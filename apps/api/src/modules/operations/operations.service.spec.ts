import { describe, expect, it, vi } from "vitest";
import { OperationsService } from "./operations.service";

describe("OperationsService weekly summary", () => {
  it("keeps open makeup balances cumulative while formal planned counts are scoped to the selected week", async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { status: "scheduled", _count: { _all: 3 } },
      { status: "actual_created", _count: { _all: 2 } },
      { status: "makeup_pending", _count: { _all: 1 } },
      { status: "cancelled", _count: { _all: 1 } },
    ]);
    const aggregate = vi.fn().mockResolvedValue({
      _count: { _all: 4 },
      _sum: { remainingDurationHours: { toString: () => "6.5" } },
    });
    const service = new OperationsService({
      studentPlannedLesson: { groupBy },
      studentMakeupBalance: { aggregate },
    } as never);

    await expect(
      service.getWeeklySummary({
        weekAnchorDate: "2026-07-20",
        studentId: "student-1",
        businessEntityId: "entity-1",
      }),
    ).resolves.toMatchObject({
      weekAnchorDate: "2026-07-20",
      weekEndDate: "2026-07-26",
      formalPlanned: {
        plannedCount: 7,
        registeredCount: 2,
        pendingRegistrationCount: 4,
        cancelledCount: 1,
      },
      makeupBalance: { openSourceCount: 4, remainingHours: "6.5" },
    });
    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ studentId: "student-1", businessEntityId: "entity-1" }),
    }));
    expect(aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "open",
        studentId: "student-1",
        businessEntityId: "entity-1",
      }),
    }));
  });

  it("rejects a week selector that is not Monday before querying data", async () => {
    const groupBy = vi.fn();
    const aggregate = vi.fn();
    const service = new OperationsService({
      studentPlannedLesson: { groupBy },
      studentMakeupBalance: { aggregate },
    } as never);

    await expect(service.getWeeklySummary({ weekAnchorDate: "2026-07-21" })).rejects.toThrow(
      "weekAnchorDate must be a Monday.",
    );
    expect(groupBy).not.toHaveBeenCalled();
    expect(aggregate).not.toHaveBeenCalled();
  });
});
