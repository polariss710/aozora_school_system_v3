#!/usr/bin/env node

const apiUrl = (process.env.STAGING_API_URL ?? "https://aozora-school-system-v3-api-staging.onrender.com/api").replace(/\/$/, "");
const schoolUrl = (process.env.STAGING_SCHOOL_URL ?? "https://aozora-school-system-v3-staging.onrender.com").replace(/\/$/, "");
const cashUrl = (process.env.STAGING_CASH_URL ?? "https://aozora-cash-v3-staging.onrender.com").replace(/\/$/, "");
const requestTimeoutMs = Number(process.env.STAGING_PROBE_TIMEOUT_MS ?? 90_000);
const retryDelayMs = Number(process.env.STAGING_PROBE_RETRY_DELAY_MS ?? 10_000);
const checks = {};

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function fetchWithRetry(label, url, init = {}) {
  const attempts = 2;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(requestTimeoutMs) });
      if (response.status >= 500 && attempt < attempts) {
        console.warn(JSON.stringify({ warning: "probe_retry", target: label, attempt, reason: `HTTP ${response.status}` }));
        await response.body?.cancel();
        await sleep(retryDelayMs);
        continue;
      }
      return response;
    } catch (error) {
      if (attempt === attempts) {
        throw new Error(`${label}: failed after ${attempts} attempts: ${errorMessage(error)}`, { cause: error });
      }
      console.warn(JSON.stringify({ warning: "probe_retry", target: label, attempt, reason: errorMessage(error) }));
      await sleep(retryDelayMs);
    }
  }
  throw new Error(`${label}: retry loop exited unexpectedly`);
}

async function text(label, url, init) {
  const response = await fetchWithRetry(label, url, init);
  const body = await response.text();
  if (!response.ok) throw new Error(`${label}: ${response.status} ${body.slice(0, 300)}`);
  return { response, body };
}

async function json(label, url) {
  const { body } = await text(label, url);
  try { return JSON.parse(body); } catch { throw new Error(`${label}: invalid JSON`); }
}

try {
  const [health, database, school, cash, cashConfig] = await Promise.all([
    json("API health", `${apiUrl}/health`),
    json("database health", `${apiUrl}/health/db`),
    text("School frontend", `${schoolUrl}/`),
    text("Cash frontend", `${cashUrl}/`),
    text("Cash config", `${cashUrl}/js/config.js`),
  ]);
  if (health.status !== "ok" || database.database?.status !== "ok") {
    throw new Error(`API or database health is not ok: ${JSON.stringify({ health, database })}`);
  }
  checks.api = "ok";
  checks.database = "ok";

  const scriptSources = [...school.body.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map((match) => match[1]);
  if (scriptSources.length === 0) throw new Error("School staging HTML contains no script assets.");
  const schoolBundles = await Promise.all(scriptSources.map((source) => text(`School bundle ${source}`, new URL(source, `${schoolUrl}/`).href)));
  const schoolBundleText = schoolBundles.map((item) => item.body).join("\n");
  if (!schoolBundleText.includes("aozora-school-system-v3-api-staging.onrender.com") || schoolBundleText.includes("aozora-school-system-v3-api-dev.onrender.com")) {
    throw new Error("School staging bundle API environment boundary failed.");
  }
  checks.schoolFrontend = "staging-api-only";

  if (!cash.body.includes("家庭账本 STAGING") || !cash.body.includes("V3 验收环境") || !cashConfig.body.includes("bxnxdkbjlxkcqwzzeyds") || !cashConfig.body.includes("aozora-school-system-v3-api-staging.onrender.com") || cashConfig.body.includes("aozora-school-system-v3-api-dev.onrender.com")) {
    throw new Error("Cash staging frontend environment boundary failed.");
  }
  checks.cashFrontend = "staging-project-and-callback-only";

  for (const origin of [schoolUrl, cashUrl]) {
    const response = await fetchWithRetry(`CORS allow ${origin}`, `${apiUrl}/health`, {
      method: "OPTIONS",
      headers: {
        origin,
        "access-control-request-method": "GET",
      },
    });
    if (!response.ok || response.headers.get("access-control-allow-origin") !== origin) {
      throw new Error(`Allowed CORS origin failed: ${origin}`);
    }
  }
  const forbiddenOrigin = "https://aozora-school-system-v3-demo.onrender.com";
  const forbidden = await fetchWithRetry(`CORS deny ${forbiddenOrigin}`, `${apiUrl}/health`, {
    method: "OPTIONS",
    headers: {
      origin: forbiddenOrigin,
      "access-control-request-method": "GET",
    },
  });
  if (forbidden.headers.get("access-control-allow-origin")) {
    throw new Error("Forbidden dev origin received an allow-origin header.");
  }
  checks.cors = "two-staging-origins-only";

  console.log(JSON.stringify({ ok: true, checkedAt: new Date().toISOString(), checks }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, checkedAt: new Date().toISOString(), checks, error: errorMessage(error) }));
  process.exitCode = 1;
}
