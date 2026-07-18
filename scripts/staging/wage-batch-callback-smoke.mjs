#!/usr/bin/env node

import { randomUUID } from "node:crypto";

const apiUrl = requiredEnv("STAGING_API_URL").replace(/\/$/, "");
const adminEmail = requiredEnv("STAGING_ADMIN_EMAIL");
const adminPassword = requiredEnv("STAGING_ADMIN_PASSWORD");
const supabaseUrl = requiredEnv("STAGING_SUPABASE_URL").replace(/\/$/, "");
const anonKey = requiredEnv("STAGING_SUPABASE_ANON_KEY");
const cashEmail = requiredEnv("STAGING_CASH_EMAIL");
const cashPassword = requiredEnv("STAGING_CASH_PASSWORD");
const marker = requiredEnv("STAGING_WAGE_MARKER");
const expenseRecordIds = requiredEnv("STAGING_WAGE_EXPENSE_IDS")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const created = { expenseRecordIds };

if (expenseRecordIds.length !== 2 || new Set(expenseRecordIds).size !== 2) {
  throw new Error("STAGING_WAGE_EXPENSE_IDS must contain exactly two unique IDs.");
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function parse(response) {
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
  const data = await parse(response);
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

async function school(path, { token, body, ...init } = {}) {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (body !== undefined) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  return request(`${apiUrl}${path}`, {
    ...init,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

try {
  const login = await school("/auth/login", {
    method: "POST",
    body: { email: adminEmail, password: adminPassword },
  });
  const schoolToken = login.accessToken;
  if (!schoolToken) throw new Error("School login returned no access token.");

  const accounts = await school("/cash/accounts", { token: schoolToken });
  const cashAccount = accounts.items.find((item) => item.currency === "JPY");
  if (!cashAccount || accounts.mode !== "supabase") {
    throw new Error("JPY staging Cash account is unavailable.");
  }
  created.cashAccountId = cashAccount.id;

  const submitted = [];
  for (const expenseRecordId of expenseRecordIds) {
    const result = await school(`/cash/requests/expense/${expenseRecordId}`, {
      method: "POST",
      token: schoolToken,
      body: {
        requestedCurrency: "JPY",
        cashAccountId: cashAccount.id,
        transactedAt: "2099-05-15",
        note: marker,
      },
    });
    if (!result.cashRequest.externalCashRequestId) {
      throw new Error(`Expense ${expenseRecordId} did not create an external Cash request.`);
    }
    submitted.push(result.cashRequest);
  }
  created.schoolCashRequestIds = submitted.map((item) => item.id);
  created.externalCashRequestIds = submitted.map(
    (item) => item.externalCashRequestId,
  );

  const cashAuth = await request(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: { apikey: anonKey, "content-type": "application/json" },
      body: JSON.stringify({ email: cashEmail, password: cashPassword }),
    },
  );
  const cashToken = cashAuth.access_token;
  if (!cashToken) throw new Error("Cash login returned no access token.");
  const rpcHeaders = {
    apikey: anonKey,
    authorization: `Bearer ${cashToken}`,
    "content-type": "application/json",
  };
  const callbackHeaders = {
    authorization: `Bearer ${cashToken}`,
    "content-type": "application/json",
  };

  const approval = await request(
    `${supabaseUrl}/rest/v1/rpc/home_approve_teacher_wage_request_batch`,
    {
      method: "POST",
      headers: rpcHeaders,
      body: JSON.stringify({ p_request_ids: created.externalCashRequestIds }),
    },
  );
  if (
    approval.ok !== true ||
    approval.inserted !== true ||
    approval.currency !== "JPY" ||
    Number(approval.total_amount) !== 3900 ||
    Number(approval.request_count) !== 2 ||
    !approval.batch_id ||
    !approval.created_transaction_id
  ) {
    throw new Error(`Cash wage batch approval failed: ${JSON.stringify(approval)}`);
  }
  created.externalCashBatchId = approval.batch_id;
  created.cashTransactionId = approval.created_transaction_id;

  const approvalReplay = await request(
    `${supabaseUrl}/rest/v1/rpc/home_approve_teacher_wage_request_batch`,
    {
      method: "POST",
      headers: rpcHeaders,
      body: JSON.stringify({ p_request_ids: created.externalCashRequestIds }),
    },
  );
  if (
    approvalReplay.ok !== true ||
    approvalReplay.inserted !== false ||
    approvalReplay.batch_id !== created.externalCashBatchId ||
    approvalReplay.created_transaction_id !== created.cashTransactionId
  ) {
    throw new Error("Cash aggregate approval replay was not idempotent.");
  }

  const callback = await request(
    `${apiUrl}/cash/callbacks/request-batch-result`,
    {
      method: "POST",
      headers: callbackHeaders,
      body: JSON.stringify({ cash_batch_id: created.externalCashBatchId }),
    },
  );
  if (callback.ok !== true || callback.idempotent !== false || !callback.batch?.id) {
    throw new Error(`School wage batch callback failed: ${JSON.stringify(callback)}`);
  }
  created.schoolPaymentBatchId = callback.batch.id;

  const callbackReplay = await request(
    `${apiUrl}/cash/callbacks/request-batch-result`,
    {
      method: "POST",
      headers: callbackHeaders,
      body: JSON.stringify({ cash_batch_id: created.externalCashBatchId }),
    },
  );
  if (
    callbackReplay.ok !== true ||
    callbackReplay.idempotent !== true ||
    callbackReplay.batch?.id !== created.schoolPaymentBatchId
  ) {
    throw new Error("School wage batch callback replay was not idempotent.");
  }

  const synced = await request(
    `${supabaseUrl}/rest/v1/rpc/home_mark_teacher_wage_batch_school_synced`,
    {
      method: "POST",
      headers: rpcHeaders,
      body: JSON.stringify({
        p_batch_id: created.externalCashBatchId,
        p_school_payment_batch_id: created.schoolPaymentBatchId,
      }),
    },
  );
  if (synced.ok !== true || synced.inserted !== true) {
    throw new Error(`Cash School-sync marker failed: ${JSON.stringify(synced)}`);
  }

  const syncedReplay = await request(
    `${supabaseUrl}/rest/v1/rpc/home_mark_teacher_wage_batch_school_synced`,
    {
      method: "POST",
      headers: rpcHeaders,
      body: JSON.stringify({
        p_batch_id: created.externalCashBatchId,
        p_school_payment_batch_id: created.schoolPaymentBatchId,
      }),
    },
  );
  const syncConflict = await request(
    `${supabaseUrl}/rest/v1/rpc/home_mark_teacher_wage_batch_school_synced`,
    {
      method: "POST",
      headers: rpcHeaders,
      body: JSON.stringify({
        p_batch_id: created.externalCashBatchId,
        p_school_payment_batch_id: randomUUID(),
      }),
    },
  );
  if (
    syncedReplay.ok !== true ||
    syncedReplay.inserted !== false ||
    syncConflict.ok !== false
  ) {
    throw new Error("Cash School-sync marker replay/conflict guard failed.");
  }

  const expenseResults = await Promise.all(
    expenseRecordIds.map((id) => school(`/expenses/${id}`, { token: schoolToken })),
  );
  if (
    expenseResults.some(
      (item) =>
        item.expenseRecord.recordStatus !== "cash_confirmed" ||
        item.expenseRecord.cashStatus !== "cash_confirmed",
    )
  ) {
    throw new Error(`School wage expenses were not confirmed: ${JSON.stringify(expenseResults)}`);
  }

  const batches = await school("/cash/payment-batches", { token: schoolToken });
  const storedBatch = batches.items.find(
    (item) => item.id === created.schoolPaymentBatchId,
  );
  if (
    !storedBatch ||
    storedBatch.externalCashBatchId !== created.externalCashBatchId ||
    storedBatch.externalCashTransactionId !== created.cashTransactionId ||
    storedBatch.currency !== "JPY" ||
    storedBatch.totalAmountJpy !== 3900 ||
    storedBatch.items?.length !== 2 ||
    storedBatch.items.some((item) => item.cashRequest.status !== "cash_confirmed")
  ) {
    throw new Error(`Stored School payment batch is inconsistent: ${JSON.stringify(storedBatch)}`);
  }

  console.log(
    JSON.stringify({
      ok: true,
      marker,
      currency: "JPY",
      itemAmountsJpy: [2100, 1800],
      totalAmountJpy: 3900,
      assertions: {
        cashAggregateApproval: "created-and-replay-idempotent",
        schoolBatchCallback: "applied-and-replay-idempotent",
        cashSchoolSyncMarker: "applied-replay-idempotent-conflict-rejected",
        schoolExpenses: "both-cash-confirmed",
        schoolPaymentBatch: "one-batch-two-items-one-transaction",
      },
      created,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      ok: false,
      marker,
      error: error instanceof Error ? error.message : String(error),
      created,
    }),
  );
  process.exitCode = 1;
}
