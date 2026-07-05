import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { MoneyModule } from "../money/money.module";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";

@Module({
  imports: [AuthModule, AuditModule, MoneyModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
