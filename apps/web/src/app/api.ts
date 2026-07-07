const defaultApiBaseUrl = "https://aozora-school-system-v3-api-dev.onrender.com/api";

export type ApiHealthStatus = "checking" | "online" | "offline";
export type ApiDatabaseStatus = "checking" | "online" | "offline" | "unknown";

export interface ApiHealthSnapshot {
  apiBaseUrl: string;
  status: ApiHealthStatus;
  database: ApiDatabaseStatus;
  service?: string;
  version?: string;
  stage?: string;
  checkedAt?: string;
  message?: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  roleCodes: string[];
  permissionCodes: string[];
}

export interface AuthSession {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: string;
  user: AuthenticatedUser;
}

export interface StudentRecord {
  id: string;
  code: string | null;
  name: string;
  kanaName: string | null;
  status: "active" | "inactive" | "archived";
  primaryBusinessEntity: {
    id: string;
    code: string;
    name: string;
  } | null;
  memo: string | null;
}

export interface StudentWriteInput {
  code?: string | null;
  name: string;
  kanaName?: string | null;
  primaryBusinessEntityId?: string | null;
  memo?: string | null;
}

export interface TeacherRecord {
  id: string;
  code: string | null;
  name: string;
  kanaName: string | null;
  status: "active" | "inactive" | "archived";
  memo: string | null;
}

export interface TeacherWriteInput {
  code?: string | null;
  name: string;
  kanaName?: string | null;
  memo?: string | null;
}

export interface BusinessEntityRecord {
  id: string;
  code: string;
  name: string;
  status: "active" | "inactive" | "archived";
  memo: string | null;
}

export interface AccountRecord {
  id: string;
  code: string;
  name: string;
  type: string;
  currency: string;
  status: "active" | "inactive" | "archived";
  memo: string | null;
}

export interface SubjectRecord {
  id: string;
  code: string;
  name: string;
  category: string;
  sortOrder: number;
  status: "active" | "inactive" | "archived";
  memo: string | null;
}

export interface ExternalWorkplaceRecord {
  id: string;
  code: string;
  name: string;
  status: "active" | "inactive" | "archived";
  memo: string | null;
}

type ApiAmountValue = number | string | null;

interface RelatedBusinessEntityRecord {
  id: string;
  code: string;
  name: string;
}

interface RelatedStudentRecord {
  id: string;
  code: string | null;
  name: string;
}

interface RelatedTeacherRecord {
  id: string;
  code: string | null;
  name: string;
}

interface RelatedAccountRecord {
  id: string;
  code: string;
  name: string;
  type: string;
  currency: string;
}

export interface IncomeRecord {
  id: string;
  sourceType: string;
  sourceId: string | null;
  studentId: string | null;
  businessEntityId: string | null;
  yearMonth: string;
  title: string;
  originalCurrency: "JPY" | "CNY";
  originalAmountJpy: ApiAmountValue;
  originalAmountCny: ApiAmountValue;
  carryoverAmountCny: ApiAmountValue;
  recordStatus: string;
  cashStatus: string;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  student: RelatedStudentRecord | null;
  businessEntity: RelatedBusinessEntityRecord | null;
}

export interface ManualIncomeInput {
  studentId?: string | null;
  businessEntityId?: string | null;
  yearMonth?: string | null;
  title: string;
  originalCurrency: "JPY" | "CNY";
  originalAmountJpy?: number | null;
  originalAmountCny?: number | null;
  memo?: string | null;
}

export interface VoidFinanceRecordInput {
  reason?: string | null;
}

export interface SubmitCashRequestInput {
  requestedCurrency: "JPY" | "CNY";
  exchangeRate?: number | null;
  exchangeRateSource?: string | null;
  conversionMethod?: "ceil" | "floor" | "half-up" | "round" | null;
  cashAccountCode?: string | null;
}

export interface RejectCashRequestInput {
  rejectionReason?: string | null;
  externalCashEventId?: string | null;
}

export interface WithdrawCashRequestInput {
  reason?: string | null;
}

export interface ConfirmCashRequestInput {
  externalCashRequestId?: string | null;
  externalCashEventId?: string | null;
}

export interface RejectCashInboundEventInput {
  reason?: string | null;
}

export interface CreateCashInboundEventInput {
  externalCashEventId: string;
  eventType?: string | null;
  corporateAccountId: string;
  eventDate: string;
  sourceCurrency?: "JPY" | "CNY" | null;
  sourceAmountJpy?: number | null;
  sourceAmountCny?: number | null;
  targetCurrency: "JPY" | "CNY";
  targetAmountJpy?: number | null;
  targetAmountCny?: number | null;
  exchangeRate?: number | null;
  feeCurrency?: "JPY" | "CNY" | null;
  feeAmountJpy?: number | null;
  feeAmountCny?: number | null;
  linkedIncomeRecordIds?: string[];
  memo?: string | null;
}

export interface CashRequestRecord {
  id: string;
  direction: "income" | "expense";
  sourceType: string;
  sourceId: string | null;
  incomeRecordId: string | null;
  expenseRecordId: string | null;
  status: string;
  expectedCurrency: "JPY" | "CNY";
  expectedAmountJpy: ApiAmountValue;
  expectedAmountCny: ApiAmountValue;
  carryoverAmountCny: ApiAmountValue;
  requestedCurrency: "JPY" | "CNY";
  requestedAmountJpy: ApiAmountValue;
  requestedAmountCny: ApiAmountValue;
  exchangeRate: ApiAmountValue;
  exchangeRateSource: string | null;
  conversionMethod: string | null;
  cashAccountCode: string | null;
  externalCashRequestId: string | null;
  externalCashEventId: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  incomeRecord: {
    id: string;
    title: string;
    recordStatus: string;
    cashStatus: string;
    originalCurrency: "JPY" | "CNY";
    originalAmountJpy: ApiAmountValue;
    originalAmountCny: ApiAmountValue;
    carryoverAmountCny: ApiAmountValue;
  } | null;
  expenseRecord: {
    id: string;
    title: string;
    recordStatus: string;
    cashStatus: string;
    originalCurrency: "JPY" | "CNY";
    originalAmountJpy: ApiAmountValue;
    originalAmountCny: ApiAmountValue;
  } | null;
}

export interface CashInboundEventRecord {
  id: string;
  externalCashEventId: string;
  eventType: string;
  corporateAccountId: string;
  accountTransactionId: string;
  eventDate: string;
  sourceCurrency: "JPY" | "CNY" | null;
  sourceAmountJpy: ApiAmountValue;
  sourceAmountCny: ApiAmountValue;
  targetCurrency: "JPY" | "CNY";
  targetAmountJpy: ApiAmountValue;
  targetAmountCny: ApiAmountValue;
  exchangeRate: ApiAmountValue;
  feeCurrency: "JPY" | "CNY" | null;
  feeAmountJpy: ApiAmountValue;
  feeAmountCny: ApiAmountValue;
  linkedIncomeRecordIds: string[];
  status: string;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  corporateAccount: RelatedAccountRecord;
  accountTransaction: {
    id: string;
    accountId: string;
    direction: "in" | "out";
    currency: "JPY" | "CNY";
    amountJpy: ApiAmountValue;
    amountCny: ApiAmountValue;
    status: string;
    externalEventId: string | null;
    idempotencyKey: string | null;
  };
}

export interface ExpenseRecord {
  id: string;
  sourceType: string;
  sourceId: string | null;
  teacherId: string | null;
  businessEntityId: string | null;
  yearMonth: string;
  title: string;
  originalCurrency: "JPY" | "CNY";
  originalAmountJpy: ApiAmountValue;
  originalAmountCny: ApiAmountValue;
  recordStatus: string;
  cashStatus: string;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  teacher: RelatedTeacherRecord | null;
  businessEntity: RelatedBusinessEntityRecord | null;
}

export interface ManualExpenseInput {
  businessEntityId?: string | null;
  yearMonth?: string | null;
  title: string;
  originalCurrency: "JPY" | "CNY";
  originalAmountJpy?: number | null;
  originalAmountCny?: number | null;
  memo?: string | null;
}

export interface AccountTransactionRecord {
  id: string;
  accountId: string;
  direction: "in" | "out";
  sourceType: string;
  sourceId: string | null;
  incomeRecordId: string | null;
  expenseRecordId: string | null;
  transactionDate: string;
  title: string;
  currency: "JPY" | "CNY";
  amountJpy: ApiAmountValue;
  amountCny: ApiAmountValue;
  status: string;
  idempotencyKey: string | null;
  externalEventId: string | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  reversedAt: string | null;
  account: RelatedAccountRecord;
  incomeRecord: { id: string; sourceType: string; title: string; recordStatus: string; cashStatus: string } | null;
  expenseRecord: { id: string; sourceType: string; title: string; recordStatus: string; cashStatus: string } | null;
}

interface ApiHealthResponse {
  service: string;
  status: "ok";
  timestamp: string;
}

interface ApiDatabaseHealthResponse {
  service: string;
  database: {
    status: "ok";
  };
  timestamp: string;
}

interface ApiVersionResponse {
  service: string;
  version: string;
  stage: string;
}

interface ListResponse<T> {
  items: T[];
  total: number;
  limit: number;
}

interface ItemsResponse<T> {
  items: T[];
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly responseText: string;

  constructor(status: number, responseText: string) {
    super(`API request failed with status ${status}`);
    this.name = "ApiRequestError";
    this.status = status;
    this.responseText = responseText;
  }
}

export const apiBaseUrl = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL?.trim() || defaultApiBaseUrl,
);

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

export async function fetchApiHealthSnapshot(): Promise<ApiHealthSnapshot> {
  const checkedAt = new Date().toISOString();

  const [healthResult, databaseResult, versionResult] = await Promise.allSettled([
    requestJson<ApiHealthResponse>("/health"),
    requestJson<ApiDatabaseHealthResponse>("/health/db"),
    requestJson<ApiVersionResponse>("/version"),
  ]);

  if (healthResult.status === "rejected") {
    return {
      apiBaseUrl,
      status: "offline",
      database: "unknown",
      checkedAt,
      message: getErrorMessage(healthResult.reason),
    };
  }

  const database =
    databaseResult.status === "fulfilled" && databaseResult.value.database.status === "ok"
      ? "online"
      : "offline";
  const version = versionResult.status === "fulfilled" ? versionResult.value : undefined;

  return {
    apiBaseUrl,
    status: "online",
    database,
    service: healthResult.value.service,
    version: version?.version,
    stage: version?.stage,
    checkedAt: healthResult.value.timestamp,
    message: database === "online" ? undefined : getRejectedMessage(databaseResult),
  };
}

export function loginWithPassword(credentials: { email: string; password: string }) {
  return requestJson<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function listStudents(accessToken: string) {
  return requestJson<ListResponse<StudentRecord>>("/students?limit=100", {
    headers: authorizedHeaders(accessToken),
  });
}

export function createStudent(accessToken: string, input: StudentWriteInput) {
  return requestJson<{ student: StudentRecord }>("/students", {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function updateStudent(accessToken: string, studentId: string, input: StudentWriteInput) {
  return requestJson<{ student: StudentRecord }>(`/students/${studentId}`, {
    method: "PATCH",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function archiveStudent(accessToken: string, studentId: string) {
  return requestJson<{ student: StudentRecord }>(`/students/${studentId}/archive`, {
    method: "POST",
    headers: authorizedHeaders(accessToken),
  });
}

export function restoreStudent(accessToken: string, studentId: string) {
  return requestJson<{ student: StudentRecord }>(`/students/${studentId}/restore`, {
    method: "POST",
    headers: authorizedHeaders(accessToken),
  });
}

export function listTeachers(accessToken: string) {
  return requestJson<ListResponse<TeacherRecord>>("/teachers?limit=100", {
    headers: authorizedHeaders(accessToken),
  });
}

export function createTeacher(accessToken: string, input: TeacherWriteInput) {
  return requestJson<{ teacher: TeacherRecord }>("/teachers", {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function updateTeacher(accessToken: string, teacherId: string, input: TeacherWriteInput) {
  return requestJson<{ teacher: TeacherRecord }>(`/teachers/${teacherId}`, {
    method: "PATCH",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function archiveTeacher(accessToken: string, teacherId: string) {
  return requestJson<{ teacher: TeacherRecord }>(`/teachers/${teacherId}/archive`, {
    method: "POST",
    headers: authorizedHeaders(accessToken),
  });
}

export function restoreTeacher(accessToken: string, teacherId: string) {
  return requestJson<{ teacher: TeacherRecord }>(`/teachers/${teacherId}/restore`, {
    method: "POST",
    headers: authorizedHeaders(accessToken),
  });
}

export function listBusinessEntities(accessToken: string) {
  return requestJson<ItemsResponse<BusinessEntityRecord>>("/settings/business-entities", {
    headers: authorizedHeaders(accessToken),
  });
}

export function listAccounts(accessToken: string) {
  return requestJson<ItemsResponse<AccountRecord>>("/settings/accounts", {
    headers: authorizedHeaders(accessToken),
  });
}

export function listSubjects(accessToken: string) {
  return requestJson<ItemsResponse<SubjectRecord>>("/settings/subjects", {
    headers: authorizedHeaders(accessToken),
  });
}

export function listExternalWorkplaces(accessToken: string) {
  return requestJson<ItemsResponse<ExternalWorkplaceRecord>>("/settings/external-workplaces", {
    headers: authorizedHeaders(accessToken),
  });
}

export function listIncomeRecords(accessToken: string) {
  return requestJson<ListResponse<IncomeRecord>>("/income?limit=100", {
    headers: authorizedHeaders(accessToken),
  });
}

export function createManualIncome(accessToken: string, input: ManualIncomeInput) {
  return requestJson<{ incomeRecord: IncomeRecord }>("/income/manual", {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function voidIncomeRecord(accessToken: string, incomeRecordId: string, input: VoidFinanceRecordInput = {}) {
  return requestJson<{ incomeRecord: IncomeRecord }>(`/income/${incomeRecordId}/void`, {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function submitIncomeCashRequest(accessToken: string, incomeRecordId: string, input: SubmitCashRequestInput) {
  return requestJson<{ cashRequest: CashRequestRecord; incomeRecord: IncomeRecord }>(
    `/cash/requests/income/${incomeRecordId}`,
    {
      method: "POST",
      headers: authorizedHeaders(accessToken),
      body: JSON.stringify(input),
    },
  );
}

export function listExpenseRecords(accessToken: string) {
  return requestJson<ListResponse<ExpenseRecord>>("/expenses?limit=100", {
    headers: authorizedHeaders(accessToken),
  });
}

export function createManualExpense(accessToken: string, input: ManualExpenseInput) {
  return requestJson<{ expenseRecord: ExpenseRecord }>("/expenses/manual", {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function voidExpenseRecord(accessToken: string, expenseRecordId: string, input: VoidFinanceRecordInput = {}) {
  return requestJson<{ expenseRecord: ExpenseRecord }>(`/expenses/${expenseRecordId}/void`, {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function submitExpenseCashRequest(accessToken: string, expenseRecordId: string, input: SubmitCashRequestInput) {
  return requestJson<{ cashRequest: CashRequestRecord; expenseRecord: ExpenseRecord }>(
    `/cash/requests/expense/${expenseRecordId}`,
    {
      method: "POST",
      headers: authorizedHeaders(accessToken),
      body: JSON.stringify(input),
    },
  );
}

export function listCashRequests(accessToken: string) {
  return requestJson<ListResponse<CashRequestRecord>>("/cash/requests?limit=100", {
    headers: authorizedHeaders(accessToken),
  });
}

export function listCashInboundEvents(accessToken: string) {
  return requestJson<ListResponse<CashInboundEventRecord>>("/cash-inbound/events?limit=100", {
    headers: authorizedHeaders(accessToken),
  });
}

export function createCashInboundEvent(accessToken: string, input: CreateCashInboundEventInput) {
  return requestJson<{ event: CashInboundEventRecord; idempotent: boolean }>("/cash-inbound/events", {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function rejectCashInboundEvent(accessToken: string, cashInboundEventId: string, input: RejectCashInboundEventInput = {}) {
  return requestJson<{ event: CashInboundEventRecord }>(`/cash-inbound/events/${cashInboundEventId}/reject`, {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function rejectCashRequest(accessToken: string, cashRequestId: string, input: RejectCashRequestInput = {}) {
  return requestJson<{
    cashRequest: CashRequestRecord;
    incomeRecord: IncomeRecord | null;
    expenseRecord: ExpenseRecord | null;
  }>(`/cash/requests/${cashRequestId}/reject`, {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function withdrawCashRequest(accessToken: string, cashRequestId: string, input: WithdrawCashRequestInput = {}) {
  return requestJson<{
    cashRequest: CashRequestRecord;
    incomeRecord: IncomeRecord | null;
    expenseRecord: ExpenseRecord | null;
  }>(`/cash/requests/${cashRequestId}/withdraw`, {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function confirmCashRequest(accessToken: string, cashRequestId: string, input: ConfirmCashRequestInput = {}) {
  return requestJson<{
    cashRequest: CashRequestRecord;
    incomeRecord: IncomeRecord | null;
    expenseRecord: ExpenseRecord | null;
  }>(`/cash/requests/${cashRequestId}/confirm`, {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function listAccountTransactions(accessToken: string) {
  return requestJson<ListResponse<AccountTransactionRecord>>("/accounts/transactions?limit=100", {
    headers: authorizedHeaders(accessToken),
  });
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new ApiRequestError(response.status, await response.text());
  }

  return response.json() as Promise<T>;
}

function authorizedHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function getRejectedMessage(result: PromiseSettledResult<unknown>) {
  if (result.status === "fulfilled") {
    return undefined;
  }

  return getErrorMessage(result.reason);
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    return `HTTP ${error.status}`;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "API request failed";
}
