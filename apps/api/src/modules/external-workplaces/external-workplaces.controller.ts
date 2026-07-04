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
import { ExternalWorkplacesService } from "./external-workplaces.service";
import {
  ExternalWorkplaceWriteBody,
  ListExternalWorkplacesQuery,
} from "./external-workplaces.types";

@Controller("external-workplaces")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ExternalWorkplacesController {
  constructor(
    @Inject(ExternalWorkplacesService)
    private readonly externalWorkplacesService: ExternalWorkplacesService,
  ) {}

  @Get()
  @RequirePermissions("external_work.manage")
  listExternalWorkplaces(@Query() query: ListExternalWorkplacesQuery) {
    return this.externalWorkplacesService.listExternalWorkplaces(query);
  }

  @Get(":id")
  @RequirePermissions("external_work.manage")
  getExternalWorkplace(@Param("id") id: string) {
    return this.externalWorkplacesService.getExternalWorkplace(id);
  }

  @Post()
  @RequirePermissions("external_work.manage")
  createExternalWorkplace(
    @Body() body: ExternalWorkplaceWriteBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.externalWorkplacesService.createExternalWorkplace(
      body,
      user.id,
    );
  }

  @Patch(":id")
  @RequirePermissions("external_work.manage")
  updateExternalWorkplace(
    @Param("id") id: string,
    @Body() body: ExternalWorkplaceWriteBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.externalWorkplacesService.updateExternalWorkplace(
      id,
      body,
      user.id,
    );
  }

  @Post(":id/archive")
  @RequirePermissions("external_work.manage")
  archiveExternalWorkplace(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.externalWorkplacesService.archiveExternalWorkplace(id, user.id);
  }

  @Post(":id/restore")
  @RequirePermissions("external_work.manage")
  restoreExternalWorkplace(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.externalWorkplacesService.restoreExternalWorkplace(id, user.id);
  }
}
