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
import { LessonsService } from "./lessons.service";
import {
  ActualLessonWriteBody,
  BatchPlannedLessonsBody,
  ListLessonsQuery,
  PlannedLessonWriteBody,
} from "./lessons.types";

@Controller("lessons")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class LessonsController {
  constructor(
    @Inject(LessonsService) private readonly lessonsService: LessonsService,
  ) {}

  @Get("planned")
  @RequirePermissions("lessons.manage")
  listPlannedLessons(@Query() query: ListLessonsQuery) {
    return this.lessonsService.listPlannedLessons(query);
  }

  @Get("planned/:id")
  @RequirePermissions("lessons.manage")
  getPlannedLesson(@Param("id") id: string) {
    return this.lessonsService.getPlannedLesson(id);
  }

  @Post("planned")
  @RequirePermissions("lessons.manage")
  createPlannedLesson(
    @Body() body: PlannedLessonWriteBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.createPlannedLesson(body, user.id);
  }

  @Post("planned/batch-preview")
  @RequirePermissions("lessons.manage")
  previewBatchPlannedLessons(@Body() body: BatchPlannedLessonsBody) {
    return this.lessonsService.previewBatchPlannedLessons(body);
  }

  @Post("planned/batch-create")
  @RequirePermissions("lessons.manage")
  createBatchPlannedLessons(
    @Body() body: BatchPlannedLessonsBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.createBatchPlannedLessons(body, user.id);
  }

  @Patch("planned/:id")
  @RequirePermissions("lessons.manage")
  updatePlannedLesson(
    @Param("id") id: string,
    @Body() body: PlannedLessonWriteBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.updatePlannedLesson(id, body, user.id);
  }

  @Post("planned/:id/cancel")
  @RequirePermissions("lessons.manage")
  cancelPlannedLesson(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.cancelPlannedLesson(id, user.id);
  }

  @Post("planned/:id/restore")
  @RequirePermissions("lessons.manage")
  restorePlannedLesson(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.restorePlannedLesson(id, user.id);
  }

  @Post("planned/:id/mark-makeup-pending")
  @RequirePermissions("lessons.manage")
  markMakeupPending(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.markMakeupPending(id, user.id);
  }

  @Post("planned/:id/generate-actual")
  @RequirePermissions("lessons.manage")
  generateActualLesson(
    @Param("id") id: string,
    @Body() body: ActualLessonWriteBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.generateActualLesson(id, body, user.id);
  }

  @Get("actual")
  @RequirePermissions("lessons.manage")
  listActualLessons(@Query() query: ListLessonsQuery) {
    return this.lessonsService.listActualLessons(query);
  }

  @Get("actual/:id")
  @RequirePermissions("lessons.manage")
  getActualLesson(@Param("id") id: string) {
    return this.lessonsService.getActualLesson(id);
  }

  @Patch("actual/:id")
  @RequirePermissions("lessons.manage")
  updateActualLesson(
    @Param("id") id: string,
    @Body() body: ActualLessonWriteBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.updateActualLesson(id, body, user.id);
  }
}
