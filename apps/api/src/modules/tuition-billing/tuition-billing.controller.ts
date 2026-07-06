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
import { TuitionBillingService } from "./tuition-billing.service";
import {
  GenerateTuitionBillBody,
  ListTuitionBillsQuery,
} from "./tuition-billing.types";

@Controller("tuition-bills")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TuitionBillingController {
  constructor(
    @Inject(TuitionBillingService)
    private readonly tuitionBillingService: TuitionBillingService,
  ) {}

  @Get()
  @RequirePermissions("tuition_billing.manage")
  listTuitionBills(@Query() query: ListTuitionBillsQuery) {
    return this.tuitionBillingService.listTuitionBills(query);
  }

  @Get(":id")
  @RequirePermissions("tuition_billing.manage")
  getTuitionBill(@Param("id") id: string) {
    return this.tuitionBillingService.getTuitionBill(id);
  }

  @Get(":id/export-payload")
  @RequirePermissions("tuition_billing.manage")
  exportTuitionBill(@Param("id") id: string) {
    return this.tuitionBillingService.exportTuitionBill(id);
  }

  @Post("generate")
  @RequirePermissions("tuition_billing.manage")
  generateTuitionBill(
    @Body() body: GenerateTuitionBillBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tuitionBillingService.generateTuitionBill(body, user.id);
  }

  @Post(":id/generate-income")
  @RequirePermissions("income.manage")
  generateIncomeRecord(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tuitionBillingService.generateIncomeRecord(id, user.id);
  }
}
