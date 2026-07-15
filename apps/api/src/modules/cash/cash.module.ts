import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { MoneyModule } from "../money/money.module";
import { CashCallbackController } from "./cash-callback.controller";
import { CashController } from "./cash.controller";
import { CASH_GATEWAY, createCashGatewayFromEnv } from "./cash.gateway";
import { CashService } from "./cash.service";

@Module({
  imports: [AuthModule, AuditModule, MoneyModule],
  controllers: [CashController, CashCallbackController],
  providers: [
    {
      provide: CASH_GATEWAY,
      useFactory: createCashGatewayFromEnv,
    },
    CashService,
  ],
})
export class CashModule {}
