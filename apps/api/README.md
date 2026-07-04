# Aozora School System v3 API

NestJS backend for the v3 system.

Current stage:

- API skeleton with the first Prisma/PostgreSQL foundation schema.
- Supabase dev PostgreSQL is connected through local environment variables.
- NestJS runtime uses `PrismaService` with the PostgreSQL driver adapter.
- The initial migration creates users, roles, permissions, business entities, accounts, master data, and audit tables.
- The seed script initializes the minimum v3 roles, permissions, business entities, and School-side accounts.

Health endpoints:

```text
GET /api/health
GET /api/health/db
```

Auth endpoints:

```text
POST /api/auth/login
GET /api/auth/me
```

Settings endpoints:

```text
GET /api/settings/business-entities
GET /api/settings/accounts
GET /api/settings/roles
GET /api/settings/permissions
GET /api/settings/subjects
GET /api/settings/external-workplaces
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

Audit endpoints:

```text
GET /api/audit/events
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
