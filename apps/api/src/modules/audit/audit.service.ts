import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AuditRiskLevel, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { CreateAuditEventInput, ListAuditEventsQuery } from "./audit.types";

const defaultLimit = 50;
const maxLimit = 200;
type AuditEventWriter = Pick<Prisma.TransactionClient, "auditEvent">;

const auditEventSelect = {
  id: true,
  action: true,
  targetType: true,
  targetId: true,
  riskLevel: true,
  reason: true,
  beforeSnapshot: true,
  afterSnapshot: true,
  metadata: true,
  requestId: true,
  createdAt: true,
  actorUser: {
    select: {
      id: true,
      email: true,
      displayName: true,
    },
  },
} satisfies Prisma.AuditEventSelect;

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async recordEvent(
    input: CreateAuditEventInput,
    client: AuditEventWriter = this.prisma,
  ) {
    return client.auditEvent.create({
      data: this.buildCreateData(input),
    });
  }

  async listEvents(query: ListAuditEventsQuery) {
    const where = this.buildWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        select: auditEventSelect,
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    return {
      items,
      total,
      limit,
    };
  }

  async getEvent(id: string) {
    const event = await this.prisma.auditEvent.findUnique({
      where: { id },
      select: auditEventSelect,
    });

    if (!event) {
      throw new NotFoundException("Audit event not found.");
    }

    return { event };
  }

  private buildWhere(query: ListAuditEventsQuery): Prisma.AuditEventWhereInput {
    const action = this.normalizeString(query.action);
    const targetType = this.normalizeString(query.targetType);
    const targetId = this.normalizeString(query.targetId);
    const actorUserId = this.normalizeString(query.actorUserId);
    const riskLevel = this.normalizeRiskLevel(query.riskLevel);

    return {
      ...(action ? { action } : {}),
      ...(targetType ? { targetType } : {}),
      ...(targetId ? { targetId } : {}),
      ...(actorUserId ? { actorUserId } : {}),
      ...(riskLevel ? { riskLevel } : {}),
    };
  }

  private buildCreateData(input: CreateAuditEventInput) {
    return {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      riskLevel: input.riskLevel ?? AuditRiskLevel.low,
      reason: input.reason ?? null,
      beforeSnapshot: input.beforeSnapshot ?? Prisma.JsonNull,
      afterSnapshot: input.afterSnapshot ?? Prisma.JsonNull,
      metadata: input.metadata ?? Prisma.JsonNull,
      requestId: input.requestId ?? null,
    };
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

  private normalizeString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private normalizeRiskLevel(value: unknown) {
    const riskLevel = this.normalizeString(value);

    if (
      riskLevel &&
      Object.values(AuditRiskLevel).includes(riskLevel as AuditRiskLevel)
    ) {
      return riskLevel as AuditRiskLevel;
    }

    return undefined;
  }
}
