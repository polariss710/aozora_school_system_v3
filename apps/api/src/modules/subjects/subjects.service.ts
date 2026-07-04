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
  ListSubjectsQuery,
  NormalizedSubjectInput,
  SubjectSnapshot,
  SubjectWriteBody,
} from "./subjects.types";

const subjectSelect = {
  id: true,
  code: true,
  name: true,
  category: true,
  sortOrder: true,
  status: true,
  memo: true,
} satisfies Prisma.SubjectSelect;

const defaultLimit = 100;
const maxLimit = 500;

@Injectable()
export class SubjectsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listSubjects(query: ListSubjectsQuery) {
    const where = this.buildWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.subject.findMany({
        where,
        orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        take: limit,
        select: subjectSelect,
      }),
      this.prisma.subject.count({ where }),
    ]);

    return {
      items,
      total,
      limit,
    };
  }

  async getSubject(id: string) {
    const subject = await this.findSubjectSnapshot(id);

    return { subject };
  }

  async createSubject(body: SubjectWriteBody, actorUserId: string) {
    const input = this.normalizeCreateInput(body);
    await this.assertCodeAvailable(input.code);

    const subject = await this.prisma.$transaction(async (tx) => {
      const created = await tx.subject.create({
        data: {
          ...input,
          status: RecordStatus.active,
        },
        select: subjectSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "subject.create",
          targetType: "subject",
          targetId: created.id,
          riskLevel: AuditRiskLevel.medium,
          afterSnapshot: created,
        },
        tx,
      );

      return created;
    });

    return { subject };
  }

  async updateSubject(id: string, body: SubjectWriteBody, actorUserId: string) {
    const before = await this.findSubjectSnapshot(id);
    const input = this.normalizeUpdateInput(body, before);

    if (input.code !== before.code) {
      await this.assertCodeAvailable(input.code, id);
    }

    const subject = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.subject.update({
        where: { id },
        data: input,
        select: subjectSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "subject.update",
          targetType: "subject",
          targetId: id,
          riskLevel: AuditRiskLevel.medium,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { subject };
  }

  async archiveSubject(id: string, actorUserId: string) {
    return this.changeStatus(id, RecordStatus.archived, actorUserId);
  }

  async restoreSubject(id: string, actorUserId: string) {
    return this.changeStatus(id, RecordStatus.active, actorUserId);
  }

  private async changeStatus(
    id: string,
    status: RecordStatus,
    actorUserId: string,
  ) {
    const before = await this.findSubjectSnapshot(id);

    if (before.status === status) {
      return { subject: before };
    }

    const subject = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.subject.update({
        where: { id },
        data: { status },
        select: subjectSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action:
            status === RecordStatus.archived
              ? "subject.archive"
              : "subject.restore",
          targetType: "subject",
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

    return { subject };
  }

  private async findSubjectSnapshot(id: string): Promise<SubjectSnapshot> {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      select: subjectSelect,
    });

    if (!subject) {
      throw new NotFoundException("Subject not found.");
    }

    return subject;
  }

  private async assertCodeAvailable(code: string, currentId?: string) {
    const existing = await this.prisma.subject.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException("Subject code already exists.");
    }
  }

  private normalizeCreateInput(body: SubjectWriteBody): NormalizedSubjectInput {
    return {
      code: this.normalizeCode(body.code),
      name: this.normalizeRequiredString(body.name, "name"),
      category: this.normalizeOptionalString(body.category),
      sortOrder: this.normalizeSortOrder(body.sortOrder),
      memo: this.normalizeOptionalString(body.memo),
    };
  }

  private normalizeUpdateInput(
    body: SubjectWriteBody,
    current: SubjectSnapshot,
  ): NormalizedSubjectInput {
    return {
      code:
        body.code === undefined ? current.code : this.normalizeCode(body.code),
      name:
        body.name === undefined
          ? current.name
          : this.normalizeRequiredString(body.name, "name"),
      category:
        body.category === undefined
          ? current.category
          : this.normalizeOptionalString(body.category),
      sortOrder:
        body.sortOrder === undefined
          ? current.sortOrder
          : this.normalizeSortOrder(body.sortOrder),
      memo:
        body.memo === undefined
          ? current.memo
          : this.normalizeOptionalString(body.memo),
    };
  }

  private buildWhere(query: ListSubjectsQuery): Prisma.SubjectWhereInput {
    const status = this.normalizeStatus(query.status);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...(status ? { status } : {}),
      ...(keyword
        ? {
            OR: [
              { code: { contains: keyword, mode: "insensitive" } },
              { name: { contains: keyword, mode: "insensitive" } },
              { category: { contains: keyword, mode: "insensitive" } },
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

  private normalizeSortOrder(value: unknown) {
    if (value === undefined || value === null || value === "") {
      return 0;
    }

    const parsed =
      typeof value === "number" ? value : Number.parseInt(String(value), 10);

    if (!Number.isInteger(parsed)) {
      throw new BadRequestException("sortOrder must be an integer.");
    }

    return parsed;
  }
}
