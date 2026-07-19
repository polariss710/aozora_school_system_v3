#!/usr/bin/env node

const apiUrl = (process.env.STAGING_API_URL ?? "https://aozora-school-system-v3-api-staging.onrender.com/api").replace(/\/$/, "");
const schoolUrl = (process.env.STAGING_SCHOOL_URL ?? "https://aozora-school-system-v3-staging.onrender.com").replace(/\/$/, "");
const cashUrl = (process.env.STAGING_CASH_URL ?? "https://aozora-cash-v3-staging.onrender.com").replace(/\/$/, "");
const checks = {};

async function fetchWithTimeout(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(90_000) });
}

async function text(url, init) {
  const response = await fetchWithTimeout(url, init);
  const body = await response.text();
  if (!response.ok) throw new Error(`${url}: ${response.status} ${body.slice(0, 300)}`);
  return { response, body };
}

async function json(url) {
  const { body } = await text(url);
  try { return JSON.parse(body); } catch { throw new Error(`${url}: invalid JSON`); }
}

try {
  const [health, database, school, cash, cashConfig] = await Promise.all([
    json(`${apiUrl}/health`),
    json(`${apiUrl}/health/db`),
    text(`${schoolUrl}/`),
    text(`${cashUrl}/`),
    text(`${cashUrl}/js/config.js`),
  ]);
  if (health.status !== "ok" || database.database?.status !== "ok") {
    throw new Error(`API or database health is not ok: ${JSON.stringify({ health, database })}`);
  }
  checks.api = "ok";
  checks.database = "ok";

  const scriptSources = [...school.body.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map((match) => match[1]);
  if (scriptSources.length === 0) throw new Error("School staging HTML contains no script assets.");
  const schoolBundles = await Promise.all(scriptSources.map((source) => text(new URL(source, `${schoolUrl}/`).href)));
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
    const response = await fetchWithTimeout(`${apiUrl}/health`, {
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
  const forbidden = await fetchWithTimeout(`${apiUrl}/health`, {
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
  console.error(JSON.stringify({ ok: false, checkedAt: new Date().toISOString(), checks, error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
}
