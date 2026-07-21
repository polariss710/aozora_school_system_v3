import {
  IncomeRecordStatus,
  PlannedLessonStatus,
  Prisma,
  RecordStatus,
  StudentSettlementStatus,
  TuitionBillStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { TuitionBillingService } from "./tuition-billing.service";

function buildService(prisma: unknown) {
  return new TuitionBillingService(
    prisma as PrismaService,
    { recordEvent: vi.fn() } as unknown as AuditService,
  );
}

function buildPlannedLesson(overrides: Record<string, unknown> = {}) {
  return {
    id: "lesson-1",
    teacherId: "teacher-1",
    subjectId: "subject-1",
    businessEntityId: "entity-1",
    weekAnchorDate: new Date("2026-07-13T00:00:00.000Z"),
    plannedDate: new Date("2026-07-13T00:00:00.000Z"),
    lessonNo: 1,
    durationHours: new Prisma.Decimal(1),
    plannedFeeJpy: 6000,
    status: PlannedLessonStatus.scheduled,
    teacher: { id: "teacher-1", code: "T001", name: "测试老师" },
    subject: { id: "subject-1", code: "MATH", name: "数学" },
    businessEntity: { id: "entity-1", code: "aozora_school", name: "青空进学塾" },
    ...overrides,
  };
}

function buildPrisma(overrides: Record<string, unknown> = {}) {
  return {
    student: {
      findFirst: vi.fn().mockResolvedValue({
        id: "student-1",
        code: "S001",
        name: "测试学生",
        status: RecordStatus.active,
      }),
    },
    studentTuitionBill: { findFirst: vi.fn().mockResolvedValue(null) },
    studentPlannedLesson: { findMany: vi.fn().mockResolvedValue([buildPlannedLesson()]) },
    studentMonthlySettlement: { findUnique: vi.fn().mockResolvedValue(null) },
    ...overrides,
  };
}

describe("TuitionBillingService preview", () => {
  it("returns authoritative planned-lesson and locked-carryover sources without writing", async () => {
    const prisma = buildPrisma({
      studentPlannedLesson: {
        findMany: vi.fn().mockResolvedValue([
          buildPlannedLesson(),
          buildPlannedLesson({
            id: "lesson-2",
            weekAnchorDate: new Date("2026-07-20T00:00:00.000Z"),
            lessonNo: 2,
            plannedFeeJpy: 6500,
          }),
        ]),
      },
      studentMonthlySettlement: {
        findUnique: vi.fn().mockResolvedValue({
          id: "settlement-1",
          status: StudentSettlementStatus.locked,
          carryoverAmountCny: new Prisma.Decimal("12.34"),
          lockedAt: new Date("2026-07-01T00:00:00.000Z"),
        }),
      },
    });

    const result = await buildService(prisma).previewTuitionBill({
      studentId: "student-1",
      yearMonth: "2026-07",
    });

    expect(result.preview.generationMode).toBe("create");
    expect(result.preview.willCreate).toBe(true);
    expect(result.preview.plannedLessonCount).toBe(2);
    expect(result.preview.plannedAmountJpy).toBe(12500);
    expect(result.preview.carryoverAmountCny).toBe(12.34);
    expect(result.preview.carryoverSource?.applied).toBe(true);
    expect(result.preview.previewFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.preview.plannedLessons[0]).toMatchObject({
      weekLabel: "7.13周",
      plannedFeeJpy: 6000,
    });
    expect(result.preview.blockingIssues).toEqual([]);
  });

  it("marks an unchanged generated bill as a no-write preview", async () => {
    const lesson = buildPlannedLesson();
    const latest = {
      id: "bill-1",
      studentId: "student-1",
      yearMonth: "2026-07",
      version: 1,
      plannedLessonCount: 1,
      plannedAmountJpy: 6000,
      carryoverAmountCny: new Prisma.Decimal(0),
      status: TuitionBillStatus.generated,
      calculationSnapshot: {
        plannedLessonIds: [lesson.id],
        plannedLessons: [{
          id: lesson.id,
          teacherId: lesson.teacherId,
          subjectId: lesson.subjectId,
          businessEntityId: lesson.businessEntityId,
          weekAnchorDate: "2026-07-13",
          plannedDate: "2026-07-13",
          lessonNo: lesson.lessonNo,
          durationHours: "1",
          plannedFeeJpy: lesson.plannedFeeJpy,
          status: lesson.status,
        }],
      },
      incomeRecordId: null,
      replacesId: null,
      generatedAt: new Date("2026-07-14T00:00:00.000Z"),
      student: { id: "student-1", code: "S001", name: "测试学生", status: RecordStatus.active },
      incomeRecord: null,
    };
    const prisma = buildPrisma({
      studentTuitionBill: { findFirst: vi.fn().mockResolvedValue(latest) },
      studentPlannedLesson: { findMany: vi.fn().mockResolvedValue([lesson]) },
    });

    const result = await buildService(prisma).previewTuitionBill({
      studentId: "student-1",
      yearMonth: "2026-07",
    });

    expect(result.preview.generationMode).toBe("unchanged");
    expect(result.preview.willCreate).toBe(false);
    expect(result.preview.nextVersion).toBe(1);
    expect(result.preview.notices).toContainEqual(
      expect.objectContaining({ code: "calculation_unchanged" }),
    );

    const changedSourceResult = await buildService(buildPrisma({
      studentTuitionBill: { findFirst: vi.fn().mockResolvedValue(latest) },
      studentPlannedLesson: {
        findMany: vi.fn().mockResolvedValue([
          buildPlannedLesson({
            teacherId: "teacher-2",
            teacher: { id: "teacher-2", code: "T002", name: "变更后老师" },
          }),
        ]),
      },
    })).previewTuitionBill({ studentId: "student-1", yearMonth: "2026-07" });

    expect(changedSourceResult.preview.generationMode).toBe("regenerate");
    expect(changedSourceResult.preview.willCreate).toBe(true);
    expect(changedSourceResult.preview.nextVersion).toBe(2);

    const changedScheduleResult = await buildService(buildPrisma({
      studentTuitionBill: { findFirst: vi.fn().mockResolvedValue(latest) },
      studentPlannedLesson: {
        findMany: vi.fn().mockResolvedValue([
          buildPlannedLesson({ plannedDate: new Date("2026-07-14T00:00:00.000Z") }),
        ]),
      },
    })).previewTuitionBill({ studentId: "student-1", yearMonth: "2026-07" });

    expect(changedScheduleResult.preview.generationMode).toBe("regenerate");
  });

  it("blocks empty bills and bills that already generated an active income", async () => {
    const emptyResult = await buildService(buildPrisma({
      studentPlannedLesson: { findMany: vi.fn().mockResolvedValue([]) },
    })).previewTuitionBill({ studentId: "student-1", yearMonth: "2026-07" });

    expect(emptyResult.preview.generationMode).toBe("blocked");
    expect(emptyResult.preview.blockingIssues).toContainEqual(
      expect.objectContaining({ code: "no_billable_sources" }),
    );

    const latestWithIncome = {
      id: "bill-1",
      studentId: "student-1",
      yearMonth: "2026-07",
      version: 1,
      plannedLessonCount: 1,
      plannedAmountJpy: 6000,
      carryoverAmountCny: new Prisma.Decimal(0),
      status: TuitionBillStatus.income_created,
      calculationSnapshot: { plannedLessonIds: ["lesson-1"] },
      incomeRecordId: "income-1",
      replacesId: null,
      generatedAt: new Date("2026-07-14T00:00:00.000Z"),
      student: { id: "student-1", code: "S001", name: "测试学生", status: RecordStatus.active },
      incomeRecord: {
        id: "income-1",
        recordStatus: IncomeRecordStatus.pending,
        cashStatus: "not_requested",
        originalCurrency: "JPY",
        originalAmountJpy: 6000,
        originalAmountCny: null,
      },
    };
    const incomeResult = await buildService(buildPrisma({
      studentTuitionBill: { findFirst: vi.fn().mockResolvedValue(latestWithIncome) },
    })).previewTuitionBill({ studentId: "student-1", yearMonth: "2026-07" });

    expect(incomeResult.preview.generationMode).toBe("blocked");
    expect(incomeResult.preview.blockingIssues).toContainEqual(
      expect.objectContaining({ code: "income_already_created" }),
    );
  });

  it("rejects generation when authoritative sources changed after preview", async () => {
    const service = buildService(buildPrisma());

    await expect(service.generateTuitionBill({
      studentId: "student-1",
      yearMonth: "2026-07",
      expectedPreviewFingerprint: "stale-preview-fingerprint",
    }, "user-1")).rejects.toThrow(
      "Tuition bill sources changed after preview",
    );
  });
});
