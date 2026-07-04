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
  ListTeachersQuery,
  NormalizedTeacherInput,
  TeacherSnapshot,
  TeacherWriteBody,
} from "./teachers.types";

const teacherSelect = {
  id: true,
  code: true,
  name: true,
  kanaName: true,
  status: true,
  memo: true,
} satisfies Prisma.TeacherSelect;

const defaultLimit = 100;
const maxLimit = 500;

@Injectable()
export class TeachersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listTeachers(query: ListTeachersQuery) {
    const where = this.buildWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.teacher.findMany({
        where,
        orderBy: [{ status: "asc" }, { name: "asc" }],
        take: limit,
        select: teacherSelect,
      }),
      this.prisma.teacher.count({ where }),
    ]);

    return {
      items,
      total,
      limit,
    };
  }

  async getTeacher(id: string) {
    const teacher = await this.findTeacherSnapshot(id);

    return { teacher };
  }

  async createTeacher(body: TeacherWriteBody, actorUserId: string) {
    const input = this.normalizeCreateInput(body);

    if (input.code) {
      await this.assertCodeAvailable(input.code);
    }

    const teacher = await this.prisma.$transaction(async (tx) => {
      const created = await tx.teacher.create({
        data: {
          ...input,
          status: RecordStatus.active,
        },
        select: teacherSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "teacher.create",
          targetType: "teacher",
          targetId: created.id,
          riskLevel: AuditRiskLevel.medium,
          afterSnapshot: created,
        },
        tx,
      );

      return created;
    });

    return { teacher };
  }

  async updateTeacher(id: string, body: TeacherWriteBody, actorUserId: string) {
    const before = await this.findTeacherSnapshot(id);
    const input = this.normalizeUpdateInput(body, before);

    if (input.code && input.code !== before.code) {
      await this.assertCodeAvailable(input.code, id);
    }

    const teacher = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.teacher.update({
        where: { id },
        data: input,
        select: teacherSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "teacher.update",
          targetType: "teacher",
          targetId: id,
          riskLevel: AuditRiskLevel.medium,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { teacher };
  }

  async archiveTeacher(id: string, actorUserId: string) {
    return this.changeStatus(id, RecordStatus.archived, actorUserId);
  }

  async restoreTeacher(id: string, actorUserId: string) {
    return this.changeStatus(id, RecordStatus.active, actorUserId);
  }

  private async changeStatus(
    id: string,
    status: RecordStatus,
    actorUserId: string,
  ) {
    const before = await this.findTeacherSnapshot(id);

    if (before.status === status) {
      return { teacher: before };
    }

    const teacher = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.teacher.update({
        where: { id },
        data: { status },
        select: teacherSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action:
            status === RecordStatus.archived
              ? "teacher.archive"
              : "teacher.restore",
          targetType: "teacher",
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

    return { teacher };
  }

  private async findTeacherSnapshot(id: string): Promise<TeacherSnapshot> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      select: teacherSelect,
    });

    if (!teacher) {
      throw new NotFoundException("Teacher not found.");
    }

    return teacher;
  }

  private async assertCodeAvailable(code: string, currentId?: string) {
    const existing = await this.prisma.teacher.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException("Teacher code already exists.");
    }
  }

  private normalizeCreateInput(body: TeacherWriteBody): NormalizedTeacherInput {
    return {
      code: this.normalizeOptionalCode(body.code),
      name: this.normalizeRequiredString(body.name, "name"),
      kanaName: this.normalizeOptionalString(body.kanaName),
      memo: this.normalizeOptionalString(body.memo),
    };
  }

  private normalizeUpdateInput(
    body: TeacherWriteBody,
    current: TeacherSnapshot,
  ): NormalizedTeacherInput {
    return {
      code:
        body.code === undefined
          ? current.code
          : this.normalizeOptionalCode(body.code),
      name:
        body.name === undefined
          ? current.name
          : this.normalizeRequiredString(body.name, "name"),
      kanaName:
        body.kanaName === undefined
          ? current.kanaName
          : this.normalizeOptionalString(body.kanaName),
      memo:
        body.memo === undefined
          ? current.memo
          : this.normalizeOptionalString(body.memo),
    };
  }

  private buildWhere(query: ListTeachersQuery): Prisma.TeacherWhereInput {
    const status = this.normalizeStatus(query.status);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...(status ? { status } : {}),
      ...(keyword
        ? {
            OR: [
              { code: { contains: keyword, mode: "insensitive" } },
              { name: { contains: keyword, mode: "insensitive" } },
              { kanaName: { contains: keyword, mode: "insensitive" } },
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

  private normalizeOptionalCode(value: unknown) {
    const code = this.normalizeOptionalString(value)?.toLowerCase() ?? null;

    if (code && !/^[a-z0-9][a-z0-9_:-]*$/.test(code)) {
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
