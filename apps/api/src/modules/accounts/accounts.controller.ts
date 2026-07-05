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
  CreateAccountTransferBody,
  CreateAccountTransactionFromExpenseBody,
  CreateAccountTransactionFromIncomeBody,
  ListAccountsQuery,
  ListAccountTransactionsQuery,
  ListAccountTransfersQuery,
  ManualAccountTransactionBody,
  ReverseAccountTransactionBody,
  VoidAccountTransferBody,
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

  @Get("transfers")
  @RequirePermissions("account_transactions.read")
  listAccountTransfers(@Query() query: ListAccountTransfersQuery) {
    return this.accountsService.listAccountTransfers(query);
  }

  @Get("transfers/:id")
  @RequirePermissions("account_transactions.read")
  getAccountTransfer(@Param("id") id: string) {
    return this.accountsService.getAccountTransfer(id);
  }

  @Post("transfers")
  @RequirePermissions("account_transactions.manage")
  createAccountTransfer(
    @Body() body: CreateAccountTransferBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountsService.createAccountTransfer(body, user.id);
  }

  @Post("transfers/:id/void")
  @RequirePermissions("account_transactions.manage")
  voidAccountTransfer(
    @Param("id") id: string,
    @Body() body: VoidAccountTransferBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountsService.voidAccountTransfer(id, body, user.id);
  }

  @Get("transactions/:id")
  @RequirePermissions("account_transactions.read")
  getAccountTransaction(@Param("id") id: string) {
    return this.accountsService.getAccountTransaction(id);
  }

  @Post("transactions/manual")
  @RequirePermissions("account_transactions.manage")
  createManualAccountTransaction(
    @Body() body: ManualAccountTransactionBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountsService.createManualAccountTransaction(body, user.id);
  }

  @Post("transactions/from-income/:incomeRecordId")
  @RequirePermissions("account_transactions.manage")
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
  @RequirePermissions("account_transactions.manage")
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

  @Post("transactions/:id/reverse")
  @RequirePermissions("account_transactions.manage")
  reverseAccountTransaction(
    @Param("id") id: string,
    @Body() body: ReverseAccountTransactionBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountsService.reverseAccountTransaction(id, body, user.id);
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
