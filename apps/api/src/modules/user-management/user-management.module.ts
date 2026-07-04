import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { UserManagementController } from "./user-management.controller";
import { UserManagementService } from "./user-management.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [UserManagementController],
  providers: [UserManagementService],
})
export class UserManagementModule {}
