import "reflect-metadata";
import { config as loadEnv } from "dotenv";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

loadEnv();

function parseCorsOrigins(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");

  const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);
  if (corsOrigins.length > 0) {
    app.enableCors({
      origin: corsOrigins,
      credentials: true,
    });
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
