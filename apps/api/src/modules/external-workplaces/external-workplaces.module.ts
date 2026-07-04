import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { ExternalWorkplacesController } from "./external-workplaces.controller";
import { ExternalWorkplacesService } from "./external-workplaces.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [ExternalWorkplacesController],
  providers: [ExternalWorkplacesService],
})
export class ExternalWorkplacesModule {}
