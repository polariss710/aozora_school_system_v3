import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { LessonsController } from "./lessons.controller";
import { LessonsService } from "./lessons.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [LessonsController],
  providers: [LessonsService],
})
export class LessonsModule {}
