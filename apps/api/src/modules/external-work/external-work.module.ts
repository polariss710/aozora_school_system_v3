import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { MoneyModule } from "../money/money.module";
import { ExternalWorkController } from "./external-work.controller";
import { ExternalWorkService } from "./external-work.service";

@Module({
  imports: [DatabaseModule, MoneyModule, AuditModule, AuthModule],
  controllers: [ExternalWorkController],
  providers: [ExternalWorkService],
})
export class ExternalWorkModule {}
