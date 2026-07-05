import {
  Body,
  Controller,
  Delete,
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
import { ExternalWorkService } from "./external-work.service";
import {
  ExternalWorkLessonBody,
  GenerateExternalWorkActualBody,
  GenerateExternalWorkIncomeBody,
  ListExternalWorkLessonsQuery,
  ListExternalWorkSettlementsQuery,
  LockExternalWorkSettlementBody,
  PreviewExternalWorkSettlementBody,
  RevokeExternalWorkSettlementBody,
} from "./external-work.types";

@Controller("external-work")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ExternalWorkController {
  constructor(
    @Inject(ExternalWorkService)
    private readonly externalWorkService: ExternalWorkService,
  ) {}

  @Get("lessons")
  @RequirePermissions("external_work.manage")
  listLessons(@Query() query: ListExternalWorkLessonsQuery) {
    return this.externalWorkService.listLessons(query);
  }

  @Get("lessons/:id")
  @RequirePermissions("external_work.manage")
  getLesson(@Param("id") id: string) {
    return this.externalWorkService.getLesson(id);
  }

  @Post("lessons/planned")
  @RequirePermissions("external_work.manage")
  createPlannedLesson(
    @Body() body: ExternalWorkLessonBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.externalWorkService.createPlannedLesson(body, user.id);
  }

  @Patch("lessons/:id")
  @RequirePermissions("external_work.manage")
  updateLesson(
    @Param("id") id: string,
    @Body() body: ExternalWorkLessonBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.externalWorkService.updateLesson(id, body, user.id);
  }

  @Delete("lessons/:id")
  @RequirePermissions("external_work.manage")
  deleteLesson(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.externalWorkService.deleteLesson(id, user.id);
  }

  @Post("lessons/:id/generate-actual")
  @RequirePermissions("external_work.manage")
  generateActualLesson(
    @Param("id") id: string,
    @Body() body: GenerateExternalWorkActualBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.externalWorkService.generateActualLesson(id, body, user.id);
  }

  @Get("settlements")
  @RequirePermissions("external_work.manage")
  listSettlements(@Query() query: ListExternalWorkSettlementsQuery) {
    return this.externalWorkService.listSettlements(query);
  }

  @Get("settlements/:id")
  @RequirePermissions("external_work.manage")
  getSettlement(@Param("id") id: string) {
    return this.externalWorkService.getSettlement(id);
  }

  @Post("settlements/preview")
  @RequirePermissions("external_work.manage")
  previewSettlement(@Body() body: PreviewExternalWorkSettlementBody) {
    return this.externalWorkService.previewSettlement(body);
  }

  @Post("settlements/lock")
  @RequirePermissions("external_work.manage")
  lockSettlement(
    @Body() body: LockExternalWorkSettlementBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.externalWorkService.lockSettlement(body, user.id);
  }

  @Post("settlements/:id/revoke")
  @RequirePermissions("external_work.manage")
  revokeSettlement(
    @Param("id") id: string,
    @Body() body: RevokeExternalWorkSettlementBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.externalWorkService.revokeSettlement(id, body, user.id);
  }

  @Post("settlements/:id/generate-income")
  @RequirePermissions("income.manage")
  generateIncome(
    @Param("id") id: string,
    @Body() body: GenerateExternalWorkIncomeBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.externalWorkService.generateIncome(id, body, user.id);
  }
}
