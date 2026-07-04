import { Module } from "@nestjs/common";
import { AccountsModule } from "./modules/accounts/accounts.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CashModule } from "./modules/cash/cash.module";
import { DatabaseModule } from "./modules/database/database.module";
import { ExpensesModule } from "./modules/expenses/expenses.module";
import { HealthModule } from "./modules/health/health.module";
import { IncomeModule } from "./modules/income/income.module";
import { LessonsModule } from "./modules/lessons/lessons.module";
import { MoneyModule } from "./modules/money/money.module";
import { SettlementsModule } from "./modules/settlements/settlements.module";
import { TuitionBillingModule } from "./modules/tuition-billing/tuition-billing.module";
import { UsersModule } from "./modules/users/users.module";
import { VersionModule } from "./modules/version/version.module";
import { WagesModule } from "./modules/wages/wages.module";

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    VersionModule,
    MoneyModule,
    AuthModule,
    UsersModule,
    LessonsModule,
    TuitionBillingModule,
    SettlementsModule,
    WagesModule,
    IncomeModule,
    ExpensesModule,
    CashModule,
    AccountsModule,
    AuditModule,
  ],
})
export class AppModule {}
