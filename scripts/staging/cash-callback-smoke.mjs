#!/usr/bin/env node

const supabaseUrl = requiredEnv("STAGING_SUPABASE_URL").replace(/\/$/, "");
const anonKey = requiredEnv("STAGING_SUPABASE_ANON_KEY");
const cashEmail = requiredEnv("STAGING_CASH_EMAIL");
const cashPassword = requiredEnv("STAGING_CASH_PASSWORD");
const schoolApiUrl = requiredEnv("STAGING_API_URL").replace(/\/$/, "");
const incomeRequestId = requiredEnv("STAGING_INCOME_CASH_REQUEST_ID");
const expenseRequestId = requiredEnv("STAGING_EXPENSE_CASH_REQUEST_ID");
const rejectionReason =
  process.env.STAGING_REJECTION_REASON ?? "STAGING-E2E callback rejection";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function parseResponse(response) {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

async function request(url, { expectedStatus, ...init } = {}) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(90_000),
  });
  const data = await parseResponse(response);

  if (expectedStatus !== undefined) {
    if (response.status !== expectedStatus) {
      throw new Error(
        `${init.method ?? "GET"} ${url}: expected ${expectedStatus}, got ${response.status} ${JSON.stringify(data)}`,
      );
    }
    return data;
  }

  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${url}: ${response.status} ${JSON.stringify(data)}`,
    );
  }
  return data;
}

const auth = await request(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: {
    apikey: anonKey,
    "content-type": "application/json",
  },
  body: JSON.stringify({ email: cashEmail, password: cashPassword }),
});
const accessToken = auth?.access_token;
if (!accessToken) throw new Error("Cash login did not return an access token.");

const cashHeaders = {
  apikey: anonKey,
  authorization: `Bearer ${accessToken}`,
  "content-type": "application/json",
};
const callbackHeaders = {
  authorization: `Bearer ${accessToken}`,
  "content-type": "application/json",
};

const approved = await request(
  `${supabaseUrl}/rest/v1/rpc/home_approve_external_transaction_request`,
  {
    method: "POST",
    headers: cashHeaders,
    body: JSON.stringify({ p_request_id: incomeRequestId }),
  },
);
if (!approved?.ok || approved.status !== "approved" || !approved.transaction_id) {
  throw new Error(`Cash income approval failed: ${JSON.stringify(approved)}`);
}

const approvedCallback = await callback(incomeRequestId, "approved");
const approvedReplay = await callback(incomeRequestId, "approved");
if (!approvedCallback?.ok || approvedCallback.idempotent !== false) {
  throw new Error("Initial approved callback did not create the School result.");
}
if (!approvedReplay?.ok || approvedReplay.idempotent !== true) {
  throw new Error("Approved callback replay was not idempotent.");
}
await callback(incomeRequestId, "rejected", 409);

const rejected = await request(
  `${supabaseUrl}/rest/v1/rpc/home_reject_external_transaction_request`,
  {
    method: "POST",
    headers: cashHeaders,
    body: JSON.stringify({
      p_request_id: expenseRequestId,
      p_reason: rejectionReason,
    }),
  },
);
if (!rejected?.ok || rejected.status !== "rejected") {
  throw new Error(`Cash expense rejection failed: ${JSON.stringify(rejected)}`);
}

const rejectedCallback = await callback(expenseRequestId, "rejected");
const rejectedReplay = await callback(expenseRequestId, "rejected");
if (!rejectedCallback?.ok || rejectedCallback.idempotent !== false) {
  throw new Error("Initial rejected callback did not create the School result.");
}
if (!rejectedReplay?.ok || rejectedReplay.idempotent !== true) {
  throw new Error("Rejected callback replay was not idempotent.");
}
await callback(expenseRequestId, "approved", 409);

console.log(
  JSON.stringify({
    ok: true,
    income: {
      requestId: incomeRequestId,
      transactionId: approved.transaction_id,
      callback: "applied",
      replay: "idempotent",
      conflictingAction: "rejected",
    },
    expense: {
      requestId: expenseRequestId,
      transactionId: rejected.transaction_id ?? null,
      callback: "applied",
      replay: "idempotent",
      conflictingAction: "rejected",
    },
  }),
);

async function callback(requestId, action, expectedStatus) {
  return request(`${schoolApiUrl}/cash/callbacks/request-result`, {
    method: "POST",
    headers: callbackHeaders,
    expectedStatus,
    body: JSON.stringify({ cash_request_id: requestId, action }),
  });
}
