import { Module } from "@nestjs/common";
import { AccountsModule } from "./modules/accounts/accounts.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BusinessEntitiesModule } from "./modules/business-entities/business-entities.module";
import { CashInboundModule } from "./modules/cash-inbound/cash-inbound.module";
import { CashModule } from "./modules/cash/cash.module";
import { DatabaseModule } from "./modules/database/database.module";
import { ExpensesModule } from "./modules/expenses/expenses.module";
import { ExternalWorkModule } from "./modules/external-work/external-work.module";
import { ExternalWorkplacesModule } from "./modules/external-workplaces/external-workplaces.module";
import { HealthModule } from "./modules/health/health.module";
import { IncomeModule } from "./modules/income/income.module";
import { LessonsModule } from "./modules/lessons/lessons.module";
import { MoneyModule } from "./modules/money/money.module";
import { OperationsModule } from "./modules/operations/operations.module";
import { ReimbursementsModule } from "./modules/reimbursements/reimbursements.module";
import { SettlementsModule } from "./modules/settlements/settlements.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { StudentsModule } from "./modules/students/students.module";
import { SubjectsModule } from "./modules/subjects/subjects.module";
import { TeachersModule } from "./modules/teachers/teachers.module";
import { TuitionBillingModule } from "./modules/tuition-billing/tuition-billing.module";
import { UserManagementModule } from "./modules/user-management/user-management.module";
import { UsersModule } from "./modules/users/users.module";
import { VersionModule } from "./modules/version/version.module";
import { WagesModule } from "./modules/wages/wages.module";

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    VersionModule,
    SettingsModule,
    BusinessEntitiesModule,
    StudentsModule,
    SubjectsModule,
    TeachersModule,
    ExternalWorkplacesModule,
    ExternalWorkModule,
    MoneyModule,
    OperationsModule,
    AuthModule,
    UserManagementModule,
    UsersModule,
    LessonsModule,
    TuitionBillingModule,
    SettlementsModule,
    WagesModule,
    IncomeModule,
    ExpensesModule,
    CashModule,
    CashInboundModule,
    AccountsModule,
    ReimbursementsModule,
    AuditModule,
  ],
})
export class AppModule {}
