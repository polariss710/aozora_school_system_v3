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
  BusinessEntitySnapshot,
  BusinessEntityWriteBody,
  ListBusinessEntitiesQuery,
  NormalizedBusinessEntityInput,
} from "./business-entities.types";

const businessEntitySelect = {
  id: true,
  code: true,
  name: true,
  status: true,
  memo: true,
} satisfies Prisma.BusinessEntitySelect;

const defaultLimit = 100;
const maxLimit = 500;

@Injectable()
export class BusinessEntitiesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listBusinessEntities(query: ListBusinessEntitiesQuery) {
    const where = this.buildWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.businessEntity.findMany({
        where,
        orderBy: [{ status: "asc" }, { name: "asc" }],
        take: limit,
        select: businessEntitySelect,
      }),
      this.prisma.businessEntity.count({ where }),
    ]);

    return { items, total, limit };
  }

  async getBusinessEntity(id: string) {
    const businessEntity = await this.findBusinessEntitySnapshot(id);

    return { businessEntity };
  }

  async createBusinessEntity(
    body: BusinessEntityWriteBody,
    actorUserId: string,
  ) {
    const input = this.normalizeCreateInput(body);
    await this.assertCodeAvailable(input.code);

    const businessEntity = await this.prisma.$transaction(async (tx) => {
      const created = await tx.businessEntity.create({
        data: { ...input, status: RecordStatus.active },
        select: businessEntitySelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "business_entity.create",
          targetType: "business_entity",
          targetId: created.id,
          riskLevel: AuditRiskLevel.high,
          afterSnapshot: created,
        },
        tx,
      );

      return created;
    });

    return { businessEntity };
  }

  async updateBusinessEntity(
    id: string,
    body: BusinessEntityWriteBody,
    actorUserId: string,
  ) {
    const before = await this.findBusinessEntitySnapshot(id);
    const input = this.normalizeUpdateInput(body, before);

    if (input.code !== before.code) {
      await this.assertCodeAvailable(input.code, id);
    }

    const businessEntity = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.businessEntity.update({
        where: { id },
        data: input,
        select: businessEntitySelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "business_entity.update",
          targetType: "business_entity",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { businessEntity };
  }

  async archiveBusinessEntity(id: string, actorUserId: string) {
    return this.changeStatus(id, RecordStatus.archived, actorUserId);
  }

  async restoreBusinessEntity(id: string, actorUserId: string) {
    return this.changeStatus(id, RecordStatus.active, actorUserId);
  }

  private async changeStatus(
    id: string,
    status: RecordStatus,
    actorUserId: string,
  ) {
    const before = await this.findBusinessEntitySnapshot(id);

    if (before.status === status) {
      return { businessEntity: before };
    }

    const businessEntity = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.businessEntity.update({
        where: { id },
        data: { status },
        select: businessEntitySelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action:
            status === RecordStatus.archived
              ? "business_entity.archive"
              : "business_entity.restore",
          targetType: "business_entity",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { businessEntity };
  }

  private async findBusinessEntitySnapshot(
    id: string,
  ): Promise<BusinessEntitySnapshot> {
    const businessEntity = await this.prisma.businessEntity.findUnique({
      where: { id },
      select: businessEntitySelect,
    });

    if (!businessEntity) {
      throw new NotFoundException("Business entity not found.");
    }

    return businessEntity;
  }

  private async assertCodeAvailable(code: string, currentId?: string) {
    const existing = await this.prisma.businessEntity.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException("Business entity code already exists.");
    }
  }

  private normalizeCreateInput(
    body: BusinessEntityWriteBody,
  ): NormalizedBusinessEntityInput {
    return {
      code: this.normalizeCode(body.code),
      name: this.normalizeRequiredString(body.name, "name"),
      memo: this.normalizeOptionalString(body.memo),
    };
  }

  private normalizeUpdateInput(
    body: BusinessEntityWriteBody,
    current: BusinessEntitySnapshot,
  ): NormalizedBusinessEntityInput {
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
    query: ListBusinessEntitiesQuery,
  ): Prisma.BusinessEntityWhereInput {
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
