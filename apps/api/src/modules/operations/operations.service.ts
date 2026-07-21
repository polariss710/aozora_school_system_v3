import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { MakeupBalanceStatus, PlannedLessonStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { WeeklyOperationsQuery } from "./operations.types";

@Injectable()
export class OperationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getWeeklySummary(query: WeeklyOperationsQuery) {
    const weekAnchorDate = this.normalizeWeekAnchorDate(query.weekAnchorDate);
    const studentId = this.normalizeOptionalId(query.studentId, "studentId");
    const businessEntityId = this.normalizeOptionalId(
      query.businessEntityId,
      "businessEntityId",
    );
    const formalPlannedWhere: Prisma.StudentPlannedLessonWhereInput = {
      weekAnchorDate,
      ...(studentId ? { studentId } : {}),
      ...(businessEntityId ? { businessEntityId } : {}),
    };
    const openBalanceWhere: Prisma.StudentMakeupBalanceWhereInput = {
      status: MakeupBalanceStatus.open,
      ...(studentId ? { studentId } : {}),
      ...(businessEntityId ? { businessEntityId } : {}),
    };

    const [plannedStatusGroups, openBalanceAggregate] = await Promise.all([
      this.prisma.studentPlannedLesson.groupBy({
        by: ["status"],
        where: formalPlannedWhere,
        _count: { _all: true },
      }),
      this.prisma.studentMakeupBalance.aggregate({
        where: openBalanceWhere,
        _count: { _all: true },
        _sum: { remainingDurationHours: true },
      }),
    ]);
    const byStatus = new Map(
      plannedStatusGroups.map((group) => [group.status, group._count._all]),
    );
    const plannedCount = plannedStatusGroups.reduce(
      (total, group) => total + group._count._all,
      0,
    );
    const registeredCount =
      (byStatus.get(PlannedLessonStatus.actual_created) ?? 0) +
      (byStatus.get(PlannedLessonStatus.makeup_completed) ?? 0);
    const pendingRegistrationCount =
      (byStatus.get(PlannedLessonStatus.scheduled) ?? 0) +
      (byStatus.get(PlannedLessonStatus.makeup_pending) ?? 0);

    return {
      weekAnchorDate: this.formatDate(weekAnchorDate),
      weekEndDate: this.formatDate(this.addDays(weekAnchorDate, 6)),
      scope: { studentId, businessEntityId },
      formalPlanned: {
        plannedCount,
        registeredCount,
        pendingRegistrationCount,
        cancelledCount: byStatus.get(PlannedLessonStatus.cancelled) ?? 0,
      },
      makeupBalance: {
        openSourceCount: openBalanceAggregate._count._all,
        remainingHours: openBalanceAggregate._sum.remainingDurationHours?.toString() ?? "0",
      },
    };
  }

  private normalizeWeekAnchorDate(value: unknown) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException("weekAnchorDate must be a Monday.");
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.getUTCDay() !== 1) {
      throw new BadRequestException("weekAnchorDate must be a Monday.");
    }

    return date;
  }

  private normalizeOptionalId(value: unknown, field: string) {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(`${field} must be a non-empty string.`);
    }

    return value.trim();
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  private formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }
}
