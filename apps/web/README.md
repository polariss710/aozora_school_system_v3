
# Aozora School System V3 Web Demo

This is the first V3 frontend demo based on the Figma static mockup style.

It keeps the original demo data as a fallback, and now probes the V3 dev API for health, auth, and the first live Students page integration.
After real API login, the Students and Teachers pages can list, create, update, archive, and restore records through the backend API.
The Settings page reads business entities, School accounts, subjects, and external workplaces from the backend API as a read-only foundation list.

## Run

```bash
pnpm install
pnpm --dir apps/web dev
```

## API

```bash
cp apps/web/.env.example apps/web/.env
```

`VITE_API_BASE_URL` should include the Nest global prefix, for example:

```text
https://aozora-school-system-v3-api-dev.onrender.com/api
```
