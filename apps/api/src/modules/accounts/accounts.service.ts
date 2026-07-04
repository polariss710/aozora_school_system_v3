import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AccountType,
  AuditRiskLevel,
  CurrencyCode,
  Prisma,
  RecordStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import {
  AccountSnapshot,
  AccountWriteBody,
  ListAccountsQuery,
  NormalizedAccountInput,
} from "./accounts.types";

const accountSelect = {
  id: true,
  code: true,
  name: true,
  type: true,
  currency: true,
  status: true,
  memo: true,
} satisfies Prisma.AccountSelect;

const defaultLimit = 100;
const maxLimit = 500;

@Injectable()
export class AccountsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listAccounts(query: ListAccountsQuery) {
    const where = this.buildWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        orderBy: [{ status: "asc" }, { type: "asc" }, { name: "asc" }],
        take: limit,
        select: accountSelect,
      }),
      this.prisma.account.count({ where }),
    ]);

    return { items, total, limit };
  }

  async getAccount(id: string) {
    const account = await this.findAccountSnapshot(id);

    return { account };
  }

  async createAccount(body: AccountWriteBody, actorUserId: string) {
    const input = this.normalizeCreateInput(body);
    await this.assertCodeAvailable(input.code);

    const account = await this.prisma.$transaction(async (tx) => {
      const created = await tx.account.create({
        data: { ...input, status: RecordStatus.active },
        select: accountSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "account.create",
          targetType: "account",
          targetId: created.id,
          riskLevel: AuditRiskLevel.high,
          afterSnapshot: created,
        },
        tx,
      );

      return created;
    });

    return { account };
  }

  async updateAccount(id: string, body: AccountWriteBody, actorUserId: string) {
    const before = await this.findAccountSnapshot(id);
    const input = this.normalizeUpdateInput(body, before);

    if (input.code !== before.code) {
      await this.assertCodeAvailable(input.code, id);
    }

    const account = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.account.update({
        where: { id },
        data: input,
        select: accountSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "account.update",
          targetType: "account",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { account };
  }

  async archiveAccount(id: string, actorUserId: string) {
    return this.changeStatus(id, RecordStatus.archived, actorUserId);
  }

  async restoreAccount(id: string, actorUserId: string) {
    return this.changeStatus(id, RecordStatus.active, actorUserId);
  }

  private async changeStatus(
    id: string,
    status: RecordStatus,
    actorUserId: string,
  ) {
    const before = await this.findAccountSnapshot(id);

    if (before.status === status) {
      return { account: before };
    }

    const account = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.account.update({
        where: { id },
        data: { status },
        select: accountSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action:
            status === RecordStatus.archived
              ? "account.archive"
              : "account.restore",
          targetType: "account",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { account };
  }

  private async findAccountSnapshot(id: string): Promise<AccountSnapshot> {
    const account = await this.prisma.account.findUnique({
      where: { id },
      select: accountSelect,
    });

    if (!account) {
      throw new NotFoundException("Account not found.");
    }

    return account;
  }

  private async assertCodeAvailable(code: string, currentId?: string) {
    const existing = await this.prisma.account.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException("Account code already exists.");
    }
  }

  private normalizeCreateInput(body: AccountWriteBody): NormalizedAccountInput {
    return {
      code: this.normalizeCode(body.code),
      name: this.normalizeRequiredString(body.name, "name"),
      type: this.normalizeAccountType(body.type),
      currency: this.normalizeCurrencyCode(body.currency),
      memo: this.normalizeOptionalString(body.memo),
    };
  }

  private normalizeUpdateInput(
    body: AccountWriteBody,
    current: AccountSnapshot,
  ): NormalizedAccountInput {
    return {
      code:
        body.code === undefined ? current.code : this.normalizeCode(body.code),
      name:
        body.name === undefined
          ? current.name
          : this.normalizeRequiredString(body.name, "name"),
      type:
        body.type === undefined
          ? current.type
          : this.normalizeAccountType(body.type),
      currency:
        body.currency === undefined
          ? current.currency
          : this.normalizeCurrencyCode(body.currency),
      memo:
        body.memo === undefined
          ? current.memo
          : this.normalizeOptionalString(body.memo),
    };
  }

  private buildWhere(query: ListAccountsQuery): Prisma.AccountWhereInput {
    const status = this.normalizeStatus(query.status);
    const type = this.normalizeOptionalAccountType(query.type);
    const currency = this.normalizeOptionalCurrencyCode(query.currency);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(currency ? { currency } : {}),
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

  private normalizeAccountType(value: unknown) {
    if (typeof value !== "string") {
      throw new BadRequestException("type is required.");
    }

    if (!Object.values(AccountType).includes(value as AccountType)) {
      throw new BadRequestException("Invalid account type.");
    }

    return value as AccountType;
  }

  private normalizeOptionalAccountType(value: unknown) {
    const type = this.normalizeOptionalString(value);

    if (!type) {
      return undefined;
    }

    if (!Object.values(AccountType).includes(type as AccountType)) {
      return undefined;
    }

    return type as AccountType;
  }

  private normalizeCurrencyCode(value: unknown) {
    if (typeof value !== "string") {
      throw new BadRequestException("currency is required.");
    }

    if (!Object.values(CurrencyCode).includes(value as CurrencyCode)) {
      throw new BadRequestException("Invalid currency code.");
    }

    return value as CurrencyCode;
  }

  private normalizeOptionalCurrencyCode(value: unknown) {
    const currency = this.normalizeOptionalString(value);

    if (!currency) {
      return undefined;
    }

    if (!Object.values(CurrencyCode).includes(currency as CurrencyCode)) {
      return undefined;
    }

    return currency as CurrencyCode;
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
