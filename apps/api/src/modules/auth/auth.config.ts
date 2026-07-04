import { config as loadEnv } from "dotenv";

loadEnv();

const DEVELOPMENT_JWT_SECRET =
  "aozora-school-v3-development-only-jwt-secret-change-before-production";

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production.");
  }

  return DEVELOPMENT_JWT_SECRET;
}

export const jwtExpiresIn = "8h";
