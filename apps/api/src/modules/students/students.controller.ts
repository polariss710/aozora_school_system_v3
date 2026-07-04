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
import { ListStudentsQuery, StudentWriteBody } from "./students.types";
import { StudentsService } from "./students.service";

@Controller("students")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class StudentsController {
  constructor(
    @Inject(StudentsService) private readonly studentsService: StudentsService,
  ) {}

  @Get()
  @RequirePermissions("students.manage")
  listStudents(@Query() query: ListStudentsQuery) {
    return this.studentsService.listStudents(query);
  }

  @Get(":id")
  @RequirePermissions("students.manage")
  getStudent(@Param("id") id: string) {
    return this.studentsService.getStudent(id);
  }

  @Post()
  @RequirePermissions("students.manage")
  createStudent(
    @Body() body: StudentWriteBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentsService.createStudent(body, user.id);
  }

  @Patch(":id")
  @RequirePermissions("students.manage")
  updateStudent(
    @Param("id") id: string,
    @Body() body: StudentWriteBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentsService.updateStudent(id, body, user.id);
  }

  @Post(":id/archive")
  @RequirePermissions("students.manage")
  archiveStudent(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentsService.archiveStudent(id, user.id);
  }

  @Post(":id/restore")
  @RequirePermissions("students.manage")
  restoreStudent(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentsService.restoreStudent(id, user.id);
  }
}
