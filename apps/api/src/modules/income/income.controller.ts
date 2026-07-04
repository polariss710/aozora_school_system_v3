import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionGuard } from "../auth/permission.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { AuthenticatedUser } from "../users/users.types";
import { IncomeService } from "./income.service";
import { ListIncomeRecordsQuery, ManualIncomeBody } from "./income.types";

@Controller("income")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class IncomeController {
  constructor(
    @Inject(IncomeService) private readonly incomeService: IncomeService,
  ) {}

  @Get()
  @RequirePermissions("income.manage")
  listIncomeRecords(@Query() query: ListIncomeRecordsQuery) {
    return this.incomeService.listIncomeRecords(query);
  }

  @Get(":id")
  @RequirePermissions("income.manage")
  getIncomeRecord(@Param("id") id: string) {
    return this.incomeService.getIncomeRecord(id);
  }

  @Post("manual")
  @RequirePermissions("income.manage")
  createManualIncome(
    @Body() body: ManualIncomeBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incomeService.createManualIncome(body, user.id);
  }

  @Post(":id/void")
  @RequirePermissions("income.manage")
  voidIncomeRecord(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incomeService.voidIncomeRecord(id, user.id);
  }
}
