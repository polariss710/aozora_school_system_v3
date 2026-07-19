#!/usr/bin/env node

const apiUrl = requiredEnv("STAGING_API_URL").replace(/\/$/, "");
const adminEmail = requiredEnv("STAGING_ADMIN_EMAIL");
const adminPassword = requiredEnv("STAGING_ADMIN_PASSWORD");
const supabaseUrl = requiredEnv("STAGING_SUPABASE_URL").replace(/\/$/, "");
const anonKey = requiredEnv("STAGING_SUPABASE_ANON_KEY");
const cashEmail = requiredEnv("STAGING_CASH_EMAIL");
const cashPassword = requiredEnv("STAGING_CASH_PASSWORD");
const marker = `STAGING-E2E-EXTERNAL-WORK-${Date.now()}`;
const created = {};

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function parse(response) {
  const raw = await response.text();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return { raw }; }
}

async function request(url, { expectedStatus, ...init } = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(90_000) });
  const data = await parse(response);
  if (expectedStatus !== undefined) {
    if (response.status !== expectedStatus) {
      throw new Error(`${init.method ?? "GET"} ${url}: expected ${expectedStatus}, got ${response.status} ${JSON.stringify(data)}`);
    }
    return data;
  }
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${url}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

async function school(path, { token, body, ...init } = {}) {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (body !== undefined) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  return request(`${apiUrl}${path}`, { ...init, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

try {
  const login = await school("/auth/login", { method: "POST", body: { email: adminEmail, password: adminPassword } });
  const schoolToken = login.accessToken;
  if (!schoolToken) throw new Error("School login returned no access token.");

  const workplace = await school("/external-workplaces", {
    method: "POST", token: schoolToken,
    body: { code: `ext-${Date.now()}`, name: `${marker} 私塾`, memo: marker },
  });
  created.workplaceId = workplace.externalWorkplace.id;

  const lessonBody = {
    workplaceId: created.workplaceId,
    lessonDate: "2099-07-10",
    startTime: "10:00",
    endTime: "12:00",
    durationHours: 2,
    instructorName: "Staging 外部讲师",
    lessonTitle: `${marker} 授课`,
    hourlyRateJpy: 2500,
    transportationFeeJpy: 500,
    content: marker,
    memo: marker,
    sourceType: "staging_e2e",
    sourceId: marker,
  };
  const planned = await school("/external-work/lessons/planned", {
    method: "POST", token: schoolToken, body: lessonBody,
  });
  created.plannedLessonId = planned.lesson.id;

  const actual = await school(`/external-work/lessons/${created.plannedLessonId}/generate-actual`, {
    method: "POST", token: schoolToken, body: {},
  });
  created.actualLessonId = actual.actualLesson.id;
  if (actual.plannedLesson.status !== "actual_created" || actual.actualLesson.status !== "completed" || actual.actualLesson.lessonWageJpy !== 5000) {
    throw new Error(`Unexpected actual lesson: ${JSON.stringify(actual)}`);
  }

  const preview = await school("/external-work/settlements/preview", {
    method: "POST", token: schoolToken,
    body: { workplaceId: created.workplaceId, yearMonth: "2099-07", adjustmentAmountJpy: -200 },
  });
  if (preview.preview.lessonCount !== 1 || preview.preview.totalLessonHours !== 2 || preview.preview.lessonWageJpy !== 5000 || preview.preview.transportationFeeJpy !== 500 || preview.preview.totalAmountJpy !== 5300 || preview.preview.blockingIssues.length !== 0) {
    throw new Error(`Unexpected external work preview: ${JSON.stringify(preview)}`);
  }

  const locked = await school("/external-work/settlements/lock", {
    method: "POST", token: schoolToken,
    body: { workplaceId: created.workplaceId, yearMonth: "2099-07", adjustmentAmountJpy: -200, memo: marker },
  });
  created.settlementId = locked.settlement.id;
  if (locked.settlement.status !== "locked" || locked.settlement.totalAmountJpy !== 5300 || locked.settlement.details?.length !== 1) {
    throw new Error(`External work settlement lock failed: ${JSON.stringify(locked)}`);
  }

  await school(`/external-work/lessons/${created.actualLessonId}`, {
    method: "PATCH", token: schoolToken, expectedStatus: 400, body: lessonBody,
  });

  const exported = await school(`/external-work/settlements/${created.settlementId}/export-payload`, { token: schoolToken });
  if (exported.exportPayload.summary.totalAmountJpy !== 5300 || exported.exportPayload.rows.length !== 1 || exported.exportPayload.rows[0].actualLessonId !== created.actualLessonId) {
    throw new Error(`External work export payload is inconsistent: ${JSON.stringify(exported)}`);
  }

  const generated = await school(`/external-work/settlements/${created.settlementId}/generate-income`, {
    method: "POST", token: schoolToken, body: { memo: marker },
  });
  created.incomeRecordId = generated.incomeRecord.id;
  const generatedReplay = await school(`/external-work/settlements/${created.settlementId}/generate-income`, {
    method: "POST", token: schoolToken, body: { memo: marker },
  });
  if (generated.settlement.status !== "income_created" || generated.incomeRecord.originalCurrency !== "JPY" || generated.incomeRecord.originalAmountJpy !== 5300 || generatedReplay.incomeRecord.id !== created.incomeRecordId) {
    throw new Error("External work income generation was not correct and idempotent.");
  }
  await school(`/external-work/settlements/${created.settlementId}/revoke`, {
    method: "POST", token: schoolToken, expectedStatus: 400, body: { reason: marker },
  });

  const accounts = await school("/cash/accounts", { token: schoolToken });
  const cashAccount = accounts.items.find((item) => item.currency === "JPY");
  if (!cashAccount || accounts.mode !== "supabase") throw new Error("JPY staging Cash account is unavailable.");
  const submitted = await school(`/cash/requests/income/${created.incomeRecordId}`, {
    method: "POST", token: schoolToken,
    body: { requestedCurrency: "JPY", cashAccountId: cashAccount.id, transactedAt: "2099-07-10", note: marker },
  });
  created.schoolCashRequestId = submitted.cashRequest.id;
  created.externalCashRequestId = submitted.cashRequest.externalCashRequestId;
  if (!created.externalCashRequestId) throw new Error("External work income did not create an external Cash request.");

  const cashAuth = await request(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email: cashEmail, password: cashPassword }),
  });
  const cashToken = cashAuth.access_token;
  if (!cashToken) throw new Error("Cash login returned no access token.");
  const rpcHeaders = { apikey: anonKey, authorization: `Bearer ${cashToken}`, "content-type": "application/json" };
  const callbackHeaders = { authorization: `Bearer ${cashToken}`, "content-type": "application/json" };
  const approved = await request(`${supabaseUrl}/rest/v1/rpc/home_approve_external_transaction_request`, {
    method: "POST", headers: rpcHeaders, body: JSON.stringify({ p_request_id: created.externalCashRequestId }),
  });
  if (approved.status !== "approved" || !approved.transaction_id) throw new Error(`Cash approval failed: ${JSON.stringify(approved)}`);
  created.cashTransactionId = approved.transaction_id;

  const callback = await request(`${apiUrl}/cash/callbacks/request-result`, {
    method: "POST", headers: callbackHeaders,
    body: JSON.stringify({ cash_request_id: created.externalCashRequestId, action: "approved" }),
  });
  const callbackReplay = await request(`${apiUrl}/cash/callbacks/request-result`, {
    method: "POST", headers: callbackHeaders,
    body: JSON.stringify({ cash_request_id: created.externalCashRequestId, action: "approved" }),
  });
  if (callback.ok !== true || callback.idempotent !== false || callbackReplay.ok !== true || callbackReplay.idempotent !== true) {
    throw new Error("External work Cash callback was not replay-safe.");
  }

  const [incomeAfter, settlementAfter] = await Promise.all([
    school(`/income/${created.incomeRecordId}`, { token: schoolToken }),
    school(`/external-work/settlements/${created.settlementId}`, { token: schoolToken }),
  ]);
  if (incomeAfter.incomeRecord.recordStatus !== "cash_confirmed" || incomeAfter.incomeRecord.cashStatus !== "cash_confirmed" || settlementAfter.settlement.status !== "income_created" || settlementAfter.settlement.incomeRecordId !== created.incomeRecordId) {
    throw new Error("External work final settlement/income state is inconsistent.");
  }

  console.log(JSON.stringify({
    ok: true, marker, totalAmountJpy: 5300,
    assertions: {
      plannedToActual: "passed",
      settlementPreviewAndLock: "passed",
      postLockLessonMutation: "rejected",
      exportPayload: "passed",
      incomeGeneration: "created-and-replay-idempotent",
      postIncomeRevoke: "rejected",
      cashApproveCallback: "applied-and-replay-idempotent",
    },
    created,
  }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, marker, error: error instanceof Error ? error.message : String(error), created }));
  process.exitCode = 1;
}
