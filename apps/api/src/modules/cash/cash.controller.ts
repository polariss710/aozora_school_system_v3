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
import { CashService } from "./cash.service";
import {
  ConfirmCashRequestBody,
  ListCashRequestsQuery,
  RejectCashRequestBody,
  SubmitExpenseCashRequestBody,
  SubmitIncomeCashRequestBody,
  WithdrawCashRequestBody,
} from "./cash.types";

@Controller("cash")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CashController {
  constructor(@Inject(CashService) private readonly cashService: CashService) {}

  @Get("requests")
  @RequirePermissions("cash_requests.manage")
  listCashRequests(@Query() query: ListCashRequestsQuery) {
    return this.cashService.listCashRequests(query);
  }

  @Get("requests/:id")
  @RequirePermissions("cash_requests.manage")
  getCashRequest(@Param("id") id: string) {
    return this.cashService.getCashRequest(id);
  }

  @Post("requests/income/:incomeRecordId")
  @RequirePermissions("cash_requests.manage")
  submitIncomeCashRequest(
    @Param("incomeRecordId") incomeRecordId: string,
    @Body() body: SubmitIncomeCashRequestBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cashService.submitIncomeCashRequest(
      incomeRecordId,
      body,
      user.id,
    );
  }

  @Post("requests/expense/:expenseRecordId")
  @RequirePermissions("cash_requests.manage")
  submitExpenseCashRequest(
    @Param("expenseRecordId") expenseRecordId: string,
    @Body() body: SubmitExpenseCashRequestBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cashService.submitExpenseCashRequest(
      expenseRecordId,
      body,
      user.id,
    );
  }

  @Post("requests/:id/reject")
  @RequirePermissions("cash_requests.manage")
  rejectCashRequest(
    @Param("id") id: string,
    @Body() body: RejectCashRequestBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cashService.rejectCashRequest(id, body, user.id);
  }

  @Post("requests/:id/withdraw")
  @RequirePermissions("cash_requests.manage")
  withdrawCashRequest(
    @Param("id") id: string,
    @Body() body: WithdrawCashRequestBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cashService.withdrawCashRequest(id, body, user.id);
  }

  @Post("requests/:id/confirm")
  @RequirePermissions("cash_requests.manage")
  confirmCashRequest(
    @Param("id") id: string,
    @Body() body: ConfirmCashRequestBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cashService.confirmCashRequest(id, body, user.id);
  }
}
