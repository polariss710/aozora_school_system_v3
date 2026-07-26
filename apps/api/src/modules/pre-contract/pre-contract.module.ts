import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { MoneyModule } from "../money/money.module";
import { PreContractController } from "./pre-contract.controller";
import { PreContractService } from "./pre-contract.service";

@Module({ imports: [DatabaseModule, AuditModule, AuthModule, MoneyModule], controllers: [PreContractController], providers: [PreContractService] })
export class PreContractModule {}
