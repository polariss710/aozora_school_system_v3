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
import { AccountsService } from "./accounts.service";
import {
  AccountWriteBody,
  CreateAccountTransactionFromExpenseBody,
  CreateAccountTransactionFromIncomeBody,
  ListAccountsQuery,
  ListAccountTransactionsQuery,
  ManualAccountTransactionBody,
} from "./accounts.types";

@Controller("accounts")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AccountsController {
  constructor(
    @Inject(AccountsService) private readonly accountsService: AccountsService,
  ) {}

  @Get()
  @RequirePermissions("accounts.read")
  listAccounts(@Query() query: ListAccountsQuery) {
    return this.accountsService.listAccounts(query);
  }

  @Get("transactions")
  @RequirePermissions("account_transactions.read")
  listAccountTransactions(@Query() query: ListAccountTransactionsQuery) {
    return this.accountsService.listAccountTransactions(query);
  }

  @Get("transactions/:id")
  @RequirePermissions("account_transactions.read")
  getAccountTransaction(@Param("id") id: string) {
    return this.accountsService.getAccountTransaction(id);
  }

  @Post("transactions/manual")
  @RequirePermissions("account_transactions.read")
  createManualAccountTransaction(
    @Body() body: ManualAccountTransactionBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountsService.createManualAccountTransaction(body, user.id);
  }

  @Post("transactions/from-income/:incomeRecordId")
  @RequirePermissions("account_transactions.read")
  createTransactionFromIncomeRecord(
    @Param("incomeRecordId") incomeRecordId: string,
    @Body() body: CreateAccountTransactionFromIncomeBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountsService.createTransactionFromIncomeRecord(
      incomeRecordId,
      body,
      user.id,
    );
  }

  @Post("transactions/from-expense/:expenseRecordId")
  @RequirePermissions("account_transactions.read")
  createTransactionFromExpenseRecord(
    @Param("expenseRecordId") expenseRecordId: string,
    @Body() body: CreateAccountTransactionFromExpenseBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountsService.createTransactionFromExpenseRecord(
      expenseRecordId,
      body,
      user.id,
    );
  }

  @Get(":id")
  @RequirePermissions("accounts.read")
  getAccount(@Param("id") id: string) {
    return this.accountsService.getAccount(id);
  }

  @Post()
  @RequirePermissions("settings.manage")
  createAccount(
    @Body() body: AccountWriteBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountsService.createAccount(body, user.id);
  }

  @Patch(":id")
  @RequirePermissions("settings.manage")
  updateAccount(
    @Param("id") id: string,
    @Body() body: AccountWriteBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountsService.updateAccount(id, body, user.id);
  }

  @Post(":id/archive")
  @RequirePermissions("settings.manage")
  archiveAccount(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountsService.archiveAccount(id, user.id);
  }

  @Post(":id/restore")
  @RequirePermissions("settings.manage")
  restoreAccount(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountsService.restoreAccount(id, user.id);
  }
}
