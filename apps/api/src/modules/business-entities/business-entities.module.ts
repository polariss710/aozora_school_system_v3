import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { BusinessEntitiesController } from "./business-entities.controller";
import { BusinessEntitiesService } from "./business-entities.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [BusinessEntitiesController],
  providers: [BusinessEntitiesService],
})
export class BusinessEntitiesModule {}
