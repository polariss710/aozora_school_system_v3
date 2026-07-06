import { Controller, Get, Inject, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionGuard } from "../auth/permission.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { SettingsService } from "./settings.service";

@Controller("settings")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SettingsController {
  constructor(
    @Inject(SettingsService) private readonly settingsService: SettingsService,
  ) {}

  @Get("business-entities")
  @RequirePermissions("settings.manage")
  listBusinessEntities() {
    return this.settingsService.listBusinessEntities();
  }

  @Get("accounts")
  @RequirePermissions("accounts.read")
  listAccounts() {
    return this.settingsService.listAccounts();
  }

  @Get("money-rules")
  @RequirePermissions("settings.manage")
  getMoneyRules() {
    return this.settingsService.getMoneyRules();
  }

  @Get("roles")
  @RequirePermissions("users.manage")
  listRoles() {
    return this.settingsService.listRoles();
  }

  @Get("roles/:id")
  @RequirePermissions("users.manage")
  getRole(@Param("id") id: string) {
    return this.settingsService.getRole(id);
  }

  @Get("permissions")
  @RequirePermissions("users.manage")
  listPermissions() {
    return this.settingsService.listPermissions();
  }

  @Get("subjects")
  @RequirePermissions("settings.manage")
  listSubjects() {
    return this.settingsService.listSubjects();
  }

  @Get("external-workplaces")
  @RequirePermissions("settings.manage")
  listExternalWorkplaces() {
    return this.settingsService.listExternalWorkplaces();
  }
}
