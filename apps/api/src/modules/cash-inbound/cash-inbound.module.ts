import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { MoneyModule } from "../money/money.module";
import { CashInboundController } from "./cash-inbound.controller";
import { CashInboundService } from "./cash-inbound.service";

@Module({
  imports: [AuthModule, AuditModule, MoneyModule],
  controllers: [CashInboundController],
  providers: [CashInboundService],
  exports: [CashInboundService],
})
export class CashInboundModule {}
