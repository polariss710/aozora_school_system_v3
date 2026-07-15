import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AccountTransactionDirection,
  AccountTransactionStatus,
  AuditRiskLevel,
  CashInboundEventStatus,
  CashRequestStatus,
  CurrencyCode,
  ExternalWorkSettlementStatus,
  IncomeRecordStatus,
  Prisma,
  RecordStatus,
  TuitionBillStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { resolveOperationalBusinessEntityId } from "../business-entities/business-ownership.policy";
import { PrismaService } from "../database/prisma.service";
import { MoneyService } from "../money/money.service";
import {
  ListIncomeRecordsQuery,
  ManualIncomeBody,
  VoidIncomeRecordBody,
} from "./income.types";
import { AuthenticatedUser } from "../users/users.types";

const defaultLimit = 100;
const maxLimit = 500;
const manualIncomeSourceType = "manual_income";
const tuitionBillSourceType = "student_tuition_bill";
const externalWorkSourceType = "external_work";

const receiptCashRequestStatuses = [
  CashRequestStatus.cash_confirmed,
  CashRequestStatus.account_transaction_created,
];

const receiptRecordSelect = {
  id: true,
  receiptNo: true,
  incomeRecordId: true,
  issuedAt: true,
  snapshotIssuedByName: true,
  snapshotPaymentDate: true,
  snapshotCurrency: true,
  snapshotAmountJpy: true,
  snapshotAmountCny: true,
  snapshotStudentName: true,
  snapshotBusinessEntityName: true,
  snapshotItem: true,
  snapshotDescription: true,
  snapshotBusinessMonth: true,
  snapshotIncomeTitle: true,
  snapshotMemo: true,
  authoritySource: true,
  sourceCashRequestId: true,
  sourceAccountTransactionId: true,
  externalCashRequestId: true,
  externalCashEventId: true,
  pdfMetadata: true,
  incomeRecord: {
    select: {
      studentId: true,
    },
  },
} satisfies Prisma.ReceiptRecordSelect;

type ReceiptRecordSnapshot = Prisma.ReceiptRecordGetPayload<{
  select: typeof receiptRecordSelect;
}>;

const incomeRecordSelect = {
  id: true,
  sourceType: true,
  sourceId: true,
  studentId: true,
  businessEntityId: true,
  yearMonth: true,
  title: true,
  originalCurrency: true,
  originalAmountJpy: true,
  originalAmountCny: true,
  carryoverAmountCny: true,
  recordStatus: true,
  cashStatus: true,
  memo: true,
  createdAt: true,
  updatedAt: true,
  student: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  businessEntity: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  tuitionBill: {
    select: {
      id: true,
      status: true,
      plannedAmountJpy: true,
      carryoverAmountCny: true,
    },
  },
  cashRequests: {
    where: { status: { in: receiptCashRequestStatuses } },
    orderBy: [{ updatedAt: "desc" as const }],
    take: 1,
    select: {
      id: true,
      status: true,
      requestedCurrency: true,
      requestedAmountJpy: true,
      requestedAmountCny: true,
      externalCashRequestId: true,
      externalCashEventId: true,
      externalCashTransactionId: true,
      cashConfirmedAt: true,
      updatedAt: true,
    },
  },
  accountTransactions: {
    where: {
      direction: AccountTransactionDirection.in,
      status: AccountTransactionStatus.active,
    },
    orderBy: [{ transactionDate: "desc" as const }, { createdAt: "desc" as const }],
    take: 1,
    select: {
      id: true,
      transactionDate: true,
      currency: true,
      amountJpy: true,
      amountCny: true,
      externalEventId: true,
    },
  },
  receiptRecords: {
    orderBy: [{ issuedAt: "desc" as const }],
    take: 1,
    select: {
      id: true,
      receiptNo: true,
      issuedAt: true,
    },
  },
} satisfies Prisma.IncomeRecordSelect;

type IncomeRecordSnapshot = Prisma.IncomeRecordGetPayload<{
  select: typeof incomeRecordSelect;
}>;

@Injectable()
export class IncomeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MoneyService) private readonly moneyService: MoneyService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listIncomeRecords(query: ListIncomeRecordsQuery) {
    const where = this.buildWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.incomeRecord.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        take: limit,
        select: incomeRecordSelect,
      }),
      this.prisma.incomeRecord.count({ where }),
    ]);

    return {
      items: items.map((item) => this.withReceiptEligibility(item)),
      total,
      limit,
    };
  }

  async getIncomeRecord(id: string) {
    const incomeRecord = await this.findIncomeRecord(id);

    return { incomeRecord: this.withReceiptEligibility(incomeRecord) };
  }

  async getTuitionReceipt(id: string) {
    const receiptRecord = await this.findReceiptRecordByIncomeId(id);

    if (receiptRecord) {
      return { receipt: this.toSnapshotReceipt(receiptRecord) };
    }

    const incomeRecord = await this.findIncomeRecord(id);
    return { receipt: await this.buildLiveTuitionReceipt(incomeRecord) };
  }

  async issueTuitionReceipt(id: string, actor: AuthenticatedUser) {
    const existing = await this.findReceiptRecordByIncomeId(id);

    if (existing) {
      return { receipt: this.toSnapshotReceipt(existing), created: false };
    }

    const incomeRecord = await this.findIncomeRecord(id);
    const liveReceipt = await this.buildLiveTuitionReceipt(incomeRecord);
    const issuedAt = new Date();

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const sequenceRows = await tx.$queryRaw<Array<{ receipt_serial: bigint }>>`
          SELECT nextval(pg_get_serial_sequence('receipt_records', 'receipt_serial')) AS receipt_serial
        `;
        const receiptSerial = sequenceRows[0]?.receipt_serial;

        if (receiptSerial === undefined) {
          throw new BadRequestException("无法生成收据编号，请稍后重试。");
        }

        const receiptRecord = await tx.receiptRecord.create({
          data: {
            receiptSerial,
            receiptNo: this.formatReceiptNo(issuedAt, receiptSerial),
            incomeRecordId: incomeRecord.id,
            issuedAt,
            issuedById: actor.id,
            snapshotIssuedByName: actor.displayName,
            snapshotPaymentDate: new Date(`${liveReceipt.paymentDate}T00:00:00.000Z`),
            snapshotCurrency: liveReceipt.paymentCurrency,
            snapshotAmountJpy: liveReceipt.paymentAmountJpy,
            snapshotAmountCny: liveReceipt.paymentAmountCny,
            snapshotStudentName: liveReceipt.studentName,
            snapshotBusinessEntityName: liveReceipt.businessEntityName,
            snapshotItem: liveReceipt.itemName,
            snapshotDescription: liveReceipt.description,
            snapshotBusinessMonth: liveReceipt.businessMonth,
            snapshotIncomeTitle: liveReceipt.incomeTitle,
            snapshotMemo: liveReceipt.memo,
            authoritySource: liveReceipt.authoritySource,
            sourceCashRequestId: liveReceipt.cashRequestId,
            sourceAccountTransactionId: liveReceipt.cashTransactionId,
            externalCashRequestId: liveReceipt.externalCashRequestId,
            externalCashEventId: liveReceipt.externalCashEventId,
            pdfMetadata: liveReceipt.pdfMetadata,
          },
          select: receiptRecordSelect,
        });

        await this.auditService.recordEvent(
          {
            actorUserId: actor.id,
            action: "tuition_receipt.issue",
            targetType: "receipt_record",
            targetId: receiptRecord.id,
            riskLevel: AuditRiskLevel.medium,
            afterSnapshot: receiptRecord,
            metadata: {
              incomeRecordId: incomeRecord.id,
              receiptNo: receiptRecord.receiptNo,
            },
          },
          tx,
        );

        return receiptRecord;
      });

      return { receipt: this.toSnapshotReceipt(created), created: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const concurrentReceipt = await this.findReceiptRecordByIncomeId(id);
        if (concurrentReceipt) {
          return { receipt: this.toSnapshotReceipt(concurrentReceipt), created: false };
        }
      }

      throw error;
    }
  }

  async listTuitionReceipts(id: string) {
    await this.assertIncomeRecordExists(id);
    const receiptRecords = await this.prisma.receiptRecord.findMany({
      where: { incomeRecordId: id },
      orderBy: [{ issuedAt: "desc" }],
      select: receiptRecordSelect,
    });

    return {
      items: receiptRecords.map((record) => this.toSnapshotReceipt(record)),
      total: receiptRecords.length,
    };
  }

  async getIssuedTuitionReceipt(id: string, receiptId: string) {
    const receiptRecord = await this.prisma.receiptRecord.findFirst({
      where: { id: receiptId, incomeRecordId: id },
      select: receiptRecordSelect,
    });

    if (!receiptRecord) {
      throw new NotFoundException("Receipt record not found.");
    }

    return { receipt: this.toSnapshotReceipt(receiptRecord) };
  }

  private async buildLiveTuitionReceipt(incomeRecord: IncomeRecordSnapshot) {
    const eligibility = this.getReceiptEligibility(incomeRecord);

    if (!eligibility.eligible) {
      throw new BadRequestException(eligibility.reason);
    }

    const cashRequest = incomeRecord.cashRequests[0];
    const accountTransaction = incomeRecord.accountTransactions[0] ?? null;
    const cashInboundEvent = accountTransaction
      ? null
      : await this.prisma.cashInboundEvent.findFirst({
          where: {
            linkedIncomeRecordIds: { has: incomeRecord.id },
            status: CashInboundEventStatus.account_transaction_created,
          },
          orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            externalCashEventId: true,
            eventDate: true,
          },
        });

    const paymentCurrency = accountTransaction?.currency ?? cashRequest.requestedCurrency;
    const paymentAmountJpy =
      paymentCurrency === CurrencyCode.JPY
        ? accountTransaction?.amountJpy ?? cashRequest.requestedAmountJpy
        : null;
    const paymentAmountCny =
      paymentCurrency === CurrencyCode.CNY
        ? accountTransaction?.amountCny ?? cashRequest.requestedAmountCny
        : null;

    if (
      (paymentCurrency === CurrencyCode.JPY && (!paymentAmountJpy || paymentAmountJpy <= 0)) ||
      (paymentCurrency === CurrencyCode.CNY &&
        (!paymentAmountCny || new Prisma.Decimal(paymentAmountCny).lessThanOrEqualTo(0)))
    ) {
      throw new BadRequestException("Cash 确认金额无效，不能生成收据。");
    }

    const paymentDate =
      accountTransaction?.transactionDate ??
      cashInboundEvent?.eventDate ??
      cashRequest.cashConfirmedAt ??
      cashRequest.updatedAt;
    const description = incomeRecord.yearMonth
      ? `${this.formatYearMonth(incomeRecord.yearMonth)} 学费`
      : "学费";

    return {
      receiptRecordId: null,
      receiptNo: null,
      issuedAt: null,
      issuedByName: null,
      snapshotLocked: false,
      incomeRecordId: incomeRecord.id,
      studentId: incomeRecord.student!.id,
      studentName: incomeRecord.student!.name,
      businessEntityName: incomeRecord.businessEntity?.name ?? "青空进学塾",
      businessMonth: incomeRecord.yearMonth,
      itemName: "学费",
      description,
      paymentDate: paymentDate.toISOString().slice(0, 10),
      paymentCurrency,
      paymentAmountJpy,
      paymentAmountCny,
      incomeTitle: incomeRecord.title,
      memo: incomeRecord.memo,
      authoritySource: accountTransaction
        ? "account_transaction"
        : cashInboundEvent
          ? "cash_inbound"
          : "cash_confirmation",
      cashRequestId: cashRequest.id,
      cashTransactionId: accountTransaction?.id ?? null,
      externalCashRequestId: cashRequest.externalCashRequestId,
      externalCashEventId:
        accountTransaction?.externalEventId ??
        cashInboundEvent?.externalCashEventId ??
        cashRequest.externalCashTransactionId ??
        cashRequest.externalCashEventId,
      pdfMetadata: {
        layoutVersion: "tuition_receipt_v1",
        pageSize: "A4",
        locale: "ja-JP",
      },
    };
  }

  async createManualIncome(body: ManualIncomeBody, actorUserId: string) {
    const input = await this.normalizeManualIncome(body);

    const incomeRecord = await this.prisma.$transaction(async (tx) => {
      const created = await tx.incomeRecord.create({
        data: {
          ...input,
          sourceType: manualIncomeSourceType,
          sourceId: null,
          carryoverAmountCny: null,
          recordStatus: IncomeRecordStatus.pending,
          cashStatus: CashRequestStatus.not_requested,
        },
        select: incomeRecordSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "income_record.create_manual",
          targetType: "income_record",
          targetId: created.id,
          riskLevel: AuditRiskLevel.high,
          afterSnapshot: created,
        },
        tx,
      );

      return created;
    });

    return { incomeRecord };
  }

  async voidIncomeRecord(
    id: string,
    body: VoidIncomeRecordBody,
    actorUserId: string,
  ) {
    const before = await this.findIncomeRecord(id);

    if (before.recordStatus !== IncomeRecordStatus.pending) {
      throw new BadRequestException("Only pending income can be voided.");
    }

    this.assertIncomeCanBeVoided(before);

    const shouldReverseAccountTransaction =
      before.cashStatus === CashRequestStatus.account_transaction_created;

    if (
      shouldReverseAccountTransaction &&
      before.sourceType !== manualIncomeSourceType
    ) {
      throw new BadRequestException(
        "Only manual income account transaction can be voided from income.",
      );
    }

    const reason = this.normalizeOptionalString(body.reason);

    const incomeRecord = await this.prisma.$transaction(async (tx) => {
      let reversedAccountTransactionIds: string[] = [];

      if (shouldReverseAccountTransaction) {
        const accountTransactions = await tx.accountTransaction.findMany({
          where: {
            incomeRecordId: id,
            status: AccountTransactionStatus.active,
          },
          select: { id: true },
        });

        if (accountTransactions.length === 0) {
          throw new BadRequestException(
            "Active account transaction is required before voiding income.",
          );
        }

        reversedAccountTransactionIds = accountTransactions.map(
          (transaction) => transaction.id,
        );

        await tx.accountTransaction.updateMany({
          where: { id: { in: reversedAccountTransactionIds } },
          data: {
            status: AccountTransactionStatus.reversed,
            reversedAt: new Date(),
          },
        });
      }

      const updated = await tx.incomeRecord.update({
        where: { id },
        data: { recordStatus: IncomeRecordStatus.voided },
        select: incomeRecordSelect,
      });

      if (
        before.sourceType === tuitionBillSourceType &&
        before.sourceId &&
        before.tuitionBill
      ) {
        await tx.studentTuitionBill.update({
          where: { id: before.sourceId },
          data: {
            status: TuitionBillStatus.voided,
          },
        });
      }

      if (before.sourceType === externalWorkSourceType && before.sourceId) {
        await tx.externalWorkMonthlySettlement.update({
          where: { id: before.sourceId },
          data: {
            status: ExternalWorkSettlementStatus.locked,
            incomeRecordId: null,
          },
        });
      }

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "income_record.void",
          targetType: "income_record",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          reason,
          beforeSnapshot: before,
          afterSnapshot: { incomeRecord: updated, reversedAccountTransactionIds },
        },
        tx,
      );

      return updated;
    });

    return { incomeRecord };
  }

  private assertIncomeCanBeVoided(incomeRecord: IncomeRecordSnapshot) {
    if (
      incomeRecord.cashStatus === CashRequestStatus.not_requested ||
      incomeRecord.cashStatus === CashRequestStatus.cash_rejected ||
      incomeRecord.cashStatus === CashRequestStatus.cash_withdrawn ||
      incomeRecord.cashStatus === CashRequestStatus.account_transaction_created
    ) {
      return;
    }

    throw new BadRequestException("Income downstream status does not allow void.");
  }

  private withReceiptEligibility(incomeRecord: IncomeRecordSnapshot) {
    const eligibility = this.getReceiptEligibility(incomeRecord);
    const latestReceipt = incomeRecord.receiptRecords[0] ?? null;

    return {
      ...incomeRecord,
      receiptEligible: eligibility.eligible,
      receiptIneligibleReason: eligibility.eligible ? null : eligibility.reason,
      receiptIssued: Boolean(latestReceipt),
      latestReceipt,
    };
  }

  private toSnapshotReceipt(receiptRecord: ReceiptRecordSnapshot) {
    return {
      receiptRecordId: receiptRecord.id,
      receiptNo: receiptRecord.receiptNo,
      issuedAt: receiptRecord.issuedAt.toISOString(),
      issuedByName: receiptRecord.snapshotIssuedByName,
      snapshotLocked: true,
      incomeRecordId: receiptRecord.incomeRecordId,
      studentId: receiptRecord.incomeRecord.studentId,
      studentName: receiptRecord.snapshotStudentName,
      businessEntityName: receiptRecord.snapshotBusinessEntityName,
      businessMonth: receiptRecord.snapshotBusinessMonth,
      itemName: receiptRecord.snapshotItem,
      description: receiptRecord.snapshotDescription,
      paymentDate: receiptRecord.snapshotPaymentDate.toISOString().slice(0, 10),
      paymentCurrency: receiptRecord.snapshotCurrency,
      paymentAmountJpy: receiptRecord.snapshotAmountJpy,
      paymentAmountCny: receiptRecord.snapshotAmountCny,
      incomeTitle: receiptRecord.snapshotIncomeTitle,
      memo: receiptRecord.snapshotMemo,
      authoritySource: receiptRecord.authoritySource,
      cashRequestId: receiptRecord.sourceCashRequestId,
      cashTransactionId: receiptRecord.sourceAccountTransactionId,
      externalCashRequestId: receiptRecord.externalCashRequestId,
      externalCashEventId: receiptRecord.externalCashEventId,
      pdfMetadata: receiptRecord.pdfMetadata,
    };
  }

  private async findReceiptRecordByIncomeId(incomeRecordId: string) {
    return this.prisma.receiptRecord.findUnique({
      where: { incomeRecordId },
      select: receiptRecordSelect,
    });
  }

  private async assertIncomeRecordExists(id: string) {
    const incomeRecord = await this.prisma.incomeRecord.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!incomeRecord) {
      throw new NotFoundException("Income record not found.");
    }
  }

  private formatReceiptNo(issuedAt: Date, serial: bigint) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(issuedAt);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;

    if (!year || !month) {
      throw new BadRequestException("无法生成收据编号，请稍后重试。");
    }

    return `AOZ-${year}${month}-${serial.toString().padStart(6, "0")}`;
  }

  private getReceiptEligibility(incomeRecord: IncomeRecordSnapshot) {
    if (incomeRecord.sourceType !== tuitionBillSourceType) {
      return { eligible: false, reason: "仅学费收入可以生成学费收据。" } as const;
    }
    if (!incomeRecord.student) {
      return { eligible: false, reason: "该收入没有学生归属，不能生成收据。" } as const;
    }
    if (incomeRecord.recordStatus !== IncomeRecordStatus.cash_confirmed) {
      return { eligible: false, reason: "该收入尚未完成 Cash 确认，不能生成收据。" } as const;
    }
    if (
      incomeRecord.cashStatus !== CashRequestStatus.cash_confirmed &&
      incomeRecord.cashStatus !== CashRequestStatus.account_transaction_created
    ) {
      return { eligible: false, reason: "该收入的 Cash 状态不允许生成收据。" } as const;
    }
    if (!incomeRecord.tuitionBill || incomeRecord.tuitionBill.status !== TuitionBillStatus.income_created) {
      return { eligible: false, reason: "关联学费账单已失效，不能生成收据。" } as const;
    }

    const cashRequest = incomeRecord.cashRequests[0];
    if (!cashRequest) {
      return { eligible: false, reason: "未找到有效的 Cash 确认记录，不能生成收据。" } as const;
    }

    const hasPositiveAmount =
      cashRequest.requestedCurrency === CurrencyCode.JPY
        ? Boolean(cashRequest.requestedAmountJpy && cashRequest.requestedAmountJpy > 0)
        : Boolean(
            cashRequest.requestedAmountCny &&
              new Prisma.Decimal(cashRequest.requestedAmountCny).greaterThan(0),
          );

    if (!hasPositiveAmount) {
      return { eligible: false, reason: "Cash 确认金额无效，不能生成收据。" } as const;
    }

    return { eligible: true, reason: null } as const;
  }

  private formatYearMonth(yearMonth: string) {
    const [year, month] = yearMonth.split("-");
    return `${year}年${Number(month)}月`;
  }

  private async findIncomeRecord(id: string): Promise<IncomeRecordSnapshot> {
    const incomeRecord = await this.prisma.incomeRecord.findUnique({
      where: { id },
      select: incomeRecordSelect,
    });

    if (!incomeRecord) {
      throw new NotFoundException("Income record not found.");
    }

    return incomeRecord;
  }

  private async normalizeManualIncome(body: ManualIncomeBody) {
    const originalCurrency = this.normalizeCurrency(body.originalCurrency);
    const studentId = this.normalizeOptionalString(body.studentId);
    const businessEntityId = await resolveOperationalBusinessEntityId(
      this.prisma,
      this.normalizeOptionalString(body.businessEntityId),
    );

    if (studentId) {
      await this.assertActiveStudent(studentId);
    }

    return {
      studentId,
      businessEntityId,
      yearMonth: this.normalizeOptionalYearMonth(body.yearMonth),
      title: this.normalizeRequiredString(body.title, "title"),
      originalCurrency,
      originalAmountJpy:
        originalCurrency === CurrencyCode.JPY
          ? this.normalizeJpyAmount(body.originalAmountJpy, "originalAmountJpy")
          : null,
      originalAmountCny:
        originalCurrency === CurrencyCode.CNY
          ? new Prisma.Decimal(this.normalizeCnyAmount(body.originalAmountCny, "originalAmountCny"))
          : null,
      memo: this.normalizeOptionalString(body.memo),
    };
  }

  private async assertActiveStudent(studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, status: RecordStatus.active },
      select: { id: true },
    });

    if (!student) {
      throw new BadRequestException("Active student is required.");
    }
  }

  private buildWhere(query: ListIncomeRecordsQuery): Prisma.IncomeRecordWhereInput {
    const yearMonth = this.normalizeOptionalYearMonth(query.yearMonth);
    const studentId = this.normalizeOptionalString(query.studentId);
    const businessEntityId = this.normalizeOptionalString(query.businessEntityId);
    const recordStatus = this.normalizeRecordStatus(query.recordStatus);
    const cashStatus = this.normalizeCashStatus(query.cashStatus);
    const sourceType = this.normalizeOptionalString(query.sourceType);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...(yearMonth ? { yearMonth } : {}),
      ...(studentId ? { studentId } : {}),
      ...(businessEntityId ? { businessEntityId } : {}),
      ...(recordStatus ? { recordStatus } : {}),
      ...(cashStatus ? { cashStatus } : {}),
      ...(sourceType ? { sourceType } : {}),
      ...(keyword
        ? {
            OR: [
              { title: { contains: keyword, mode: "insensitive" } },
              { memo: { contains: keyword, mode: "insensitive" } },
              { student: { name: { contains: keyword, mode: "insensitive" } } },
              { businessEntity: { name: { contains: keyword, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private normalizeRecordStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (
      status &&
      Object.values(IncomeRecordStatus).includes(status as IncomeRecordStatus)
    ) {
      return status as IncomeRecordStatus;
    }

    return undefined;
  }

  private normalizeCashStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (status && Object.values(CashRequestStatus).includes(status as CashRequestStatus)) {
      return status as CashRequestStatus;
    }

    return undefined;
  }

  private normalizeCurrency(value: unknown) {
    if (typeof value !== "string") {
      throw new BadRequestException("originalCurrency is required.");
    }

    if (!Object.values(CurrencyCode).includes(value as CurrencyCode)) {
      throw new BadRequestException("Invalid currency.");
    }

    return value as CurrencyCode;
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

  private normalizeOptionalYearMonth(value: unknown) {
    const yearMonth = this.normalizeOptionalString(value);

    if (!yearMonth) {
      return null;
    }

    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      throw new BadRequestException("yearMonth must be YYYY-MM.");
    }

    return yearMonth;
  }

  private normalizeJpyAmount(value: unknown, field: string) {
    const parsed =
      typeof value === "number" ? value : Number.parseInt(String(value), 10);

    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new BadRequestException(`${field} must be a non-negative integer.`);
    }

    return parsed;
  }

  private normalizeCnyAmount(value: unknown, field: string) {
    const parsed =
      typeof value === "number" ? value : Number.parseFloat(String(value));

    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException(`${field} must be a non-negative number.`);
    }

    return this.moneyService.confirmAmount({
      amount: parsed,
      currency: "CNY",
    });
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
