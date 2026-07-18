const SUPPORTED_ENVIRONMENTS = ["dev", "staging", "prod"] as const;

type RuntimeEnvironment = (typeof SUPPORTED_ENVIRONMENTS)[number];

function csv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function requireValue(env: NodeJS.ProcessEnv, key: string) {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required outside the dev runtime.`);
  }
  return value;
}

function requireProjectIdentity(value: string, projectRef: string, key: string) {
  if (!value.includes(projectRef)) {
    throw new Error(`${key} does not belong to SCHOOL_ENVIRONMENT_PROJECT_REF.`);
  }
}

export function validateRuntimeEnvironment(env: NodeJS.ProcessEnv): RuntimeEnvironment {
  const rawEnvironment = env.SCHOOL_RUNTIME_ENV?.trim().toLowerCase() || "dev";
  if (!SUPPORTED_ENVIRONMENTS.includes(rawEnvironment as RuntimeEnvironment)) {
    throw new Error("SCHOOL_RUNTIME_ENV must be dev, staging, or prod.");
  }

  const runtimeEnvironment = rawEnvironment as RuntimeEnvironment;
  if (runtimeEnvironment === "dev") {
    return runtimeEnvironment;
  }

  const projectRef = requireValue(env, "SCHOOL_ENVIRONMENT_PROJECT_REF");
  const cashPrefix = `CASH_${runtimeEnvironment.toUpperCase()}`;
  const cashUrl = requireValue(env, `${cashPrefix}_SUPABASE_URL`);
  const cashUserId = requireValue(env, `${cashPrefix}_USER_ID`);
  const databaseUrl = requireValue(env, "DATABASE_URL");
  const directDatabaseUrl = requireValue(env, "DIRECT_DATABASE_URL");

  if (env.CASH_INTEGRATION_MODE?.trim().toLowerCase() !== "supabase") {
    throw new Error("CASH_INTEGRATION_MODE must be supabase outside the dev runtime.");
  }

  requireProjectIdentity(cashUrl, projectRef, `${cashPrefix}_SUPABASE_URL`);
  requireProjectIdentity(databaseUrl, projectRef, "DATABASE_URL");
  requireProjectIdentity(directDatabaseUrl, projectRef, "DIRECT_DATABASE_URL");

  if (csv(env.SCHOOL_FORBIDDEN_PROJECT_REFS).includes(projectRef)) {
    throw new Error("SCHOOL_ENVIRONMENT_PROJECT_REF matches a forbidden environment.");
  }

  if (csv(env.SCHOOL_FORBIDDEN_CASH_USER_IDS).includes(cashUserId)) {
    throw new Error(`${cashPrefix}_USER_ID matches a forbidden environment identity.`);
  }

  const corsOrigins = env.CORS_ORIGIN ?? "";
  const forbiddenOrigin = csv(env.SCHOOL_FORBIDDEN_ORIGIN_MARKERS).find((marker) =>
    corsOrigins.includes(marker),
  );
  if (forbiddenOrigin) {
    throw new Error("CORS_ORIGIN contains a forbidden environment origin marker.");
  }

  return runtimeEnvironment;
}
