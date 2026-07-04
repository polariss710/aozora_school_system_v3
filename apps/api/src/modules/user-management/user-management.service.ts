import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AuditRiskLevel,
  Prisma,
  RecordStatus,
  UserStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PasswordService } from "../auth/password.service";
import { PrismaService } from "../database/prisma.service";
import {
  ListUsersQuery,
  NormalizedUserInput,
  UserPasswordBody,
  UserSnapshot,
  UserWriteBody,
} from "./user-management.types";

const defaultLimit = 100;
const maxLimit = 500;
const adminRoleCode = "admin";

const userSelect = {
  id: true,
  email: true,
  displayName: true,
  status: true,
  memo: true,
  userRoles: {
    include: {
      role: {
        select: {
          code: true,
          name: true,
          status: true,
        },
      },
    },
    orderBy: {
      role: {
        code: "asc",
      },
    },
  },
} satisfies Prisma.UserSelect;

type SelectedUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

@Injectable()
export class UserManagementService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listUsers(query: ListUsersQuery) {
    const where = this.buildWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ status: "asc" }, { displayName: "asc" }],
        take: limit,
        select: userSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toSnapshot(item)),
      total,
      limit,
    };
  }

  async getUser(id: string) {
    const user = await this.findUserSnapshot(id);

    return { user };
  }

  async createUser(body: UserWriteBody, actorUserId: string) {
    const input = this.normalizeCreateInput(body);
    await this.assertEmailAvailable(input.email);
    const roles = await this.resolveActiveRoles(input.roleCodes);
    const passwordHash = await this.passwordService.hashPassword(
      input.password ?? "",
    );

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          displayName: input.displayName,
          passwordHash,
          status: UserStatus.active,
          memo: input.memo,
          userRoles: {
            createMany: {
              data: roles.map((role) => ({ roleId: role.id })),
            },
          },
        },
        select: userSelect,
      });
      const after = this.toSnapshot(created);

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "user.create",
          targetType: "user",
          targetId: created.id,
          riskLevel: AuditRiskLevel.high,
          afterSnapshot: after,
        },
        tx,
      );

      return after;
    });

    return { user };
  }

  async updateUser(id: string, body: UserWriteBody, actorUserId: string) {
    const before = await this.findUserSnapshot(id);
    const input = this.normalizeUpdateInput(body, before);

    if (input.email !== before.email) {
      await this.assertEmailAvailable(input.email, id);
    }

    const roles = await this.resolveActiveRoles(input.roleCodes);
    await this.assertAdminRoleWillRemain(before, input.roleCodes);

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({
        data: roles.map((role) => ({ userId: id, roleId: role.id })),
      });

      const updated = await tx.user.update({
        where: { id },
        data: {
          email: input.email,
          displayName: input.displayName,
          memo: input.memo,
        },
        select: userSelect,
      });
      const after = this.toSnapshot(updated);

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "user.update",
          targetType: "user",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: before,
          afterSnapshot: after,
        },
        tx,
      );

      return after;
    });

    return { user };
  }

  async updatePassword(
    id: string,
    body: UserPasswordBody,
    actorUserId: string,
  ) {
    const before = await this.findUserSnapshot(id);
    const password = this.normalizePassword(body.password);
    const passwordHash = await this.passwordService.hashPassword(password);

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { passwordHash },
        select: userSelect,
      });
      const after = this.toSnapshot(updated);

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "user.password_update",
          targetType: "user",
          targetId: id,
          riskLevel: AuditRiskLevel.critical,
          beforeSnapshot: before,
          afterSnapshot: after,
          metadata: { passwordChanged: true },
        },
        tx,
      );

      return after;
    });

    return { user };
  }

  async suspendUser(id: string, actorUserId: string) {
    return this.changeStatus(id, UserStatus.suspended, actorUserId);
  }

  async activateUser(id: string, actorUserId: string) {
    return this.changeStatus(id, UserStatus.active, actorUserId);
  }

  private async changeStatus(
    id: string,
    status: UserStatus,
    actorUserId: string,
  ) {
    const before = await this.findUserSnapshot(id);

    if (before.status === status) {
      return { user: before };
    }

    if (before.status === UserStatus.active && status !== UserStatus.active) {
      await this.assertAdminRoleWillRemain(before, before.roleCodes, status);
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { status },
        select: userSelect,
      });
      const after = this.toSnapshot(updated);

      await this.auditService.recordEvent(
        {
          actorUserId,
          action:
            status === UserStatus.active ? "user.activate" : "user.suspend",
          targetType: "user",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: before,
          afterSnapshot: after,
        },
        tx,
      );

      return after;
    });

    return { user };
  }

  private async findUserSnapshot(id: string): Promise<UserSnapshot> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    return this.toSnapshot(user);
  }

  private async assertEmailAvailable(email: string, currentId?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException("User email already exists.");
    }
  }

  private async resolveActiveRoles(roleCodes: string[]) {
    const roles = await this.prisma.role.findMany({
      where: {
        code: { in: roleCodes },
        status: RecordStatus.active,
      },
      select: {
        id: true,
        code: true,
      },
    });

    const foundCodes = new Set(roles.map((role) => role.code));
    const missingCodes = roleCodes.filter((roleCode) => !foundCodes.has(roleCode));

    if (missingCodes.length > 0) {
      throw new BadRequestException(
        `Unknown or inactive role codes: ${missingCodes.join(", ")}`,
      );
    }

    return roles;
  }

  private async assertAdminRoleWillRemain(
    before: UserSnapshot,
    nextRoleCodes: string[],
    nextStatus: UserStatus = before.status,
  ) {
    const wasActiveAdmin =
      before.status === UserStatus.active &&
      before.roleCodes.includes(adminRoleCode);
    const willRemainActiveAdmin =
      nextStatus === UserStatus.active && nextRoleCodes.includes(adminRoleCode);

    if (!wasActiveAdmin || willRemainActiveAdmin) {
      return;
    }

    const activeAdminCount = await this.prisma.user.count({
      where: {
        id: { not: before.id },
        status: UserStatus.active,
        userRoles: {
          some: {
            role: {
              code: adminRoleCode,
              status: RecordStatus.active,
            },
          },
        },
      },
    });

    if (activeAdminCount < 1) {
      throw new BadRequestException("At least one active admin user is required.");
    }
  }

  private toSnapshot(user: SelectedUser): UserSnapshot {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      memo: user.memo,
      roleCodes: user.userRoles.map((userRole) => userRole.role.code),
    };
  }

  private normalizeCreateInput(body: UserWriteBody): NormalizedUserInput {
    return {
      email: this.normalizeEmail(body.email),
      displayName: this.normalizeRequiredString(
        body.displayName,
        "displayName",
      ),
      password: this.normalizePassword(body.password),
      roleCodes: this.normalizeRoleCodes(body.roleCodes),
      memo: this.normalizeOptionalString(body.memo),
    };
  }

  private normalizeUpdateInput(
    body: UserWriteBody,
    current: UserSnapshot,
  ): NormalizedUserInput {
    return {
      email:
        body.email === undefined
          ? current.email
          : this.normalizeEmail(body.email),
      displayName:
        body.displayName === undefined
          ? current.displayName
          : this.normalizeRequiredString(body.displayName, "displayName"),
      password: null,
      roleCodes:
        body.roleCodes === undefined
          ? current.roleCodes
          : this.normalizeRoleCodes(body.roleCodes),
      memo:
        body.memo === undefined
          ? current.memo
          : this.normalizeOptionalString(body.memo),
    };
  }

  private buildWhere(query: ListUsersQuery): Prisma.UserWhereInput {
    const status = this.normalizeStatus(query.status);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...(status ? { status } : {}),
      ...(keyword
        ? {
            OR: [
              { email: { contains: keyword, mode: "insensitive" } },
              { displayName: { contains: keyword, mode: "insensitive" } },
              { memo: { contains: keyword, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }

  private normalizeStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (status && Object.values(UserStatus).includes(status as UserStatus)) {
      return status as UserStatus;
    }

    return undefined;
  }

  private normalizeLimit(value: unknown) {
    if (typeof value !== "string") {
      return defaultLimit;
    }

    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed) || parsed < 1) {
      return defaultLimit;
    }

    return Math.min(parsed, maxLimit);
  }

  private normalizeEmail(value: unknown) {
    const email = this.normalizeRequiredString(value, "email").toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("Invalid email.");
    }

    return email;
  }

  private normalizePassword(value: unknown) {
    if (typeof value !== "string" || value.length < 10) {
      throw new BadRequestException("password must be at least 10 characters.");
    }

    return value;
  }

  private normalizeRoleCodes(value: unknown) {
    if (!Array.isArray(value)) {
      throw new BadRequestException("roleCodes must be an array.");
    }

    const roleCodes = [
      ...new Set(
        value.map((item) => {
          if (typeof item !== "string" || !item.trim()) {
            throw new BadRequestException("roleCodes must contain strings.");
          }

          return item.trim().toLowerCase();
        }),
      ),
    ];

    if (roleCodes.length < 1) {
      throw new BadRequestException("At least one role is required.");
    }

    return roleCodes;
  }

  private normalizeRequiredString(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(`${field} is required.`);
    }

    return value.trim();
  }

  private normalizeOptionalString(value: unknown) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== "string") {
      throw new BadRequestException("Expected a string value.");
    }

    return value.trim() || null;
  }
}
