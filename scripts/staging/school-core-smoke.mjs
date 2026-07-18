#!/usr/bin/env node

const baseUrl = requiredEnv("STAGING_API_URL").replace(/\/$/, "");
const email = requiredEnv("STAGING_ADMIN_EMAIL");
const password = requiredEnv("STAGING_ADMIN_PASSWORD");
const marker = `STAGING-E2E-CORE-${Date.now()}`;
const yearMonth = "2099-02";
const created = {};

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
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
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);

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

  const studentResult = await request("/students", {
    method: "POST",
    token,
    body: jsonBody({
      code: marker.toLowerCase(),
      name: `${marker} 学生`,
      kanaName: "ステージング コア",
      primaryBusinessEntityId: entity.id,
      memo: marker,
    }),
  });
  created.studentId = studentResult.student.id;

  const teacherResult = await request("/teachers", {
    method: "POST",
    token,
    body: jsonBody({
      code: marker.toLowerCase(),
      name: `${marker} 老师`,
      kanaName: "ステージング コア",
      memo: marker,
    }),
  });
  created.teacherId = teacherResult.teacher.id;

  const subjectResult = await request("/subjects", {
    method: "POST",
    token,
    body: jsonBody({
      code: marker.toLowerCase(),
      name: `${marker} 科目`,
      category: "staging",
      sortOrder: 9999,
      memo: marker,
    }),
  });
  created.subjectId = subjectResult.subject.id;

  const wageRuleResult = await request("/wages/rules", {
    method: "POST",
    token,
    body: jsonBody({
      teacherId: created.teacherId,
      businessEntityId: entity.id,
      hourlyRateJpy: 2000,
      memo: marker,
    }),
  });
  created.wageRuleId = wageRuleResult.rule.id;

  const plannedResult = await request("/lessons/planned", {
    method: "POST",
    token,
    body: jsonBody({
      studentId: created.studentId,
      teacherId: created.teacherId,
      subjectId: created.subjectId,
      businessEntityId: entity.id,
      weekAnchorDate: "2099-02-02",
      lessonNo: 1,
      plannedStartTime: "16:00",
      plannedEndTime: "17:30",
      durationHours: 1.5,
      plannedFeeJpy: 6000,
      content: `${marker} lesson`,
      memo: marker,
    }),
  });
  created.plannedLessonId = plannedResult.plannedLesson.id;

  const actualResult = await request(
    `/lessons/planned/${created.plannedLessonId}/generate-actual`,
    {
      method: "POST",
      token,
      body: jsonBody({
        teacherId: created.teacherId,
        actualDate: "2099-02-02",
        startTime: "16:00",
        endTime: "17:30",
        durationHours: 1.5,
        content: `${marker} actual`,
        memo: marker,
        teacherWageEligible: true,
      }),
    },
  );
  created.actualLessonId = actualResult.actualLesson.id;

  const settlementKey = {
    studentId: created.studentId,
    yearMonth,
    settlementExchangeRate: 20,
    adjustmentAmountCny: 0,
  };
  const settlementPreview = await request("/settlements/student/preview", {
    method: "POST",
    token,
    body: jsonBody(settlementKey),
  });
  if (
    settlementPreview.preview.blockingIssues.length !== 0 ||
    settlementPreview.preview.plannedLessonCount !== 1 ||
    settlementPreview.preview.actualLessonCount !== 1 ||
    settlementPreview.preview.billableAmountJpy !== 6000
  ) {
    throw new Error(`Unexpected settlement preview: ${JSON.stringify(settlementPreview)}`);
  }

  const settlementResult = await request("/settlements/student/lock", {
    method: "POST",
    token,
    body: jsonBody({ ...settlementKey, memo: marker }),
  });
  created.studentSettlementId = settlementResult.settlement.id;

  await request("/lessons/planned", {
    method: "POST",
    token,
    expectedStatus: 400,
    body: jsonBody({
      studentId: created.studentId,
      teacherId: created.teacherId,
      subjectId: created.subjectId,
      businessEntityId: entity.id,
      weekAnchorDate: "2099-02-09",
      durationHours: 1,
      plannedFeeJpy: 4000,
      memo: marker,
    }),
  });

  const wageKey = {
    teacherId: created.teacherId,
    yearMonth,
    businessEntityId: entity.id,
  };
  const wagePreview = await request("/wages/teacher/preview", {
    method: "POST",
    token,
    body: jsonBody(wageKey),
  });
  if (
    wagePreview.preview.blockingIssues.length !== 0 ||
    wagePreview.preview.lessonCount !== 1 ||
    wagePreview.preview.totalLessonHours !== 1.5 ||
    wagePreview.preview.baseWageJpy !== 3000
  ) {
    throw new Error(`Unexpected wage preview: ${JSON.stringify(wagePreview)}`);
  }

  const wageResult = await request("/wages/teacher/lock", {
    method: "POST",
    token,
    body: jsonBody({ ...wageKey, memo: marker }),
  });
  created.wageSnapshotId = wageResult.snapshot.id;

  await request(`/lessons/actual/${created.actualLessonId}`, {
    method: "PATCH",
    token,
    expectedStatus: 400,
    body: jsonBody({ memo: `${marker} locked mutation` }),
  });

  const adjusted = await request(
    `/wages/teacher/${created.wageSnapshotId}/adjustments`,
    {
      method: "PATCH",
      token,
      body: jsonBody({
        transportationFeeJpy: 500,
        classroomFeeJpy: 200,
        manualAdjustmentJpy: -100,
        memo: marker,
      }),
    },
  );
  if (adjusted.snapshot.totalWageJpy !== 3600) {
    throw new Error(`Unexpected adjusted wage: ${JSON.stringify(adjusted)}`);
  }

  const confirmed = await request(
    `/wages/teacher/${created.wageSnapshotId}/confirm-adjustments`,
    {
      method: "POST",
      token,
      body: jsonBody({ memo: marker }),
    },
  );
  if (
    confirmed.snapshot.status !== "adjustment_confirmed" ||
    confirmed.snapshot.adjustmentStatus !== "confirmed"
  ) {
    throw new Error(`Unexpected confirmed wage: ${JSON.stringify(confirmed)}`);
  }

  const revokedWage = await request(
    `/wages/teacher/${created.wageSnapshotId}/revoke`,
    {
      method: "POST",
      token,
      body: jsonBody({ reason: `${marker} cleanup` }),
    },
  );
  if (revokedWage.snapshot.status !== "revoked") {
    throw new Error("Wage snapshot did not reach revoked status.");
  }

  const revokedSettlement = await request(
    `/settlements/student/${created.studentSettlementId}/revoke`,
    {
      method: "POST",
      token,
      body: jsonBody({ reason: `${marker} cleanup` }),
    },
  );
  if (revokedSettlement.settlement.status !== "revoked") {
    throw new Error("Student settlement did not reach revoked status.");
  }

  console.log(
    JSON.stringify({
      ok: true,
      marker,
      businessEntityCode: entity.code,
      assertions: {
        plannedToActual: "passed",
        studentSettlement: "locked-and-post-lock-lesson-rejected",
        teacherWage: "previewed-locked-adjusted-confirmed-revoked",
        lockedActualMutation: "rejected",
        cleanupState: "settlement-and-wage-revoked",
      },
      amounts: {
        tuitionJpy: 6000,
        baseWageJpy: 3000,
        adjustedWageJpy: 3600,
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
