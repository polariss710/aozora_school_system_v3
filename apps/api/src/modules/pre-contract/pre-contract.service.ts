import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AuditRiskLevel, Prisma, QuoteStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { MoneyService } from "../money/money.service";
import { ListQuotesQuery, QuoteCourseBody, QuotePlanRowRemovalBody, QuoteWriteBody } from "./pre-contract.types";

const quoteSelect = {
  id: true, title: true, courseTrack: true, startDate: true, endDate: true, exchangeRate: true,
  totalHours: true, totalJpy: true, totalCny: true, status: true, note: true, calculationSnapshot: true, createdAt: true, updatedAt: true,
  prospectiveStudent: { select: { id: true, name: true, status: true, memo: true } },
  courses: { orderBy: { sortOrder: "asc" }, select: { id: true, sortOrder: true, name: true, content: true, hoursPerSession: true, weeklyFrequency: true, unitPriceJpy: true } },
} satisfies Prisma.QuoteSelect;

type Course = { name: string; content: string; hoursPerSession: number; weeklyFrequency: number; unitPriceJpy: number };
type Input = { prospectiveStudentName: string; prospectiveStudentMemo: string | null; title: string; courseTrack: string; startDate: Date; endDate: Date; exchangeRate: number; note: string | null; courses: Course[] };
type PlanRow = { courseIndex: number; occurrence: number; weekAnchorDate: string; hours: number; amountJpy: number };
type Calculation = { totalHours: number; totalJpy: number; totalCny: number; snapshot: Record<string, Prisma.JsonValue> };

@Injectable()
export class PreContractService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MoneyService) private readonly money: MoneyService,
  ) {}

  async listQuotes(query: ListQuotesQuery) {
    const status = typeof query.status === "string" && Object.values(QuoteStatus).includes(query.status as QuoteStatus) ? query.status as QuoteStatus : undefined;
    const keyword = typeof query.keyword === "string" && query.keyword.trim() ? query.keyword.trim() : undefined;
    const limit = Math.min(Math.max(Number.parseInt(String(query.limit ?? "100"), 10) || 100, 1), 500);
    const where: Prisma.QuoteWhereInput = {
      ...(status ? { status } : {}),
      ...(keyword ? { OR: [{ title: { contains: keyword, mode: "insensitive" } }, { prospectiveStudent: { name: { contains: keyword, mode: "insensitive" } } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.quote.findMany({ where, orderBy: { updatedAt: "desc" }, take: limit, select: quoteSelect }),
      this.prisma.quote.count({ where }),
    ]);
    return { items, total, limit };
  }

  async getQuote(id: string) {
    return { quote: await this.find(id) };
  }

  async createQuote(body: QuoteWriteBody, actorUserId: string) {
    const input = this.normalize(body);
    const calculation = this.calculate(input);
    const quote = await this.prisma.$transaction(async (tx) => {
      const lead = await tx.prospectiveStudent.create({ data: { name: input.prospectiveStudentName, memo: input.prospectiveStudentMemo } });
      const created = await tx.quote.create({
        data: {
          prospectiveStudentId: lead.id,
          title: input.title,
          courseTrack: input.courseTrack,
          startDate: input.startDate,
          endDate: input.endDate,
          exchangeRate: new Prisma.Decimal(input.exchangeRate),
          totalHours: new Prisma.Decimal(calculation.totalHours),
          totalJpy: calculation.totalJpy,
          totalCny: new Prisma.Decimal(calculation.totalCny),
          note: input.note,
          calculationSnapshot: calculation.snapshot,
          courses: { create: input.courses.map((course, sortOrder) => ({ ...course, sortOrder, hoursPerSession: new Prisma.Decimal(course.hoursPerSession) })) },
        },
        select: quoteSelect,
      });
      await this.audit.recordEvent({ actorUserId, action: "quote.create", targetType: "quote", targetId: created.id, riskLevel: AuditRiskLevel.medium, afterSnapshot: created }, tx);
      return created;
    });
    return { quote };
  }

  async updateQuote(id: string, body: QuoteWriteBody, actorUserId: string) {
    const before = await this.find(id);
    if (before.status !== QuoteStatus.draft) throw new BadRequestException("Only draft quotes can be edited.");
    const input = this.normalize(body);
    const calculation = this.calculate(input);
    const removedRowKeys = this.planSignature(before.calculationSnapshot) === this.planSignature(calculation.snapshot)
      ? this.removedRowKeys(before.calculationSnapshot)
      : [];
    const adjusted = this.applyRemovedRows(calculation.snapshot, input.exchangeRate, removedRowKeys);
    const quote = await this.prisma.$transaction(async (tx) => {
      await tx.prospectiveStudent.update({ where: { id: before.prospectiveStudent.id }, data: { name: input.prospectiveStudentName, memo: input.prospectiveStudentMemo } });
      await tx.quoteCourse.deleteMany({ where: { quoteId: id } });
      const updated = await tx.quote.update({
        where: { id },
        data: {
          title: input.title,
          courseTrack: input.courseTrack,
          startDate: input.startDate,
          endDate: input.endDate,
          exchangeRate: new Prisma.Decimal(input.exchangeRate),
          totalHours: new Prisma.Decimal(adjusted.totalHours),
          totalJpy: adjusted.totalJpy,
          totalCny: new Prisma.Decimal(adjusted.totalCny),
          note: input.note,
          calculationSnapshot: adjusted.snapshot,
          courses: { create: input.courses.map((course, sortOrder) => ({ ...course, sortOrder, hoursPerSession: new Prisma.Decimal(course.hoursPerSession) })) },
        },
        select: quoteSelect,
      });
      await this.audit.recordEvent({ actorUserId, action: "quote.update", targetType: "quote", targetId: id, riskLevel: AuditRiskLevel.medium, beforeSnapshot: before, afterSnapshot: updated }, tx);
      return updated;
    });
    return { quote };
  }

  async removePlanRow(id: string, body: QuotePlanRowRemovalBody, actorUserId: string) {
    const before = await this.find(id);
    if (before.status !== QuoteStatus.draft) throw new BadRequestException("Only draft quote plan rows can be removed.");
    const rowKey = typeof body.rowKey === "string" ? body.rowKey.trim() : "";
    if (!rowKey) throw new BadRequestException("rowKey is required.");
    const rows = this.planRows(before.calculationSnapshot);
    if (!rows.some((row) => this.rowKey(row) === rowKey)) throw new NotFoundException("Quote plan row not found.");
    const alreadyRemoved = this.removedRowKeys(before.calculationSnapshot);
    if (alreadyRemoved.includes(rowKey)) return { quote: before };
    const adjusted = this.applyRemovedRows(before.calculationSnapshot, Number(before.exchangeRate), [...alreadyRemoved, rowKey]);
    const quote = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.quote.update({
        where: { id },
        data: {
          totalHours: new Prisma.Decimal(adjusted.totalHours),
          totalJpy: adjusted.totalJpy,
          totalCny: new Prisma.Decimal(adjusted.totalCny),
          calculationSnapshot: adjusted.snapshot,
        },
        select: quoteSelect,
      });
      await this.audit.recordEvent({ actorUserId, action: "quote.plan_row.remove", targetType: "quote", targetId: id, riskLevel: AuditRiskLevel.medium, beforeSnapshot: before, afterSnapshot: updated }, tx);
      return updated;
    });
    return { quote };
  }

  async archiveQuote(id: string, actorUserId: string) {
    const before = await this.find(id);
    if (before.status === QuoteStatus.archived) return { quote: before };
    const quote = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.quote.update({ where: { id }, data: { status: QuoteStatus.archived }, select: quoteSelect });
      await this.audit.recordEvent({ actorUserId, action: "quote.archive", targetType: "quote", targetId: id, riskLevel: AuditRiskLevel.medium, beforeSnapshot: before, afterSnapshot: updated }, tx);
      return updated;
    });
    return { quote };
  }

  private async find(id: string) {
    const quote = await this.prisma.quote.findUnique({ where: { id }, select: quoteSelect });
    if (!quote) throw new NotFoundException("Quote not found.");
    return quote;
  }

  private normalize(body: QuoteWriteBody): Input {
    const required = (value: unknown, field: string) => {
      if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${field} is required.`);
      return value.trim();
    };
    const positive = (value: unknown, field: string) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) throw new BadRequestException(`${field} must be positive.`);
      return numeric;
    };
    const nonnegative = (value: unknown, field: string) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric < 0) throw new BadRequestException(`${field} must not be negative.`);
      return numeric;
    };
    const wholePositive = (value: unknown, field: string) => {
      const numeric = positive(value, field);
      if (!Number.isInteger(numeric)) throw new BadRequestException(`${field} must be a whole number.`);
      return numeric;
    };
    const date = (value: unknown, field: string) => {
      const raw = required(value, field);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new BadRequestException(`${field} must be YYYY-MM-DD.`);
      return new Date(`${raw}T00:00:00.000Z`);
    };
    const courses = Array.isArray(body.courses) ? body.courses : [];
    if (!courses.length) throw new BadRequestException("At least one quote course is required.");
    const normalized = courses.map((course: QuoteCourseBody) => ({
      name: required(course.name, "course.name"),
      content: typeof course.content === "string" && course.content.trim() ? course.content.trim() : required(course.name, "course.name"),
      hoursPerSession: positive(course.hoursPerSession, "course.hoursPerSession"),
      weeklyFrequency: wholePositive(course.weeklyFrequency, "course.weeklyFrequency"),
      unitPriceJpy: this.money.confirmAmount({ amount: nonnegative(course.unitPriceJpy, "course.unitPriceJpy"), currency: "JPY" }),
    }));
    const startDate = date(body.startDate, "startDate");
    const endDate = date(body.endDate, "endDate");
    if (endDate < startDate) throw new BadRequestException("endDate must not be before startDate.");
    const track = required(body.courseTrack, "courseTrack");
    if (!["science", "humanities"].includes(track)) throw new BadRequestException("courseTrack is invalid.");
    return {
      prospectiveStudentName: required(body.prospectiveStudentName, "prospectiveStudentName"),
      prospectiveStudentMemo: typeof body.prospectiveStudentMemo === "string" && body.prospectiveStudentMemo.trim() ? body.prospectiveStudentMemo.trim() : null,
      title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : "课程计划",
      courseTrack: track,
      startDate,
      endDate,
      exchangeRate: positive(body.exchangeRate, "exchangeRate"),
      note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
      courses: normalized,
    };
  }

  private calculate(input: Input): Calculation {
    const cursor = new Date(input.startDate);
    while (cursor.getUTCDay() !== 1) cursor.setUTCDate(cursor.getUTCDate() + 1);
    const rows: PlanRow[] = [];
    while (cursor <= input.endDate) {
      for (const [courseIndex, course] of input.courses.entries()) {
        for (let occurrence = 0; occurrence < course.weeklyFrequency; occurrence += 1) {
          rows.push({
            courseIndex,
            occurrence,
            weekAnchorDate: cursor.toISOString().slice(0, 10),
            hours: course.hoursPerSession,
            amountJpy: this.money.confirmAmount({ amount: course.hoursPerSession * course.unitPriceJpy, currency: "JPY" }),
          });
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
    const snapshot: Record<string, Prisma.JsonValue> = {
      calculationVersion: "quote_v1",
      weekAnchor: "monday",
      planSignature: this.signatureFor(input),
      rows,
      removedRowKeys: [],
    };
    return this.applyRemovedRows(snapshot, input.exchangeRate, []);
  }

  private applyRemovedRows(snapshot: Prisma.JsonValue, exchangeRate: number, requestedRemovedRowKeys: string[]): Calculation {
    const base = this.snapshotObject(snapshot);
    const rows = this.planRows(base);
    const validKeys = new Set(rows.map((row) => this.rowKey(row)));
    const removedRowKeys = [...new Set(requestedRemovedRowKeys)].filter((key) => validKeys.has(key));
    const removed = new Set(removedRowKeys);
    const activeRows = rows.filter((row) => !removed.has(this.rowKey(row)));
    const totalHours = new Prisma.Decimal(activeRows.reduce((sum, row) => sum + row.hours, 0)).toDecimalPlaces(2).toNumber();
    const totalJpy = activeRows.reduce((sum, row) => sum + row.amountJpy, 0);
    const totalCny = this.money.convertJpyToCny({ jpyAmount: totalJpy, exchangeRate });
    return {
      totalHours,
      totalJpy,
      totalCny,
      snapshot: { ...base, rows, removedRowKeys, totalHours, totalJpy, totalCny, exchangeRate },
    };
  }

  private snapshotObject(snapshot: Prisma.JsonValue | unknown): Record<string, Prisma.JsonValue> {
    return snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot as Record<string, Prisma.JsonValue> : {};
  }

  private planRows(snapshot: Prisma.JsonValue | unknown): PlanRow[] {
    const rows = this.snapshotObject(snapshot).rows;
    if (!Array.isArray(rows)) return [];
    return rows.flatMap((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return [];
      const value = row as Record<string, unknown>;
      const courseIndex = Number(value.courseIndex);
      const occurrence = Number(value.occurrence);
      const hours = Number(value.hours);
      const amountJpy = Number(value.amountJpy);
      const weekAnchorDate = typeof value.weekAnchorDate === "string" ? value.weekAnchorDate : "";
      return Number.isInteger(courseIndex) && courseIndex >= 0 && Number.isInteger(occurrence) && occurrence >= 0 && Number.isFinite(hours) && hours > 0 && Number.isFinite(amountJpy) && /^\d{4}-\d{2}-\d{2}$/.test(weekAnchorDate)
        ? [{ courseIndex, occurrence, weekAnchorDate, hours, amountJpy }]
        : [];
    });
  }

  private removedRowKeys(snapshot: Prisma.JsonValue | unknown) {
    const removed = this.snapshotObject(snapshot).removedRowKeys;
    return Array.isArray(removed) ? removed.filter((value): value is string => typeof value === "string") : [];
  }

  private planSignature(snapshot: Prisma.JsonValue | unknown) {
    const value = this.snapshotObject(snapshot).planSignature;
    return typeof value === "string" ? value : null;
  }

  private signatureFor(input: Input) {
    return JSON.stringify({
      startDate: input.startDate.toISOString().slice(0, 10),
      endDate: input.endDate.toISOString().slice(0, 10),
      courses: input.courses.map((course) => ({ name: course.name, hoursPerSession: course.hoursPerSession, weeklyFrequency: course.weeklyFrequency })),
    });
  }

  private rowKey(row: PlanRow) {
    return `course:${row.courseIndex}:date:${row.weekAnchorDate}:slot:${row.occurrence}`;
  }
}
