import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionGuard } from "../auth/permission.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { AuthenticatedUser } from "../users/users.types";
import { WagesService } from "./wages.service";
import {
  ConfirmTeacherWageAdjustmentsBody,
  ImportTeacherAttendanceAdjustmentsBody,
  ListTeacherWageRulesQuery,
  ListTeacherWageSnapshotsQuery,
  LockTeacherWageBody,
  PreviewTeacherWageBody,
  RevokeTeacherWageSnapshotBody,
  TeacherWageRuleBody,
  TeacherAttendanceWorkbookBody,
  TeacherAttendanceWorkbookImportBody,
  UpdateTeacherWageAdjustmentsBody,
} from "./wages.types";

@Controller("wages")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WagesController {
  constructor(@Inject(WagesService) private readonly wagesService: WagesService) {}

  @Get("rules")
  @RequirePermissions("teacher_wages.manage")
  listRules(@Query() query: ListTeacherWageRulesQuery) {
    return this.wagesService.listRules(query);
  }

  @Post("rules")
  @RequirePermissions("teacher_wages.manage")
  upsertRule(
    @Body() body: TeacherWageRuleBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.wagesService.upsertRule(body, user.id);
  }

  @Patch("rules/:id")
  @RequirePermissions("teacher_wages.manage")
  updateRule(
    @Param("id") id: string,
    @Body() body: TeacherWageRuleBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.wagesService.updateRule(id, body, user.id);
  }

  @Get("teacher")
  @RequirePermissions("teacher_wages.manage")
  listSnapshots(@Query() query: ListTeacherWageSnapshotsQuery) {
    return this.wagesService.listSnapshots(query);
  }

  @Get("teacher/:id")
  @RequirePermissions("teacher_wages.manage")
  getSnapshot(@Param("id") id: string) {
    return this.wagesService.getSnapshot(id);
  }

  @Post("teacher/preview")
  @RequirePermissions("teacher_wages.manage")
  previewTeacherWage(@Body() body: PreviewTeacherWageBody) {
    return this.wagesService.previewTeacherWage(body);
  }

  @Post("teacher/lock")
  @RequirePermissions("teacher_wages.manage")
  lockTeacherWage(
    @Body() body: LockTeacherWageBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.wagesService.lockTeacherWage(body, user.id);
  }

  @Patch("teacher/:id/adjustments")
  @RequirePermissions("teacher_wages.manage")
  updateAdjustments(
    @Param("id") id: string,
    @Body() body: UpdateTeacherWageAdjustmentsBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.wagesService.updateAdjustments(id, body, user.id);
  }

  @Post("attendance/export")
  @RequirePermissions("teacher_attendance_import.manage")
  exportAttendanceWorkbook(
    @Body() body: TeacherAttendanceWorkbookBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.wagesService.exportAttendanceWorkbook(body, user.id);
  }

  @Post("attendance/import-preview")
  @RequirePermissions("teacher_attendance_import.manage")
  previewAttendanceWorkbookImport(@Body() body: TeacherAttendanceWorkbookImportBody) {
    return this.wagesService.previewAttendanceWorkbookImport(body);
  }

  @Post("attendance/import-confirm")
  @RequirePermissions("teacher_attendance_import.manage")
  confirmAttendanceWorkbookImport(
    @Body() body: TeacherAttendanceWorkbookImportBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.wagesService.confirmAttendanceWorkbookImport(body, user.id);
  }

  @Post("teacher/:id/attendance-export")
  @RequirePermissions("teacher_attendance_import.manage")
  exportAttendanceSheet(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.wagesService.exportAttendanceSheet(id, user.id);
  }

  @Post("teacher/:id/attendance-import-preview")
  @RequirePermissions("teacher_attendance_import.manage")
  previewAttendanceImport(
    @Param("id") id: string,
    @Body() body: ImportTeacherAttendanceAdjustmentsBody,
  ) {
    return this.wagesService.previewAttendanceImport(id, body);
  }

  @Post("teacher/:id/attendance-import-confirm")
  @RequirePermissions("teacher_attendance_import.manage")
  confirmAttendanceImport(
    @Param("id") id: string,
    @Body() body: ImportTeacherAttendanceAdjustmentsBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.wagesService.confirmAttendanceImport(id, body, user.id);
  }

  @Post("teacher/:id/confirm-adjustments")
  @RequirePermissions("teacher_wages.manage")
  confirmAdjustments(
    @Param("id") id: string,
    @Body() body: ConfirmTeacherWageAdjustmentsBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.wagesService.confirmAdjustments(id, body, user.id);
  }

  @Post("teacher/:id/revoke")
  @RequirePermissions("teacher_wages.manage")
  revokeSnapshot(
    @Param("id") id: string,
    @Body() body: RevokeTeacherWageSnapshotBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.wagesService.revokeSnapshot(id, body, user.id);
  }
}
