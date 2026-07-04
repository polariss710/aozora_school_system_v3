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
GET /api/settings/roles
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
PATCH /api/lessons/planned/:id
POST /api/lessons/planned/:id/cancel
POST /api/lessons/planned/:id/restore
POST /api/lessons/planned/:id/mark-makeup-pending
POST /api/lessons/planned/:id/generate-actual
GET /api/lessons/actual
GET /api/lessons/actual/:id
PATCH /api/lessons/actual/:id
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

External workplace endpoints:

```text
GET /api/external-workplaces
GET /api/external-workplaces/:id
POST /api/external-workplaces
PATCH /api/external-workplaces/:id
POST /api/external-workplaces/:id/archive
POST /api/external-workplaces/:id/restore
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
