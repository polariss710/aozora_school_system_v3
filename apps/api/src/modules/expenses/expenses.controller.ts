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
import { ExpensesService } from "./expenses.service";
import {
  CreateExpenseFromWageBody,
  ListExpenseRecordsQuery,
  VoidExpenseRecordBody,
} from "./expenses.types";

@Controller("expenses")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ExpensesController {
  constructor(
    @Inject(ExpensesService)
    private readonly expensesService: ExpensesService,
  ) {}

  @Get()
  @RequirePermissions("expenses.manage")
  listExpenseRecords(@Query() query: ListExpenseRecordsQuery) {
    return this.expensesService.listExpenseRecords(query);
  }

  @Get(":id")
  @RequirePermissions("expenses.manage")
  getExpenseRecord(@Param("id") id: string) {
    return this.expensesService.getExpenseRecord(id);
  }

  @Post("from-wage/:snapshotId")
  @RequirePermissions("expenses.manage")
  createFromWageSnapshot(
    @Param("snapshotId") snapshotId: string,
    @Body() body: CreateExpenseFromWageBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expensesService.createFromWageSnapshot(
      snapshotId,
      body,
      user.id,
    );
  }

  @Post(":id/void")
  @RequirePermissions("expenses.manage")
  voidExpenseRecord(
    @Param("id") id: string,
    @Body() body: VoidExpenseRecordBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expensesService.voidExpenseRecord(id, body, user.id);
  }
}
