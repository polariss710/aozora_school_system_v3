import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditRiskLevel, Prisma, RecordStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import {
  ExternalWorkplaceSnapshot,
  ExternalWorkplaceWriteBody,
  ListExternalWorkplacesQuery,
  NormalizedExternalWorkplaceInput,
} from "./external-workplaces.types";

const externalWorkplaceSelect = {
  id: true,
  code: true,
  name: true,
  status: true,
  memo: true,
} satisfies Prisma.ExternalWorkplaceSelect;

const defaultLimit = 100;
const maxLimit = 500;

@Injectable()
export class ExternalWorkplacesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listExternalWorkplaces(query: ListExternalWorkplacesQuery) {
    const where = this.buildWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.externalWorkplace.findMany({
        where,
        orderBy: [{ status: "asc" }, { name: "asc" }],
        take: limit,
        select: externalWorkplaceSelect,
      }),
      this.prisma.externalWorkplace.count({ where }),
    ]);

    return { items, total, limit };
  }

  async getExternalWorkplace(id: string) {
    const externalWorkplace = await this.findExternalWorkplaceSnapshot(id);

    return { externalWorkplace };
  }

  async createExternalWorkplace(
    body: ExternalWorkplaceWriteBody,
    actorUserId: string,
  ) {
    const input = this.normalizeCreateInput(body);
    await this.assertCodeAvailable(input.code);

    const externalWorkplace = await this.prisma.$transaction(async (tx) => {
      const created = await tx.externalWorkplace.create({
        data: { ...input, status: RecordStatus.active },
        select: externalWorkplaceSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "external_workplace.create",
          targetType: "external_workplace",
          targetId: created.id,
          riskLevel: AuditRiskLevel.medium,
          afterSnapshot: created,
        },
        tx,
      );

      return created;
    });

    return { externalWorkplace };
  }

  async updateExternalWorkplace(
    id: string,
    body: ExternalWorkplaceWriteBody,
    actorUserId: string,
  ) {
    const before = await this.findExternalWorkplaceSnapshot(id);
    const input = this.normalizeUpdateInput(body, before);

    if (input.code !== before.code) {
      await this.assertCodeAvailable(input.code, id);
    }

    const externalWorkplace = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.externalWorkplace.update({
        where: { id },
        data: input,
        select: externalWorkplaceSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "external_workplace.update",
          targetType: "external_workplace",
          targetId: id,
          riskLevel: AuditRiskLevel.medium,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { externalWorkplace };
  }

  async archiveExternalWorkplace(id: string, actorUserId: string) {
    return this.changeStatus(id, RecordStatus.archived, actorUserId);
  }

  async restoreExternalWorkplace(id: string, actorUserId: string) {
    return this.changeStatus(id, RecordStatus.active, actorUserId);
  }

  private async changeStatus(
    id: string,
    status: RecordStatus,
    actorUserId: string,
  ) {
    const before = await this.findExternalWorkplaceSnapshot(id);

    if (before.status === status) {
      return { externalWorkplace: before };
    }

    const externalWorkplace = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.externalWorkplace.update({
        where: { id },
        data: { status },
        select: externalWorkplaceSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action:
            status === RecordStatus.archived
              ? "external_workplace.archive"
              : "external_workplace.restore",
          targetType: "external_workplace",
          targetId: id,
          riskLevel:
            status === RecordStatus.archived
              ? AuditRiskLevel.high
              : AuditRiskLevel.medium,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { externalWorkplace };
  }

  private async findExternalWorkplaceSnapshot(
    id: string,
  ): Promise<ExternalWorkplaceSnapshot> {
    const externalWorkplace = await this.prisma.externalWorkplace.findUnique({
      where: { id },
      select: externalWorkplaceSelect,
    });

    if (!externalWorkplace) {
      throw new NotFoundException("External workplace not found.");
    }

    return externalWorkplace;
  }

  private async assertCodeAvailable(code: string, currentId?: string) {
    const existing = await this.prisma.externalWorkplace.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException("External workplace code already exists.");
    }
  }

  private normalizeCreateInput(
    body: ExternalWorkplaceWriteBody,
  ): NormalizedExternalWorkplaceInput {
    return {
      code: this.normalizeCode(body.code),
      name: this.normalizeRequiredString(body.name, "name"),
      memo: this.normalizeOptionalString(body.memo),
    };
  }

  private normalizeUpdateInput(
    body: ExternalWorkplaceWriteBody,
    current: ExternalWorkplaceSnapshot,
  ): NormalizedExternalWorkplaceInput {
    return {
      code:
        body.code === undefined ? current.code : this.normalizeCode(body.code),
      name:
        body.name === undefined
          ? current.name
          : this.normalizeRequiredString(body.name, "name"),
      memo:
        body.memo === undefined
          ? current.memo
          : this.normalizeOptionalString(body.memo),
    };
  }

  private buildWhere(
    query: ListExternalWorkplacesQuery,
  ): Prisma.ExternalWorkplaceWhereInput {
    const status = this.normalizeStatus(query.status);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...(status ? { status } : {}),
      ...(keyword
        ? {
            OR: [
              { code: { contains: keyword, mode: "insensitive" } },
              { name: { contains: keyword, mode: "insensitive" } },
              { memo: { contains: keyword, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }

  private normalizeStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (status && Object.values(RecordStatus).includes(status as RecordStatus)) {
      return status as RecordStatus;
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

  private normalizeCode(value: unknown) {
    const code = this.normalizeRequiredString(value, "code").toLowerCase();

    if (!/^[a-z0-9][a-z0-9_:-]*$/.test(code)) {
      throw new BadRequestException(
        "code must use lowercase letters, numbers, underscore, colon, or hyphen.",
      );
    }

    return code;
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
