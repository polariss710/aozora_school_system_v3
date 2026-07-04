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
import { ListSubjectsQuery, SubjectWriteBody } from "./subjects.types";
import { SubjectsService } from "./subjects.service";

@Controller("subjects")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SubjectsController {
  constructor(
    @Inject(SubjectsService) private readonly subjectsService: SubjectsService,
  ) {}

  @Get()
  @RequirePermissions("settings.manage")
  listSubjects(@Query() query: ListSubjectsQuery) {
    return this.subjectsService.listSubjects(query);
  }

  @Get(":id")
  @RequirePermissions("settings.manage")
  getSubject(@Param("id") id: string) {
    return this.subjectsService.getSubject(id);
  }

  @Post()
  @RequirePermissions("settings.manage")
  createSubject(
    @Body() body: SubjectWriteBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subjectsService.createSubject(body, user.id);
  }

  @Patch(":id")
  @RequirePermissions("settings.manage")
  updateSubject(
    @Param("id") id: string,
    @Body() body: SubjectWriteBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subjectsService.updateSubject(id, body, user.id);
  }

  @Post(":id/archive")
  @RequirePermissions("settings.manage")
  archiveSubject(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subjectsService.archiveSubject(id, user.id);
  }

  @Post(":id/restore")
  @RequirePermissions("settings.manage")
  restoreSubject(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subjectsService.restoreSubject(id, user.id);
  }
}
