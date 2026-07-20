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
});
