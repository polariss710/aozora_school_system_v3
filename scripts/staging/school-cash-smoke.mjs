#!/usr/bin/env node

const baseUrl = requiredEnv("STAGING_API_URL").replace(/\/$/, "");
const email = requiredEnv("STAGING_ADMIN_EMAIL");
const password = requiredEnv("STAGING_ADMIN_PASSWORD");
const marker = `STAGING-E2E-CROSS-${Date.now()}`;
const created = {};

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function request(path, { token, expectedStatus, ...init } = {}) {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }

  if (expectedStatus !== undefined) {
    if (response.status !== expectedStatus) {
      throw new Error(
        `${init.method ?? "GET"} ${path}: expected ${expectedStatus}, got ${response.status} ${JSON.stringify(data)}`,
      );
    }
    return data;
  }
  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${path}: ${response.status} ${JSON.stringify(data)}`,
    );
  }
  return data;
}

const jsonBody = (value) => JSON.stringify(value);

try {
  const login = await request("/auth/login", {
    method: "POST",
    body: jsonBody({ email, password }),
  });
  const token = login.accessToken;
  if (!token) throw new Error("Login did not return an access token.");

  const entities = await request("/business-entities", { token });
  const entity = entities.items.find(
    (item) => item.status === "active" && item.acceptsNewBusiness,
  );
  if (!entity) throw new Error("No active operational business entity found.");

  const cashAccounts = await request("/cash/accounts", { token });
  if (cashAccounts.mode !== "supabase") {
    throw new Error(`Expected Supabase Cash mode, got ${cashAccounts.mode}.`);
  }
  const cashAccount = cashAccounts.items.find((item) => item.currency === "JPY");
  if (!cashAccount) throw new Error("No eligible JPY Cash account found.");

  const incomeResult = await request("/income/manual", {
    method: "POST",
    token,
    body: jsonBody({
      businessEntityId: entity.id,
      yearMonth: "2099-02",
      title: `${marker} 收入`,
      originalCurrency: "JPY",
      originalAmountJpy: 2200,
      memo: marker,
    }),
  });
  created.incomeRecordId = incomeResult.incomeRecord.id;

  const expenseResult = await request("/expenses/manual", {
    method: "POST",
    token,
    body: jsonBody({
      businessEntityId: entity.id,
      yearMonth: "2099-02",
      title: `${marker} 支出`,
      originalCurrency: "JPY",
      originalAmountJpy: 1100,
      memo: marker,
    }),
  });
  created.expenseRecordId = expenseResult.expenseRecord.id;

  const submission = {
    requestedCurrency: "JPY",
    cashAccountId: cashAccount.id,
    transactedAt: "2099-02-01",
    note: marker,
  };

  const incomeCash = await request(
    `/cash/requests/income/${created.incomeRecordId}`,
    { method: "POST", token, body: jsonBody(submission) },
  );
  created.incomeCashRequestId = incomeCash.cashRequest.id;
  created.incomeExternalCashRequestId =
    incomeCash.cashRequest.externalCashRequestId;
  if (
    incomeCash.integrationMode !== "supabase" ||
    incomeCash.cashRequest.status !== "cash_requested" ||
    !created.incomeExternalCashRequestId
  ) {
    throw new Error("Income Cash request was not persisted externally.");
  }

  const expenseCash = await request(
    `/cash/requests/expense/${created.expenseRecordId}`,
    { method: "POST", token, body: jsonBody(submission) },
  );
  created.expenseCashRequestId = expenseCash.cashRequest.id;
  created.expenseExternalCashRequestId =
    expenseCash.cashRequest.externalCashRequestId;
  if (
    expenseCash.integrationMode !== "supabase" ||
    expenseCash.cashRequest.status !== "cash_requested" ||
    !created.expenseExternalCashRequestId
  ) {
    throw new Error("Expense Cash request was not persisted externally.");
  }

  await request(`/cash/requests/${created.incomeCashRequestId}`, { token });
  await request(`/cash/requests/${created.expenseCashRequestId}`, { token });

  await request(`/cash/requests/income/${created.incomeRecordId}`, {
    method: "POST",
    token,
    expectedStatus: 400,
    body: jsonBody(submission),
  });
  await request(`/cash/requests/${created.incomeCashRequestId}/withdraw`, {
    method: "POST",
    token,
    expectedStatus: 400,
    body: jsonBody({ reason: `${marker} ownership guard` }),
  });
  await request(`/cash/requests/${created.incomeCashRequestId}/confirm`, {
    method: "POST",
    token,
    expectedStatus: 400,
    body: jsonBody({}),
  });

  console.log(
    JSON.stringify({
      ok: true,
      marker,
      cashMode: cashAccounts.mode,
      cashAccountName: cashAccount.name,
      assertions: {
        incomeExternalSubmission: "pending",
        expenseExternalSubmission: "pending",
        duplicateSchoolSubmission: "rejected",
        schoolSideWithdrawInSupabaseMode: "rejected",
        schoolSideConfirmInSupabaseMode: "rejected",
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
