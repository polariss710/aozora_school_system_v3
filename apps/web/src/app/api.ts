// Fail closed to the current origin when a deployment forgets VITE_API_BASE_URL.
// Environment-specific builds must opt in to their own API URL instead of
// silently falling back to the dev service.
const defaultApiBaseUrl = "/api";

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
  acceptsNewBusiness?: boolean;
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

interface RelatedSubjectRecord {
  id: string;
  code: string;
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
  receiptEligible: boolean;
  receiptIneligibleReason: string | null;
  receiptIssued: boolean;
  latestReceipt: {
    id: string;
    receiptNo: string;
    issuedAt: string;
  } | null;
}

export interface TuitionReceiptPayload {
  receiptRecordId: string | null;
  receiptNo: string | null;
  issuedAt: string | null;
  issuedByName: string | null;
  snapshotLocked: boolean;
  incomeRecordId: string;
  studentId: string | null;
  studentName: string;
  businessEntityName: string;
  businessMonth: string | null;
  itemName: string;
  description: string;
  paymentDate: string;
  paymentCurrency: "JPY" | "CNY";
  paymentAmountJpy: ApiAmountValue;
  paymentAmountCny: ApiAmountValue;
  incomeTitle: string;
  memo: string | null;
  authoritySource: "account_transaction" | "cash_inbound" | "cash_confirmation";
  cashRequestId: string;
  cashTransactionId: string | null;
  externalCashRequestId: string | null;
  externalCashEventId: string | null;
  pdfMetadata: {
    layoutVersion?: string;
    pageSize?: string;
    locale?: string;
    [key: string]: unknown;
  };
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
  cashAccountId: string;
  cashAccountCode?: string | null;
  transactedAt: string;
  note?: string | null;
}

export interface CashEligibleAccountRecord {
  id: string;
  name: string;
  currency: "JPY" | "CNY";
  accountType: string;
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
  cashAccountId: string | null;
  cashAccountNameSnapshot: string | null;
  cashAccountTypeSnapshot: string | null;
  cashTransactedAt: string | null;
  externalCashRequestId: string | null;
  externalCashEventId: string | null;
  externalCashTransactionId: string | null;
  cashConfirmedAt: string | null;
  rejectionReason: string | null;
  syncAttemptCount: number;
  lastSyncAttemptAt: string | null;
  lastSyncError: string | null;
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

export interface CashPaymentBatchRecord {
  id: string;
  externalCashBatchId: string;
  externalCashTransactionId: string;
  batchType: string;
  currency: "JPY" | "CNY";
  totalAmountJpy: ApiAmountValue;
  totalAmountCny: ApiAmountValue;
  cashAccountId: string;
  cashTransactedAt: string;
  teacherId: string | null;
  teacherNameSnapshot: string;
  yearMonth: string;
  status: string;
  approvedAt: string;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    batchId: string;
    cashRequestId: string;
    expenseRecordId: string;
    externalCashRequestId: string;
    amountJpy: ApiAmountValue;
    amountCny: ApiAmountValue;
    itemOrder: number;
    createdAt: string;
    cashRequest: {
      id: string;
      status: string;
      externalCashRequestId: string | null;
      externalCashTransactionId: string | null;
      cashConfirmedAt: string | null;
      syncAttemptCount: number;
      lastSyncError: string | null;
    };
    expenseRecord: {
      id: string;
      title: string;
      businessEntity: RelatedBusinessEntityRecord | null;
    };
  }>;
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

export interface ReimbursementRecord {
  id: string;
  expenseRecordId: string;
  corporateAccountId: string;
  advanceAccountId: string;
  corporateTransactionId: string;
  advanceTransactionId: string;
  reimbursementDate: string;
  currency: "JPY" | "CNY";
  amountJpy: ApiAmountValue;
  amountCny: ApiAmountValue;
  status: string;
  memo: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  expenseRecord: {
    id: string;
    sourceType: string;
    title: string;
    originalCurrency: "JPY" | "CNY";
    recordStatus: string;
    cashStatus: string;
  };
  corporateAccount: RelatedAccountRecord;
  advanceAccount: RelatedAccountRecord;
  corporateTransaction: {
    id: string;
    direction: "in" | "out";
    currency: "JPY" | "CNY";
    amountJpy: ApiAmountValue;
    amountCny: ApiAmountValue;
    status: string;
  };
  advanceTransaction: {
    id: string;
    direction: "in" | "out";
    currency: "JPY" | "CNY";
    amountJpy: ApiAmountValue;
    amountCny: ApiAmountValue;
    status: string;
  };
}

export interface ReimbursementCandidateExpenseRecord {
  id: string;
  sourceType: string;
  title: string;
  originalCurrency: "JPY" | "CNY";
  originalAmountJpy: ApiAmountValue;
  originalAmountCny: ApiAmountValue;
  recordStatus: string;
  cashStatus: string;
  memo: string | null;
  accountTransactions: Array<{
    id: string;
    accountId: string;
    direction: "in" | "out";
    currency: "JPY" | "CNY";
    amountJpy: ApiAmountValue;
    amountCny: ApiAmountValue;
    status: string;
    account: RelatedAccountRecord & { status: string };
  }>;
  reimbursementRecord: { id: string; status: string } | null;
}

export interface CreateReimbursementInput {
  corporateAccountId: string;
  reimbursementDate: string;
  memo?: string | null;
}

export interface VoidReimbursementInput {
  memo?: string | null;
}

export interface StudentPlannedLessonRecord {
  id: string;
  studentId: string;
  teacherId: string;
  subjectId: string;
  businessEntityId: string;
  yearMonth: string;
  weekAnchorDate: string;
  lessonNo: number | null;
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  durationHours: ApiAmountValue;
  plannedFeeJpy: ApiAmountValue;
  content: string | null;
  memo: string | null;
  status: string;
  sourceType: string;
  sourceId: string | null;
  createdAt: string;
  updatedAt: string;
  student: RelatedStudentRecord;
  teacher: RelatedTeacherRecord;
  subject: RelatedSubjectRecord;
  businessEntity: RelatedBusinessEntityRecord;
  actualLesson: {
    id: string;
    actualDate: string;
    status: string;
  } | null;
}

export interface CreatePlannedLessonInput {
  studentId: string;
  teacherId: string;
  subjectId: string;
  weekAnchorDate: string;
  lessonNo?: number | null;
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  durationHours: number;
  plannedFeeJpy: number;
  content?: string | null;
  memo?: string | null;
}

export interface StudentActualLessonRecord {
  id: string;
  plannedLessonId: string | null;
  studentId: string;
  teacherId: string;
  subjectId: string;
  businessEntityId: string;
  yearMonth: string;
  actualDate: string;
  startTime: string | null;
  endTime: string | null;
  durationHours: ApiAmountValue;
  content: string | null;
  memo: string | null;
  status: string;
  teacherWageEligible: boolean;
  sourceType: string;
  sourceId: string | null;
  createdAt: string;
  updatedAt: string;
  plannedLesson: {
    id: string;
    yearMonth: string;
    weekAnchorDate: string;
    lessonNo: number | null;
    status: string;
  } | null;
  student: RelatedStudentRecord;
  teacher: RelatedTeacherRecord;
  subject: RelatedSubjectRecord;
  businessEntity: RelatedBusinessEntityRecord;
}

export interface GenerateActualLessonInput {
  actualDate: string;
  teacherId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  durationHours?: number | null;
  content?: string | null;
  memo?: string | null;
  teacherWageEligible?: boolean;
}

export interface TuitionBillRecord {
  id: string;
  studentId: string;
  yearMonth: string;
  version: number;
  plannedLessonCount: number;
  plannedAmountJpy: ApiAmountValue;
  carryoverAmountCny: ApiAmountValue;
  status: string;
  calculationSnapshot: unknown;
  incomeRecordId: string | null;
  replacesId: string | null;
  generatedAt: string;
  student: RelatedStudentRecord & {
    status?: "active" | "inactive" | "archived";
  };
  incomeRecord: {
    id: string;
    recordStatus: string;
    cashStatus: string;
    originalCurrency: "JPY" | "CNY";
    originalAmountJpy: ApiAmountValue;
    originalAmountCny: ApiAmountValue;
  } | null;
}

export interface TuitionBillPreviewIssue {
  code: string;
  message: string;
}

export interface TuitionBillPreview {
  student: RelatedStudentRecord;
  studentId: string;
  yearMonth: string;
  previousYearMonth: string;
  plannedLessonCount: number;
  plannedAmountJpy: ApiAmountValue;
  carryoverAmountCny: ApiAmountValue;
  businessEntityIds: string[];
  generationMode: "create" | "regenerate" | "unchanged" | "blocked";
  previewFingerprint: string;
  willCreate: boolean;
  nextVersion: number;
  blockingIssues: TuitionBillPreviewIssue[];
  notices: TuitionBillPreviewIssue[];
  latestBill: {
    id: string;
    version: number;
    status: string;
    plannedLessonCount: number;
    plannedAmountJpy: ApiAmountValue;
    carryoverAmountCny: ApiAmountValue;
    incomeRecordId: string | null;
  } | null;
  carryoverSource: {
    settlementId: string;
    yearMonth: string;
    status: string;
    lockedAt: string;
    sourceAmountCny: ApiAmountValue;
    applied: boolean;
  } | null;
  plannedLessons: Array<{
    id: string;
    weekAnchorDate: string;
    weekLabel: string;
    lessonNo: number | null;
    durationHours: ApiAmountValue;
    plannedFeeJpy: ApiAmountValue;
    status: string;
    teacher: RelatedTeacherRecord;
    subject: RelatedSubjectRecord;
    businessEntity: RelatedBusinessEntityRecord;
  }>;
}

export interface StudentSettlementRecord {
  id: string;
  studentId: string;
  yearMonth: string;
  plannedLessonCount: number;
  billableLessonCount: number;
  cancelledLessonCount: number;
  actualLessonCount: number;
  plannedAmountJpy: ApiAmountValue;
  billableAmountJpy: ApiAmountValue;
  receivedAmountJpy: ApiAmountValue;
  receivedAmountCny: ApiAmountValue;
  previousCarryoverAmountCny: ApiAmountValue;
  settlementExchangeRate: ApiAmountValue;
  adjustmentAmountCny: ApiAmountValue;
  carryoverAmountCny: ApiAmountValue;
  status: string;
  calculationSnapshot: unknown;
  lockedAt: string;
  revokedAt: string | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  student: RelatedStudentRecord;
}

export interface StudentSettlementInput {
  studentId: string;
  yearMonth: string;
  settlementExchangeRate?: number | null;
  adjustmentAmountCny?: number | null;
}

export interface LockStudentSettlementInput extends StudentSettlementInput {
  memo?: string | null;
}

export interface StudentSettlementPreview {
  student: RelatedStudentRecord;
  studentId: string;
  yearMonth: string;
  plannedLessonCount: number;
  billableLessonCount: number;
  cancelledLessonCount: number;
  actualLessonCount: number;
  plannedAmountJpy: ApiAmountValue;
  billableAmountJpy: ApiAmountValue;
  receivedAmountJpy: ApiAmountValue;
  receivedAmountCny: ApiAmountValue;
  previousCarryoverAmountCny: ApiAmountValue;
  expectedAmountCny: ApiAmountValue;
  adjustmentAmountCny: ApiAmountValue;
  carryoverAmountCny: ApiAmountValue;
  settlementExchangeRate: ApiAmountValue;
  needsExchangeRate: boolean;
  blockingIssues: string[];
  tuitionBill: {
    id: string;
    status: string;
    plannedAmountJpy: ApiAmountValue;
    carryoverAmountCny: ApiAmountValue;
  } | null;
}

export interface TeacherWageRuleRecord {
  id: string;
  teacherId: string;
  businessEntityId: string;
  hourlyRateJpy: ApiAmountValue;
  status: "active" | "inactive" | "archived";
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  teacher: RelatedTeacherRecord;
  businessEntity: RelatedBusinessEntityRecord;
}

export interface TeacherWageRuleInput {
  teacherId: string;
  businessEntityId: string;
  hourlyRateJpy: number;
  memo?: string | null;
}

export interface TeacherWageInput {
  teacherId: string;
  businessEntityId: string;
  yearMonth: string;
}

export interface LockTeacherWageInput extends TeacherWageInput {
  memo?: string | null;
}

export interface TeacherWageAdjustmentInput {
  transportationFeeJpy: number;
  classroomFeeJpy: number;
  manualAdjustmentJpy: number;
  memo?: string | null;
}

export interface TeacherWagePreview {
  teacher: RelatedTeacherRecord;
  businessEntity: RelatedBusinessEntityRecord;
  teacherId: string;
  businessEntityId: string;
  yearMonth: string;
  wageRule: { id: string; hourlyRateJpy: ApiAmountValue } | null;
  lessonCount: number;
  totalLessonHours: ApiAmountValue;
  baseWageJpy: ApiAmountValue;
  transportationFeeJpy: ApiAmountValue;
  classroomFeeJpy: ApiAmountValue;
  manualAdjustmentJpy: ApiAmountValue;
  totalWageJpy: ApiAmountValue;
  blockingIssues: string[];
  details: Array<{
    actualLessonId: string;
    actualDate: string;
    durationHours: ApiAmountValue;
    hourlyRateJpy: ApiAmountValue;
    lessonWageJpy: ApiAmountValue;
    teacherWageEligible: boolean;
    includedInWage: boolean;
    studentNameSnapshot: string;
    subjectNameSnapshot: string;
    contentSnapshot: string | null;
  }>;
}

export interface TeacherWageSnapshotRecord {
  id: string;
  teacherId: string;
  yearMonth: string;
  businessEntityId: string;
  version: number;
  lessonCount: number;
  totalLessonHours: ApiAmountValue;
  baseWageJpy: ApiAmountValue;
  transportationFeeJpy: ApiAmountValue;
  classroomFeeJpy: ApiAmountValue;
  manualAdjustmentJpy: ApiAmountValue;
  totalWageJpy: ApiAmountValue;
  status: string;
  adjustmentStatus: string;
  calculationSnapshot: unknown;
  expenseRecordId: string | null;
  replacesId: string | null;
  lockedAt: string;
  revokedAt: string | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  teacher: RelatedTeacherRecord;
  businessEntity: RelatedBusinessEntityRecord;
  details: Array<{
    id: string;
    actualLessonId: string;
    actualDate: string;
    durationHours: ApiAmountValue;
    hourlyRateJpy: ApiAmountValue;
    lessonWageJpy: ApiAmountValue;
    teacherWageEligible: boolean;
    includedInWage: boolean;
    studentNameSnapshot: string;
    subjectNameSnapshot: string;
    contentSnapshot: string | null;
  }>;
}

export interface TeacherAttendanceWorkbookRow {
  rowNo: number;
  snapshotId: string;
  detailId: string;
  businessEntityId: string;
  businessEntityCode: string;
  businessEntityName: string;
  actualDate: string;
  studentName: string;
  subjectName: string;
  content: string | null;
  durationHours: ApiAmountValue;
  lessonWageJpy: ApiAmountValue;
  includedInWage: boolean;
  transportationFeeJpy: ApiAmountValue;
  classroomFeeJpy: ApiAmountValue;
}

export interface TeacherAttendanceWorkbookPayload {
  kind: "teacher_attendance_workbook";
  schemaVersion: number;
  teacher: RelatedTeacherRecord;
  yearMonth: string;
  sortPolicy: string[];
  snapshots: Array<{
    id: string;
    version: number;
    businessEntity: RelatedBusinessEntityRecord;
    lessonCount: number;
    totalLessonHours: ApiAmountValue;
    baseWageJpy: ApiAmountValue;
  }>;
  rows: TeacherAttendanceWorkbookRow[];
}

export interface TeacherAttendanceWorkbookImportInput {
  teacherId: string;
  yearMonth: string;
  importSource: string;
  rows: Array<{
    snapshotId: string;
    detailId: string;
    transportationFeeJpy: number;
    classroomFeeJpy: number;
  }>;
}

export interface TeacherAttendanceWorkbookImportPreview {
  teacher: RelatedTeacherRecord;
  yearMonth: string;
  importSource: string;
  rowCount: number;
  groups: Array<{
    snapshotId: string;
    businessEntity: RelatedBusinessEntityRecord;
    rowCount: number;
    before: { transportationFeeJpy: number; classroomFeeJpy: number; totalWageJpy: number };
    after: { transportationFeeJpy: number; classroomFeeJpy: number; totalWageJpy: number };
  }>;
  totalTransportationFeeJpy: number;
  totalClassroomFeeJpy: number;
  totalWageJpy: number;
}

export interface ExternalWorkLessonRecord {
  id: string;
  workplaceId: string;
  yearMonth: string;
  lessonType: "planned" | "actual";
  plannedLessonId: string | null;
  lessonDate: string;
  startTime: string | null;
  endTime: string | null;
  durationHours: ApiAmountValue;
  instructorName: string;
  lessonTitle: string;
  hourlyRateJpy: ApiAmountValue;
  transportationFeeJpy: ApiAmountValue;
  lessonWageJpy: ApiAmountValue;
  status: string;
  content: string | null;
  memo: string | null;
  sourceType: string;
  sourceId: string | null;
  createdAt: string;
  updatedAt: string;
  workplace: {
    id: string;
    code: string;
    name: string;
  };
  actualLesson: { id: string; status: string } | null;
  plannedLesson: { id: string; status: string } | null;
}

export interface ExternalWorkSettlementRecord {
  id: string;
  workplaceId: string;
  yearMonth: string;
  lessonCount: number;
  totalLessonHours: ApiAmountValue;
  lessonWageJpy: ApiAmountValue;
  transportationFeeJpy: ApiAmountValue;
  adjustmentAmountJpy: ApiAmountValue;
  totalAmountJpy: ApiAmountValue;
  status: string;
  calculationSnapshot: unknown;
  incomeRecordId: string | null;
  lockedAt: string;
  revokedAt: string | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  workplace: {
    id: string;
    code: string;
    name: string;
  };
  incomeRecord: {
    id: string;
    recordStatus: string;
    cashStatus: string;
    originalCurrency: "JPY" | "CNY";
    originalAmountJpy: ApiAmountValue;
  } | null;
  details: Array<{
    id: string;
    actualLessonId: string;
    lessonDate: string;
    startTime: string | null;
    endTime: string | null;
    durationHours: ApiAmountValue;
    instructorNameSnapshot: string;
    lessonTitleSnapshot: string;
    hourlyRateJpy: ApiAmountValue;
    lessonWageJpy: ApiAmountValue;
    transportationFeeJpy: ApiAmountValue;
    contentSnapshot: string | null;
  }>;
}

export interface AuditEventRecord {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  riskLevel: string;
  reason: string | null;
  beforeSnapshot: unknown;
  afterSnapshot: unknown;
  metadata: unknown;
  requestId: string | null;
  createdAt: string;
  actorUser: {
    id: string;
    email: string;
    displayName: string;
  } | null;
}

export interface MigrationRecordAuditRecord {
  id: string;
  sourceSystem: string;
  sourceTable: string;
  sourceId: string;
  targetTable: string | null;
  targetId: string | null;
  disposition: "migrated" | "audit_only" | "skipped";
  sourceRowNumber: number | null;
  sourceSha256: string;
  migrationProgramVersion: string;
  migratedAt: string;
  importBatch: {
    sourceKey: string;
    periodStart: string;
    periodEnd: string;
  } | null;
  coreTeachingBatch: {
    sourceKey: string;
    periodStart: string;
    periodEnd: string;
  } | null;
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

export function getCurrentUser(accessToken: string) {
  return requestJson<{ user: AuthenticatedUser }>("/auth/me", {
    headers: authorizedHeaders(accessToken),
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

export function listPlannedLessons(accessToken: string, query: Record<string, string> = {}) {
  const search = new URLSearchParams({ limit: "500", ...query });
  return requestJson<ListResponse<StudentPlannedLessonRecord>>(`/lessons/planned?${search.toString()}`, {
    headers: authorizedHeaders(accessToken),
  });
}

export function createPlannedLesson(accessToken: string, input: CreatePlannedLessonInput) {
  return requestJson<{ plannedLesson: StudentPlannedLessonRecord }>("/lessons/planned", {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function listActualLessons(accessToken: string, query: Record<string, string> = {}) {
  const search = new URLSearchParams({ limit: "500", ...query });
  return requestJson<ListResponse<StudentActualLessonRecord>>(`/lessons/actual?${search.toString()}`, {
    headers: authorizedHeaders(accessToken),
  });
}

export function generateActualLesson(
  accessToken: string,
  plannedLessonId: string,
  input: GenerateActualLessonInput,
) {
  return requestJson<{ plannedLesson: StudentPlannedLessonRecord; actualLesson: StudentActualLessonRecord }>(
    `/lessons/planned/${plannedLessonId}/generate-actual`,
    {
      method: "POST",
      headers: authorizedHeaders(accessToken),
      body: JSON.stringify(input),
    },
  );
}

export function cancelPlannedLesson(accessToken: string, plannedLessonId: string) {
  return requestJson<{ plannedLesson: StudentPlannedLessonRecord }>(`/lessons/planned/${plannedLessonId}/cancel`, {
    method: "POST",
    headers: authorizedHeaders(accessToken),
  });
}

export function restorePlannedLesson(accessToken: string, plannedLessonId: string) {
  return requestJson<{ plannedLesson: StudentPlannedLessonRecord }>(`/lessons/planned/${plannedLessonId}/restore`, {
    method: "POST",
    headers: authorizedHeaders(accessToken),
  });
}

export function markPlannedLessonMakeupPending(accessToken: string, plannedLessonId: string) {
  return requestJson<{ plannedLesson: StudentPlannedLessonRecord }>(
    `/lessons/planned/${plannedLessonId}/mark-makeup-pending`,
    {
      method: "POST",
      headers: authorizedHeaders(accessToken),
    },
  );
}

export function deleteFreshPlannedLesson(
  accessToken: string,
  plannedLessonId: string,
  input: { expectedUpdatedAt: string; confirmDelete: true },
) {
  return requestJson<{ deletedPlannedLesson: { id: string } }>(
    `/lessons/planned/${plannedLessonId}/delete-fresh`,
    {
      method: "POST",
      headers: authorizedHeaders(accessToken),
      body: JSON.stringify(input),
    },
  );
}

export function listTuitionBills(accessToken: string) {
  return requestJson<ListResponse<TuitionBillRecord>>("/tuition-bills?limit=100", {
    headers: authorizedHeaders(accessToken),
  });
}

export interface GenerateTuitionBillInput {
  studentId: string;
  yearMonth: string;
  expectedPreviewFingerprint?: string;
}

export function previewTuitionBill(accessToken: string, input: GenerateTuitionBillInput) {
  return requestJson<{ preview: TuitionBillPreview }>("/tuition-bills/preview", {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function generateTuitionBill(accessToken: string, input: GenerateTuitionBillInput) {
  return requestJson<{ tuitionBill: TuitionBillRecord; created?: boolean }>("/tuition-bills/generate", {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function generateTuitionBillIncome(accessToken: string, tuitionBillId: string) {
  return requestJson<{ tuitionBill: TuitionBillRecord; incomeRecord: IncomeRecord }>(
    `/tuition-bills/${tuitionBillId}/generate-income`,
    {
      method: "POST",
      headers: authorizedHeaders(accessToken),
    },
  );
}

export function voidTuitionBill(accessToken: string, tuitionBillId: string, reason?: string | null) {
  return requestJson<{ tuitionBill: TuitionBillRecord }>(`/tuition-bills/${tuitionBillId}/void`, {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify({ reason: reason ?? null }),
  });
}

export function listStudentSettlements(accessToken: string) {
  return requestJson<ListResponse<StudentSettlementRecord>>("/settlements/student?limit=100", {
    headers: authorizedHeaders(accessToken),
  });
}

export function previewStudentSettlement(accessToken: string, input: StudentSettlementInput) {
  return requestJson<{ preview: StudentSettlementPreview }>("/settlements/student/preview", {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function lockStudentSettlement(accessToken: string, input: LockStudentSettlementInput) {
  return requestJson<{ settlement: StudentSettlementRecord }>("/settlements/student/lock", {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function revokeStudentSettlement(accessToken: string, settlementId: string, reason?: string | null) {
  return requestJson<{ settlement: StudentSettlementRecord }>(
    `/settlements/student/${settlementId}/revoke`,
    {
      method: "POST",
      headers: authorizedHeaders(accessToken),
      body: JSON.stringify({ reason: reason || null }),
    },
  );
}

export function listTeacherWageRules(accessToken: string) {
  return requestJson<ListResponse<TeacherWageRuleRecord>>("/wages/rules?limit=100", {
    headers: authorizedHeaders(accessToken),
  });
}

export function createTeacherWageRule(accessToken: string, input: TeacherWageRuleInput) {
  return requestJson<{ rule: TeacherWageRuleRecord }>("/wages/rules", {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function updateTeacherWageRule(
  accessToken: string,
  ruleId: string,
  input: Pick<TeacherWageRuleInput, "hourlyRateJpy" | "memo">,
) {
  return requestJson<{ rule: TeacherWageRuleRecord }>(`/wages/rules/${ruleId}`, {
    method: "PATCH",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function listTeacherWageSnapshots(accessToken: string) {
  return requestJson<ListResponse<TeacherWageSnapshotRecord>>("/wages/teacher?limit=100", {
    headers: authorizedHeaders(accessToken),
  });
}

export function previewTeacherWage(accessToken: string, input: TeacherWageInput) {
  return requestJson<{ preview: TeacherWagePreview }>("/wages/teacher/preview", {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function lockTeacherWage(accessToken: string, input: LockTeacherWageInput) {
  return requestJson<{ snapshot: TeacherWageSnapshotRecord }>("/wages/teacher/lock", {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function revokeTeacherWage(accessToken: string, snapshotId: string, reason?: string | null) {
  return requestJson<{ snapshot: TeacherWageSnapshotRecord }>(`/wages/teacher/${snapshotId}/revoke`, {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify({ reason: reason || null }),
  });
}

export function updateTeacherWageAdjustments(
  accessToken: string,
  snapshotId: string,
  input: TeacherWageAdjustmentInput,
) {
  return requestJson<{ snapshot: TeacherWageSnapshotRecord }>(`/wages/teacher/${snapshotId}/adjustments`, {
    method: "PATCH",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function confirmTeacherWageAdjustments(accessToken: string, snapshotId: string, memo?: string | null) {
  return requestJson<{ snapshot: TeacherWageSnapshotRecord }>(`/wages/teacher/${snapshotId}/confirm-adjustments`, {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify({ memo: memo || null }),
  });
}

export function exportTeacherAttendanceWorkbook(
  accessToken: string,
  input: { teacherId: string; yearMonth: string },
) {
  return requestJson<{ exportPayload: TeacherAttendanceWorkbookPayload }>("/wages/attendance/export", {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function previewTeacherAttendanceWorkbookImport(
  accessToken: string,
  input: TeacherAttendanceWorkbookImportInput,
) {
  return requestJson<{ preview: TeacherAttendanceWorkbookImportPreview }>("/wages/attendance/import-preview", {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function confirmTeacherAttendanceWorkbookImport(
  accessToken: string,
  input: TeacherAttendanceWorkbookImportInput,
) {
  return requestJson<{ snapshots: TeacherWageSnapshotRecord[]; preview: TeacherAttendanceWorkbookImportPreview }>(
    "/wages/attendance/import-confirm",
    {
      method: "POST",
      headers: authorizedHeaders(accessToken),
      body: JSON.stringify(input),
    },
  );
}

export function listExternalWorkLessons(accessToken: string) {
  return requestJson<ListResponse<ExternalWorkLessonRecord>>("/external-work/lessons?limit=100", {
    headers: authorizedHeaders(accessToken),
  });
}

export function listExternalWorkSettlements(accessToken: string) {
  return requestJson<ListResponse<ExternalWorkSettlementRecord>>("/external-work/settlements?limit=100", {
    headers: authorizedHeaders(accessToken),
  });
}

export function listAuditEvents(accessToken: string) {
  return requestJson<ListResponse<AuditEventRecord>>("/audit/events?limit=100", {
    headers: authorizedHeaders(accessToken),
  });
}

export function listMigrationRecordAudits(
  accessToken: string,
  targetTable: string,
  targetId: string,
) {
  const query = new URLSearchParams({ targetTable, targetId });
  return requestJson<ItemsResponse<MigrationRecordAuditRecord>>(`/audit/migration-records?${query.toString()}`, {
    headers: authorizedHeaders(accessToken),
  });
}

export function listIncomeRecords(accessToken: string) {
  return requestJson<ListResponse<IncomeRecord>>("/income?limit=100", {
    headers: authorizedHeaders(accessToken),
  });
}

export function getTuitionReceipt(accessToken: string, incomeRecordId: string) {
  return requestJson<{ receipt: TuitionReceiptPayload }>(`/income/${incomeRecordId}/receipt`, {
    headers: authorizedHeaders(accessToken),
  });
}

export function issueTuitionReceipt(accessToken: string, incomeRecordId: string) {
  return requestJson<{ receipt: TuitionReceiptPayload; created: boolean }>(`/income/${incomeRecordId}/receipt`, {
    method: "POST",
    headers: authorizedHeaders(accessToken),
  });
}

export function listTuitionReceipts(accessToken: string, incomeRecordId: string) {
  return requestJson<{ items: TuitionReceiptPayload[]; total: number }>(`/income/${incomeRecordId}/receipts`, {
    headers: authorizedHeaders(accessToken),
  });
}

export function getIssuedTuitionReceipt(accessToken: string, incomeRecordId: string, receiptRecordId: string) {
  return requestJson<{ receipt: TuitionReceiptPayload }>(
    `/income/${incomeRecordId}/receipts/${receiptRecordId}`,
    { headers: authorizedHeaders(accessToken) },
  );
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

export function createExpenseFromTeacherWage(accessToken: string, snapshotId: string, memo?: string | null) {
  return requestJson<{ expenseRecord: ExpenseRecord }>(`/expenses/from-wage/${snapshotId}`, {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify({ memo: memo || null }),
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

export function listCashPaymentBatches(accessToken: string) {
  return requestJson<ListResponse<CashPaymentBatchRecord>>("/cash/payment-batches", {
    headers: authorizedHeaders(accessToken),
  });
}

export function listCashEligibleAccounts(accessToken: string) {
  return requestJson<{
    mode: "mock" | "supabase" | "disabled";
    items: CashEligibleAccountRecord[];
  }>("/cash/accounts", {
    headers: authorizedHeaders(accessToken),
  });
}

export function listCashInboundEvents(accessToken: string) {
  return requestJson<ListResponse<CashInboundEventRecord>>("/cash-inbound/events?limit=100", {
    headers: authorizedHeaders(accessToken),
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

export function listReimbursements(accessToken: string) {
  return requestJson<ListResponse<ReimbursementRecord>>("/reimbursements?limit=100", {
    headers: authorizedHeaders(accessToken),
  });
}

export function listReimbursementCandidateExpenses(accessToken: string) {
  return requestJson<ListResponse<ReimbursementCandidateExpenseRecord>>("/reimbursements/candidates/expenses?limit=100", {
    headers: authorizedHeaders(accessToken),
  });
}

export function createReimbursementFromExpense(
  accessToken: string,
  expenseRecordId: string,
  input: CreateReimbursementInput,
) {
  return requestJson<{ reimbursement: ReimbursementRecord }>(`/reimbursements/from-expense/${expenseRecordId}`, {
    method: "POST",
    headers: authorizedHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function voidReimbursement(accessToken: string, reimbursementId: string, input: VoidReimbursementInput = {}) {
  return requestJson<{ reimbursement: ReimbursementRecord; idempotent?: boolean }>(`/reimbursements/${reimbursementId}/void`, {
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
