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
import { ReimbursementsService } from "./reimbursements.service";
import {
  CreateReimbursementBody,
  ListReimbursementCandidateExpensesQuery,
  ListReimbursementsQuery,
  VoidReimbursementBody,
} from "./reimbursements.types";

@Controller("reimbursements")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReimbursementsController {
  constructor(
    @Inject(ReimbursementsService)
    private readonly reimbursementsService: ReimbursementsService,
  ) {}

  @Get()
  @RequirePermissions("reimbursements.manage")
  listReimbursements(@Query() query: ListReimbursementsQuery) {
    return this.reimbursementsService.listReimbursements(query);
  }

  @Get("candidates/expenses")
  @RequirePermissions("reimbursements.manage")
  listCandidateExpenses(@Query() query: ListReimbursementCandidateExpensesQuery) {
    return this.reimbursementsService.listCandidateExpenses(query);
  }

  @Get(":id")
  @RequirePermissions("reimbursements.manage")
  getReimbursement(@Param("id") id: string) {
    return this.reimbursementsService.getReimbursement(id);
  }

  @Post("from-expense/:expenseRecordId")
  @RequirePermissions("reimbursements.manage")
  createFromExpense(
    @Param("expenseRecordId") expenseRecordId: string,
    @Body() body: CreateReimbursementBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reimbursementsService.createFromExpense(
      expenseRecordId,
      body,
      user.id,
    );
  }

  @Post(":id/void")
  @RequirePermissions("reimbursements.manage")
  voidReimbursement(
    @Param("id") id: string,
    @Body() body: VoidReimbursementBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reimbursementsService.voidReimbursement(id, body, user.id);
  }
}
