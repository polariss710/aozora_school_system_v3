import { describe, expect, it, vi } from "vitest";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { LessonsService } from "./lessons.service";

function buildService(prisma: unknown) {
  return new LessonsService(
    prisma as PrismaService,
    { recordEvent: vi.fn() } as unknown as AuditService,
  );
}

describe("LessonsService historical import boundary", () => {
  it("rejects an attempted planned-lesson update before any write", async () => {
    const update = vi.fn();
    const prisma = {
      studentPlannedLesson: {
        findUnique: vi.fn().mockResolvedValue({
          id: "planned-1",
          sourceType: "legacy_v2_import",
        }),
        update,
      },
    };

    await expect(
      buildService(prisma).updatePlannedLesson("planned-1", {}, "admin-1"),
    ).rejects.toThrow("Historical imported lessons are read-only.");
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects an attempted actual-lesson update before any write", async () => {
    const update = vi.fn();
    const prisma = {
      studentActualLesson: {
        findUnique: vi.fn().mockResolvedValue({
          id: "actual-1",
          sourceType: "legacy_v2_import",
        }),
        update,
      },
    };

    await expect(
      buildService(prisma).updateActualLesson("actual-1", {}, "admin-1"),
    ).rejects.toThrow("Historical imported lessons are read-only.");
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects generating a new actual lesson from a historical planned lesson", async () => {
    const create = vi.fn();
    const prisma = {
      studentPlannedLesson: {
        findUnique: vi.fn().mockResolvedValue({
          id: "planned-1",
          sourceType: "legacy_v2_import",
        }),
      },
      studentActualLesson: { create },
    };

    await expect(
      buildService(prisma).generateActualLesson("planned-1", {}, "admin-1"),
    ).rejects.toThrow("Historical imported lessons are read-only.");
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a makeup completion when its planned lesson has no open balance source", async () => {
    const create = vi.fn();
    const prisma = {
      studentPlannedLesson: {
        findUnique: vi.fn().mockResolvedValue({
          id: "planned-1",
          sourceType: "manual",
          status: "makeup_pending",
          actualLesson: null,
        }),
      },
      studentActualLesson: { create },
      studentMakeupBalance: { findUnique: vi.fn().mockResolvedValue(null) },
    };

    await expect(
      buildService(prisma).generateActualLesson("planned-1", {}, "admin-1"),
    ).rejects.toThrow("Open makeup balance is required");
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a makeup completion that exceeds its remaining balance before any write", async () => {
    const transaction = vi.fn();
    const prisma = {
      studentMakeupBalance: {
        findUnique: vi.fn().mockResolvedValue({
          id: "balance-1",
          status: "open",
          remainingDurationHours: "1.00",
          sourcePlannedLesson: { sourceType: "manual" },
        }),
      },
      $transaction: transaction,
    };

    await expect(
      buildService(prisma).completeMakeupBalance(
        "balance-1",
        {
          teacherId: "teacher-1",
          subjectId: "subject-1",
          actualDate: "2026-07-21",
          durationHours: "1.50",
        },
        "admin-1",
      ),
    ).rejects.toThrow("Makeup duration exceeds the remaining balance.");
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe("LessonsService planned schedule date", () => {
  const createBody = {
    studentId: "student-1",
    teacherId: "teacher-1",
    subjectId: "subject-1",
    businessEntityId: "entity-1",
    weekAnchorDate: "2026-07-27",
    plannedDate: "2026-08-01",
    durationHours: "1",
    plannedFeeJpy: 6000,
  };

  it("keeps the business month on the Monday anchor while storing the planned date", () => {
    const service = buildService({}) as never as {
      normalizeCreatePlannedInput: (body: unknown) => { yearMonth: string; plannedDate: Date };
    };

    const result = service.normalizeCreatePlannedInput(createBody);

    expect(result.yearMonth).toBe("2026-07");
    expect(result.plannedDate.toISOString().slice(0, 10)).toBe("2026-08-01");
  });

  it("rejects a planned date outside its Monday-anchored week", () => {
    const service = buildService({}) as never as {
      normalizeCreatePlannedInput: (body: unknown) => unknown;
    };

    expect(() => service.normalizeCreatePlannedInput({ ...createBody, plannedDate: "2026-08-03" }))
      .toThrow("plannedDate must belong to weekAnchorDate.");
  });

  it("scopes planned lesson queries to an inclusive planned-date range", () => {
    const service = buildService({}) as never as {
      buildPlannedWhere: (query: unknown) => unknown;
    };

    expect(service.buildPlannedWhere({ plannedDateFrom: "2026-07-20", plannedDateTo: "2026-07-26" })).toMatchObject({
      plannedDate: {
        gte: new Date("2026-07-20T00:00:00.000Z"),
        lte: new Date("2026-07-26T00:00:00.000Z"),
      },
    });
    expect(() => service.buildPlannedWhere({ plannedDateFrom: "2026-07-26", plannedDateTo: "2026-07-20" }))
      .toThrow("plannedDateFrom must be on or before plannedDateTo.");
  });
});
