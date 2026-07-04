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
  ListStudentsQuery,
  NormalizedStudentInput,
  StudentSnapshot,
  StudentWriteBody,
} from "./students.types";

const studentSelect = {
  id: true,
  code: true,
  name: true,
  kanaName: true,
  status: true,
  primaryBusinessEntityId: true,
  primaryBusinessEntity: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  memo: true,
} satisfies Prisma.StudentSelect;

const defaultLimit = 100;
const maxLimit = 500;

@Injectable()
export class StudentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listStudents(query: ListStudentsQuery) {
    const where = this.buildWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        orderBy: [{ status: "asc" }, { name: "asc" }],
        take: limit,
        select: studentSelect,
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      items,
      total,
      limit,
    };
  }

  async getStudent(id: string) {
    const student = await this.findStudentSnapshot(id);

    return { student };
  }

  async createStudent(body: StudentWriteBody, actorUserId: string) {
    const input = this.normalizeCreateInput(body);

    if (input.code) {
      await this.assertCodeAvailable(input.code);
    }

    if (input.primaryBusinessEntityId) {
      await this.assertBusinessEntityExists(input.primaryBusinessEntityId);
    }

    const student = await this.prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          ...input,
          status: RecordStatus.active,
        },
        select: studentSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "student.create",
          targetType: "student",
          targetId: created.id,
          riskLevel: AuditRiskLevel.medium,
          afterSnapshot: created,
        },
        tx,
      );

      return created;
    });

    return { student };
  }

  async updateStudent(id: string, body: StudentWriteBody, actorUserId: string) {
    const before = await this.findStudentSnapshot(id);
    const input = this.normalizeUpdateInput(body, before);

    if (input.code && input.code !== before.code) {
      await this.assertCodeAvailable(input.code, id);
    }

    if (
      input.primaryBusinessEntityId &&
      input.primaryBusinessEntityId !== before.primaryBusinessEntityId
    ) {
      await this.assertBusinessEntityExists(input.primaryBusinessEntityId);
    }

    const student = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.student.update({
        where: { id },
        data: input,
        select: studentSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "student.update",
          targetType: "student",
          targetId: id,
          riskLevel: AuditRiskLevel.medium,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { student };
  }

  async archiveStudent(id: string, actorUserId: string) {
    return this.changeStatus(id, RecordStatus.archived, actorUserId);
  }

  async restoreStudent(id: string, actorUserId: string) {
    return this.changeStatus(id, RecordStatus.active, actorUserId);
  }

  private async changeStatus(
    id: string,
    status: RecordStatus,
    actorUserId: string,
  ) {
    const before = await this.findStudentSnapshot(id);

    if (before.status === status) {
      return { student: before };
    }

    const student = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.student.update({
        where: { id },
        data: { status },
        select: studentSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action:
            status === RecordStatus.archived
              ? "student.archive"
              : "student.restore",
          targetType: "student",
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

    return { student };
  }

  private async findStudentSnapshot(id: string): Promise<StudentSnapshot> {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: studentSelect,
    });

    if (!student) {
      throw new NotFoundException("Student not found.");
    }

    return student;
  }

  private async assertCodeAvailable(code: string, currentId?: string) {
    const existing = await this.prisma.student.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException("Student code already exists.");
    }
  }

  private async assertBusinessEntityExists(id: string) {
    const existing = await this.prisma.businessEntity.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new BadRequestException("primaryBusinessEntityId does not exist.");
    }
  }

  private normalizeCreateInput(body: StudentWriteBody): NormalizedStudentInput {
    return {
      code: this.normalizeOptionalCode(body.code),
      name: this.normalizeRequiredString(body.name, "name"),
      kanaName: this.normalizeOptionalString(body.kanaName),
      primaryBusinessEntityId: this.normalizeOptionalString(
        body.primaryBusinessEntityId,
      ),
      memo: this.normalizeOptionalString(body.memo),
    };
  }

  private normalizeUpdateInput(
    body: StudentWriteBody,
    current: StudentSnapshot,
  ): NormalizedStudentInput {
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
      primaryBusinessEntityId:
        body.primaryBusinessEntityId === undefined
          ? current.primaryBusinessEntityId
          : this.normalizeOptionalString(body.primaryBusinessEntityId),
      memo:
        body.memo === undefined
          ? current.memo
          : this.normalizeOptionalString(body.memo),
    };
  }

  private buildWhere(query: ListStudentsQuery): Prisma.StudentWhereInput {
    const status = this.normalizeStatus(query.status);
    const keyword = this.normalizeOptionalString(query.keyword);
    const primaryBusinessEntityId = this.normalizeOptionalString(
      query.primaryBusinessEntityId,
    );

    return {
      ...(status ? { status } : {}),
      ...(primaryBusinessEntityId ? { primaryBusinessEntityId } : {}),
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
