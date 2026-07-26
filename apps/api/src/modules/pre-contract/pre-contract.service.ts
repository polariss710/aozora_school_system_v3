import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AuditRiskLevel, Prisma, QuoteStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { MoneyService } from "../money/money.service";
import { ListQuotesQuery, QuoteCourseBody, QuoteWriteBody } from "./pre-contract.types";

const quoteSelect = {
  id: true, title: true, courseTrack: true, startDate: true, endDate: true, exchangeRate: true,
  totalHours: true, totalJpy: true, totalCny: true, status: true, note: true, calculationSnapshot: true, createdAt: true, updatedAt: true,
  prospectiveStudent: { select: { id: true, name: true, status: true, memo: true } },
  courses: { orderBy: { sortOrder: "asc" }, select: { id: true, sortOrder: true, name: true, content: true, hoursPerSession: true, weeklyFrequency: true, unitPriceJpy: true } },
} satisfies Prisma.QuoteSelect;

type Course = { name: string; content: string; hoursPerSession: number; weeklyFrequency: number; unitPriceJpy: number };
type Input = { prospectiveStudentName: string; prospectiveStudentMemo: string | null; title: string; courseTrack: string; startDate: Date; endDate: Date; exchangeRate: number; note: string | null; courses: Course[] };

@Injectable()
export class PreContractService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService, @Inject(MoneyService) private readonly money: MoneyService) {}

  async listQuotes(query: ListQuotesQuery) {
    const status = typeof query.status === "string" && Object.values(QuoteStatus).includes(query.status as QuoteStatus) ? query.status as QuoteStatus : undefined;
    const keyword = typeof query.keyword === "string" && query.keyword.trim() ? query.keyword.trim() : undefined;
    const limit = Math.min(Math.max(Number.parseInt(String(query.limit ?? "100"), 10) || 100, 1), 500);
    const where: Prisma.QuoteWhereInput = { ...(status ? { status } : {}), ...(keyword ? { OR: [{ title: { contains: keyword, mode: "insensitive" } }, { prospectiveStudent: { name: { contains: keyword, mode: "insensitive" } } }] } : {}) };
    const [items, total] = await Promise.all([this.prisma.quote.findMany({ where, orderBy: { updatedAt: "desc" }, take: limit, select: quoteSelect }), this.prisma.quote.count({ where })]);
    return { items, total, limit };
  }

  async getQuote(id: string) { return { quote: await this.find(id) }; }

  async createQuote(body: QuoteWriteBody, actorUserId: string) {
    const input = this.normalize(body); const totals = this.calculate(input);
    const quote = await this.prisma.$transaction(async (tx) => {
      const lead = await tx.prospectiveStudent.create({ data: { name: input.prospectiveStudentName, memo: input.prospectiveStudentMemo } });
      const created = await tx.quote.create({ data: { prospectiveStudentId: lead.id, title: input.title, courseTrack: input.courseTrack, startDate: input.startDate, endDate: input.endDate, exchangeRate: new Prisma.Decimal(input.exchangeRate), totalHours: new Prisma.Decimal(totals.totalHours), totalJpy: totals.totalJpy, totalCny: new Prisma.Decimal(totals.totalCny), note: input.note, calculationSnapshot: totals.snapshot, courses: { create: input.courses.map((course, sortOrder) => ({ ...course, sortOrder, hoursPerSession: new Prisma.Decimal(course.hoursPerSession) })) } }, select: quoteSelect });
      await this.audit.recordEvent({ actorUserId, action: "quote.create", targetType: "quote", targetId: created.id, riskLevel: AuditRiskLevel.medium, afterSnapshot: created }, tx); return created;
    }); return { quote };
  }

  async updateQuote(id: string, body: QuoteWriteBody, actorUserId: string) {
    const before = await this.find(id); if (before.status !== QuoteStatus.draft) throw new BadRequestException("Only draft quotes can be edited.");
    const input = this.normalize(body); const totals = this.calculate(input);
    const quote = await this.prisma.$transaction(async (tx) => {
      await tx.prospectiveStudent.update({ where: { id: before.prospectiveStudent.id }, data: { name: input.prospectiveStudentName, memo: input.prospectiveStudentMemo } });
      await tx.quoteCourse.deleteMany({ where: { quoteId: id } });
      const updated = await tx.quote.update({ where: { id }, data: { title: input.title, courseTrack: input.courseTrack, startDate: input.startDate, endDate: input.endDate, exchangeRate: new Prisma.Decimal(input.exchangeRate), totalHours: new Prisma.Decimal(totals.totalHours), totalJpy: totals.totalJpy, totalCny: new Prisma.Decimal(totals.totalCny), note: input.note, calculationSnapshot: totals.snapshot, courses: { create: input.courses.map((course, sortOrder) => ({ ...course, sortOrder, hoursPerSession: new Prisma.Decimal(course.hoursPerSession) })) } }, select: quoteSelect });
      await this.audit.recordEvent({ actorUserId, action: "quote.update", targetType: "quote", targetId: id, riskLevel: AuditRiskLevel.medium, beforeSnapshot: before, afterSnapshot: updated }, tx); return updated;
    }); return { quote };
  }

  async archiveQuote(id: string, actorUserId: string) { const before = await this.find(id); if (before.status === QuoteStatus.archived) return { quote: before }; const quote = await this.prisma.$transaction(async tx => { const updated = await tx.quote.update({ where: { id }, data: { status: QuoteStatus.archived }, select: quoteSelect }); await this.audit.recordEvent({ actorUserId, action: "quote.archive", targetType: "quote", targetId: id, riskLevel: AuditRiskLevel.medium, beforeSnapshot: before, afterSnapshot: updated }, tx); return updated; }); return { quote }; }

  private async find(id: string) { const quote = await this.prisma.quote.findUnique({ where: { id }, select: quoteSelect }); if (!quote) throw new NotFoundException("Quote not found."); return quote; }
  private normalize(body: QuoteWriteBody): Input { const required = (value: unknown, field: string) => { if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${field} is required.`); return value.trim(); }; const positive = (value: unknown, field: string) => { const numeric = Number(value); if (!Number.isFinite(numeric) || numeric <= 0) throw new BadRequestException(`${field} must be positive.`); return numeric; }; const nonnegative = (value: unknown, field: string) => { const numeric = Number(value); if (!Number.isFinite(numeric) || numeric < 0) throw new BadRequestException(`${field} must not be negative.`); return numeric; }; const wholePositive = (value: unknown, field: string) => { const numeric = positive(value, field); if (!Number.isInteger(numeric)) throw new BadRequestException(`${field} must be a whole number.`); return numeric; }; const date = (value: unknown, field: string) => { const raw = required(value, field); if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new BadRequestException(`${field} must be YYYY-MM-DD.`); return new Date(`${raw}T00:00:00.000Z`); }; const courses = Array.isArray(body.courses) ? body.courses : []; if (!courses.length) throw new BadRequestException("At least one quote course is required."); const normalized = courses.map((course: QuoteCourseBody) => ({ name: required(course.name, "course.name"), content: typeof course.content === "string" && course.content.trim() ? course.content.trim() : required(course.name, "course.name"), hoursPerSession: positive(course.hoursPerSession, "course.hoursPerSession"), weeklyFrequency: wholePositive(course.weeklyFrequency, "course.weeklyFrequency"), unitPriceJpy: this.money.confirmAmount({ amount: nonnegative(course.unitPriceJpy, "course.unitPriceJpy"), currency: "JPY" }) })); const startDate = date(body.startDate, "startDate"); const endDate = date(body.endDate, "endDate"); if (endDate < startDate) throw new BadRequestException("endDate must not be before startDate."); const track = required(body.courseTrack, "courseTrack"); if (!["science", "humanities"].includes(track)) throw new BadRequestException("courseTrack is invalid."); return { prospectiveStudentName: required(body.prospectiveStudentName, "prospectiveStudentName"), prospectiveStudentMemo: typeof body.prospectiveStudentMemo === "string" && body.prospectiveStudentMemo.trim() ? body.prospectiveStudentMemo.trim() : null, title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : "课程计划", courseTrack: track, startDate, endDate, exchangeRate: positive(body.exchangeRate, "exchangeRate"), note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null, courses: normalized }; }
  private calculate(input: Input) { const cursor = new Date(input.startDate); while (cursor.getUTCDay() !== 1) cursor.setUTCDate(cursor.getUTCDate() + 1); let totalHours = 0; let totalJpy = 0; const rows: Array<Record<string, number | string>> = []; while (cursor <= input.endDate) { for (const [courseIndex, course] of input.courses.entries()) for (let occurrence = 0; occurrence < course.weeklyFrequency; occurrence += 1) { const amountJpy = this.money.confirmAmount({ amount: course.hoursPerSession * course.unitPriceJpy, currency: "JPY" }); totalHours += course.hoursPerSession; totalJpy += amountJpy; rows.push({ courseIndex, occurrence, weekAnchorDate: cursor.toISOString().slice(0, 10), hours: course.hoursPerSession, amountJpy }); } cursor.setUTCDate(cursor.getUTCDate() + 7); } totalHours = new Prisma.Decimal(totalHours).toDecimalPlaces(2).toNumber(); const totalCny = this.money.convertJpyToCny({ jpyAmount: totalJpy, exchangeRate: input.exchangeRate }); return { totalHours, totalJpy, totalCny, snapshot: { calculationVersion: "quote_v1", weekAnchor: "monday", rows, totalHours, totalJpy, totalCny, exchangeRate: input.exchangeRate } }; }
}
