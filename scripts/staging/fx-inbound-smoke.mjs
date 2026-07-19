#!/usr/bin/env node

import { randomUUID } from "node:crypto";

const apiUrl = requiredEnv("STAGING_API_URL").replace(/\/$/, "");
const adminEmail = requiredEnv("STAGING_ADMIN_EMAIL");
const adminPassword = requiredEnv("STAGING_ADMIN_PASSWORD");
const supabaseUrl = requiredEnv("STAGING_SUPABASE_URL").replace(/\/$/, "");
const anonKey = requiredEnv("STAGING_SUPABASE_ANON_KEY");
const cashEmail = requiredEnv("STAGING_CASH_EMAIL");
const cashPassword = requiredEnv("STAGING_CASH_PASSWORD");
const marker = `STAGING-E2E-FX-${Date.now()}`;
const created = {};

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

  const [entities, cashAccounts] = await Promise.all([
    school("/business-entities", { token: schoolToken }),
    school("/cash/accounts", { token: schoolToken }),
  ]);
  const entity = entities.items.find(
    (item) => item.status === "active" && item.acceptsNewBusiness,
  );
  const cnyCashAccount = cashAccounts.items.find((item) => item.currency === "CNY");
  const jpyCashAccount = cashAccounts.items.find((item) => item.currency === "JPY");
  if (
    !entity ||
    !cnyCashAccount ||
    !jpyCashAccount ||
    cashAccounts.mode !== "supabase"
  ) {
    throw new Error("Required staging entity or Cash FX accounts are unavailable.");
  }
  created.cnyCashAccountId = cnyCashAccount.id;
  created.jpyCashAccountId = jpyCashAccount.id;

  const income = await school("/income/manual", {
    method: "POST",
    token: schoolToken,
    body: {
      businessEntityId: entity.id,
      yearMonth: "2099-06",
      title: `${marker} CNY income`,
      originalCurrency: "CNY",
      originalAmountCny: 88,
      memo: marker,
    },
  });
  created.incomeRecordId = income.incomeRecord.id;

  const submitted = await school(
    `/cash/requests/income/${created.incomeRecordId}`,
    {
      method: "POST",
      token: schoolToken,
      body: {
        requestedCurrency: "CNY",
        cashAccountId: cnyCashAccount.id,
        transactedAt: "2099-06-01",
        note: marker,
      },
    },
  );
  created.schoolCashRequestId = submitted.cashRequest.id;
  created.externalCashRequestId = submitted.cashRequest.externalCashRequestId;
  if (!created.externalCashRequestId) {
    throw new Error("FX source income did not create an external Cash request.");
  }

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

  const approved = await request(
    `${supabaseUrl}/rest/v1/rpc/home_approve_external_transaction_request`,
    {
      method: "POST",
      headers: rpcHeaders,
      body: JSON.stringify({ p_request_id: created.externalCashRequestId }),
    },
  );
  if (approved.status !== "approved" || !approved.transaction_id) {
    throw new Error(`FX source CNY approval failed: ${JSON.stringify(approved)}`);
  }
  created.sourceCnyTransactionId = approved.transaction_id;

  const sourceCallback = await request(
    `${apiUrl}/cash/callbacks/request-result`,
    {
      method: "POST",
      headers: callbackHeaders,
      body: JSON.stringify({
        cash_request_id: created.externalCashRequestId,
        action: "approved",
      }),
    },
  );
  const sourceCallbackReplay = await request(
    `${apiUrl}/cash/callbacks/request-result`,
    {
      method: "POST",
      headers: callbackHeaders,
      body: JSON.stringify({
        cash_request_id: created.externalCashRequestId,
        action: "approved",
      }),
    },
  );
  if (
    sourceCallback.ok !== true ||
    sourceCallback.idempotent !== false ||
    sourceCallbackReplay.ok !== true ||
    sourceCallbackReplay.idempotent !== true
  ) {
    throw new Error("FX source income callback was not replay-safe.");
  }

  const fx = await request(
    `${supabaseUrl}/rest/v1/rpc/home_create_cny_to_jpy_fx`,
    {
      method: "POST",
      headers: rpcHeaders,
      body: JSON.stringify({
        p_cny_account_id: cnyCashAccount.id,
        p_jpy_account_id: jpyCashAccount.id,
        p_transacted_at: "2099-06-01",
        p_cny_amount: 88,
        p_jpy_amount: 1800,
        p_description: `${marker} CNY→JPY`,
        p_note: marker,
      }),
    },
  );
  if (!fx.ok || !fx.cny_transaction_id || !fx.jpy_transaction_id) {
    throw new Error(`Cash FX creation failed: ${JSON.stringify(fx)}`);
  }
  created.fxCnyTransactionId = fx.cny_transaction_id;
  created.fxJpyTransactionId = fx.jpy_transaction_id;

  const options = await request(
    `${apiUrl}/cash/callbacks/fx-inbound/options?cash_cny_transaction_id=${created.fxCnyTransactionId}`,
    { headers: { authorization: `Bearer ${cashToken}` } },
  );
  const candidate = options.incomeCandidates.find(
    (item) => item.incomeRecordId === created.incomeRecordId,
  );
  const corporateAccount = options.corporateAccounts[0];
  if (
    options.ok !== true ||
    options.fx.cnyTransactionId !== created.fxCnyTransactionId ||
    options.fx.jpyTransactionId !== created.fxJpyTransactionId ||
    options.fx.cnyAmount !== 88 ||
    options.fx.jpyAmount !== 1800 ||
    !candidate ||
    candidate.amountCny !== 88 ||
    !corporateAccount ||
    corporateAccount.currency !== "JPY" ||
    options.existingEvent !== null
  ) {
    throw new Error(`Unexpected FX inbound options: ${JSON.stringify(options)}`);
  }
  created.schoolCorporateAccountId = corporateAccount.id;

  const callbackBody = {
    cash_cny_transaction_id: created.fxCnyTransactionId,
    corporate_account_id: corporateAccount.id,
    linked_income_record_ids: [created.incomeRecordId],
  };
  const inbound = await request(`${apiUrl}/cash/callbacks/fx-inbound`, {
    method: "POST",
    headers: callbackHeaders,
    body: JSON.stringify(callbackBody),
  });
  if (
    inbound.ok !== true ||
    inbound.idempotent !== false ||
    !inbound.event?.id ||
    !inbound.event?.accountTransactionId ||
    Number(inbound.event.sourceAmountCny) !== 88 ||
    inbound.event.targetAmountJpy !== 1800
  ) {
    throw new Error(`School FX inbound callback failed: ${JSON.stringify(inbound)}`);
  }
  created.schoolInboundEventId = inbound.event.id;
  created.schoolAccountTransactionId = inbound.event.accountTransactionId;

  const inboundReplay = await request(`${apiUrl}/cash/callbacks/fx-inbound`, {
    method: "POST",
    headers: callbackHeaders,
    body: JSON.stringify(callbackBody),
  });
  if (
    inboundReplay.ok !== true ||
    inboundReplay.idempotent !== true ||
    inboundReplay.event?.id !== created.schoolInboundEventId ||
    inboundReplay.event?.accountTransactionId !== created.schoolAccountTransactionId
  ) {
    throw new Error("School FX inbound callback replay was not idempotent.");
  }

  await request(`${apiUrl}/cash/callbacks/fx-inbound`, {
    method: "POST",
    headers: callbackHeaders,
    expectedStatus: 409,
    body: JSON.stringify({
      ...callbackBody,
      corporate_account_id: randomUUID(),
    }),
  });

  const synced = await request(
    `${supabaseUrl}/rest/v1/rpc/home_mark_cny_to_jpy_fx_school_synced`,
    {
      method: "POST",
      headers: rpcHeaders,
      body: JSON.stringify({
        p_cny_transaction_id: created.fxCnyTransactionId,
        p_school_inbound_event_id: created.schoolInboundEventId,
        p_school_account_transaction_id: created.schoolAccountTransactionId,
      }),
    },
  );
  if (synced.ok !== true || synced.inserted !== true || !synced.sync_id) {
    throw new Error(`Cash FX sync marker failed: ${JSON.stringify(synced)}`);
  }
  created.cashFxSyncId = synced.sync_id;

  const syncedReplay = await request(
    `${supabaseUrl}/rest/v1/rpc/home_mark_cny_to_jpy_fx_school_synced`,
    {
      method: "POST",
      headers: rpcHeaders,
      body: JSON.stringify({
        p_cny_transaction_id: created.fxCnyTransactionId,
        p_school_inbound_event_id: created.schoolInboundEventId,
        p_school_account_transaction_id: created.schoolAccountTransactionId,
      }),
    },
  );
  const syncConflict = await request(
    `${supabaseUrl}/rest/v1/rpc/home_mark_cny_to_jpy_fx_school_synced`,
    {
      method: "POST",
      headers: rpcHeaders,
      body: JSON.stringify({
        p_cny_transaction_id: created.fxCnyTransactionId,
        p_school_inbound_event_id: randomUUID(),
        p_school_account_transaction_id: created.schoolAccountTransactionId,
      }),
    },
  );
  if (
    syncedReplay.ok !== true ||
    syncedReplay.inserted !== false ||
    syncConflict.ok !== false
  ) {
    throw new Error("Cash FX sync replay/conflict guard failed.");
  }

  const [incomeAfter, optionsAfter] = await Promise.all([
    school(`/income/${created.incomeRecordId}`, { token: schoolToken }),
    request(
      `${apiUrl}/cash/callbacks/fx-inbound/options?cash_cny_transaction_id=${created.fxCnyTransactionId}`,
      { headers: { authorization: `Bearer ${cashToken}` } },
    ),
  ]);
  if (
    incomeAfter.incomeRecord.recordStatus !== "cash_confirmed" ||
    incomeAfter.incomeRecord.cashStatus !== "account_transaction_created" ||
    optionsAfter.existingEvent?.id !== created.schoolInboundEventId ||
    optionsAfter.existingEvent?.accountTransactionId !== created.schoolAccountTransactionId
  ) {
    throw new Error("FX inbound final School state is inconsistent.");
  }

  console.log(
    JSON.stringify({
      ok: true,
      marker,
      sourceAmountCny: 88,
      targetAmountJpy: 1800,
      assertions: {
        sourceIncome: "approved-callback-replay-idempotent",
        fxPair: "formal-cash-rpc-bidirectionally-linked",
        options: "candidate-and-corporate-account-verified",
        schoolInbound: "created-replay-idempotent-conflict-rejected",
        cashSyncMarker: "created-replay-idempotent-conflict-rejected",
        finalIncomeStatus: "account-transaction-created",
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
