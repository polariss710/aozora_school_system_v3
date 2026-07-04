import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { MoneyModule } from "../money/money.module";
import { IncomeController } from "./income.controller";
import { IncomeService } from "./income.service";

@Module({
  imports: [AuthModule, AuditModule, MoneyModule],
  controllers: [IncomeController],
  providers: [IncomeService],
})
export class IncomeModule {}
