#!/usr/bin/env node

const apiUrl = requiredEnv("STAGING_API_URL").replace(/\/$/, "");
const adminEmail = requiredEnv("STAGING_ADMIN_EMAIL");
const adminPassword = requiredEnv("STAGING_ADMIN_PASSWORD");
const supabaseUrl = requiredEnv("STAGING_SUPABASE_URL").replace(/\/$/, "");
const anonKey = requiredEnv("STAGING_SUPABASE_ANON_KEY");
const cashEmail = requiredEnv("STAGING_CASH_EMAIL");
const cashPassword = requiredEnv("STAGING_CASH_PASSWORD");
const marker = `STAGING-E2E-TUITION-${Date.now()}`;
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
  const cashAccount = cashAccounts.items.find((item) => item.currency === "JPY");
  if (!entity || !cashAccount || cashAccounts.mode !== "supabase") {
    throw new Error("Required staging entity or JPY Cash account is unavailable.");
  }

  const student = await school("/students", {
    method: "POST",
    token: schoolToken,
    body: {
      code: marker.toLowerCase(),
      name: `${marker} 学生`,
      primaryBusinessEntityId: entity.id,
      memo: marker,
    },
  });
  created.studentId = student.student.id;

  const teacher = await school("/teachers", {
    method: "POST",
    token: schoolToken,
    body: {
      code: marker.toLowerCase(),
      name: `${marker} 老师`,
      memo: marker,
    },
  });
  created.teacherId = teacher.teacher.id;

  const subject = await school("/subjects", {
    method: "POST",
    token: schoolToken,
    body: {
      code: marker.toLowerCase(),
      name: `${marker} 科目`,
      category: "staging",
      sortOrder: 9999,
      memo: marker,
    },
  });
  created.subjectId = subject.subject.id;

  const lesson = await school("/lessons/planned", {
    method: "POST",
    token: schoolToken,
    body: {
      studentId: created.studentId,
      teacherId: created.teacherId,
      subjectId: created.subjectId,
      businessEntityId: entity.id,
      weekAnchorDate: "2099-03-02",
      lessonNo: 1,
      durationHours: 1.5,
      plannedFeeJpy: 6000,
      content: marker,
      memo: marker,
    },
  });
  created.plannedLessonId = lesson.plannedLesson.id;

  const preview = await school("/tuition-bills/preview", {
    method: "POST",
    token: schoolToken,
    body: { studentId: created.studentId, yearMonth: "2099-03" },
  });
  if (
    preview.preview.blockingIssues.length !== 0 ||
    preview.preview.plannedLessonCount !== 1 ||
    preview.preview.plannedAmountJpy !== 6000 ||
    !preview.preview.previewFingerprint
  ) {
    throw new Error(`Unexpected tuition preview: ${JSON.stringify(preview)}`);
  }

  await school("/tuition-bills/generate", {
    method: "POST",
    token: schoolToken,
    expectedStatus: 400,
    body: {
      studentId: created.studentId,
      yearMonth: "2099-03",
      expectedPreviewFingerprint: "0".repeat(64),
    },
  });

  const generated = await school("/tuition-bills/generate", {
    method: "POST",
    token: schoolToken,
    body: {
      studentId: created.studentId,
      yearMonth: "2099-03",
      expectedPreviewFingerprint: preview.preview.previewFingerprint,
    },
  });
  created.tuitionBillId = generated.tuitionBill.id;
  if (!generated.created || generated.tuitionBill.plannedAmountJpy !== 6000) {
    throw new Error(`Tuition generation failed: ${JSON.stringify(generated)}`);
  }

  const unchanged = await school("/tuition-bills/generate", {
    method: "POST",
    token: schoolToken,
    body: { studentId: created.studentId, yearMonth: "2099-03" },
  });
  if (unchanged.created || unchanged.tuitionBill.id !== created.tuitionBillId) {
    throw new Error("Unchanged tuition generation was not idempotent.");
  }

  const income = await school(
    `/tuition-bills/${created.tuitionBillId}/generate-income`,
    { method: "POST", token: schoolToken },
  );
  created.incomeRecordId = income.incomeRecord.id;
  const incomeReplay = await school(
    `/tuition-bills/${created.tuitionBillId}/generate-income`,
    { method: "POST", token: schoolToken },
  );
  if (incomeReplay.incomeRecord.id !== created.incomeRecordId) {
    throw new Error("Tuition income generation was not idempotent.");
  }

  const submitted = await school(
    `/cash/requests/income/${created.incomeRecordId}`,
    {
      method: "POST",
      token: schoolToken,
      body: {
        requestedCurrency: "JPY",
        cashAccountId: cashAccount.id,
        transactedAt: "2099-03-02",
        note: marker,
      },
    },
  );
  created.cashRequestId = submitted.cashRequest.id;
  created.externalCashRequestId = submitted.cashRequest.externalCashRequestId;
  if (!created.externalCashRequestId) {
    throw new Error("Tuition Cash request was not created externally.");
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
  const cashHeaders = {
    apikey: anonKey,
    authorization: `Bearer ${cashToken}`,
    "content-type": "application/json",
  };
  const approved = await request(
    `${supabaseUrl}/rest/v1/rpc/home_approve_external_transaction_request`,
    {
      method: "POST",
      headers: cashHeaders,
      body: JSON.stringify({ p_request_id: created.externalCashRequestId }),
    },
  );
  if (!approved.ok || approved.status !== "approved" || !approved.transaction_id) {
    throw new Error(`Cash approval failed: ${JSON.stringify(approved)}`);
  }
  created.cashTransactionId = approved.transaction_id;

  const callbackHeaders = {
    authorization: `Bearer ${cashToken}`,
    "content-type": "application/json",
  };
  const callback = await request(`${apiUrl}/cash/callbacks/request-result`, {
    method: "POST",
    headers: callbackHeaders,
    body: JSON.stringify({
      cash_request_id: created.externalCashRequestId,
      action: "approved",
    }),
  });
  const callbackReplay = await request(`${apiUrl}/cash/callbacks/request-result`, {
    method: "POST",
    headers: callbackHeaders,
    body: JSON.stringify({
      cash_request_id: created.externalCashRequestId,
      action: "approved",
    }),
  });
  if (callback.idempotent !== false || callbackReplay.idempotent !== true) {
    throw new Error("Tuition Cash callback was not replay-safe.");
  }

  const liveReceipt = await school(`/income/${created.incomeRecordId}/receipt`, {
    token: schoolToken,
  });
  if (
    liveReceipt.receipt.paymentAmountJpy !== 6000 ||
    liveReceipt.receipt.authoritySource !== "cash_confirmation" ||
    liveReceipt.receipt.snapshotLocked !== false
  ) {
    throw new Error(`Unexpected live receipt: ${JSON.stringify(liveReceipt)}`);
  }

  const issued = await school(`/income/${created.incomeRecordId}/receipt`, {
    method: "POST",
    token: schoolToken,
  });
  created.receiptRecordId = issued.receipt.receiptRecordId;
  const issuedReplay = await school(`/income/${created.incomeRecordId}/receipt`, {
    method: "POST",
    token: schoolToken,
  });
  if (
    issued.created !== true ||
    issuedReplay.created !== false ||
    issuedReplay.receipt.receiptRecordId !== created.receiptRecordId ||
    issued.receipt.paymentAmountJpy !== 6000 ||
    issued.receipt.snapshotLocked !== true
  ) {
    throw new Error("Issued tuition receipt was not immutable and idempotent.");
  }

  const receiptList = await school(
    `/income/${created.incomeRecordId}/receipts`,
    { token: schoolToken },
  );
  if (receiptList.total !== 1) {
    throw new Error(`Expected one receipt, got ${receiptList.total}.`);
  }

  console.log(
    JSON.stringify({
      ok: true,
      marker,
      assertions: {
        previewFingerprintConflict: "rejected",
        billGeneration: "created-and-unchanged-replay-idempotent",
        incomeGeneration: "idempotent",
        cashApprovalCallback: "applied-and-replay-idempotent",
        receipt: "live-preview-issued-and-issue-replay-idempotent",
      },
      amountJpy: 6000,
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
