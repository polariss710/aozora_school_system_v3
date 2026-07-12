import { Prisma, TeacherWageAdjustmentStatus, TeacherWageSnapshotStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { MoneyService } from "../money/money.service";
import { WagesService } from "./wages.service";

type AttendanceInternals = {
  buildAttendanceWorkbookExportPayload: (snapshots: unknown[]) => {
    rows: Array<{ businessEntityName: string; actualDate: string; studentName: string }>;
  };
  buildAttendanceWorkbookImportPreview: (
    snapshots: unknown[],
    rows: Array<{
      snapshotId: string;
      detailId: string;
      transportationFeeJpy: number;
      classroomFeeJpy: number;
    }>,
    importSource: string,
  ) => {
    groups: Array<{
      snapshotId: string;
      after: { transportationFeeJpy: number; classroomFeeJpy: number; totalWageJpy: number };
    }>;
  };
};

function createService() {
  return new WagesService(
    {} as PrismaService,
    new MoneyService(),
    {} as AuditService,
  ) as unknown as AttendanceInternals;
}

function snapshot(
  id: string,
  businessName: string,
  details: Array<{ id: string; date: string; student: string }>,
) {
  return {
    id,
    teacherId: "teacher-1",
    yearMonth: "2026-07",
    businessEntityId: `entity-${id}`,
    version: 1,
    lessonCount: details.length,
    totalLessonHours: new Prisma.Decimal(details.length * 2),
    baseWageJpy: details.length * 6000,
    transportationFeeJpy: 0,
    classroomFeeJpy: 0,
    manualAdjustmentJpy: 0,
    totalWageJpy: details.length * 6000,
    status: TeacherWageSnapshotStatus.locked,
    adjustmentStatus: TeacherWageAdjustmentStatus.exported,
    calculationSnapshot: {},
    expenseRecordId: null,
    replacesId: null,
    lockedAt: new Date("2026-07-31T00:00:00Z"),
    revokedAt: null,
    memo: null,
    createdAt: new Date("2026-07-31T00:00:00Z"),
    updatedAt: new Date("2026-07-31T00:00:00Z"),
    teacher: { id: "teacher-1", code: "T1", name: "测试老师" },
    businessEntity: { id: `entity-${id}`, code: id, name: businessName },
    details: details.map((detail) => ({
      id: detail.id,
      actualLessonId: `actual-${detail.id}`,
      actualDate: new Date(`${detail.date}T00:00:00Z`),
      durationHours: new Prisma.Decimal(2),
      hourlyRateJpy: 3000,
      lessonWageJpy: 6000,
      teacherWageEligible: true,
      includedInWage: true,
      studentNameSnapshot: detail.student,
      subjectNameSnapshot: "日语",
      contentSnapshot: null,
    })),
  };
}

describe("teacher attendance workbook", () => {
  it("sorts rows by business entity, then date, then student", () => {
    const service = createService();
    const payload = service.buildAttendanceWorkbookExportPayload([
      snapshot("b", "B业务", [{ id: "b1", date: "2026-07-01", student: "学生甲" }]),
      snapshot("a", "A业务", [
        { id: "a2", date: "2026-07-02", student: "学生乙" },
        { id: "a1", date: "2026-07-02", student: "学生甲" },
      ]),
    ]);

    expect(payload.rows.map((row) => [row.businessEntityName, row.actualDate, row.studentName])).toEqual([
      ["A业务", "2026-07-02", "学生甲"],
      ["A业务", "2026-07-02", "学生乙"],
      ["B业务", "2026-07-01", "学生甲"],
    ]);
  });

  it("aggregates editable fees back to each business snapshot", () => {
    const service = createService();
    const snapshots = [
      snapshot("a", "A业务", [{ id: "a1", date: "2026-07-01", student: "学生甲" }]),
      snapshot("b", "B业务", [{ id: "b1", date: "2026-07-02", student: "学生乙" }]),
    ];
    const preview = service.buildAttendanceWorkbookImportPreview(
      snapshots,
      [
        { snapshotId: "a", detailId: "a1", transportationFeeJpy: 500, classroomFeeJpy: 200 },
        { snapshotId: "b", detailId: "b1", transportationFeeJpy: 300, classroomFeeJpy: 100 },
      ],
      "test.xlsx",
    );

    expect(preview.groups.map((group) => [group.snapshotId, group.after])).toEqual([
      ["a", { transportationFeeJpy: 500, classroomFeeJpy: 200, totalWageJpy: 6700 }],
      ["b", { transportationFeeJpy: 300, classroomFeeJpy: 100, totalWageJpy: 6400 }],
    ]);
  });
});
