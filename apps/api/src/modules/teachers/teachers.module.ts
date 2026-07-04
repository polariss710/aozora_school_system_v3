import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { TeachersController } from "./teachers.controller";
import { TeachersService } from "./teachers.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [TeachersController],
  providers: [TeachersService],
})
export class TeachersModule {}
