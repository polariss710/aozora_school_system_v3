#!/usr/bin/env node

const baseUrl = requiredEnv("STAGING_API_URL").replace(/\/$/, "");
const email = requiredEnv("STAGING_ADMIN_EMAIL");
const password = requiredEnv("STAGING_ADMIN_PASSWORD");
const marker = `STAGING-E2E-API-${Date.now()}`;
const created = {};

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function parseResponse(response) {
  const body = await response.text();
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return { raw: body };
  }
}

async function request(path, { token, expectedStatus, ...init } = {}) {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const data = await parseResponse(response);

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

function jsonBody(value) {
  return JSON.stringify(value);
}

try {
  const login = await request("/auth/login", {
    method: "POST",
    body: jsonBody({ email, password }),
  });
  const token = login.accessToken;
  if (!token) throw new Error("Login did not return an access token.");

  const me = await request("/auth/me", { token });
  const entities = await request("/business-entities", { token });
  const entity = entities.items.find(
    (item) => item.status === "active" && item.acceptsNewBusiness,
  );
  if (!entity) throw new Error("No active operational business entity found.");

  const accounts = await request("/accounts?status=active&currency=JPY", {
    token,
  });
  const account = accounts.items.find(
    (item) => item.status === "active" && item.currency === "JPY",
  );
  if (!account) throw new Error("No active JPY school account found.");

  const studentResult = await request("/students", {
    method: "POST",
    token,
    body: jsonBody({
      code: marker.toLowerCase(),
      name: `${marker} 学生`,
      kanaName: "ステージング テスト",
      primaryBusinessEntityId: entity.id,
      memo: marker,
    }),
  });
  created.studentId = studentResult.student.id;

  await request(`/students/${created.studentId}`, {
    method: "PATCH",
    token,
    body: jsonBody({ memo: `${marker}-updated` }),
  });
  await request(`/students/${created.studentId}/archive`, {
    method: "POST",
    token,
  });
  await request(`/students/${created.studentId}/restore`, {
    method: "POST",
    token,
  });
  await request("/students", {
    method: "POST",
    token,
    expectedStatus: 409,
    body: jsonBody({
      code: marker.toLowerCase(),
      name: `${marker} 重复学生`,
      primaryBusinessEntityId: entity.id,
    }),
  });

  const teacherResult = await request("/teachers", {
    method: "POST",
    token,
    body: jsonBody({
      code: marker.toLowerCase(),
      name: `${marker} 老师`,
      kanaName: "ステージング センセイ",
      memo: marker,
    }),
  });
  created.teacherId = teacherResult.teacher.id;

  await request(`/teachers/${created.teacherId}`, {
    method: "PATCH",
    token,
    body: jsonBody({ memo: `${marker}-updated` }),
  });
  await request(`/teachers/${created.teacherId}/archive`, {
    method: "POST",
    token,
  });
  await request(`/teachers/${created.teacherId}/restore`, {
    method: "POST",
    token,
  });

  const incomeResult = await request("/income/manual", {
    method: "POST",
    token,
    body: jsonBody({
      studentId: created.studentId,
      businessEntityId: entity.id,
      yearMonth: "2099-01",
      title: `${marker} 收入`,
      originalCurrency: "JPY",
      originalAmountJpy: 1234,
      memo: marker,
    }),
  });
  created.incomeRecordId = incomeResult.incomeRecord.id;
  await request(`/income/${created.incomeRecordId}`, { token });
  const voidedIncome = await request(`/income/${created.incomeRecordId}/void`, {
    method: "POST",
    token,
    body: jsonBody({ reason: `${marker} cleanup` }),
  });
  if (voidedIncome.incomeRecord.recordStatus !== "voided") {
    throw new Error("Income did not reach voided status.");
  }
  await request(`/income/${created.incomeRecordId}/void`, {
    method: "POST",
    token,
    expectedStatus: 400,
    body: jsonBody({ reason: `${marker} duplicate void guard` }),
  });

  const expenseResult = await request("/expenses/manual", {
    method: "POST",
    token,
    body: jsonBody({
      businessEntityId: entity.id,
      yearMonth: "2099-01",
      title: `${marker} 支出`,
      originalCurrency: "JPY",
      originalAmountJpy: 567,
      memo: marker,
    }),
  });
  created.expenseRecordId = expenseResult.expenseRecord.id;
  await request(`/expenses/${created.expenseRecordId}`, { token });
  const voidedExpense = await request(
    `/expenses/${created.expenseRecordId}/void`,
    {
      method: "POST",
      token,
      body: jsonBody({ reason: `${marker} cleanup` }),
    },
  );
  if (voidedExpense.expenseRecord.recordStatus !== "voided") {
    throw new Error("Expense did not reach voided status.");
  }
  await request(`/expenses/${created.expenseRecordId}/void`, {
    method: "POST",
    token,
    expectedStatus: 400,
    body: jsonBody({ reason: `${marker} duplicate void guard` }),
  });

  const transactionResult = await request("/accounts/transactions/manual", {
    method: "POST",
    token,
    body: jsonBody({
      accountId: account.id,
      direction: "in",
      transactionDate: "2099-01-01",
      title: `${marker} 账户入金`,
      currency: "JPY",
      amountJpy: 321,
      sourceType: "manual_account_transaction",
      idempotencyKey: marker.toLowerCase(),
      memo: marker,
    }),
  });
  created.accountTransactionId = transactionResult.accountTransaction.id;
  const reversedTransaction = await request(
    `/accounts/transactions/${created.accountTransactionId}/reverse`,
    {
      method: "POST",
      token,
      body: jsonBody({ memo: `${marker} cleanup` }),
    },
  );
  if (reversedTransaction.accountTransaction.status !== "reversed") {
    throw new Error("Account transaction did not reach reversed status.");
  }
  await request(
    `/accounts/transactions/${created.accountTransactionId}/reverse`,
    {
      method: "POST",
      token,
      expectedStatus: 400,
      body: jsonBody({ memo: `${marker} duplicate reverse guard` }),
    },
  );

  console.log(
    JSON.stringify({
      ok: true,
      marker,
      user: me.user.email,
      businessEntityCode: entity.code,
      schoolAccountCode: account.code,
      assertions: {
        studentLifecycle: "passed",
        duplicateStudentCode: "rejected",
        teacherLifecycle: "passed",
        incomeLifecycle: "voided-and-double-void-rejected",
        expenseLifecycle: "voided-and-double-void-rejected",
        accountTransaction: "reversed-and-double-reverse-rejected",
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
