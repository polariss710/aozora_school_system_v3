import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { MoneyModule } from "../money/money.module";
import { WagesController } from "./wages.controller";
import { WagesService } from "./wages.service";

@Module({
  imports: [DatabaseModule, MoneyModule, AuditModule, AuthModule],
  controllers: [WagesController],
  providers: [WagesService],
})
export class WagesModule {}
