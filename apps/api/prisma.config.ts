import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

loadEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DIRECT_DATABASE_URL"),
  },
});
