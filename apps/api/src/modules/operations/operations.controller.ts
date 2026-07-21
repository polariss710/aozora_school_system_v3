import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionGuard } from "../auth/permission.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { OperationsService } from "./operations.service";
import { WeeklyOperationsQuery } from "./operations.types";

@Controller("operations")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OperationsController {
  constructor(
    @Inject(OperationsService) private readonly operationsService: OperationsService,
  ) {}

  @Get("weekly-summary")
  @RequirePermissions("lessons.manage")
  getWeeklySummary(@Query() query: WeeklyOperationsQuery) {
    return this.operationsService.getWeeklySummary(query);
  }
}
