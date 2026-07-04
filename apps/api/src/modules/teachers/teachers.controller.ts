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
import { ListTeachersQuery, TeacherWriteBody } from "./teachers.types";
import { TeachersService } from "./teachers.service";

@Controller("teachers")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TeachersController {
  constructor(
    @Inject(TeachersService) private readonly teachersService: TeachersService,
  ) {}

  @Get()
  @RequirePermissions("teachers.manage")
  listTeachers(@Query() query: ListTeachersQuery) {
    return this.teachersService.listTeachers(query);
  }

  @Get(":id")
  @RequirePermissions("teachers.manage")
  getTeacher(@Param("id") id: string) {
    return this.teachersService.getTeacher(id);
  }

  @Post()
  @RequirePermissions("teachers.manage")
  createTeacher(
    @Body() body: TeacherWriteBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teachersService.createTeacher(body, user.id);
  }

  @Patch(":id")
  @RequirePermissions("teachers.manage")
  updateTeacher(
    @Param("id") id: string,
    @Body() body: TeacherWriteBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teachersService.updateTeacher(id, body, user.id);
  }

  @Post(":id/archive")
  @RequirePermissions("teachers.manage")
  archiveTeacher(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teachersService.archiveTeacher(id, user.id);
  }

  @Post(":id/restore")
  @RequirePermissions("teachers.manage")
  restoreTeacher(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teachersService.restoreTeacher(id, user.id);
  }
}
