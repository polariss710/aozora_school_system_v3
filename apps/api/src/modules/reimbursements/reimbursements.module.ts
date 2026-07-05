import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { ReimbursementsController } from "./reimbursements.controller";
import { ReimbursementsService } from "./reimbursements.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [ReimbursementsController],
  providers: [ReimbursementsService],
})
export class ReimbursementsModule {}
