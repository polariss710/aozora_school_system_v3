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
import { UserManagementService } from "./user-management.service";
import {
  ListUsersQuery,
  UserPasswordBody,
  UserWriteBody,
} from "./user-management.types";

@Controller("users")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UserManagementController {
  constructor(
    @Inject(UserManagementService)
    private readonly userManagementService: UserManagementService,
  ) {}

  @Get()
  @RequirePermissions("users.manage")
  listUsers(@Query() query: ListUsersQuery) {
    return this.userManagementService.listUsers(query);
  }

  @Get(":id")
  @RequirePermissions("users.manage")
  getUser(@Param("id") id: string) {
    return this.userManagementService.getUser(id);
  }

  @Post()
  @RequirePermissions("users.manage")
  createUser(
    @Body() body: UserWriteBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userManagementService.createUser(body, user.id);
  }

  @Patch(":id")
  @RequirePermissions("users.manage")
  updateUser(
    @Param("id") id: string,
    @Body() body: UserWriteBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userManagementService.updateUser(id, body, user.id);
  }

  @Post(":id/password")
  @RequirePermissions("users.manage")
  updatePassword(
    @Param("id") id: string,
    @Body() body: UserPasswordBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userManagementService.updatePassword(id, body, user.id);
  }

  @Post(":id/suspend")
  @RequirePermissions("users.manage")
  suspendUser(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userManagementService.suspendUser(id, user.id);
  }

  @Post(":id/activate")
  @RequirePermissions("users.manage")
  activateUser(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userManagementService.activateUser(id, user.id);
  }
}
