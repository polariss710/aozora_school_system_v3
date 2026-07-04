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
import { BusinessEntitiesService } from "./business-entities.service";
import {
  BusinessEntityWriteBody,
  ListBusinessEntitiesQuery,
} from "./business-entities.types";

@Controller("business-entities")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BusinessEntitiesController {
  constructor(
    @Inject(BusinessEntitiesService)
    private readonly businessEntitiesService: BusinessEntitiesService,
  ) {}

  @Get()
  @RequirePermissions("settings.manage")
  listBusinessEntities(@Query() query: ListBusinessEntitiesQuery) {
    return this.businessEntitiesService.listBusinessEntities(query);
  }

  @Get(":id")
  @RequirePermissions("settings.manage")
  getBusinessEntity(@Param("id") id: string) {
    return this.businessEntitiesService.getBusinessEntity(id);
  }

  @Post()
  @RequirePermissions("settings.manage")
  createBusinessEntity(
    @Body() body: BusinessEntityWriteBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.businessEntitiesService.createBusinessEntity(body, user.id);
  }

  @Patch(":id")
  @RequirePermissions("settings.manage")
  updateBusinessEntity(
    @Param("id") id: string,
    @Body() body: BusinessEntityWriteBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.businessEntitiesService.updateBusinessEntity(
      id,
      body,
      user.id,
    );
  }

  @Post(":id/archive")
  @RequirePermissions("settings.manage")
  archiveBusinessEntity(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.businessEntitiesService.archiveBusinessEntity(id, user.id);
  }

  @Post(":id/restore")
  @RequirePermissions("settings.manage")
  restoreBusinessEntity(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.businessEntitiesService.restoreBusinessEntity(id, user.id);
  }
}
