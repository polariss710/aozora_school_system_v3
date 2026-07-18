import { describe, expect, it } from "vitest";
import { validateRuntimeEnvironment } from "./runtime-environment";

const stagingEnv = {
  SCHOOL_RUNTIME_ENV: "staging",
  SCHOOL_ENVIRONMENT_PROJECT_REF: "stagingref123",
  CASH_INTEGRATION_MODE: "supabase",
  CASH_STAGING_SUPABASE_URL: "https://stagingref123.supabase.co",
  CASH_STAGING_USER_ID: "11111111-1111-4111-8111-111111111111",
  DATABASE_URL: "postgresql://postgres.stagingref123:secret@pooler.example/postgres",
  DIRECT_DATABASE_URL: "postgresql://postgres:secret@db.stagingref123.supabase.co/postgres",
  CORS_ORIGIN: "https://aozora-school-v3-staging.example",
};

describe("validateRuntimeEnvironment", () => {
  it("accepts a co-located staging configuration", () => {
    expect(validateRuntimeEnvironment(stagingEnv)).toBe("staging");
  });

  it("rejects a Cash URL from a different project", () => {
    expect(() =>
      validateRuntimeEnvironment({
        ...stagingEnv,
        CASH_STAGING_SUPABASE_URL: "https://devref456.supabase.co",
      }),
    ).toThrow("does not belong");
  });

  it("rejects a known dev Cash identity", () => {
    expect(() =>
      validateRuntimeEnvironment({
        ...stagingEnv,
        SCHOOL_FORBIDDEN_CASH_USER_IDS: stagingEnv.CASH_STAGING_USER_ID,
      }),
    ).toThrow("forbidden environment identity");
  });

  it("rejects forbidden CORS origins", () => {
    expect(() =>
      validateRuntimeEnvironment({
        ...stagingEnv,
        CORS_ORIGIN: "https://aozora-cash-v3-dev.onrender.com",
        SCHOOL_FORBIDDEN_ORIGIN_MARKERS: "-v3-dev.onrender.com",
      }),
    ).toThrow("forbidden environment origin");
  });

  it("keeps local dev defaults available", () => {
    expect(validateRuntimeEnvironment({})).toBe("dev");
  });
});
