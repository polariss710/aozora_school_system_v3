import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { TuitionBillingController } from "./tuition-billing.controller";
import { TuitionBillingService } from "./tuition-billing.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [TuitionBillingController],
  providers: [TuitionBillingService],
})
export class TuitionBillingModule {}
