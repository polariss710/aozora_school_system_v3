import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

loadEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Render's IPv4 network cannot reach Supabase's IPv6-only direct host.
    // Use the session-pooler URL for both runtime access and deploy-time
    // migrations; DIRECT_DATABASE_URL remains an explicit environment-boundary
    // assertion and local administration escape hatch.
    url: env("DATABASE_URL"),
  },
});
