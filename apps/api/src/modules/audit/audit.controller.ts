import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionGuard } from "../auth/permission.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { AuditService } from "./audit.service";
import { ListAuditEventsQuery } from "./audit.types";

@Controller("audit")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AuditController {
  constructor(@Inject(AuditService) private readonly auditService: AuditService) {}

  @Get("events")
  @RequirePermissions("audit.read")
  listEvents(@Query() query: ListAuditEventsQuery) {
    return this.auditService.listEvents(query);
  }
}
