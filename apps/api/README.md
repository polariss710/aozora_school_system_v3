# Aozora School System v3 API

NestJS backend for the v3 system.

Current stage:

- API skeleton with the first Prisma/PostgreSQL foundation schema.
- Supabase dev PostgreSQL is connected through local environment variables.
- The initial migration creates users, roles, permissions, business entities, accounts, master data, and audit tables.
- The seed script initializes the minimum v3 roles, permissions, business entities, and School-side accounts.

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
