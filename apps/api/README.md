# Aozora School System v3 API

NestJS backend for the v3 system.

Current stage:

- First-round dev API for the v3 main business chain.
- Supabase dev PostgreSQL is connected through local environment variables.
- NestJS runtime uses `PrismaService` with the PostgreSQL driver adapter.
- Prisma migrations cover foundation master data, lessons, settlements, tuition bills, income, tuition receipt snapshots, expenses, Cash requests, Cash inbound events, account transactions, reimbursements, external work, and teacher wages.
- The seed script initializes the minimum v3 roles, permissions, business entities, and School-side accounts.
- Controller route count: 153 as of 2026-07-13.

API contract principles:

- Frontend calls business-action APIs. It must not write business tables directly or assemble core write flows from generic CRUD calls.
- Business amounts, currency rounding, exchange conversion, Cash request amounts, settlement totals, tuition bills, wage totals, account transaction amounts, and carryovers are backend-confirmed values.
- Frontend may submit user choices such as exchange rate, rounding mode, memo, reason, explicit adjustment fields, and target accounts, but backend domain services confirm the final business result.
- State-machine APIs must write audit events for high-risk or irreversible changes.
- Linked records should be moved forward and released by the same backend use case. Example: Cash inbound creates the School-side corporate account transaction and marks linked Cash-confirmed income records as `account_transaction_created`; rejection reverses the transaction and restores them to `cash_confirmed`.
- Fresh planned lesson physical delete is only allowed through `POST /api/lessons/planned/:id/delete-fresh` after backend downstream guard checks.
- New business records use the active entity identified by `OPERATIONAL_BUSINESS_ENTITY_CODE` (default `aozora_school`). Historical entity relations remain readable, but a different entity cannot be selected for new students, planned lessons, manual finance records, external-work income, or wage rules.

Health endpoints:

```text
GET /api/health
GET /api/health/db
GET /api/version
```

Auth endpoints:

```text
POST /api/auth/login
GET /api/auth/me
```

User management endpoints:

```text
GET /api/users
GET /api/users/:id
POST /api/users
PATCH /api/users/:id
POST /api/users/:id/password
POST /api/users/:id/suspend
POST /api/users/:id/activate
```

Settings endpoints:

```text
GET /api/settings/business-entities
GET /api/settings/accounts
GET /api/settings/money-rules
GET /api/settings/roles
GET /api/settings/roles/:id
GET /api/settings/permissions
GET /api/settings/subjects
GET /api/settings/external-workplaces
```

Business entity endpoints:

```text
GET /api/business-entities
GET /api/business-entities/:id
POST /api/business-entities
PATCH /api/business-entities/:id
POST /api/business-entities/:id/archive
POST /api/business-entities/:id/restore
```

Account endpoints:

```text
GET /api/accounts
GET /api/accounts/transactions
GET /api/accounts/transactions/:id
POST /api/accounts/transactions/manual
POST /api/accounts/transactions/from-income/:incomeRecordId
POST /api/accounts/transactions/from-expense/:expenseRecordId
POST /api/accounts/transactions/:id/reverse
GET /api/accounts/transfers
GET /api/accounts/transfers/:id
POST /api/accounts/transfers
POST /api/accounts/transfers/:id/void
GET /api/accounts/:id
POST /api/accounts
PATCH /api/accounts/:id
POST /api/accounts/:id/archive
POST /api/accounts/:id/restore
```

Student endpoints:

```text
GET /api/students
GET /api/students/:id
POST /api/students
PATCH /api/students/:id
POST /api/students/:id/archive
POST /api/students/:id/restore
```

Student lesson endpoints:

```text
GET /api/lessons/planned
GET /api/lessons/planned/:id
POST /api/lessons/planned
POST /api/lessons/planned/batch-preview
POST /api/lessons/planned/batch-create
PATCH /api/lessons/planned/:id
POST /api/lessons/planned/:id/delete-fresh
POST /api/lessons/planned/:id/cancel
POST /api/lessons/planned/:id/restore
POST /api/lessons/planned/:id/mark-makeup-pending
POST /api/lessons/planned/:id/generate-actual
GET /api/lessons/actual
GET /api/lessons/actual/:id
PATCH /api/lessons/actual/:id
POST /api/lessons/actual/:id/cancel
```

Student settlement endpoints:

```text
GET /api/settlements/student
GET /api/settlements/student/:id
GET /api/settlements/student/:id/export-payload
POST /api/settlements/student/preview
POST /api/settlements/student/lock
POST /api/settlements/student/:id/revoke
```

Tuition billing endpoints:

```text
GET /api/tuition-bills
GET /api/tuition-bills/:id
GET /api/tuition-bills/:id/export-payload
POST /api/tuition-bills/preview
POST /api/tuition-bills/generate
POST /api/tuition-bills/:id/generate-income
POST /api/tuition-bills/:id/void
```

Tuition bill preview contract:

- `POST /api/tuition-bills/preview` is read-only and uses the same authoritative calculation context as `POST /api/tuition-bills/generate`.
- The preview returns included planned-lesson rows, locked previous-month carryover, the latest bill/version, the next version, notices, and blocking issues.
- A bill cannot be generated when an active downstream income already exists, or when both billable planned lessons and locked carryover are absent.
- Unchanged source details return `generationMode = unchanged` and `willCreate = false`; teacher, subject, business entity, week anchor, lesson number, duration, fee, status, or carryover changes require a new version.
- The frontend passes `previewFingerprint` back as `expectedPreviewFingerprint`; generation rejects stale previews when lesson, carryover, or latest-bill state changed after preview.

Income endpoints:

```text
GET /api/income
GET /api/income/:id
GET /api/income/:id/receipt
POST /api/income/:id/receipt
GET /api/income/:id/receipts
GET /api/income/:id/receipts/:receiptId
POST /api/income/manual
POST /api/income/:id/void
```

Tuition receipt contract:

- `GET /api/income/:id/receipt` returns a live authority-backed preview before issuance and the immutable receipt snapshot after issuance.
- `POST /api/income/:id/receipt` is idempotent. The first call writes `receipt_records`, assigns `AOZ-YYYYMM-######`, records the issuer and audit event, and freezes the receipt fields; later calls return the existing snapshot.
- Receipt history and exact snapshot retrieval use the plural endpoints. Stage 2 currently allows one issued receipt per income record; void/reissue and multiple allocations remain stage 3 work.

Expense endpoints:

```text
GET /api/expenses
GET /api/expenses/:id
POST /api/expenses/manual
POST /api/expenses/from-wage/:snapshotId
POST /api/expenses/:id/void
```

Cash request endpoints:

```text
GET /api/cash/requests
GET /api/cash/requests/:id
POST /api/cash/requests/income/:incomeRecordId
POST /api/cash/requests/expense/:expenseRecordId
POST /api/cash/requests/:id/reject
POST /api/cash/requests/:id/withdraw
POST /api/cash/requests/:id/confirm
```

Cash inbound endpoints:

```text
GET /api/cash-inbound/events
GET /api/cash-inbound/events/:id
POST /api/cash-inbound/events
POST /api/cash-inbound/events/:id/reject
```

Subject endpoints:

```text
GET /api/subjects
GET /api/subjects/:id
POST /api/subjects
PATCH /api/subjects/:id
POST /api/subjects/:id/archive
POST /api/subjects/:id/restore
```

Teacher endpoints:

```text
GET /api/teachers
GET /api/teachers/:id
POST /api/teachers
PATCH /api/teachers/:id
POST /api/teachers/:id/archive
POST /api/teachers/:id/restore
```

Teacher wage endpoints:

```text
GET /api/wages/rules
POST /api/wages/rules
PATCH /api/wages/rules/:id
GET /api/wages/teacher
GET /api/wages/teacher/:id
POST /api/wages/teacher/preview
POST /api/wages/teacher/lock
PATCH /api/wages/teacher/:id/adjustments
POST /api/wages/teacher/:id/attendance-export
POST /api/wages/teacher/:id/attendance-import-preview
POST /api/wages/teacher/:id/attendance-import-confirm
POST /api/wages/attendance/export
POST /api/wages/attendance/import-preview
POST /api/wages/attendance/import-confirm
POST /api/wages/teacher/:id/confirm-adjustments
POST /api/wages/teacher/:id/revoke
```

External workplace endpoints:

```text
GET /api/external-workplaces
GET /api/external-workplaces/:id
POST /api/external-workplaces
PATCH /api/external-workplaces/:id
POST /api/external-workplaces/:id/archive
POST /api/external-workplaces/:id/restore
```

External work endpoints:

```text
GET /api/external-work/lessons
GET /api/external-work/lessons/:id
POST /api/external-work/lessons/planned
PATCH /api/external-work/lessons/:id
DELETE /api/external-work/lessons/:id
POST /api/external-work/lessons/:id/generate-actual
GET /api/external-work/settlements
GET /api/external-work/settlements/:id
GET /api/external-work/settlements/:id/export-payload
POST /api/external-work/settlements/preview
POST /api/external-work/settlements/lock
POST /api/external-work/settlements/:id/revoke
POST /api/external-work/settlements/:id/generate-income
```

Reimbursement endpoints:

```text
GET /api/reimbursements
GET /api/reimbursements/candidates/expenses
GET /api/reimbursements/:id
POST /api/reimbursements/from-expense/:expenseRecordId
POST /api/reimbursements/:id/void
```

Audit endpoints:

```text
GET /api/audit/events
GET /api/audit/events/:id
```

Optional seed admin:

```text
V3_ADMIN_EMAIL
V3_ADMIN_PASSWORD
V3_ADMIN_DISPLAY_NAME
```

Commands:

```bash
pnpm --dir apps/api exec prisma validate
pnpm --dir apps/api exec prisma migrate dev
pnpm --dir apps/api db:seed
pnpm --dir apps/api dev
pnpm --dir apps/api dev:watch
pnpm --dir apps/api build
pnpm --dir apps/api test
```

## Render dev API deployment

The repository includes `render.yaml` for the dev API Web Service:

```text
Service name: aozora-school-system-v3-api-dev
Runtime: Node
Build command:
corepack enable && corepack prepare pnpm@11.7.0 --activate && pnpm install --frozen-lockfile && pnpm --dir apps/api exec prisma generate && pnpm build:api
Start command:
pnpm --dir apps/api start
Health check:
GET /api/health
DB check:
GET /api/health/db
```

Required Render environment variables:

```text
NODE_ENV=production
CORS_ORIGIN=http://localhost:5173,https://aozora-school-system-v3-demo.onrender.com
OPERATIONAL_BUSINESS_ENTITY_CODE=aozora_school
DATABASE_URL=<Supabase v3 dev pooler URL>
DIRECT_DATABASE_URL=<Supabase v3 dev direct URL>
JWT_SECRET=<long random secret>
```

Notes:

- `DATABASE_URL`, `DIRECT_DATABASE_URL`, and `JWT_SECRET` must be set in Render, not committed to git.
- `CORS_ORIGIN` is comma-separated when multiple frontend origins are needed.
- `OPERATIONAL_BUSINESS_ENTITY_CODE` identifies the only entity that accepts new business. Do not use a database UUID so environment migrations remain portable.
- The dev API uses the Supabase v3 dev project only. Do not point it at v2, staging, or future prod data.
