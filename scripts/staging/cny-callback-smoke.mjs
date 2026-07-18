#!/usr/bin/env node

const apiUrl = requiredEnv("STAGING_API_URL").replace(/\/$/, "");
const adminEmail = requiredEnv("STAGING_ADMIN_EMAIL");
const adminPassword = requiredEnv("STAGING_ADMIN_PASSWORD");
const supabaseUrl = requiredEnv("STAGING_SUPABASE_URL").replace(/\/$/, "");
const anonKey = requiredEnv("STAGING_SUPABASE_ANON_KEY");
const cashEmail = requiredEnv("STAGING_CASH_EMAIL");
const cashPassword = requiredEnv("STAGING_CASH_PASSWORD");
const marker = `STAGING-E2E-CNY-${Date.now()}`;
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

  const [entities, accounts] = await Promise.all([
    school("/business-entities", { token: schoolToken }),
    school("/cash/accounts", { token: schoolToken }),
  ]);
  const entity = entities.items.find((item) => item.status === "active" && item.acceptsNewBusiness);
  const cashAccount = accounts.items.find((item) => item.currency === "CNY");
  if (!entity || !cashAccount || accounts.mode !== "supabase") throw new Error("CNY staging Cash account is unavailable.");

  const income = await school("/income/manual", {
    method: "POST", token: schoolToken,
    body: { businessEntityId: entity.id, yearMonth: "2099-04", title: `${marker} income`, originalCurrency: "CNY", originalAmountCny: 123.45, memo: marker },
  });
  created.incomeRecordId = income.incomeRecord.id;

  const expense = await school("/expenses/manual", {
    method: "POST", token: schoolToken,
    body: { businessEntityId: entity.id, yearMonth: "2099-04", title: `${marker} expense`, originalCurrency: "CNY", originalAmountCny: 67.89, memo: marker },
  });
  created.expenseRecordId = expense.expenseRecord.id;

  const submission = { requestedCurrency: "CNY", cashAccountId: cashAccount.id, transactedAt: "2099-04-01", note: marker };
  const incomeCash = await school(`/cash/requests/income/${created.incomeRecordId}`, { method: "POST", token: schoolToken, body: submission });
  const expenseCash = await school(`/cash/requests/expense/${created.expenseRecordId}`, { method: "POST", token: schoolToken, body: submission });
  created.incomeCashRequestId = incomeCash.cashRequest.id;
  created.expenseCashRequestId = expenseCash.cashRequest.id;
  created.incomeExternalCashRequestId = incomeCash.cashRequest.externalCashRequestId;
  created.expenseExternalCashRequestId = expenseCash.cashRequest.externalCashRequestId;
  if (!created.incomeExternalCashRequestId || !created.expenseExternalCashRequestId) throw new Error("CNY external Cash requests were not created.");

  const cashAuth = await request(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email: cashEmail, password: cashPassword }),
  });
  const cashToken = cashAuth.access_token;
  if (!cashToken) throw new Error("Cash login returned no access token.");
  const rpcHeaders = { apikey: anonKey, authorization: `Bearer ${cashToken}`, "content-type": "application/json" };
  const callbackHeaders = { authorization: `Bearer ${cashToken}`, "content-type": "application/json" };

  const approvedIncome = await request(`${supabaseUrl}/rest/v1/rpc/home_approve_external_transaction_request`, {
    method: "POST", headers: rpcHeaders, body: JSON.stringify({ p_request_id: created.incomeExternalCashRequestId }),
  });
  const approvedExpense = await request(`${supabaseUrl}/rest/v1/rpc/home_approve_external_transaction_request`, {
    method: "POST", headers: rpcHeaders, body: JSON.stringify({ p_request_id: created.expenseExternalCashRequestId }),
  });
  if (approvedIncome.status !== "approved" || approvedExpense.status !== "approved" || !approvedIncome.transaction_id || !approvedExpense.transaction_id) {
    throw new Error(`CNY Cash approval failed: ${JSON.stringify({ approvedIncome, approvedExpense })}`);
  }
  created.incomeCashTransactionId = approvedIncome.transaction_id;
  created.expenseCashTransactionId = approvedExpense.transaction_id;

  for (const [externalId, action] of [[created.incomeExternalCashRequestId, "approved"], [created.expenseExternalCashRequestId, "approved"]]) {
    await request(`${apiUrl}/cash/callbacks/request-result`, { method: "POST", headers: callbackHeaders, body: JSON.stringify({ cash_request_id: externalId, action }) });
    const replay = await request(`${apiUrl}/cash/callbacks/request-result`, { method: "POST", headers: callbackHeaders, body: JSON.stringify({ cash_request_id: externalId, action }) });
    if (replay.idempotent !== true) throw new Error("CNY callback replay was not idempotent.");
  }

  const incomeAfter = await school(`/income/${created.incomeRecordId}`, { token: schoolToken });
  const expenseAfter = await school(`/expenses/${created.expenseRecordId}`, { token: schoolToken });
  if (incomeAfter.incomeRecord.cashStatus !== "cash_confirmed" || expenseAfter.expenseRecord.cashStatus !== "cash_confirmed") {
    throw new Error(`CNY School callback did not confirm both records: ${JSON.stringify({ incomeAfter, expenseAfter })}`);
  }

  console.log(JSON.stringify({
    ok: true, marker, currency: "CNY", amountCny: { income: 123.45, expense: 67.89 },
    assertions: { incomeApprove: "passed", expenseApprove: "passed", callback: "applied-and-replay-idempotent", schoolStatus: "cash-confirmed" },
    created,
  }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, marker, error: error instanceof Error ? error.message : String(error), created }));
  process.exitCode = 1;
}
