import { AuditRiskLevel, Prisma } from "@prisma/client";

export type CreateAuditEventInput = {
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  riskLevel?: AuditRiskLevel;
  reason?: string | null;
  beforeSnapshot?: Prisma.InputJsonValue | null;
  afterSnapshot?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
  requestId?: string | null;
};

export type ListAuditEventsQuery = {
  limit?: unknown;
  action?: unknown;
  targetType?: unknown;
  targetId?: unknown;
  actorUserId?: unknown;
  riskLevel?: unknown;
};

export type ListMigrationRecordAuditsQuery = {
  targetTable?: unknown;
  targetId?: unknown;
};
