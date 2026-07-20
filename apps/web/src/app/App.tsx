import { useEffect, useMemo, useState } from "react";
import type { ElementType, FormEvent, ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpDown,
  BadgeCheck,
  Banknote,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileText,
  GraduationCap,
  History,
  Home,
  Landmark,
  Layers3,
  LayoutDashboard,
  LockKeyhole,
  MoreHorizontal,
  PencilLine,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SquarePen,
  UserCircle2,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  archiveStudent,
  archiveTeacher,
  apiBaseUrl,
  cancelPlannedLesson,
  confirmTeacherWageAdjustments,
  confirmTeacherAttendanceWorkbookImport,
  createPlannedLesson,
  createTeacherWageRule,
  createReimbursementFromExpense,
  createExpenseFromTeacherWage,
  createManualExpense,
  createManualIncome,
  createStudent,
  createTeacher,
  deleteFreshPlannedLesson,
  fetchApiHealthSnapshot,
  isApiRequestError,
  listAccountTransactions,
  listAccounts,
  listAuditEvents,
  listBusinessEntities,
  listCashInboundEvents,
  listCashEligibleAccounts,
  listCashRequests,
  listCashPaymentBatches,
  listExpenseRecords,
  listExternalWorkLessons,
  listExternalWorkSettlements,
  listExternalWorkplaces,
  listIncomeRecords,
  listMigrationRecordAudits,
  listActualLessons,
  listPlannedLessons,
  listReimbursementCandidateExpenses,
  listReimbursements,
  listStudentSettlements,
  listSubjects,
  listStudents,
  listTeachers,
  listTeacherWageRules,
  listTeacherWageSnapshots,
  exportTeacherAttendanceWorkbook,
  listTuitionBills,
  lockStudentSettlement,
  lockTeacherWage,
  loginWithPassword,
  generateTuitionBill,
  generateTuitionBillIncome,
  generateActualLesson,
  getTuitionReceipt,
  issueTuitionReceipt,
  getCurrentUser,
  markPlannedLessonMakeupPending,
  previewTuitionBill,
  previewStudentSettlement,
  previewTeacherWage,
  previewTeacherAttendanceWorkbookImport,
  rejectCashInboundEvent,
  revokeStudentSettlement,
  revokeTeacherWage,
  restorePlannedLesson,
  restoreStudent,
  restoreTeacher,
  submitExpenseCashRequest,
  submitIncomeCashRequest,
  updateStudent,
  updateTeacher,
  updateTeacherWageAdjustments,
  updateTeacherWageRule,
  voidExpenseRecord,
  voidIncomeRecord,
  voidReimbursement,
  voidTuitionBill,
  withdrawCashRequest,
} from "./api";
import type {
  ApiHealthSnapshot,
  AccountRecord,
  AccountTransactionRecord,
  AuditEventRecord,
  AuthSession,
  BusinessEntityRecord,
  CashInboundEventRecord,
  CashEligibleAccountRecord,
  CashRequestRecord,
  CashPaymentBatchRecord,
  CreateReimbursementInput,
  CreatePlannedLessonInput,
  ExpenseRecord,
  ExternalWorkLessonRecord,
  ExternalWorkSettlementRecord,
  ExternalWorkplaceRecord,
  GenerateActualLessonInput,
  GenerateTuitionBillInput,
  IncomeRecord,
  LockStudentSettlementInput,
  ManualExpenseInput,
  ManualIncomeInput,
  MigrationRecordAuditRecord,
  ReimbursementCandidateExpenseRecord,
  ReimbursementRecord,
  StudentActualLessonRecord,
  StudentPlannedLessonRecord,
  SubmitCashRequestInput,
  StudentSettlementRecord,
  StudentSettlementInput,
  StudentSettlementPreview,
  StudentRecord,
  StudentWriteInput,
  SubjectRecord,
  TeacherRecord,
  TeacherWageRuleRecord,
  TeacherWageRuleInput,
  TeacherWageInput,
  TeacherWageAdjustmentInput,
  TeacherWagePreview,
  TeacherWageSnapshotRecord,
  TeacherAttendanceWorkbookImportInput,
  TeacherAttendanceWorkbookImportPreview,
  TeacherWriteInput,
  TuitionBillRecord,
  TuitionBillPreview,
  TuitionReceiptPayload,
} from "./api";
import {
  downloadTeacherAttendanceWorkbook,
  parseTeacherAttendanceWorkbook,
} from "./attendance-workbook";

type Tone = "sky" | "cyan" | "emerald" | "amber" | "rose" | "slate" | "violet";

interface Metric {
  label: string;
  value: string;
  sub: string;
  tone: Tone;
  icon: ElementType;
}

interface Filter {
  label: string;
  options: string[];
}

interface Column {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  wide?: boolean;
}

interface DetailLine {
  label: string;
  value: ReactNode;
}

interface DetailSection {
  title: string;
  lines: DetailLine[];
}

interface CashPreview {
  sourceAmount: string;
  exchangeRate: string;
  method: string;
  requestedAmount: string;
  account: string;
}

interface DataRow {
  id: string;
  title: string;
  subtitle?: string;
  status: string;
  tone: Tone;
  cells: Record<string, ReactNode>;
  detail: DetailSection[];
  cashPreview?: CashPreview;
  apiRef?: {
    resource:
      | "student"
      | "teacher"
      | "income"
      | "expense"
      | "cashRequest"
      | "cashPaymentBatch"
      | "cashInbound"
      | "reimbursement"
      | "tuitionBill"
      | "studentSettlement"
      | "teacherWageRule"
      | "teacherWageSnapshot"
      | "externalWorkLesson"
      | "externalWorkSettlement"
      | "auditEvent";
    id: string;
  };
  studentRecord?: StudentRecord;
  tuitionBillRecord?: TuitionBillRecord;
  studentSettlementRecord?: StudentSettlementRecord;
  teacherWageRuleRecord?: TeacherWageRuleRecord;
  teacherWageSnapshotRecord?: TeacherWageSnapshotRecord;
  teacherAttendanceGroup?: TeacherAttendanceGroup;
  teacherRecord?: TeacherRecord;
  settingCategory?: SettingCategory;
  readOnlyActions?: boolean;
  migrationAuditTarget?: {
    targetTable: string;
    targetId: string;
  };
  financeRecord?: {
    kind: "income" | "expense";
    sourceType: string;
    recordStatus: string;
    cashStatus: string;
    originalCurrency: "JPY" | "CNY";
    amountJpy: number | null;
    amountCny: number | null;
    receiptEligible?: boolean;
    receiptIssued?: boolean;
  };
  cashRequest?: {
    status: string;
    direction: "income" | "expense";
  };
  cashInbound?: {
    status: string;
  };
  reimbursement?: {
    status: string;
  };
}

type DrawerActionVariant = "primary" | "secondary" | "quiet" | "danger" | "warning";
type DrawerActionKey =
  | "student.edit"
  | "student.archive"
  | "student.restore"
  | "teacher.edit"
  | "teacher.archive"
  | "teacher.restore"
  | "cash.submit"
  | "cash.withdraw"
  | "cashInbound.reject"
  | "tuitionBill.generate"
  | "tuitionBill.generateIncome"
  | "tuitionBill.void"
  | "studentSettlement.relock"
  | "studentSettlement.revoke"
  | "teacherWageRule.edit"
  | "teacherWageSnapshot.relock"
  | "teacherWageSnapshot.revoke"
  | "teacherWageSnapshot.adjust"
  | "teacherWageSnapshot.confirmAdjustments"
  | "teacherWageSnapshot.generateExpense"
  | "teacherWageSnapshot.viewExpense"
  | "teacherAttendance.export"
  | "teacherAttendance.import"
  | "income.receipt"
  | "income.void"
  | "expense.void"
  | "reimbursement.void"
  | "migrationAudit.view";

interface DrawerAction {
  label: string;
  icon: ElementType;
  variant: DrawerActionVariant;
  hint?: string;
  key?: DrawerActionKey;
}

interface DrawerActionGroup {
  title: string;
  actions: DrawerAction[];
}

interface PageConfig {
  key: string;
  group: string;
  title: string;
  description: string;
  primaryAction?: string;
  secondaryAction?: string;
  icon: ElementType;
  metrics: Metric[];
  filters: Filter[];
  columns: Column[];
  rows: DataRow[];
  batchAction?: "cash" | "export" | "lock";
  selectable?: boolean;
}

interface MenuItem {
  key: string;
  label: string;
}

interface MenuGroup {
  label: string;
  icon: ElementType;
  items: MenuItem[];
}

type AuthMode = "api" | "demo";

const persistentAuthStorageKey = "aozora-v3-auth-session";
const tabAuthStorageKey = "aozora-v3-tab-auth-session";

interface StoredAuthSession {
  session: AuthSession;
  remember: boolean;
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AuthSession>;
  return (
    typeof candidate.accessToken === "string" &&
    candidate.tokenType === "Bearer" &&
    typeof candidate.expiresIn === "string" &&
    Boolean(candidate.user && typeof candidate.user.id === "string")
  );
}

function readStoredAuthSession(): StoredAuthSession | null {
  const candidates = [
    { getStorage: () => window.localStorage, key: persistentAuthStorageKey, remember: true },
    { getStorage: () => window.sessionStorage, key: tabAuthStorageKey, remember: false },
  ];

  for (const candidate of candidates) {
    try {
      const storage = candidate.getStorage();
      const raw = storage.getItem(candidate.key);
      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw) as unknown;
      if (isAuthSession(parsed)) {
        return { session: parsed, remember: candidate.remember };
      }

      storage.removeItem(candidate.key);
    } catch {
      // Try the next storage when this one is unavailable or malformed.
    }
  }

  return null;
}

function clearStoredAuthSession() {
  try {
    window.localStorage.removeItem(persistentAuthStorageKey);
    window.sessionStorage.removeItem(tabAuthStorageKey);
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}

function persistAuthSession(session: AuthSession, remember: boolean) {
  clearStoredAuthSession();

  try {
    const storage = remember ? window.localStorage : window.sessionStorage;
    const key = remember ? persistentAuthStorageKey : tabAuthStorageKey;
    storage.setItem(key, JSON.stringify(session));
  } catch {
    // The current page remains logged in even when persistence is unavailable.
  }
}

type StudentApiState =
  | { status: "idle" | "loading"; rows: DataRow[]; total: number; message?: string }
  | { status: "ready"; rows: DataRow[]; total: number; message?: string }
  | { status: "error"; rows: DataRow[]; total: number; message: string };

type StudentDialogState =
  | { mode: "create" }
  | { mode: "edit"; row: DataRow };

type TeacherApiState =
  | { status: "idle" | "loading"; rows: DataRow[]; total: number; message?: string }
  | { status: "ready"; rows: DataRow[]; total: number; message?: string }
  | { status: "error"; rows: DataRow[]; total: number; message: string };

type TeacherDialogState =
  | { mode: "create" }
  | { mode: "edit"; row: DataRow };

type FinanceDialogState = { kind: "income" | "expense" };
type PlannedLessonDialogState = { defaultStudentId?: string };
type TuitionBillDialogState = {
  mode: "create" | "regenerate";
  yearMonth: string;
  studentId?: string;
};
type StudentSettlementDialogState = {
  mode: "lock" | "relock";
  studentId?: string;
  yearMonth: string;
  settlement?: StudentSettlementRecord;
};
type TeacherWageRuleDialogState =
  | { mode: "create" }
  | { mode: "edit"; rule: TeacherWageRuleRecord };
type TeacherWageDialogState = {
  mode: "lock" | "relock";
  teacherId?: string;
  businessEntityId?: string;
  yearMonth: string;
  snapshot?: TeacherWageSnapshotRecord;
};
type TeacherWageAdjustmentDialogState = { snapshot: TeacherWageSnapshotRecord };
interface TeacherAttendanceGroup {
  teacherId: string;
  teacherName: string;
  yearMonth: string;
  snapshots: TeacherWageSnapshotRecord[];
}
type TeacherAttendanceImportDialogState = { group: TeacherAttendanceGroup };
type CashRequestDialogState = { row: DataRow };
type TuitionReceiptDialogState = { receipt: TuitionReceiptPayload };
type ReimbursementDialogState = {
  isLoading: boolean;
  candidates: ReimbursementCandidateExpenseRecord[];
  accounts: AccountRecord[];
};
type MigrationAuditDialogState = {
  title: string;
  isLoading: boolean;
  records: MigrationRecordAuditRecord[];
  error?: string;
};
type ReimbursementFormInput = CreateReimbursementInput & {
  expenseRecordId: string;
};

type SettingCategory = "businessEntities" | "accounts" | "subjects" | "externalWorkplaces";

interface SettingsApiCounts {
  businessEntities: number;
  accounts: number;
  subjects: number;
  externalWorkplaces: number;
}

type SettingsApiState =
  | {
      status: "idle" | "loading";
      rows: DataRow[];
      counts: SettingsApiCounts;
      businessEntities: BusinessEntityRecord[];
      subjects: SubjectRecord[];
      message?: string;
    }
  | {
      status: "ready";
      rows: DataRow[];
      counts: SettingsApiCounts;
      businessEntities: BusinessEntityRecord[];
      subjects: SubjectRecord[];
      message?: string;
    }
  | {
      status: "error";
      rows: DataRow[];
      counts: SettingsApiCounts;
      businessEntities: BusinessEntityRecord[];
      subjects: SubjectRecord[];
      message: string;
    };

type FinanceListState =
  | { status: "idle" | "loading"; rows: DataRow[]; total: number; message?: string }
  | { status: "ready"; rows: DataRow[]; total: number; message?: string }
  | { status: "error"; rows: DataRow[]; total: number; message: string };

interface FinanceApiState {
  incomeRecords: FinanceListState;
  expenseRecords: FinanceListState;
  cashRequests: FinanceListState;
  cashInbound: FinanceListState;
  accountLedger: FinanceListState;
  reimbursements: FinanceListState;
}

type ApiItemsState<T> =
  | { status: "idle" | "loading"; items: T[]; total: number; message?: string }
  | { status: "ready"; items: T[]; total: number; message?: string }
  | { status: "error"; items: T[]; total: number; message: string };

type StudentChainListState<T> = ApiItemsState<T>;

interface StudentChainApiState {
  plannedLessons: StudentChainListState<StudentPlannedLessonRecord>;
  actualLessons: StudentChainListState<StudentActualLessonRecord>;
  tuitionBills: FinanceListState;
  settlements: FinanceListState;
}

interface WorkflowApiState {
  wageRules: FinanceListState;
  wageSnapshots: FinanceListState;
  wageImports: FinanceListState;
  externalLessons: ApiItemsState<ExternalWorkLessonRecord>;
  externalSettlements: FinanceListState;
  auditEvents: FinanceListState;
}

const toneClasses: Record<
  Tone,
  {
    pill: string;
    dot: string;
    card: string;
    icon: string;
    accent: string;
    border: string;
    text: string;
    soft: string;
  }
> = {
  sky: {
    pill: "bg-sky-50 text-sky-700",
    dot: "bg-sky-500",
    card: "bg-sky-50",
    icon: "text-sky-700",
    accent: "bg-[#1687D9]",
    border: "border-sky-200",
    text: "text-sky-700",
    soft: "bg-sky-50/70",
  },
  cyan: {
    pill: "bg-cyan-50 text-cyan-700",
    dot: "bg-cyan-500",
    card: "bg-cyan-50",
    icon: "text-cyan-700",
    accent: "bg-cyan-500",
    border: "border-cyan-200",
    text: "text-cyan-700",
    soft: "bg-cyan-50/70",
  },
  emerald: {
    pill: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    card: "bg-emerald-50",
    icon: "text-emerald-700",
    accent: "bg-emerald-500",
    border: "border-emerald-200",
    text: "text-emerald-700",
    soft: "bg-emerald-50/70",
  },
  amber: {
    pill: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    card: "bg-amber-50",
    icon: "text-amber-700",
    accent: "bg-amber-500",
    border: "border-amber-200",
    text: "text-amber-700",
    soft: "bg-amber-50/70",
  },
  rose: {
    pill: "bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
    card: "bg-rose-50",
    icon: "text-rose-700",
    accent: "bg-rose-500",
    border: "border-rose-200",
    text: "text-rose-700",
    soft: "bg-rose-50/70",
  },
  slate: {
    pill: "bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
    card: "bg-slate-50",
    icon: "text-slate-600",
    accent: "bg-slate-400",
    border: "border-slate-200",
    text: "text-slate-600",
    soft: "bg-slate-50/70",
  },
  violet: {
    pill: "bg-violet-50 text-violet-700",
    dot: "bg-violet-500",
    card: "bg-violet-50",
    icon: "text-violet-700",
    accent: "bg-violet-500",
    border: "border-violet-200",
    text: "text-violet-700",
    soft: "bg-violet-50/70",
  },
};

const menuGroups: MenuGroup[] = [
  {
    label: "工作台",
    icon: LayoutDashboard,
    items: [{ label: "首页", key: "dashboard" }],
  },
  {
    label: "签约前",
    icon: FileText,
    items: [
      { label: "报价单", key: "quote" },
      { label: "合同草稿", key: "contract" },
      { label: "课程计划", key: "course-plan" },
    ],
  },
  {
    label: "学生链路",
    icon: Users,
    items: [
      { label: "学生管理", key: "students" },
      { label: "课时管理", key: "lesson-management" },
      { label: "学费账单", key: "tuition-bills" },
      { label: "月度结算", key: "student-settlements" },
    ],
  },
  {
    label: "老师链路",
    icon: GraduationCap,
    items: [
      { label: "老师管理", key: "teachers" },
      { label: "工资规则", key: "teacher-rules" },
      { label: "工资结算", key: "teacher-wages" },
      { label: "勤务表导入", key: "wage-import" },
    ],
  },
  {
    label: "外部授课",
    icon: BookOpen,
    items: [
      { label: "打工课时", key: "external-lessons" },
      { label: "打工结算", key: "external-settlements" },
    ],
  },
  {
    label: "财务 / Cash",
    icon: Landmark,
    items: [
      { label: "收入记录", key: "income-records" },
      { label: "支出记录", key: "expense-records" },
      { label: "Cash 请求", key: "cash-requests" },
      { label: "Cash 入站", key: "cash-inbound" },
      { label: "账户流水", key: "account-ledger" },
      { label: "报销管理", key: "reimbursements" },
    ],
  },
  {
    label: "系统管理",
    icon: Settings,
    items: [
      { label: "审计中心", key: "audit" },
      { label: "基础设置", key: "settings" },
    ],
  },
];

const money = {
  jpy: (n: number) => `JPY ${n.toLocaleString("ja-JP")}`,
  cny: (n: number) =>
    `CNY ${n.toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
};

function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  const c = toneClasses[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${c.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {label}
    </span>
  );
}

function createInitialApiHealth(): ApiHealthSnapshot {
  return {
    apiBaseUrl,
    status: "checking",
    database: "checking",
    message: "Checking API health",
  };
}

function ApiStatusBadge({
  apiHealth,
  onRefresh,
}: {
  apiHealth: ApiHealthSnapshot;
  onRefresh: () => void;
}) {
  const isOnline = apiHealth.status === "online";
  const databaseOnline = apiHealth.database === "online";
  const label =
    apiHealth.status === "checking"
      ? "API 唤醒中"
      : isOnline && databaseOnline
        ? "API 在线"
        : isOnline
          ? "DB 异常"
          : "API 未连接";
  const className =
    isOnline && databaseOnline
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : apiHealth.status === "checking"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <button
      type="button"
      onClick={onRefresh}
      title={`${apiHealth.apiBaseUrl}${apiHealth.message ? ` · ${apiHealth.message}` : ""}`}
      className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition hover:bg-white ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isOnline && databaseOnline
            ? "bg-emerald-500"
            : apiHealth.status === "checking"
              ? "bg-sky-500"
              : "bg-amber-500"
        }`}
      />
      {label}
      <RefreshCw className={`h-3 w-3 ${apiHealth.status === "checking" ? "animate-spin" : ""}`} />
    </button>
  );
}

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon;
  const tone = toneClasses[metric.tone];
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      <div className={`h-[3px] ${tone.accent}`} />
      <div className="flex min-h-[112px] flex-col justify-between px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
          <span className={`flex h-7 w-7 items-center justify-center rounded-md ${tone.card}`}>
            <Icon className={`h-3.5 w-3.5 ${tone.icon}`} />
          </span>
        </div>
        <div>
          <div className="font-mono text-2xl font-semibold tracking-normal text-foreground">{metric.value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{metric.sub}</div>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  filter,
  value,
  onChange,
}: {
  filter: Filter;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{filter.label}</span>
      <span className="relative">
        <select
          className="h-9 w-full appearance-none rounded-md border border-border bg-white py-1.5 pl-3 pr-8 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-ring"
          value={value}
          onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        >
          <option value="">全部</option>
          {filter.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      </span>
    </label>
  );
}

function ActionButton({
  children,
  icon: Icon,
  variant = "primary",
  onClick,
}: {
  children: ReactNode;
  icon?: ElementType;
  variant?: "primary" | "secondary" | "quiet";
  onClick?: () => void;
}) {
  const className =
    variant === "primary"
      ? "bg-[#1687D9] text-white hover:bg-[#0f74bd]"
      : variant === "secondary"
        ? "border border-[#1687D9] bg-[#EDF6FD] text-[#1264a8] hover:bg-[#dff0fb]"
        : "border border-border bg-white text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition ${className}`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

function Sidebar({
  activeKey,
  onNavigate,
  user,
}: {
  activeKey: string;
  onNavigate: (key: string) => void;
  user: Pick<AuthSession["user"], "displayName" | "email">;
}) {
  const activeGroup = menuGroups.find((group) => group.items.some((item) => item.key === activeKey));
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(["工作台", "学生链路", "财务 / Cash", activeGroup?.label ?? ""]),
  );

  const toggleGroup = (label: string) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  return (
    <aside className="flex min-h-screen w-[224px] shrink-0 flex-col border-r border-border bg-white">
      <div className="border-b border-border px-4 py-4">
        <button
          onClick={() => onNavigate("dashboard")}
          className="flex w-full items-center gap-2 text-left"
        >
          <img
            src="/favicon.ico"
            alt="青空进学塾"
            className="h-9 w-9 shrink-0 rounded-md bg-white object-contain shadow-sm ring-1 ring-border"
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-tight text-foreground">青空进学塾</span>
            <span className="block truncate text-[10px] leading-tight text-muted-foreground">V3 管理后台</span>
          </span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {menuGroups.map((group) => {
          const isOpen = openGroups.has(group.label);
          const hasActive = group.items.some((item) => item.key === activeKey);
          const Icon = group.icon;

          return (
            <div className="mb-1" key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className={`flex h-9 w-full items-center justify-between rounded-md px-2.5 text-sm transition ${
                  hasActive
                    ? "bg-sky-50 text-foreground"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  {group.label}
                </span>
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </button>
              {isOpen && (
                <div className="ml-4 mt-1 space-y-0.5 border-l border-border pl-2">
                  {group.items.map((item) => {
                    const isActive = item.key === activeKey;
                    return (
                      <button
                        key={item.key}
                        onClick={() => onNavigate(item.key)}
                        className={`h-8 w-full rounded-md px-2.5 text-left text-xs transition ${
                          isActive
                            ? "bg-[#1687D9] font-medium text-white"
                            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
            {user.displayName.slice(0, 1) || "管"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium text-foreground">{user.displayName}</span>
            <span className="block truncate text-[10px] text-muted-foreground">{user.email}</span>
          </span>
        </div>
      </div>
    </aside>
  );
}

function TopBar({
  page,
  apiHealth,
  authMode,
  onRefreshApi,
  onLogout,
}: {
  page: Pick<PageConfig, "group" | "title">;
  apiHealth: ApiHealthSnapshot;
  authMode: AuthMode;
  onRefreshApi: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-white">
      <div className="flex h-12 items-center justify-between px-6">
        <nav className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{page.group}</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">{page.title}</span>
        </nav>
        <div className="flex items-center gap-3">
          <ApiStatusBadge apiHealth={apiHealth} onRefresh={onRefreshApi} />
          <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {authMode === "api" ? "API 登录" : "Demo 登录"}
          </span>
          <span className="text-xs text-muted-foreground">2026年07月</span>
          <button className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <Bell className="h-4 w-4" />
          </button>
          <button
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title="退出登录"
            onClick={onLogout}
          >
            <UserCircle2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

function PageHeader({
  page,
  onPrimary,
}: {
  page: PageConfig;
  onPrimary?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-[#1687D9] ring-1 ring-border">
            <page.icon className="h-4 w-4" />
          </span>
          <h1 className="text-lg font-semibold tracking-normal text-foreground">{page.title}</h1>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{page.description}</p>
      </div>
      <div className="flex items-center gap-2">
        {page.secondaryAction && (
          <ActionButton icon={Download} variant="quiet">
            {page.secondaryAction}
          </ActionButton>
        )}
        {page.primaryAction && (
          <ActionButton icon={SquarePen} onClick={onPrimary}>
            {page.primaryAction}
          </ActionButton>
        )}
      </div>
    </div>
  );
}

function FilterPanel({
  filters,
  values,
  keyword,
  onFilterChange,
  onKeywordChange,
  onQuery,
  onReset,
}: {
  filters: Filter[];
  values?: Record<string, string>;
  keyword?: string;
  onFilterChange?: (label: string, value: string) => void;
  onKeywordChange?: (value: string) => void;
  onQuery?: () => void;
  onReset?: () => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-white px-5 py-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {filters.map((filter) => (
          <FilterSelect
            key={filter.label}
            filter={filter}
            value={values?.[filter.label]}
            onChange={onFilterChange ? (value) => onFilterChange(filter.label, value) : undefined}
          />
        ))}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">关键词</span>
          <span className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-9 w-full rounded-md border border-border bg-white py-1.5 pl-8 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-ring"
              placeholder="搜索姓名、对象或备注"
              value={keyword}
              onChange={onKeywordChange ? (event) => onKeywordChange(event.target.value) : undefined}
              onKeyDown={onQuery ? (event) => {
                if (event.key === "Enter") onQuery();
              } : undefined}
            />
          </span>
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-border/70 pt-3">
        <ActionButton icon={Search} onClick={onQuery}>查询</ActionButton>
        <ActionButton icon={RotateCcw} variant="quiet" onClick={onReset}>
          重置
        </ActionButton>
      </div>
    </section>
  );
}

function DataTable({
  page,
  selected,
  onToggleRow,
  onToggleAll,
  onOpenDetail,
  showSelection = true,
}: {
  page: PageConfig;
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onOpenDetail: (row: DataRow) => void;
  showSelection?: boolean;
}) {
  const allChecked = page.rows.length > 0 && selected.size === page.rows.length;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-foreground">{page.title}列表</span>
        <span className="text-xs text-muted-foreground">共 {page.rows.length} 条</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {showSelection && (
                <th className="w-10 px-4 py-2.5 text-left">
                  <input
                    checked={allChecked}
                    onChange={onToggleAll}
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-border accent-[#1687D9]"
                  />
                </th>
              )}
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">对象</th>
              {page.columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-3 py-2.5 text-xs font-medium text-muted-foreground ${
                    column.align === "right"
                      ? "text-right"
                      : column.align === "center"
                        ? "text-center"
                        : "text-left"
                  } ${column.wide ? "min-w-[150px]" : "whitespace-nowrap"}`}
                >
                  <span
                    className={`inline-flex items-center gap-1 ${
                      column.align === "right" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {column.label}
                    <ArrowUpDown className="h-3 w-3 opacity-30" />
                  </span>
                </th>
              ))}
              <th className="w-24 px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            {page.rows.map((row) => {
              const isSelected = selected.has(row.id);
              return (
                <tr
                  key={row.id}
                  className={`border-b border-border/60 transition hover:bg-muted/20 ${
                    isSelected ? "bg-sky-50/50" : ""
                  }`}
                >
                  {showSelection && (
                    <td className="px-4 py-3">
                      <input
                        checked={isSelected}
                        onChange={() => onToggleRow(row.id)}
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-border accent-[#1687D9]"
                      />
                    </td>
                  )}
                  <td className="px-3 py-3">
                    <div className="font-medium leading-snug text-foreground">{row.title}</div>
                    {row.subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{row.subtitle}</div>}
                  </td>
                  {page.columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-3 py-3 ${
                        column.align === "right"
                          ? "text-right"
                          : column.align === "center"
                            ? "text-center"
                            : "text-left"
                      }`}
                    >
                      {column.key === "status" ? (
                        <StatusPill label={row.status} tone={row.tone} />
                      ) : (
                        row.cells[column.key]
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onOpenDetail(row)}
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        title="查看详情"
                        aria-label={`查看${row.title}详情`}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenDetail(row)}
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        title="更多操作"
                        aria-label={`打开${row.title}更多操作`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DrawerActionButton({
  action,
  onSelect,
}: {
  action: DrawerAction;
  onSelect?: (action: DrawerAction) => void;
}) {
  const Icon = action.icon;
  const className =
    action.variant === "primary"
      ? "border-[#1687D9] bg-[#1687D9] text-white hover:bg-[#0f74bd]"
      : action.variant === "secondary"
        ? "border-[#1687D9] bg-[#EDF6FD] text-[#1264a8] hover:bg-[#dff0fb]"
        : action.variant === "danger"
          ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
          : action.variant === "warning"
            ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
            : "border-border bg-white text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <button
      onClick={action.key ? () => onSelect?.(action) : undefined}
      className={`flex min-h-9 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-xs font-medium transition ${className}`}
      title={action.hint}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{action.label}</span>
      </span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
    </button>
  );
}

function getDrawerActionGroups(row: DataRow): DrawerActionGroup[] {
  const migrationAuditActionGroup: DrawerActionGroup[] = row.migrationAuditTarget
    ? [
        {
          title: "历史迁移审计",
          actions: [
            {
              label: "查看迁移审计",
              icon: ShieldCheck,
              variant: "secondary",
              key: "migrationAudit.view",
              hint: "仅显示迁移批次、校验与时间元数据，不显示来源业务行。",
            },
          ],
        },
      ]
    : [];

  if (row.readOnlyActions) {
    return migrationAuditActionGroup;
  }

  if (row.apiRef?.resource === "cashRequest") {
    const canManageCashRequest = row.cashRequest?.status === "cash_requested";
    const actions: DrawerAction[] = canManageCashRequest
      ? [
          { label: "撤回请求", icon: RotateCcw, variant: "warning", key: "cash.withdraw" },
          { label: "查看操作记录", icon: History, variant: "quiet" },
        ]
      : [{ label: "查看操作记录", icon: History, variant: "quiet" }];

    return [
      {
        title: "Cash 请求操作",
        actions,
      },
    ];
  }

  if (row.apiRef?.resource === "cashInbound") {
    const canRejectInbound = row.cashInbound?.status === "account_transaction_created";
    const actions: DrawerAction[] = canRejectInbound
      ? [
          { label: "冲销入站", icon: RotateCcw, variant: "danger", key: "cashInbound.reject" },
          { label: "查看操作记录", icon: History, variant: "quiet" },
        ]
      : [{ label: "查看操作记录", icon: History, variant: "quiet" }];

    return [
      {
        title: "Cash 入站操作",
        actions,
      },
    ];
  }

  if (row.apiRef?.resource === "reimbursement") {
    const canVoidReimbursement = row.reimbursement?.status === "completed";
    const actions: DrawerAction[] = canVoidReimbursement
      ? [
          { label: "作废报销", icon: X, variant: "danger", key: "reimbursement.void" },
          { label: "查看操作记录", icon: History, variant: "quiet" },
        ]
      : [{ label: "查看操作记录", icon: History, variant: "quiet" }];

    return [
      {
        title: "报销操作",
        actions,
      },
    ];
  }

  if (row.apiRef?.resource === "income" || row.apiRef?.resource === "expense") {
    const actionKey = row.apiRef.resource === "income" ? "income.void" : "expense.void";
    const actions: DrawerAction[] = [];
    const canVoid = row.financeRecord
      ? row.financeRecord.kind === "income"
        ? canVoidIncomeRecord(row.financeRecord.sourceType, row.financeRecord.recordStatus, row.financeRecord.cashStatus)
        : canVoidExpenseRecord(row.financeRecord.sourceType, row.financeRecord.recordStatus, row.financeRecord.cashStatus)
      : false;

    if (row.financeRecord && canSubmitCashRequest(row.financeRecord.recordStatus, row.financeRecord.cashStatus)) {
      actions.push({ label: "提交 Cash 请求", icon: Send, variant: "primary", key: "cash.submit" });
    }

    if (
      row.apiRef.resource === "income" &&
      (row.financeRecord?.receiptEligible || row.financeRecord?.receiptIssued)
    ) {
      actions.push({
        label: row.financeRecord.receiptIssued ? "查看学费收据" : "生成学费收据",
        icon: ReceiptText,
        variant: "secondary",
        key: "income.receipt",
      });
    }

    if (canVoid) {
      actions.push({
        label: row.financeRecord?.sourceType === "teacher_wage_snapshot" ? "作废工资支出" : "作废记录",
        icon: X,
        variant: "danger",
        key: actionKey,
      });
    }

    actions.push({ label: "查看操作记录", icon: History, variant: "quiet" });

    return [
      {
        title: "财务操作",
        actions,
      },
      ...migrationAuditActionGroup,
    ];
  }

  if (row.id.startsWith("student-")) {
    const statusAction: DrawerAction =
      row.status === "归档"
        ? { label: "恢复学生", icon: RotateCcw, variant: "secondary", key: "student.restore" }
        : { label: "归档学生", icon: X, variant: "warning", key: "student.archive" };

    return [
      {
        title: "学生操作",
        actions: [
          { label: "编辑基础信息", icon: PencilLine, variant: "primary", key: "student.edit" },
          { label: "查看该学生课时", icon: CalendarDays, variant: "secondary" },
          { label: "查看该学生账单", icon: ReceiptText, variant: "secondary" },
          statusAction,
          { label: "查看操作记录", icon: History, variant: "quiet" },
        ],
      },
    ];
  }

  if (row.id.startsWith("bill-")) {
    if (row.status === "已生成") {
      return [
        {
          title: "学费账单操作",
          actions: [
            { label: "生成收入记录", icon: ReceiptText, variant: "primary", key: "tuitionBill.generateIncome" },
            { label: "重新生成账单", icon: RefreshCw, variant: "secondary", key: "tuitionBill.generate" },
            { label: "作废账单", icon: X, variant: "danger", key: "tuitionBill.void" },
            { label: "查看来源课时", icon: CalendarDays, variant: "quiet" },
            { label: "查看操作记录", icon: History, variant: "quiet" },
          ],
        },
      ];
    }

    if (row.status === "已作废") {
      return [
        {
          title: "学费账单操作",
          actions: [
            { label: "重新生成账单", icon: RefreshCw, variant: "primary", key: "tuitionBill.generate" },
            { label: "查看来源课时", icon: CalendarDays, variant: "quiet" },
            { label: "查看操作记录", icon: History, variant: "quiet" },
          ],
        },
      ];
    }

    return [
      {
        title: "学费账单操作",
        actions: [
          { label: "查看 Cash 回写", icon: Banknote, variant: "secondary" },
          { label: "导出账单 PDF", icon: Download, variant: "quiet" },
          { label: "查看来源课时", icon: CalendarDays, variant: "quiet" },
          { label: "查看操作记录", icon: History, variant: "quiet" },
        ],
      },
    ];
  }

  if (row.id.startsWith("settlement-")) {
    if (row.studentSettlementRecord?.status === "locked") {
      return [
        {
          title: "月度结算操作",
          actions: [
            { label: "撤销结算", icon: RotateCcw, variant: "warning", key: "studentSettlement.revoke" },
            { label: "查看课时明细", icon: CalendarDays, variant: "quiet" },
            { label: "查看操作记录", icon: History, variant: "quiet" },
          ],
        },
      ];
    }

    return [
      {
        title: "月度结算操作",
        actions: [
          { label: "重新预览并锁定", icon: LockKeyhole, variant: "primary", key: "studentSettlement.relock" },
          { label: "查看课时明细", icon: CalendarDays, variant: "quiet" },
          { label: "查看操作记录", icon: History, variant: "quiet" },
        ],
      },
    ];
  }

  if (row.id.startsWith("teacher-")) {
    const statusAction: DrawerAction =
      row.status === "归档"
        ? { label: "恢复老师", icon: RotateCcw, variant: "secondary", key: "teacher.restore" }
        : { label: "归档老师", icon: X, variant: "warning", key: "teacher.archive" };

    return [
      {
        title: "老师操作",
        actions: [
          { label: "编辑老师资料", icon: PencilLine, variant: "primary", key: "teacher.edit" },
          { label: "查看工资规则", icon: FileText, variant: "secondary" },
          { label: "查看工资结算", icon: GraduationCap, variant: "secondary" },
          statusAction,
          { label: "查看操作记录", icon: History, variant: "quiet" },
        ],
      },
    ];
  }

  if (row.id.startsWith("rule-")) {
    return [
      {
        title: "工资规则操作",
        actions: [
          { label: "编辑规则", icon: PencilLine, variant: "primary", key: "teacherWageRule.edit" },
          { label: "查看操作记录", icon: History, variant: "quiet" },
        ],
      },
    ];
  }

  if (row.id.startsWith("wage-")) {
    const snapshot = row.teacherWageSnapshotRecord;
    const actions: DrawerAction[] = [];

    if (snapshot?.status === "revoked") {
      actions.push({ label: "重新预览并锁定", icon: LockKeyhole, variant: "primary", key: "teacherWageSnapshot.relock" });
    } else if (snapshot?.status === "locked") {
      actions.push(
        { label: "调整工资与查看课时", icon: PencilLine, variant: "primary", key: "teacherWageSnapshot.adjust" },
        { label: "确认调整", icon: CheckCircle2, variant: "primary", key: "teacherWageSnapshot.confirmAdjustments" },
      );
    } else if (snapshot?.status === "adjustment_confirmed" && !snapshot.expenseRecordId) {
      actions.push({ label: "生成支出记录", icon: ReceiptText, variant: "primary", key: "teacherWageSnapshot.generateExpense" });
    } else if (snapshot?.status === "expense_created" && snapshot.expenseRecordId) {
      actions.push({ label: "查看工资支出记录", icon: FileText, variant: "primary", key: "teacherWageSnapshot.viewExpense" });
    }

    if (snapshot && snapshot.status !== "locked") {
      actions.push({ label: "查看工资与课时明细", icon: Eye, variant: "secondary", key: "teacherWageSnapshot.adjust" });
    }

    if (snapshot && !snapshot.expenseRecordId && !["expense_created", "revoked"].includes(snapshot.status)) {
      actions.push({ label: "撤销工资快照", icon: RotateCcw, variant: "warning", key: "teacherWageSnapshot.revoke" });
    }

    actions.push({ label: "查看操作记录", icon: History, variant: "quiet" });

    return [
      {
        title: "工资结算操作",
        actions,
      },
    ];
  }

  if (row.id.startsWith("import-")) {
    const group = row.teacherAttendanceGroup;
    const canExport = Boolean(group && group.snapshots.every((snapshot) =>
      snapshot.status === "locked" && ["none", "exported"].includes(snapshot.adjustmentStatus),
    ));
    const canImport = Boolean(group && group.snapshots.every((snapshot) =>
      snapshot.status === "locked" && ["exported", "imported"].includes(snapshot.adjustmentStatus),
    ));
    const actions: DrawerAction[] = [];
    if (canExport) {
      actions.push({ label: row.status === "未导出" ? "下载勤务表" : "重新下载勤务表", icon: Download, variant: "primary", key: "teacherAttendance.export" });
    }
    if (canImport) {
      actions.push({
        label: row.status === "已导入待确认" ? "重新上传回传文件" : "上传老师回传文件",
        icon: FileText,
        variant: "primary",
        key: "teacherAttendance.import",
      });
    }
    actions.push({ label: "查看工资快照", icon: Eye, variant: "secondary" });
    actions.push({ label: "查看操作记录", icon: History, variant: "quiet" });

    return [
      {
        title: "勤务表导入操作",
        actions,
      },
    ];
  }

  if (row.id.startsWith("external-lesson-")) {
    const isLocked = row.status.includes("锁定") || row.status.includes("结算生成");

    return [
      {
        title: "外部课时操作",
        actions: [
          { label: "查看外部课时详情", icon: Eye, variant: "secondary" },
          { label: "生成实际课时", icon: ClipboardCheck, variant: isLocked ? "quiet" : "primary" },
          { label: "编辑课时", icon: PencilLine, variant: isLocked ? "quiet" : "secondary" },
          { label: "删除课时", icon: X, variant: isLocked ? "quiet" : "danger" },
          { label: "查看操作记录", icon: History, variant: "quiet" },
        ],
      },
    ];
  }

  if (row.id.startsWith("external-settlement-")) {
    if (row.status === "待锁定") {
      return [
        {
          title: "打工结算操作",
          actions: [
            { label: "锁定结算快照", icon: LockKeyhole, variant: "primary" },
            { label: "重新生成预览", icon: RefreshCw, variant: "secondary" },
            { label: "查看外部课时明细", icon: CalendarDays, variant: "quiet" },
            { label: "查看操作记录", icon: History, variant: "quiet" },
          ],
        },
      ];
    }

    if (row.status === "已锁定") {
      return [
        {
          title: "打工结算操作",
          actions: [
            { label: "生成收入记录", icon: ReceiptText, variant: "primary" },
            { label: "撤销锁定", icon: X, variant: "warning" },
            { label: "导出结算明细", icon: Download, variant: "secondary" },
            { label: "查看外部课时明细", icon: CalendarDays, variant: "quiet" },
            { label: "查看操作记录", icon: History, variant: "quiet" },
          ],
        },
      ];
    }

    return [
      {
        title: "打工结算操作",
        actions: [
          { label: "查看收入记录", icon: ReceiptText, variant: "secondary" },
          { label: "撤销收入记录", icon: RotateCcw, variant: row.status.includes("Cash 已确认") ? "quiet" : "warning" },
          { label: "导出结算明细", icon: Download, variant: "quiet" },
          { label: "查看操作记录", icon: History, variant: "quiet" },
        ],
      },
    ];
  }

  if (row.id.startsWith("income-") || row.id.startsWith("expense-")) {
    return [
      {
        title: "财务操作",
        actions: [
          { label: row.cashPreview ? "提交 Cash 请求" : "查看 Cash 状态", icon: Send, variant: row.cashPreview ? "primary" : "secondary" },
          { label: "查看来源记录", icon: FileText, variant: "quiet" },
          { label: "作废记录", icon: X, variant: "danger" },
          { label: "查看操作记录", icon: History, variant: "quiet" },
        ],
      },
      ...migrationAuditActionGroup,
    ];
  }

  return [
    {
      title: "记录操作",
      actions: [
        { label: "编辑草稿", icon: PencilLine, variant: "primary" },
        { label: "查看关联记录", icon: FileText, variant: "secondary" },
        { label: "查看操作记录", icon: History, variant: "quiet" },
      ],
    },
  ];
}

function DetailDrawer({
  row,
  onClose,
  onAction,
}: {
  row: DataRow | null;
  onClose: () => void;
  onAction?: (actionKey: DrawerActionKey, row: DataRow) => void;
}) {
  if (!row) {
    return null;
  }

  const actionGroups = getDrawerActionGroups(row);

  return (
    <div className="fixed inset-0 z-40">
      <button className="absolute inset-0 bg-slate-900/20" onClick={onClose} aria-label="关闭详情" />
      <aside className="absolute bottom-0 right-0 top-0 flex w-[420px] flex-col border-l border-border bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">{row.title}</h2>
            {row.subtitle && <p className="mt-1 text-xs text-muted-foreground">{row.subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <StatusPill label={row.status} tone={row.tone} />
          {actionGroups.map((group) => (
            <section key={group.title} className="rounded-lg border border-border bg-white">
              <div className="border-b border-border bg-muted/30 px-3 py-2 text-xs font-semibold text-foreground">
                {group.title}
              </div>
              <div className="grid gap-2 p-3">
                {group.actions.map((action) => (
                  <DrawerActionButton
                    action={action}
                    key={action.label}
                    onSelect={(selectedAction) => {
                      if (selectedAction.key) {
                        onAction?.(selectedAction.key, row);
                      }
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
          {row.detail.map((section) => (
            <section key={section.title} className="rounded-lg border border-border bg-white">
              <div className="border-b border-border bg-muted/30 px-3 py-2 text-xs font-semibold text-foreground">
                {section.title}
              </div>
              <div className="divide-y divide-border/70">
                {section.lines.map((line) => (
                  <div className="grid grid-cols-[112px_1fr] gap-3 px-3 py-2.5 text-sm" key={line.label}>
                    <span className="text-xs text-muted-foreground">{line.label}</span>
                    <span className="text-foreground">{line.value}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <ActionButton variant="quiet" onClick={onClose}>
            关闭
          </ActionButton>
        </div>
      </aside>
    </div>
  );
}

function MigrationAuditDialog({
  state,
  onClose,
}: {
  state: MigrationAuditDialogState;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="关闭迁移审计" />
      <section className="relative z-10 flex max-h-[88vh] w-[min(680px,96vw)] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">历史迁移审计</h2>
            <p className="mt-1 text-xs text-muted-foreground">{state.title}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
          <p className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs leading-5 text-violet-800">
            此处只显示迁移批次、来源类别、校验哈希和迁移时间；不显示来源业务行或原始快照。
          </p>
          {state.isLoading && (
            <div className="flex items-center gap-2 rounded-md border border-border px-3 py-3 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" /> 正在读取审计元数据…
            </div>
          )}
          {state.error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{state.error}</div>}
          {!state.isLoading && !state.error && state.records.length === 0 && (
            <div className="rounded-md border border-border px-3 py-3 text-sm text-muted-foreground">未找到对应的迁移审计记录。</div>
          )}
          {!state.isLoading &&
            state.records.map((record) => {
              const batch = record.importBatch ?? record.coreTeachingBatch;
              const disposition =
                record.disposition === "migrated" ? "已迁移" : record.disposition === "audit_only" ? "仅审计" : "已跳过";
              const period = batch?.periodStart && batch?.periodEnd ? `${batch.periodStart} ～ ${batch.periodEnd}` : "未记录";

              return (
                <section key={record.id} className="rounded-lg border border-border bg-white">
                  <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-3 py-2">
                    <span className="text-xs font-semibold text-foreground">{disposition}</span>
                    <span className="text-xs text-muted-foreground">{formatApiDateTime(record.migratedAt)}</span>
                  </div>
                  <dl className="divide-y divide-border/70 text-sm">
                    <div className="grid grid-cols-[120px_1fr] gap-3 px-3 py-2.5"><dt className="text-xs text-muted-foreground">来源类别</dt><dd>{record.sourceSystem} / {record.sourceTable}</dd></div>
                    <div className="grid grid-cols-[120px_1fr] gap-3 px-3 py-2.5"><dt className="text-xs text-muted-foreground">迁移批次</dt><dd>{batch?.sourceKey ?? "未记录"}</dd></div>
                    <div className="grid grid-cols-[120px_1fr] gap-3 px-3 py-2.5"><dt className="text-xs text-muted-foreground">批次期间</dt><dd>{period}</dd></div>
                    <div className="grid grid-cols-[120px_1fr] gap-3 px-3 py-2.5"><dt className="text-xs text-muted-foreground">来源行号</dt><dd>{record.sourceRowNumber ?? "未记录"}</dd></div>
                    <div className="grid grid-cols-[120px_1fr] gap-3 px-3 py-2.5"><dt className="text-xs text-muted-foreground">来源校验</dt><dd className="break-all font-mono text-[11px] text-muted-foreground">{record.sourceSha256 ?? "未记录"}</dd></div>
                    <div className="grid grid-cols-[120px_1fr] gap-3 px-3 py-2.5"><dt className="text-xs text-muted-foreground">迁移程序版本</dt><dd>{record.migrationProgramVersion ?? "未记录"}</dd></div>
                  </dl>
                </section>
              );
            })}
        </div>
        <footer className="flex justify-end border-t border-border bg-muted/10 px-6 py-4">
          <ActionButton variant="quiet" onClick={onClose}>关闭</ActionButton>
        </footer>
      </section>
    </div>
  );
}

function BatchActionBar({
  page,
  selectedRows,
  onClear,
  onCash,
  onLock,
}: {
  page: PageConfig;
  selectedRows: DataRow[];
  onClear: () => void;
  onCash: () => void;
  onLock?: () => void;
}) {
  if (selectedRows.length === 0 || page.selectable === false) {
    return null;
  }

  const cashCount = selectedRows.filter((row) => row.cashPreview).length;
  const label =
    page.batchAction === "cash"
      ? "提交 Cash 请求"
      : page.batchAction === "export"
        ? "批量导出"
        : "批量锁定";

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-30 flex justify-center">
      <div className="pointer-events-auto mb-4 rounded-xl border border-[#1a2d42] bg-[#0F1C2E] px-5 py-3 shadow-2xl">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-xs text-white/60">
            已选 <span className="font-semibold text-white">{selectedRows.length}</span> 条
          </span>
          {page.batchAction === "cash" && (
            <>
              <span className="h-4 w-px bg-white/15" />
              <span className="text-xs text-white/60">
                可提交 <span className="font-semibold text-white">{cashCount}</span> 条
              </span>
            </>
          )}
          <span className="h-4 w-px bg-white/15" />
          <button
            onClick={page.batchAction === "cash" ? onCash : page.batchAction === "lock" ? onLock : undefined}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1687D9] px-4 text-xs font-medium text-white transition hover:bg-[#0f74bd]"
          >
            {page.batchAction === "export" ? <Download className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
            {label}
          </button>
          <button
            onClick={onClear}
            className="inline-flex h-8 items-center gap-1 text-xs text-white/45 transition hover:text-white/80"
          >
            <X className="h-3.5 w-3.5" />
            清除选择
          </button>
        </div>
      </div>
    </div>
  );
}

function CashModal({ rows, onClose }: { rows: DataRow[]; onClose: () => void }) {
  const cashRows = rows.filter((row) => row.cashPreview);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="关闭弹窗" />
      <div className="relative z-10 flex max-h-[90vh] w-[min(1240px,96vw)] flex-col rounded-xl border border-border bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">提交 Cash 确认请求</h2>
            <p className="mt-1 text-xs text-muted-foreground">金额预览由服务端口径生成，确认后进入 Cash 待确认队列。</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-border bg-sky-50/60 px-6 py-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-sky-800">汇率方案</span>
              <select className="h-9 rounded-md border border-sky-200 bg-white px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
                <option>今日实时汇率</option>
                <option>手动输入汇率</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-sky-800">参考汇率</span>
              <input
                className="h-9 rounded-md border border-sky-200 bg-white px-3 font-mono text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                defaultValue="0.04782"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-sky-800">取舍方式</span>
              <select className="h-9 rounded-md border border-sky-200 bg-white px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
                <option>四舍五入到 0.01 CNY</option>
                <option>向上取到 0.01 CNY</option>
                <option>向下取到 0.01 CNY</option>
              </select>
            </label>
            <div className="flex items-end">
              <ActionButton icon={RefreshCw} variant="secondary">
                重新预览
              </ActionButton>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["对象", "来源金额", "汇率", "取舍", "提交金额", "Cash 账户", "备注", "结果"].map((header) => (
                  <th key={header} className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cashRows.map((row) => {
                const preview = row.cashPreview!;
                return (
                  <tr className="border-b border-border/60 hover:bg-muted/20" key={row.id}>
                    <td className="px-3 py-3">
                      <div className="font-medium text-foreground">{row.title}</div>
                      {row.subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{row.subtitle}</div>}
                    </td>
                    <td className="px-3 py-3 font-mono text-sm">{preview.sourceAmount}</td>
                    <td className="px-3 py-3 font-mono text-sm">{preview.exchangeRate}</td>
                    <td className="px-3 py-3 text-sm">{preview.method}</td>
                    <td className="px-3 py-3 font-mono text-sm font-semibold">{preview.requestedAmount}</td>
                    <td className="px-3 py-3">
                      <select className="h-8 rounded-md border border-border bg-white px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring">
                        <option>{preview.account}</option>
                        <option>备用 Cash 账户</option>
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <input
                        placeholder="选填备注"
                        className="h-8 w-32 rounded-md border border-border bg-white px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-ring"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        待提交
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border bg-muted/10 px-6 py-4">
          <div className="text-xs text-muted-foreground">
            本次将创建 <span className="font-semibold text-foreground">{cashRows.length}</span> 条 Cash 待确认请求
          </div>
          <div className="flex items-center gap-2">
            <ActionButton variant="quiet" onClick={onClose}>
              取消
            </ActionButton>
            <ActionButton icon={CheckCircle2}>提交请求</ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

const settlementBatchReady = [
  { student: "王小明", month: "2026年06月", carryover: money.cny(0), note: "课时已处理，差额为 0.00" },
  { student: "陈美咲", month: "2026年06月", carryover: money.cny(126.35), note: "存在 CNY 结转，已由后端确认" },
  { student: "李天伦", month: "2026年06月", carryover: money.cny(0), note: "同月补课已完成" },
];

const settlementBatchBlocked = [
  { student: "林拓海", reason: "存在未处理跨月补课", action: "先在课时管理登记补课完成或确认跨月状态" },
  { student: "佐藤优", reason: "学费收入 Cash 未确认", action: "等待 Cash 回写或进入人工复核" },
  { student: "高桥葵", reason: "本月学费账单被作废后未重新生成", action: "重新生成学费账单和收入记录" },
];

function SettlementBatchModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="关闭弹窗" />
      <div className="relative z-10 flex max-h-[90vh] w-[min(1080px,94vw)] flex-col rounded-xl border border-border bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">批量检查 / 锁定月度结算</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              批量操作不会改变单学生结算粒度；系统只锁定检查通过的学生，并为每个学生保留独立审计记录。
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 border-b border-border bg-muted/20 px-6 py-4 md:grid-cols-4">
          <MetricCard
            metric={{ label: "检查对象", value: "6 人", sub: "2026年06月", tone: "sky", icon: Users }}
          />
          <MetricCard
            metric={{ label: "可锁定", value: "3 人", sub: "确认后逐个锁定", tone: "emerald", icon: CheckCircle2 }}
          />
          <MetricCard
            metric={{ label: "需处理", value: "3 人", sub: "不会被本次锁定", tone: "amber", icon: ShieldCheck }}
          />
          <MetricCard
            metric={{ label: "结转合计", value: money.cny(126.35), sub: "后端确认金额", tone: "cyan", icon: RefreshCw }}
          />
        </div>

        <div className="grid flex-1 gap-4 overflow-auto px-6 py-4 lg:grid-cols-2">
          <section className="overflow-hidden rounded-lg border border-emerald-200 bg-white">
            <div className="flex items-center justify-between border-b border-emerald-200 bg-emerald-50 px-4 py-3">
              <span className="text-sm font-semibold text-emerald-800">可锁定学生</span>
              <StatusPill label="通过检查" tone="emerald" />
            </div>
            <div className="divide-y divide-border/70">
              {settlementBatchReady.map((item) => (
                <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 text-sm" key={item.student}>
                  <div>
                    <div className="font-medium text-foreground">{item.student}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {item.month} · {item.note}
                    </div>
                  </div>
                  <div className="font-mono text-sm font-semibold text-foreground">{item.carryover}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-amber-200 bg-white">
            <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-3">
              <span className="text-sm font-semibold text-amber-800">需先处理</span>
              <StatusPill label="本次跳过" tone="amber" />
            </div>
            <div className="divide-y divide-border/70">
              {settlementBatchBlocked.map((item) => (
                <div className="px-4 py-3 text-sm" key={item.student}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-foreground">{item.student}</div>
                    <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      {item.reason}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.action}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/10 px-6 py-4">
          <div className="text-xs text-muted-foreground">
            确认后仅锁定检查通过的 3 名学生；未通过学生保持待处理状态。
          </div>
          <div className="flex items-center gap-2">
            <ActionButton variant="quiet" onClick={onClose}>
              取消
            </ActionButton>
            <ActionButton icon={RefreshCw} variant="secondary">
              重新检查
            </ActionButton>
            <ActionButton icon={LockKeyhole}>锁定可通过项</ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentFormModal({
  state,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  state: StudentDialogState;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: StudentWriteInput) => void;
}) {
  const record = state.mode === "edit" ? state.row.studentRecord : undefined;
  const [name, setName] = useState(record?.name ?? "");
  const [code, setCode] = useState(record?.code ?? "");
  const [kanaName, setKanaName] = useState(record?.kanaName ?? "");
  const [memo, setMemo] = useState(record?.memo ?? "");
  const title = state.mode === "edit" ? "编辑学生基础信息" : "新增学生";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    onSubmit({
      name: name.trim(),
      code: normalizeOptionalFormValue(code),
      kanaName: normalizeOptionalFormValue(kanaName),
      memo: normalizeOptionalFormValue(memo),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="关闭弹窗" />
      <form
        onSubmit={submit}
        className="relative z-10 flex w-[min(560px,94vw)] flex-col rounded-xl border border-border bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">保存后刷新学生管理列表</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 px-6 py-5">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">学生姓名</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
              placeholder="例如：王小明"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">学生编号</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="h-10 rounded-md border border-border bg-white px-3 font-mono text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
                placeholder="student-001"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">假名</span>
              <input
                value={kanaName}
                onChange={(event) => setKanaName(event.target.value)}
                className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
                placeholder="任意备注用假名"
              />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">备注</span>
            <textarea
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              className="min-h-[92px] resize-none rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
              placeholder="选填"
            />
          </label>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/10 px-6 py-4">
          <ActionButton variant="quiet" onClick={onClose}>
            取消
          </ActionButton>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#1687D9] px-3 text-xs font-medium text-white transition hover:bg-[#0f74bd] disabled:cursor-not-allowed disabled:bg-[#8cbfe3]"
          >
            {isSubmitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {isSubmitting ? "保存中" : "保存"}
          </button>
        </div>
      </form>
    </div>
  );
}

function formatTuitionPreviewIssue(code: string, fallback: string) {
  const labels: Record<string, string> = {
    income_already_created: "该账单已经生成收入记录，不能直接重新生成。",
    no_billable_sources: "该学生本月没有可计费预定课时，也没有可用的上月锁定结转。",
    no_previous_settlement: "未找到上月结算，本次结转金额按 CNY 0.00 处理。",
    previous_settlement_not_locked: "上月结算尚未锁定，本次不会计入结转金额。",
    calculation_unchanged: "当前课时和结转与最新账单完全一致，无需重复生成。",
    replace_voided_income_bill: "旧账单收入已经作废，本次将生成新的账单版本。",
  };
  return labels[code] ?? fallback;
}

function getTuitionGenerationModeLabel(mode: TuitionBillPreview["generationMode"]) {
  if (mode === "create") return "首次生成";
  if (mode === "regenerate") return "生成新版本";
  if (mode === "unchanged") return "无需变更";
  return "当前不可生成";
}

function TuitionBillGenerateModal({
  students,
  state,
  isSubmitting,
  error,
  onClose,
  onPreview,
  onSubmit,
}: {
  students: StudentRecord[];
  state: TuitionBillDialogState;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onPreview: (input: GenerateTuitionBillInput) => Promise<TuitionBillPreview>;
  onSubmit: (input: GenerateTuitionBillInput) => void;
}) {
  const activeStudents = students.filter((student) => student.status === "active");
  const [studentId, setStudentId] = useState(state.studentId ?? activeStudents[0]?.id ?? "");
  const [yearMonth, setYearMonth] = useState(state.yearMonth);
  const [preview, setPreview] = useState<TuitionBillPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId && activeStudents[0]) setStudentId(activeStudents[0].id);
  }, [activeStudents, studentId]);

  const clearPreview = () => {
    setPreview(null);
    setPreviewError(null);
  };
  const input = studentId && yearMonth ? { studentId, yearMonth } : null;
  const requestPreview = async () => {
    if (!input) return;
    setIsPreviewing(true);
    setPreviewError(null);
    try {
      setPreview(await onPreview(input));
    } catch (previewRequestError) {
      setPreview(null);
      setPreviewError(formatApiError(previewRequestError));
    } finally {
      setIsPreviewing(false);
    }
  };
  const canGenerate = Boolean(
    input && preview && preview.willCreate && preview.blockingIssues.length === 0,
  );
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input || !preview || !canGenerate) return;
    onSubmit({
      ...input,
      expectedPreviewFingerprint: preview.previewFingerprint,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="关闭弹窗" />
      <form onSubmit={submit} className="relative z-10 flex max-h-[94vh] w-[min(820px,96vw)] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div className="min-w-0 pr-4">
            <h2 className="text-base font-semibold text-foreground">{state.mode === "regenerate" ? "重新生成学费账单" : "生成学费账单"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">先读取后端权威预览；确认后才写入账单快照。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid min-w-0 gap-4 overflow-y-auto px-6 py-5">
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">学生</span>
              <select required disabled={state.mode === "regenerate"} value={studentId} onChange={(event) => { setStudentId(event.target.value); clearPreview(); }} className="h-10 w-full min-w-0 truncate rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15 disabled:bg-muted/40">
                <option value="">请选择学生</option>
                {activeStudents.map((student) => <option key={student.id} value={student.id}>{student.name}{student.code ? `（${student.code}）` : ""}</option>)}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">业务月份</span>
              <input required disabled={state.mode === "regenerate"} type="month" value={yearMonth} onChange={(event) => { setYearMonth(event.target.value); clearPreview(); }} className="h-10 w-full min-w-0 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15 disabled:bg-muted/40" />
            </label>
          </div>

          {preview && (
            <section className="min-w-0 overflow-hidden rounded-lg border border-border">
              <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
                <span className="text-xs font-semibold">后端账单预览</span>
                <span className="rounded-full bg-white px-2 py-1 text-[11px] text-muted-foreground">{getTuitionGenerationModeLabel(preview.generationMode)}</span>
              </div>
              <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
                {[
                  ["计费课时", `${preview.plannedLessonCount} 节`],
                  ["JPY 学费", formatApiJpyAmount(preview.plannedAmountJpy)],
                  ["上月结转", formatApiCnyAmount(preview.carryoverAmountCny)],
                  ["目标版本", `v${preview.nextVersion}`],
                ].map(([label, value]) => <div key={label} className="min-w-0 bg-white px-3 py-3"><div className="text-[11px] text-muted-foreground">{label}</div><div className="mt-1 truncate text-sm font-medium" title={value}>{value}</div></div>)}
              </div>
              <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                {preview.carryoverSource?.applied
                  ? `结转来源：${formatYearMonth(preview.carryoverSource.yearMonth)}已锁定月结（${formatApiCnyAmount(preview.carryoverSource.sourceAmountCny)}）`
                  : `结转来源：${formatYearMonth(preview.previousYearMonth)}无可用锁定月结`}
                {preview.latestBill ? `；最新账单：v${preview.latestBill.version} / ${getTuitionBillStatusView(preview.latestBill.status).label}` : "；当前没有历史账单"}
              </div>
              <div className="border-t border-border">
                <div className="bg-muted/20 px-4 py-2 text-[11px] font-medium text-muted-foreground">计费来源明细</div>
                {preview.plannedLessons.length > 0 ? (
                  <div className="max-h-52 overflow-y-auto">
                    {preview.plannedLessons.map((lesson) => (
                      <div key={lesson.id} className="grid min-w-0 grid-cols-[84px_52px_minmax(0,1fr)_auto] gap-3 border-t border-border/70 px-4 py-2.5 text-xs first:border-t-0">
                        <span>{lesson.weekLabel}</span>
                        <span>{lesson.lessonNo ? `第${lesson.lessonNo}回` : "-"}</span>
                        <span className="truncate" title={`${lesson.teacher.name} / ${lesson.subject.name}`}>{lesson.teacher.name} / {lesson.subject.name} / {formatDurationHours(lesson.durationHours)}</span>
                        <span className="font-medium">{formatApiJpyAmount(lesson.plannedFeeJpy)}</span>
                      </div>
                    ))}
                  </div>
                ) : <div className="px-4 py-4 text-xs text-muted-foreground">没有可计费预定课时。</div>}
              </div>
            </section>
          )}

          {preview?.notices.length ? <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{preview.notices.map((notice) => <div key={notice.code}>{formatTuitionPreviewIssue(notice.code, notice.message)}</div>)}</div> : null}
          {preview?.blockingIssues.length ? <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">{preview.blockingIssues.map((issue) => <div key={issue.code}>{formatTuitionPreviewIssue(issue.code, issue.message)}</div>)}</div> : null}
          <div className="min-w-0 break-words rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">预览和正式生成使用同一套后端金额逻辑；前端不计算或提交账单金额，也不会自动创建收入记录。</div>
          {(previewError || error) && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{previewError ?? error}</div>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/10 px-6 py-4">
          <ActionButton variant="quiet" onClick={onClose}>取消</ActionButton>
          <button type="button" disabled={isPreviewing || isSubmitting || !input} onClick={requestPreview} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#1687D9] bg-white px-3 text-xs font-medium text-[#1264a8] hover:bg-[#EDF6FD] disabled:cursor-not-allowed disabled:opacity-50">{isPreviewing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}{isPreviewing ? "预览中" : preview ? "刷新预览" : "生成预览"}</button>
          <button type="submit" disabled={isSubmitting || isPreviewing || !canGenerate} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#1687D9] px-3 text-xs font-medium text-white hover:bg-[#0f74bd] disabled:cursor-not-allowed disabled:bg-[#8cbfe3]">{isSubmitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ReceiptText className="h-3.5 w-3.5" />}{isSubmitting ? "生成中" : preview?.generationMode === "unchanged" ? "无需生成" : state.mode === "regenerate" ? "确认生成新版本" : "确认生成账单"}</button>
        </div>
      </form>
    </div>
  );
}

function StudentSettlementModal({
  students,
  state,
  onClose,
  onPreview,
  onLock,
}: {
  students: StudentRecord[];
  state: StudentSettlementDialogState;
  onClose: () => void;
  onPreview: (input: StudentSettlementInput) => Promise<StudentSettlementPreview>;
  onLock: (input: LockStudentSettlementInput) => Promise<void>;
}) {
  const activeStudents = students.filter((student) => student.status === "active");
  const existing = state.settlement;
  const [studentId, setStudentId] = useState(state.studentId ?? existing?.studentId ?? activeStudents[0]?.id ?? "");
  const [yearMonth, setYearMonth] = useState(state.yearMonth);
  const [exchangeRate, setExchangeRate] = useState(
    existing?.settlementExchangeRate === null || existing?.settlementExchangeRate === undefined
      ? ""
      : String(existing.settlementExchangeRate),
  );
  const [adjustmentAmountCny, setAdjustmentAmountCny] = useState(
    existing?.adjustmentAmountCny === null || existing?.adjustmentAmountCny === undefined
      ? "0"
      : String(existing.adjustmentAmountCny),
  );
  const [memo, setMemo] = useState(existing?.memo ?? "");
  const [preview, setPreview] = useState<StudentSettlementPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isLocking, setIsLocking] = useState(false);

  useEffect(() => {
    if (!studentId && activeStudents[0]) {
      setStudentId(activeStudents[0].id);
    }
  }, [activeStudents, studentId]);

  const clearPreview = () => {
    setPreview(null);
    setError(null);
  };

  const buildInput = (): StudentSettlementInput | null => {
    const normalizedRate = exchangeRate.trim() ? Number(exchangeRate) : null;
    const normalizedAdjustment = adjustmentAmountCny.trim() ? Number(adjustmentAmountCny) : 0;

    if (!studentId || !yearMonth) {
      setError("请选择学生和业务月份。");
      return null;
    }

    if (normalizedRate !== null && (!Number.isFinite(normalizedRate) || normalizedRate <= 0)) {
      setError("结算汇率必须是大于 0 的数字。");
      return null;
    }

    if (!Number.isFinite(normalizedAdjustment)) {
      setError("CNY 调整额必须是有效数字。");
      return null;
    }

    return {
      studentId,
      yearMonth,
      settlementExchangeRate: normalizedRate,
      adjustmentAmountCny: normalizedAdjustment,
    };
  };

  const requestPreview = async () => {
    const input = buildInput();
    if (!input) {
      return;
    }

    setIsPreviewing(true);
    setError(null);
    try {
      setPreview(await onPreview(input));
    } catch (previewError) {
      setPreview(null);
      setError(formatApiError(previewError));
    } finally {
      setIsPreviewing(false);
    }
  };

  const submitLock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = buildInput();
    if (!input || !preview || preview.blockingIssues.length > 0 || preview.needsExchangeRate) {
      return;
    }

    setIsLocking(true);
    setError(null);
    try {
      await onLock({ ...input, memo: normalizeOptionalFormValue(memo) });
    } catch (lockError) {
      setError(formatApiError(lockError));
    } finally {
      setIsLocking(false);
    }
  };

  const title = state.mode === "relock" ? "重新锁定学生月度结算" : "生成学生月度结算预览";
  const canLock = Boolean(preview && preview.blockingIssues.length === 0 && !preview.needsExchangeRate);
  const selectedStudent = activeStudents.find((student) => student.id === studentId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="关闭弹窗" />
      <form
        onSubmit={submitLock}
        className="relative z-10 flex max-h-[92vh] w-[min(760px,96vw)] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">金额和结转均来自后端预览，锁定后形成月度快照。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">学生</span>
              <select
                required
                disabled={state.mode === "relock"}
                value={studentId}
                title={selectedStudent ? `${selectedStudent.name}${selectedStudent.code ? `（${selectedStudent.code}）` : ""}` : undefined}
                onChange={(event) => {
                  setStudentId(event.target.value);
                  clearPreview();
                }}
                className="h-10 w-full min-w-0 truncate rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15 disabled:bg-muted/40"
              >
                <option value="">请选择学生</option>
                {activeStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}{student.code ? `（${student.code}）` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">业务月份</span>
              <input
                required
                disabled={state.mode === "relock"}
                type="month"
                value={yearMonth}
                onChange={(event) => {
                  setYearMonth(event.target.value);
                  clearPreview();
                }}
                className="h-10 w-full min-w-0 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15 disabled:bg-muted/40"
              />
            </label>

            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">JPY → CNY 结算汇率</span>
              <input
                inputMode="decimal"
                value={exchangeRate}
                onChange={(event) => {
                  setExchangeRate(event.target.value);
                  clearPreview();
                }}
                className="h-10 w-full min-w-0 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
                placeholder="例如 0.04782"
              />
            </label>

            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">CNY 调整额</span>
              <input
                inputMode="decimal"
                value={adjustmentAmountCny}
                onChange={(event) => {
                  setAdjustmentAmountCny(event.target.value);
                  clearPreview();
                }}
                className="h-10 w-full min-w-0 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
                placeholder="0.00"
              />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">备注</span>
            <textarea
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              className="min-h-[72px] resize-none rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
              placeholder="选填"
            />
          </label>

          {preview && (
            <section className="overflow-hidden rounded-lg border border-border">
              <div className="border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-semibold text-foreground">后端结算预览</div>
              <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
                {[
                  ["计费课时", `${preview.billableLessonCount}/${preview.plannedLessonCount} 节`],
                  ["实际课时", `${preview.actualLessonCount} 节`],
                  ["应收课时费", formatApiJpyAmount(preview.billableAmountJpy)],
                  ["已收金额", formatReceivedAmounts(preview.receivedAmountJpy, preview.receivedAmountCny)],
                  ["上月结转", formatApiCnyAmount(preview.previousCarryoverAmountCny)],
                  ["CNY 应收", preview.expectedAmountCny === null ? "待输入汇率" : formatApiCnyAmount(preview.expectedAmountCny)],
                  ["调整额", formatApiCnyAmount(preview.adjustmentAmountCny)],
                  ["下月结转", formatApiCnyAmount(preview.carryoverAmountCny)],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 bg-white px-3 py-3">
                    <div className="text-[11px] text-muted-foreground">{label}</div>
                    <div className="mt-1 truncate text-sm font-medium text-foreground" title={value}>{value}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {preview?.needsExchangeRate && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              当前结算包含 JPY 应收或收款，请填写结算汇率后重新生成预览。
            </div>
          )}

          {preview && preview.blockingIssues.length > 0 && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
              {preview.blockingIssues.map((issue) => <div key={issue}>{formatSettlementBlockingIssue(issue)}</div>)}
            </div>
          )}

          {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/10 px-6 py-4">
          <ActionButton variant="quiet" onClick={onClose}>取消</ActionButton>
          <button
            type="button"
            disabled={isPreviewing || isLocking || !studentId || !yearMonth}
            onClick={requestPreview}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#1687D9] bg-white px-3 text-xs font-medium text-[#1264a8] transition hover:bg-[#EDF6FD] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPreviewing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
            {isPreviewing ? "预览中" : "生成预览"}
          </button>
          <button
            type="submit"
            disabled={isLocking || isPreviewing || !canLock}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#1687D9] px-3 text-xs font-medium text-white transition hover:bg-[#0f74bd] disabled:cursor-not-allowed disabled:bg-[#8cbfe3]"
          >
            {isLocking ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <LockKeyhole className="h-3.5 w-3.5" />}
            {isLocking ? "锁定中" : state.mode === "relock" ? "重新锁定" : "锁定结算"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TeacherWageRuleModal({
  teachers,
  businessEntities,
  state,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  teachers: TeacherRecord[];
  businessEntities: BusinessEntityRecord[];
  state: TeacherWageRuleDialogState;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: TeacherWageRuleInput) => void;
}) {
  const activeTeachers = teachers.filter((teacher) => teacher.status === "active");
  const existing = state.mode === "edit" ? state.rule : undefined;
  const operationalEntity = getOperationalBusinessEntity(businessEntities);
  const [teacherId, setTeacherId] = useState(existing?.teacherId ?? activeTeachers[0]?.id ?? "");
  const businessEntityId = existing?.businessEntityId ?? operationalEntity?.id ?? "";
  const businessEntityName = existing?.businessEntity.name ?? operationalEntity?.name ?? "未配置";
  const [hourlyRateJpy, setHourlyRateJpy] = useState(existing ? String(existing.hourlyRateJpy) : "");
  const [memo, setMemo] = useState(existing?.memo ?? "");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const rate = Number(hourlyRateJpy);
    if (!teacherId || !businessEntityId || !Number.isFinite(rate) || rate < 0) {
      return;
    }
    onSubmit({ teacherId, businessEntityId, hourlyRateJpy: rate, memo: normalizeOptionalFormValue(memo) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="关闭弹窗" />
      <form onSubmit={submit} className="relative z-10 flex w-[min(620px,96vw)] flex-col rounded-xl border border-border bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">{existing ? "编辑工资规则" : "新增工资规则"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">工资规则按老师和业务归属唯一，课时单价以 JPY 计。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="关闭"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-4 px-6 py-5">
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">老师</span>
              <select required disabled={Boolean(existing)} value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className="h-10 w-full min-w-0 truncate rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-[#1687D9] disabled:bg-muted/40">
                <option value="">请选择老师</option>
                {activeTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}{teacher.code ? `（${teacher.code}）` : ""}</option>)}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">业务归属</span>
              <div className="flex h-10 min-w-0 items-center truncate rounded-md border border-border bg-muted/40 px-3 text-sm" title={businessEntityName}>{businessEntityName}</div>
            </label>
          </div>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">课时单价（JPY / 小时）</span>
            <input required min="0" step="1" type="number" value={hourlyRateJpy} onChange={(event) => setHourlyRateJpy(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-[#1687D9]" placeholder="例如 3000" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">备注</span>
            <textarea value={memo} onChange={(event) => setMemo(event.target.value)} className="min-h-[84px] resize-none rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-[#1687D9]" placeholder="选填" />
          </label>
          {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-muted/10 px-6 py-4">
          <ActionButton variant="quiet" onClick={onClose}>取消</ActionButton>
          <button type="submit" disabled={isSubmitting || !teacherId || !businessEntityId || !hourlyRateJpy} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#1687D9] px-3 text-xs font-medium text-white disabled:bg-[#8cbfe3]">
            {isSubmitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{isSubmitting ? "保存中" : "保存规则"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TeacherWageModal({ teachers, businessEntities, state, onClose, onPreview, onLock }: {
  teachers: TeacherRecord[];
  businessEntities: BusinessEntityRecord[];
  state: TeacherWageDialogState;
  onClose: () => void;
  onPreview: (input: TeacherWageInput) => Promise<TeacherWagePreview>;
  onLock: (input: TeacherWageInput & { memo?: string | null }) => Promise<void>;
}) {
  const activeTeachers = teachers.filter((teacher) => teacher.status === "active");
  const operationalEntity = getOperationalBusinessEntity(businessEntities);
  const [teacherId, setTeacherId] = useState(state.teacherId ?? activeTeachers[0]?.id ?? "");
  const businessEntityId = state.businessEntityId ?? operationalEntity?.id ?? "";
  const businessEntityName = state.snapshot?.businessEntity.name ?? operationalEntity?.name ?? "未配置";
  const [yearMonth, setYearMonth] = useState(state.yearMonth);
  const [memo, setMemo] = useState(state.snapshot?.memo ?? "");
  const [preview, setPreview] = useState<TeacherWagePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const clearPreview = () => { setPreview(null); setError(null); };
  const input = { teacherId, businessEntityId, yearMonth };

  const requestPreview = async () => {
    if (!teacherId || !businessEntityId || !yearMonth) return;
    setIsPreviewing(true); setError(null);
    try { setPreview(await onPreview(input)); } catch (requestError) { setPreview(null); setError(formatApiError(requestError)); } finally { setIsPreviewing(false); }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!preview || preview.blockingIssues.length > 0) return;
    setIsLocking(true); setError(null);
    try { await onLock({ ...input, memo: normalizeOptionalFormValue(memo) }); } catch (requestError) { setError(formatApiError(requestError)); } finally { setIsLocking(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="关闭弹窗" />
      <form onSubmit={submit} className="relative z-10 flex max-h-[92vh] w-[min(820px,96vw)] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div><h2 className="text-base font-semibold text-foreground">{state.mode === "relock" ? "重新生成老师工资快照" : "生成老师工资预览"}</h2><p className="mt-1 text-xs text-muted-foreground">金额只读取实际课时和当前生效工资规则，由后端计算。</p></div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="关闭"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid min-w-0 gap-4 md:grid-cols-3">
            <label className="grid min-w-0 gap-1.5"><span className="text-xs font-medium text-muted-foreground">老师</span><select required disabled={state.mode === "relock"} value={teacherId} onChange={(event) => { setTeacherId(event.target.value); clearPreview(); }} className="h-10 w-full min-w-0 truncate rounded-md border border-border bg-white px-3 text-sm disabled:bg-muted/40"><option value="">请选择老师</option>{activeTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}{teacher.code ? `（${teacher.code}）` : ""}</option>)}</select></label>
            <label className="grid min-w-0 gap-1.5"><span className="text-xs font-medium text-muted-foreground">业务归属</span><div className="flex h-10 min-w-0 items-center truncate rounded-md border border-border bg-muted/40 px-3 text-sm" title={businessEntityName}>{businessEntityName}</div></label>
            <label className="grid min-w-0 gap-1.5"><span className="text-xs font-medium text-muted-foreground">业务月份</span><input required disabled={state.mode === "relock"} type="month" value={yearMonth} onChange={(event) => { setYearMonth(event.target.value); clearPreview(); }} className="h-10 w-full min-w-0 rounded-md border border-border bg-white px-3 text-sm disabled:bg-muted/40" /></label>
          </div>
          <label className="grid gap-1.5"><span className="text-xs font-medium text-muted-foreground">备注</span><textarea value={memo} onChange={(event) => setMemo(event.target.value)} className="min-h-[68px] resize-none rounded-md border border-border bg-white px-3 py-2 text-sm" placeholder="选填" /></label>
          {preview && <section className="overflow-hidden rounded-lg border border-border"><div className="border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-semibold">后端工资预览</div><div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">{[["计薪课时", `${preview.lessonCount} 节`], ["计薪时长", formatDurationHours(preview.totalLessonHours)], ["课时单价", preview.wageRule ? formatApiJpyAmount(preview.wageRule.hourlyRateJpy) : "无生效规则"], ["基础工资", formatApiJpyAmount(preview.baseWageJpy)]].map(([label, value]) => <div key={label} className="min-w-0 bg-white px-3 py-3"><div className="text-[11px] text-muted-foreground">{label}</div><div className="mt-1 truncate text-sm font-medium" title={value}>{value}</div></div>)}</div><div className="max-h-44 overflow-y-auto border-t border-border">{preview.details.slice(0, 20).map((detail) => <div key={detail.actualLessonId} className="grid grid-cols-[90px_1fr_auto] gap-3 border-b border-border/70 px-3 py-2 text-xs last:border-b-0"><span>{formatApiDate(detail.actualDate)}</span><span className="truncate">{detail.studentNameSnapshot} / {detail.subjectNameSnapshot}</span><span className={detail.includedInWage ? "font-medium" : "text-muted-foreground"}>{detail.includedInWage ? formatApiJpyAmount(detail.lessonWageJpy) : "不计工资"}</span></div>)}</div></section>}
          {preview && preview.blockingIssues.length > 0 && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">{preview.blockingIssues.map((issue) => <div key={issue}>{formatTeacherWageBlockingIssue(issue)}</div>)}</div>}
          {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-muted/10 px-6 py-4"><ActionButton variant="quiet" onClick={onClose}>取消</ActionButton><button type="button" disabled={isPreviewing || isLocking || !teacherId || !businessEntityId || !yearMonth} onClick={requestPreview} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#1687D9] px-3 text-xs font-medium text-[#1264a8] disabled:opacity-50">{isPreviewing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}{isPreviewing ? "预览中" : "生成预览"}</button><button type="submit" disabled={isLocking || isPreviewing || !preview || preview.blockingIssues.length > 0} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#1687D9] px-3 text-xs font-medium text-white disabled:bg-[#8cbfe3]">{isLocking ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <LockKeyhole className="h-3.5 w-3.5" />}{isLocking ? "锁定中" : state.mode === "relock" ? "重新锁定" : "锁定工资"}</button></div>
      </form>
    </div>
  );
}

function TeacherWageAdjustmentModal({ state, onClose, onSave }: {
  state: TeacherWageAdjustmentDialogState;
  onClose: () => void;
  onSave: (snapshotId: string, input: TeacherWageAdjustmentInput) => Promise<TeacherWageSnapshotRecord>;
}) {
  const [snapshot, setSnapshot] = useState(state.snapshot);
  const [transportationFeeJpy, setTransportationFeeJpy] = useState(String(snapshot.transportationFeeJpy ?? 0));
  const [classroomFeeJpy, setClassroomFeeJpy] = useState(String(snapshot.classroomFeeJpy ?? 0));
  const [manualAdjustmentJpy, setManualAdjustmentJpy] = useState(String(snapshot.manualAdjustmentJpy ?? 0));
  const [memo, setMemo] = useState(snapshot.memo ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const readOnly = snapshot.status !== "locked" || snapshot.adjustmentStatus === "confirmed";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) return;
    const transportation = Number(transportationFeeJpy);
    const classroom = Number(classroomFeeJpy);
    const manual = Number(manualAdjustmentJpy);
    if (![transportation, classroom, manual].every(Number.isFinite)) {
      setError("调整金额必须是有效数字。");
      return;
    }
    if (transportation < 0 || classroom < 0) {
      setError("交通费和教室费不能为负数。");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await onSave(snapshot.id, {
        transportationFeeJpy: transportation,
        classroomFeeJpy: classroom,
        manualAdjustmentJpy: manual,
        memo: normalizeOptionalFormValue(memo),
      });
      setSnapshot(updated);
      onClose();
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="关闭弹窗" />
      <form onSubmit={submit} className="relative z-10 flex max-h-[94vh] w-[min(900px,97vw)] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{readOnly ? "查看工资与课时明细" : "调整老师工资"}</h2>
            <p className="mt-1 truncate text-xs text-muted-foreground" title={`${snapshot.teacher.name} / ${snapshot.businessEntity.name} / ${snapshot.yearMonth}`}>
              {snapshot.teacher.name} / {snapshot.businessEntity.name} / {formatYearMonth(snapshot.yearMonth)} / 第{snapshot.version}版
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="关闭"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <section className="overflow-hidden rounded-lg border border-border">
            <div className="border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-semibold">工资金额</div>
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
              {[
                ["基础工资", formatApiJpyAmount(snapshot.baseWageJpy)],
                ["计薪课时", `${snapshot.lessonCount} 节`],
                ["计薪时长", formatDurationHours(snapshot.totalLessonHours)],
                ["已保存工资合计", formatApiJpyAmount(snapshot.totalWageJpy)],
              ].map(([label, value]) => <div key={label} className="min-w-0 bg-white px-3 py-3"><div className="text-[11px] text-muted-foreground">{label}</div><div className="mt-1 truncate text-sm font-medium" title={value}>{value}</div></div>)}
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-1.5"><span className="text-xs font-medium text-muted-foreground">交通费（JPY）</span><input disabled={readOnly} min="0" step="1" type="number" value={transportationFeeJpy} onChange={(event) => setTransportationFeeJpy(event.target.value)} className="h-10 min-w-0 rounded-md border border-border bg-white px-3 text-sm disabled:bg-muted/40" /></label>
            <label className="grid gap-1.5"><span className="text-xs font-medium text-muted-foreground">教室费（JPY）</span><input disabled={readOnly} min="0" step="1" type="number" value={classroomFeeJpy} onChange={(event) => setClassroomFeeJpy(event.target.value)} className="h-10 min-w-0 rounded-md border border-border bg-white px-3 text-sm disabled:bg-muted/40" /></label>
            <label className="grid gap-1.5"><span className="text-xs font-medium text-muted-foreground">其他调整（JPY）</span><input disabled={readOnly} step="1" type="number" value={manualAdjustmentJpy} onChange={(event) => setManualAdjustmentJpy(event.target.value)} className="h-10 min-w-0 rounded-md border border-border bg-white px-3 text-sm disabled:bg-muted/40" /></label>
          </div>

          <label className="grid gap-1.5"><span className="text-xs font-medium text-muted-foreground">备注</span><textarea disabled={readOnly} value={memo} onChange={(event) => setMemo(event.target.value)} className="min-h-[68px] resize-none rounded-md border border-border bg-white px-3 py-2 text-sm disabled:bg-muted/40" placeholder="选填" /></label>

          <section className="overflow-hidden rounded-lg border border-border">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5"><span className="text-xs font-semibold">计薪课时明细</span><span className="text-[11px] text-muted-foreground">共 {snapshot.details.length} 条</span></div>
            <div className="max-h-64 overflow-y-auto">
              {snapshot.details.map((detail) => (
                <div key={detail.id} className="grid grid-cols-[90px_minmax(0,1fr)_90px_100px] gap-3 border-b border-border/70 px-3 py-2.5 text-xs last:border-b-0">
                  <span>{formatApiDate(detail.actualDate)}</span>
                  <span className="truncate" title={`${detail.studentNameSnapshot} / ${detail.subjectNameSnapshot}`}>{detail.studentNameSnapshot} / {detail.subjectNameSnapshot}</span>
                  <span>{formatDurationHours(detail.durationHours)}</span>
                  <span className={detail.includedInWage ? "text-right font-medium" : "text-right text-muted-foreground"}>{detail.includedInWage ? formatApiJpyAmount(detail.lessonWageJpy) : "不计工资"}</span>
                </div>
              ))}
              {snapshot.details.length === 0 && <div className="px-4 py-8 text-center text-xs text-muted-foreground">没有工资课时明细</div>}
            </div>
          </section>

          {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-muted/10 px-6 py-4">
          <ActionButton variant="quiet" onClick={onClose}>{readOnly ? "关闭" : "取消"}</ActionButton>
          {!readOnly && <button type="submit" disabled={isSubmitting} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#1687D9] px-3 text-xs font-medium text-white disabled:bg-[#8cbfe3]">{isSubmitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{isSubmitting ? "保存中" : "保存调整"}</button>}
        </div>
      </form>
    </div>
  );
}

function TeacherAttendanceImportModal({ state, onClose, onPreview, onConfirm }: {
  state: TeacherAttendanceImportDialogState;
  onClose: () => void;
  onPreview: (file: File, group: TeacherAttendanceGroup) => Promise<{
    input: TeacherAttendanceWorkbookImportInput;
    preview: TeacherAttendanceWorkbookImportPreview;
  }>;
  onConfirm: (input: TeacherAttendanceWorkbookImportInput) => Promise<void>;
}) {
  const [fileName, setFileName] = useState("");
  const [input, setInput] = useState<TeacherAttendanceWorkbookImportInput | null>(null);
  const [preview, setPreview] = useState<TeacherAttendanceWorkbookImportPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setInput(null);
    setPreview(null);
    setError(null);
    setIsPreviewing(true);
    try {
      const result = await onPreview(file, state.group);
      setInput(result.input);
      setPreview(result.preview);
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setIsPreviewing(false);
    }
  };

  const confirm = async () => {
    if (!input || !preview) return;
    setIsConfirming(true);
    setError(null);
    try {
      await onConfirm(input);
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="关闭弹窗" />
      <div className="relative z-10 flex max-h-[92vh] w-[min(760px,96vw)] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">导入老师勤务表</h2>
            <p className="mt-1 truncate text-xs text-muted-foreground">{state.group.teacherName} / {formatYearMonth(state.group.yearMonth)} / {state.group.snapshots.length} 个业务归属</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="关闭"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">老师回传 Excel</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              disabled={isPreviewing || isConfirming}
              onChange={(event) => void selectFile(event.target.files?.[0])}
              className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-sky-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-sky-700"
            />
          </label>

          {fileName && <div className="text-xs text-muted-foreground">已选择：{fileName}</div>}
          {isPreviewing && <div className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700"><RefreshCw className="h-3.5 w-3.5 animate-spin" />正在读取并校验文件...</div>}

          {preview && (
            <section className="overflow-hidden rounded-lg border border-border">
              <div className="border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-semibold">导入预览 · {preview.rowCount} 条课时</div>
              <div className="divide-y divide-border">
                {preview.groups.map((group) => (
                  <div key={group.snapshotId} className="grid gap-2 px-4 py-3 text-xs sm:grid-cols-[minmax(0,1fr)_120px_120px_140px] sm:items-center">
                    <div className="min-w-0"><div className="truncate font-medium" title={group.businessEntity.name}>{group.businessEntity.name}</div><div className="mt-0.5 text-muted-foreground">{group.rowCount} 条课时</div></div>
                    <div><span className="text-muted-foreground">交通费 </span>{formatApiJpyAmount(group.after.transportationFeeJpy)}</div>
                    <div><span className="text-muted-foreground">教室费 </span>{formatApiJpyAmount(group.after.classroomFeeJpy)}</div>
                    <div><span className="text-muted-foreground">工资合计 </span><span className="font-medium">{formatApiJpyAmount(group.after.totalWageJpy)}</span></div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-px border-t border-border bg-border text-xs">
                <div className="bg-white px-3 py-2"><span className="text-muted-foreground">交通费合计 </span>{formatApiJpyAmount(preview.totalTransportationFeeJpy)}</div>
                <div className="bg-white px-3 py-2"><span className="text-muted-foreground">教室费合计 </span>{formatApiJpyAmount(preview.totalClassroomFeeJpy)}</div>
                <div className="bg-white px-3 py-2"><span className="text-muted-foreground">工资总计 </span><span className="font-medium">{formatApiJpyAmount(preview.totalWageJpy)}</span></div>
              </div>
            </section>
          )}

          {state.group.snapshots.every((snapshot) => snapshot.adjustmentStatus === "imported") && (
            <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">
              重新上传并确认后，将覆盖上一次导入的交通费和教室费。工资调整确认后不可再上传。
            </div>
          )}
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">系统只读取交通费和教室费。业务归属、日期、学生、科目、课时和工资金额不会从 Excel 回写。</div>
          {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-muted/10 px-6 py-4">
          <ActionButton variant="quiet" onClick={onClose}>取消</ActionButton>
          <button type="button" disabled={!preview || !input || isPreviewing || isConfirming} onClick={() => void confirm()} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#1687D9] px-3 text-xs font-medium text-white disabled:bg-[#8cbfe3]">{isConfirming ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileCheck2 className="h-3.5 w-3.5" />}{isConfirming ? "导入中" : "确认导入"}</button>
        </div>
      </div>
    </div>
  );
}

function TeacherFormModal({
  state,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  state: TeacherDialogState;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: TeacherWriteInput) => void;
}) {
  const record = state.mode === "edit" ? state.row.teacherRecord : undefined;
  const [name, setName] = useState(record?.name ?? "");
  const [code, setCode] = useState(record?.code ?? "");
  const [kanaName, setKanaName] = useState(record?.kanaName ?? "");
  const [memo, setMemo] = useState(record?.memo ?? "");
  const title = state.mode === "edit" ? "编辑老师基础信息" : "新增老师";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    onSubmit({
      name: name.trim(),
      code: normalizeOptionalFormValue(code),
      kanaName: normalizeOptionalFormValue(kanaName),
      memo: normalizeOptionalFormValue(memo),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="关闭弹窗" />
      <form
        onSubmit={submit}
        className="relative z-10 flex w-[min(560px,94vw)] flex-col rounded-xl border border-border bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">保存后刷新老师管理列表</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 px-6 py-5">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">老师姓名</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
              placeholder="例如：高若天"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">老师编号</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="h-10 rounded-md border border-border bg-white px-3 font-mono text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
                placeholder="teacher-001"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">假名</span>
              <input
                value={kanaName}
                onChange={(event) => setKanaName(event.target.value)}
                className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
                placeholder="选填"
              />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">备注</span>
            <textarea
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              className="min-h-[92px] resize-none rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
              placeholder="选填"
            />
          </label>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/10 px-6 py-4">
          <ActionButton variant="quiet" onClick={onClose}>
            取消
          </ActionButton>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#1687D9] px-3 text-xs font-medium text-white transition hover:bg-[#0f74bd] disabled:cursor-not-allowed disabled:bg-[#8cbfe3]"
          >
            {isSubmitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {isSubmitting ? "保存中" : "保存"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FinanceRecordFormModal({
  state,
  businessEntities,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  state: FinanceDialogState;
  businessEntities: BusinessEntityRecord[];
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: ManualIncomeInput | ManualExpenseInput) => void;
}) {
  const defaultMonth = new Date().toISOString().slice(0, 7);
  const operationalEntity = getOperationalBusinessEntity(businessEntities);
  const [title, setTitle] = useState("");
  const [yearMonth, setYearMonth] = useState(defaultMonth);
  const businessEntityId = operationalEntity?.id ?? "";
  const [currency, setCurrency] = useState<"JPY" | "CNY">("JPY");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const isIncome = state.kind === "income";
  const modalTitle = isIncome ? "新增手动收入" : "新增手动支出";
  const amountNumber = Number(amount);
  const canSubmit = title.trim() && yearMonth && businessEntityId && Number.isFinite(amountNumber) && amountNumber > 0;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    onSubmit({
      title: title.trim(),
      yearMonth,
      businessEntityId: normalizeOptionalFormValue(businessEntityId),
      originalCurrency: currency,
      originalAmountJpy: currency === "JPY" ? amountNumber : null,
      originalAmountCny: currency === "CNY" ? amountNumber : null,
      memo: normalizeOptionalFormValue(memo),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="关闭弹窗" />
      <form
        onSubmit={submit}
        className="relative z-10 flex w-[min(620px,94vw)] flex-col rounded-xl border border-border bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">{modalTitle}</h2>
            <p className="mt-1 text-xs text-muted-foreground">保存后刷新{isIncome ? "收入记录" : "支出记录"}列表</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 px-6 py-5">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">标题</span>
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
              placeholder={isIncome ? "例如：教材费收入" : "例如：教材采购支出"}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">业务月份</span>
              <input
                required
                type="month"
                value={yearMonth}
                onChange={(event) => setYearMonth(event.target.value)}
                className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">业务归属</span>
              <div className="flex h-10 items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground">{operationalEntity?.name ?? "未配置"}</div>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-[140px_1fr]">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">币种</span>
              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value as "JPY" | "CNY")}
                className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
              >
                <option value="JPY">JPY</option>
                <option value="CNY">CNY</option>
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">金额</span>
              <input
                required
                min="0"
                step={currency === "JPY" ? "1" : "0.01"}
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
                placeholder={currency === "JPY" ? "例如：12000" : "例如：320.50"}
              />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">备注</span>
            <textarea
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              className="min-h-[92px] resize-none rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
              placeholder="选填"
            />
          </label>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/10 px-6 py-4">
          <ActionButton variant="quiet" onClick={onClose}>
            取消
          </ActionButton>
          <button
            type="submit"
            disabled={isSubmitting || !canSubmit}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#1687D9] px-3 text-xs font-medium text-white transition hover:bg-[#0f74bd] disabled:cursor-not-allowed disabled:bg-[#8cbfe3]"
          >
            {isSubmitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {isSubmitting ? "保存中" : "保存"}
          </button>
        </div>
      </form>
    </div>
  );
}

function formatReceiptAmount(receipt: TuitionReceiptPayload) {
  const amount = parseApiAmount(
    receipt.paymentCurrency === "JPY" ? receipt.paymentAmountJpy : receipt.paymentAmountCny,
  );

  if (amount === null) {
    return `${receipt.paymentCurrency} -`;
  }

  return receipt.paymentCurrency === "JPY"
    ? `￥${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(amount)}`
    : `CNY ${new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
}

function escapeReceiptHtml(value: string | null | undefined) {
  return (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printTuitionReceipt(receipt: TuitionReceiptPayload) {
  const printWindow = window.open("", "_blank", "width=900,height=1000");
  if (!printWindow) {
    throw new Error("浏览器阻止了打印窗口，请允许此页面打开弹窗后重试。");
  }

  printWindow.opener = null;
  const paymentDate = receipt.paymentDate.replace(/-/g, "/");
  const receiptHtml = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <title>${escapeReceiptHtml(receipt.receiptNo ?? "領収書")} - ${escapeReceiptHtml(receipt.studentName)}</title>
  <style>
    @page { size: A4 portrait; margin: 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #172033; font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif; }
    .sheet { width: 100%; min-height: 250mm; padding: 18mm 16mm; border: 1px solid #cfd8e6; }
    h1 { margin: 0; text-align: center; font-size: 30px; font-weight: 600; letter-spacing: 0; }
    .date { margin-top: 24px; text-align: right; font-size: 13px; }
    .recipient { margin-top: 34px; width: 70%; padding: 0 8px 8px; border-bottom: 1px solid #172033; font-size: 20px; }
    .amount { margin: 42px auto 0; width: 72%; padding: 14px 12px; border-top: 2px solid #172033; border-bottom: 2px solid #172033; text-align: center; font-size: 28px; font-weight: 700; }
    .tax { margin-top: 10px; text-align: center; font-size: 12px; color: #596579; }
    .description { margin-top: 38px; padding: 18px; border: 1px solid #cfd8e6; font-size: 15px; line-height: 1.8; }
    .issuer { margin-top: 64px; display: flex; justify-content: flex-end; }
    .issuer-box { min-width: 240px; font-size: 14px; line-height: 1.9; }
    .issuer-name { font-size: 19px; font-weight: 600; }
    .source { margin-top: 72px; border-top: 1px solid #e2e7ef; padding-top: 10px; color: #7a8494; font-size: 9px; }
    .receipt-no { margin-top: 8px; text-align: right; color: #596579; font-size: 11px; }
    @media print { .sheet { border: 0; min-height: auto; } }
  </style>
</head>
<body>
  <main class="sheet">
    <h1>領収書</h1>
    <div class="receipt-no">No. ${escapeReceiptHtml(receipt.receiptNo)}</div>
    <div class="date">受領日：${escapeReceiptHtml(paymentDate)}</div>
    <div class="recipient">${escapeReceiptHtml(receipt.studentName)} 様</div>
    <div class="amount">${escapeReceiptHtml(formatReceiptAmount(receipt))}</div>
    <div class="tax">上記正に領収いたしました</div>
    <div class="description">但し、${escapeReceiptHtml(receipt.description)}として</div>
    <div class="issuer"><div class="issuer-box"><div class="issuer-name">${escapeReceiptHtml(receipt.businessEntityName)}</div></div></div>
    <div class="source">Receipt record: ${escapeReceiptHtml(receipt.receiptRecordId)} / Income record: ${escapeReceiptHtml(receipt.incomeRecordId)}</div>
  </main>
  <script>window.addEventListener("load", () => { window.focus(); window.print(); });<\/script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(receiptHtml);
  printWindow.document.close();
}

function TuitionReceiptModal({
  state,
  isIssuing,
  onClose,
  onIssue,
  onPrintError,
}: {
  state: TuitionReceiptDialogState;
  isIssuing: boolean;
  onClose: () => void;
  onIssue: () => void;
  onPrintError: (message: string) => void;
}) {
  const { receipt } = state;
  const authorityLabel =
    receipt.authoritySource === "account_transaction"
      ? "账户流水"
      : receipt.authoritySource === "cash_inbound"
        ? "Cash 入站"
        : "Cash 确认";

  const printReceipt = () => {
    try {
      printTuitionReceipt(receipt);
    } catch (error) {
      onPrintError(error instanceof Error ? error.message : "打开打印窗口失败。");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="关闭收据预览" />
      <section className="relative z-10 flex max-h-[92vh] w-[min(720px,96vw)] flex-col overflow-hidden rounded-lg border border-border bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {receipt.snapshotLocked ? "学费收据" : "学费收据开具预览"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{receipt.studentName} / {receipt.description}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto bg-[#f5f7fa] p-5 md:p-7">
          <article className="mx-auto min-h-[560px] max-w-[560px] border border-border bg-white px-10 py-9 shadow-sm">
            <h3 className="text-center text-2xl font-semibold text-foreground">領収書</h3>
            <div className="mt-2 text-right text-[11px] text-muted-foreground">
              {receipt.receiptNo ? `No. ${receipt.receiptNo}` : "开具后生成收据编号"}
            </div>
            <div className="mt-6 text-right text-xs text-muted-foreground">受領日：{receipt.paymentDate.replace(/-/g, "/")}</div>
            <div className="mt-9 w-4/5 border-b border-foreground px-2 pb-2 text-lg font-medium">{receipt.studentName} 様</div>
            <div className="mx-auto mt-10 w-4/5 border-y-2 border-foreground py-3 text-center text-2xl font-semibold">
              {formatReceiptAmount(receipt)}
            </div>
            <div className="mt-2 text-center text-xs text-muted-foreground">上記正に領収いたしました</div>
            <div className="mt-9 border border-border px-4 py-4 text-sm">但し、{receipt.description}として</div>
            <div className="mt-14 text-right">
              <div className="text-lg font-semibold">{receipt.businessEntityName}</div>
            </div>
          </article>

          <div className="mx-auto mt-3 flex max-w-[560px] flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>金额来源：{authorityLabel}</span>
            <span>Cash 请求：{receipt.cashRequestId}</span>
            {receipt.issuedAt && <span>开具时间：{new Date(receipt.issuedAt).toLocaleString("ja-JP")}</span>}
            {receipt.issuedByName && <span>开具人：{receipt.issuedByName}</span>}
          </div>
          {!receipt.snapshotLocked && (
            <div className="mx-auto mt-3 max-w-[560px] rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              开具后，学生名、金额、项目、收款日期和来源追踪会固定为收据快照；本阶段不支持作废或重开。
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-white px-6 py-4">
          <ActionButton variant="quiet" onClick={onClose}>关闭</ActionButton>
          {receipt.snapshotLocked ? (
            <button
              type="button"
              onClick={printReceipt}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#1687D9] px-3 text-xs font-medium text-white transition hover:bg-[#0f74bd]"
            >
              <Download className="h-3.5 w-3.5" />
              打印 / 保存 PDF
            </button>
          ) : (
            <button
              type="button"
              onClick={onIssue}
              disabled={isIssuing}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#1687D9] px-3 text-xs font-medium text-white transition hover:bg-[#0f74bd] disabled:cursor-not-allowed disabled:bg-[#8cbfe3]"
            >
              {isIssuing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileCheck2 className="h-3.5 w-3.5" />}
              {isIssuing ? "开具中" : "开具并固定快照"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function CashRequestFormModal({
  state,
  accounts,
  integrationMode,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  state: CashRequestDialogState;
  accounts: CashEligibleAccountRecord[];
  integrationMode: "mock" | "supabase" | "disabled";
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: SubmitCashRequestInput) => void;
}) {
  const financeRecord = state.row.financeRecord;
  const originalCurrency = financeRecord?.originalCurrency ?? "JPY";
  const [requestedCurrency, setRequestedCurrency] = useState<"JPY" | "CNY">(originalCurrency);
  const [exchangeRate, setExchangeRate] = useState("");
  const [exchangeRateSource, setExchangeRateSource] = useState("");
  const [conversionMethod, setConversionMethod] = useState<"half-up" | "ceil" | "floor">("half-up");
  const [cashAccountId, setCashAccountId] = useState("");
  const [transactedAt, setTransactedAt] = useState(new Date().toISOString().slice(0, 10));
  const requiresExchangeRate = originalCurrency === "JPY" && requestedCurrency === "CNY";
  const exchangeRateNumber = Number(exchangeRate);
  const eligibleAccounts = accounts.filter((account) => account.currency === requestedCurrency);
  const canSubmit = Boolean(cashAccountId && transactedAt) &&
    (!requiresExchangeRate || (Number.isFinite(exchangeRateNumber) && exchangeRateNumber > 0));

  useEffect(() => {
    if (!eligibleAccounts.some((account) => account.id === cashAccountId)) {
      setCashAccountId(eligibleAccounts[0]?.id ?? "");
    }
  }, [cashAccountId, eligibleAccounts]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    onSubmit({
      requestedCurrency,
      exchangeRate: requiresExchangeRate ? exchangeRateNumber : null,
      exchangeRateSource: normalizeOptionalFormValue(exchangeRateSource),
      conversionMethod,
      cashAccountId,
      transactedAt,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="关闭弹窗" />
      <form
        onSubmit={submit}
        className="relative z-10 flex w-[min(620px,94vw)] flex-col rounded-xl border border-border bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">提交 Cash 请求</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {integrationMode === "supabase"
                ? "提交后会在真实 Cash 系统生成待确认请求"
                : integrationMode === "mock"
                  ? "当前为 dev mock，仅生成 V3 本地请求"
                  : "Cash 联动当前已停用"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 px-6 py-5">
          <section className="rounded-lg border border-border bg-muted/20 px-3 py-3">
            <div className="text-sm font-medium text-foreground">{state.row.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              原始金额：{state.row.cells.amount} / 当前状态：{state.row.status}
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">请求币种</span>
              <select
                value={requestedCurrency}
                onChange={(event) => setRequestedCurrency(event.target.value as "JPY" | "CNY")}
                className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
              >
                <option value={originalCurrency}>{originalCurrency}</option>
                {originalCurrency === "JPY" && <option value="CNY">CNY</option>}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Cash 账户</span>
              <select
                required
                value={cashAccountId}
                onChange={(event) => setCashAccountId(event.target.value)}
                className="h-10 min-w-0 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
              >
                <option value="">请选择 {requestedCurrency} 账户</option>
                {eligibleAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} / {account.accountType}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">预计实际收 / 付款日期</span>
            <input
              required
              type="date"
              value={transactedAt}
              onChange={(event) => setTransactedAt(event.target.value)}
              className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
            />
          </label>

          {requiresExchangeRate && (
            <div className="grid gap-4 md:grid-cols-[1fr_160px]">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">JPY → CNY 汇率</span>
                <input
                  required
                  min="0"
                  step="0.000001"
                  type="number"
                  value={exchangeRate}
                  onChange={(event) => setExchangeRate(event.target.value)}
                  className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
                  placeholder="例如：0.0478"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">取舍方式</span>
                <select
                  value={conversionMethod}
                  onChange={(event) => setConversionMethod(event.target.value as "half-up" | "ceil" | "floor")}
                  className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
                >
                  <option value="half-up">四舍五入</option>
                  <option value="ceil">进位</option>
                  <option value="floor">舍去</option>
                </select>
              </label>
              <label className="grid gap-1.5 md:col-span-2">
                <span className="text-xs font-medium text-muted-foreground">汇率来源</span>
                <input
                  value={exchangeRateSource}
                  onChange={(event) => setExchangeRateSource(event.target.value)}
                  className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
                  placeholder="选填，例如 cash / manual"
                />
              </label>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/10 px-6 py-4">
          <ActionButton variant="quiet" onClick={onClose}>
            取消
          </ActionButton>
          <button
            type="submit"
            disabled={isSubmitting || !canSubmit}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#1687D9] px-3 text-xs font-medium text-white transition hover:bg-[#0f74bd] disabled:cursor-not-allowed disabled:bg-[#8cbfe3]"
          >
            {isSubmitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {isSubmitting ? "提交中" : "提交"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ReimbursementFormModal({
  state,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  state: ReimbursementDialogState;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: ReimbursementFormInput) => void;
}) {
  const defaultDate = new Date().toISOString().slice(0, 10);
  const [expenseRecordId, setExpenseRecordId] = useState("");
  const [corporateAccountId, setCorporateAccountId] = useState("");
  const [reimbursementDate, setReimbursementDate] = useState(defaultDate);
  const [memo, setMemo] = useState("");
  const selectedCandidate = state.candidates.find((candidate) => candidate.id === expenseRecordId) ?? state.candidates[0];
  const advanceTransaction = selectedCandidate ? getReimbursementCandidateAdvanceTransaction(selectedCandidate) : null;
  const candidateCurrency = advanceTransaction?.currency ?? selectedCandidate?.originalCurrency ?? "JPY";
  const matchingCorporateAccounts = getMatchingCorporateAccounts(state.accounts, candidateCurrency);
  const canSubmit =
    !state.isLoading &&
    Boolean(selectedCandidate) &&
    Boolean(advanceTransaction) &&
    Boolean(corporateAccountId) &&
    Boolean(reimbursementDate);

  useEffect(() => {
    if (state.isLoading) {
      return;
    }

    const nextExpenseRecordId = expenseRecordId || state.candidates[0]?.id || "";
    if (nextExpenseRecordId && nextExpenseRecordId !== expenseRecordId) {
      setExpenseRecordId(nextExpenseRecordId);
    }

    const candidate = state.candidates.find((item) => item.id === nextExpenseRecordId) ?? state.candidates[0];
    const nextCorporateAccountId = candidate ? getDefaultReimbursementCorporateAccountId(state.accounts, candidate) : "";
    if (!matchingCorporateAccounts.some((account) => account.id === corporateAccountId)) {
      setCorporateAccountId(nextCorporateAccountId);
    }
  }, [state.isLoading, state.candidates, state.accounts, expenseRecordId, corporateAccountId, matchingCorporateAccounts]);

  const handleExpenseChange = (nextExpenseRecordId: string) => {
    setExpenseRecordId(nextExpenseRecordId);
    const candidate = state.candidates.find((item) => item.id === nextExpenseRecordId);
    setCorporateAccountId(candidate ? getDefaultReimbursementCorporateAccountId(state.accounts, candidate) : "");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit || !selectedCandidate) {
      return;
    }

    onSubmit({
      expenseRecordId: selectedCandidate.id,
      corporateAccountId,
      reimbursementDate,
      memo: normalizeOptionalFormValue(memo),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="关闭弹窗" />
      <form
        onSubmit={submit}
        className="relative z-10 flex max-h-[92vh] w-[min(720px,94vw)] flex-col rounded-xl border border-border bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">新增报销</h2>
            <p className="mt-1 text-xs text-muted-foreground">从已入账的垫付支出生成法人账户出金和垫付账户入金</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 overflow-y-auto px-6 py-5">
          {state.isLoading ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              正在读取可报销支出...
            </div>
          ) : state.candidates.length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-700">
              当前没有可报销的垫付支出。需要先有一笔已生成账户流水的垫付账户支出。
            </div>
          ) : (
            <>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">关联垫付支出</span>
                <select
                  required
                  value={expenseRecordId}
                  onChange={(event) => handleExpenseChange(event.target.value)}
                  className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
                >
                  {state.candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.title} / {getReimbursementCandidateAmount(candidate)}
                    </option>
                  ))}
                </select>
              </label>

              {selectedCandidate && advanceTransaction && (
                <section className="rounded-lg border border-border bg-muted/10 px-3 py-3">
                  <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                    <div>
                      <span className="block font-medium text-foreground">垫付账户</span>
                      <span>{advanceTransaction.account.name}</span>
                    </div>
                    <div>
                      <span className="block font-medium text-foreground">报销金额</span>
                      <span>{getReimbursementCandidateAmount(selectedCandidate)}</span>
                    </div>
                    <div>
                      <span className="block font-medium text-foreground">来源</span>
                      <span>{getExpenseSourceLabel(selectedCandidate.sourceType)}</span>
                    </div>
                  </div>
                </section>
              )}

              <div className="grid gap-4 md:grid-cols-[1fr_170px]">
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">法人出金账户</span>
                  <select
                    required
                    value={corporateAccountId}
                    onChange={(event) => setCorporateAccountId(event.target.value)}
                    className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
                  >
                    {matchingCorporateAccounts.length === 0 && <option value="">没有同币种法人账户</option>}
                    {matchingCorporateAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} / {account.currency}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">报销日期</span>
                  <input
                    required
                    type="date"
                    value={reimbursementDate}
                    onChange={(event) => setReimbursementDate(event.target.value)}
                    className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
                  />
                </label>
              </div>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">备注</span>
                <textarea
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  className="min-h-[82px] resize-none rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
                  placeholder="选填"
                />
              </label>
            </>
          )}

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/10 px-6 py-4">
          <ActionButton variant="quiet" onClick={onClose}>
            取消
          </ActionButton>
          <button
            type="submit"
            disabled={isSubmitting || !canSubmit}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#1687D9] px-3 text-xs font-medium text-white transition hover:bg-[#0f74bd] disabled:cursor-not-allowed disabled:bg-[#8cbfe3]"
          >
            {isSubmitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {isSubmitting ? "生成中" : "生成报销"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ActionNotice({
  notice,
  onClose,
}: {
  notice: { tone: "emerald" | "rose" | "amber"; text: string } | null;
  onClose: () => void;
}) {
  if (!notice) {
    return null;
  }

  const Icon = notice.tone === "emerald" ? CheckCircle2 : notice.tone === "amber" ? ShieldCheck : X;
  const title = notice.tone === "emerald" ? "操作成功" : notice.tone === "amber" ? "需要处理" : "操作失败";
  const className =
    notice.tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : notice.tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <div
      role="status"
      className={`fixed left-1/2 top-4 z-[80] flex w-[min(520px,92vw)] -translate-x-1/2 items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-xl ${className}`}
    >
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/75">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold">{title}</span>
        <span className="mt-0.5 block leading-relaxed">{notice.text}</span>
      </span>
      <button
        type="button"
        onClick={onClose}
        className="rounded p-0.5 opacity-70 transition hover:bg-white/70 hover:opacity-100"
        aria-label="关闭提示"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function normalizeOptionalFormValue(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function getOperationalBusinessEntity(businessEntities: BusinessEntityRecord[]) {
  return businessEntities.find(
    (entity) =>
      entity.status === "active" &&
      (entity.acceptsNewBusiness === true || entity.code === "aozora_school"),
  );
}

function formatSettlementBlockingIssue(issue: string) {
  if (issue === "No planned lessons exist for this student/month.") {
    return "该学生本月没有预定课时，不能锁定月度结算。";
  }

  if (issue === "Scheduled planned lessons must be processed before settlement lock.") {
    return "仍有未处理的预定课时，请先生成实际课时、标记待补课或取消课时。";
  }

  return issue;
}

function formatTeacherWageBlockingIssue(issue: string) {
  const translations: Record<string, string> = {
    "Active teacher wage rule is required.": "当前老师与业务归属没有生效中的工资规则，请先新增工资规则。",
    "No completed actual lessons exist for this teacher/month/business entity.": "当前老师、月份和业务归属没有已完成的实际课时。",
    "Student monthly settlements must be locked before teacher wage settlement.": "参与计薪课时对应的学生月度结算尚未全部锁定。",
  };
  return translations[issue] ?? issue;
}

function formatApiError(error: unknown) {
  if (isApiRequestError(error)) {
    let message = error.responseText;

    try {
      const payload = JSON.parse(error.responseText) as { message?: unknown };
      if (typeof payload.message === "string") {
        message = payload.message;
      }
    } catch {
      // Keep the plain-text response when the API did not return JSON.
    }

    if (message === "Active student is required.") {
      return "该学生已归档或停用，当前操作不可用。请先恢复学生状态后再操作。";
    }

    const lessonErrorTranslations = [
      ["weekAnchorDate must be a Monday.", "周起始日期必须选择周一。"],
      ["Active teacher is required.", "该老师已归档或停用，请选择有效老师。"],
      ["Active subject is required.", "该科目已归档或停用，请选择有效科目。"],
      ["Student settlement is locked for this month.", "该学生当前月份已经锁定结算，不能新增预定课时。"],
      ["durationHours must be greater than 0.", "课时数必须大于 0 且不超过 24。"],
      ["plannedFeeJpy must be a non-negative integer.", "预定课时费必须是非负整数日元。"],
    ] as const;

    for (const [source, translated] of lessonErrorTranslations) {
      if (message.includes(source)) message = message.replace(source, translated);
    }

    const tuitionBillErrorTranslations = [
      ["Tuition bill already generated income record.", "该学费账单已经生成收入记录，不能直接重新生成。"],
      ["No billable planned lessons or locked carryover exist for this student/month.", "该学生本月没有可计费预定课时，也没有可用的上月锁定结转。"],
      ["Tuition bill sources changed after preview. Refresh preview before generating.", "预览后课时或结转来源已经变化，请刷新预览后再生成账单。"],
    ] as const;

    for (const [source, translated] of tuitionBillErrorTranslations) {
      if (message.includes(source)) message = message.replace(source, translated);
    }

    const settlementErrorTranslations = [
      ["No planned lessons exist for this student/month.", "该学生本月没有预定课时。"],
      ["Scheduled planned lessons must be processed before settlement lock.", "仍有未处理的预定课时，请先处理完毕后再锁定结算。"],
      ["settlementExchangeRate is required to lock CNY carryover.", "当前结算包含 JPY 金额，请填写结算汇率并重新生成预览。"],
      ["Only locked settlement can be revoked.", "只有已锁定的月度结算可以撤销。"],
      ["Next month tuition bill already exists. Revoke or rebuild downstream bill first.", "下月学费账单已经存在，请先处理下游账单后再撤销或重新锁定本月结算。"],
    ] as const;

    for (const [source, translated] of settlementErrorTranslations) {
      if (message.includes(source)) {
        message = message.replace(source, translated);
      }
    }

    const wageErrorTranslations = [
      ["Operational business entity is not active or does not exist.", "青空进学塾业务归属未启用，请先检查基础设置。"],
      ["New business must belong to the operational business entity.", "新业务只能归属青空进学塾。"],
      ["Operational business entity cannot be archived.", "青空进学塾是当前运营归属，不能归档。"],
      ["Operational business entity code cannot be changed.", "青空进学塾的系统编码不能修改。"],
      ["Active teacher is required.", "该老师已归档或停用，请先恢复老师状态。"],
      ["Active business entity is required.", "该业务归属已停用，当前操作不可用。"],
      ["Active wage snapshot already exists. Revoke it before relocking.", "该老师、业务归属和月份已有有效工资快照，请先撤销后再重新锁定。"],
      ["Wage snapshot already generated expense.", "该工资快照已经生成支出，不能直接撤销或重新锁定。"],
      ["Student monthly settlements must be locked before teacher wage settlement.", "参与计薪课时对应的学生月度结算尚未全部锁定。"],
      ["Confirmed wage adjustments cannot be edited.", "工资调整已经确认，不能继续修改金额。请先撤销整份工资快照。"],
      ["Revoked wage snapshot cannot be adjusted.", "已撤销的工资快照不能调整。"],
      ["Wage snapshot adjustments must be confirmed before generating expense.", "工资调整尚未确认，不能生成工资支出。"],
      ["Rejected teacher wage expense with account transaction cannot be voided.", "该工资支出已经存在账户流水，不能按 Cash 拒绝分支直接作废。"],
      ["No active teacher wage snapshots exist for this teacher/month.", "该老师和月份没有可用的工资快照。"],
      ["Only locked wage snapshots can be exported to attendance workbook.", "只有尚未确认调整的锁定工资快照可以导出勤务表。"],
      ["Wage snapshot already has adjustments and cannot start Excel workflow.", "工资快照已经通过其他方式调整，不能再开始 Excel 流程。"],
      ["Attendance workbook must be exported before import.", "请先从系统导出勤务表，再导入老师回传文件。"],
      ["Attendance workbook detail rows do not match exported snapshot details.", "回传文件的课时行数与导出快照不一致，请使用原始导出文件。"],
      ["Attendance workbook detail mapping does not match exported snapshots.", "回传文件的课时映射已被修改，不能导入。"],
    ] as const;
    for (const [source, translated] of wageErrorTranslations) {
      if (message.includes(source)) message = message.replace(source, translated);
    }

    return message || `请求失败（HTTP ${error.status}）`;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "请求失败";
}

function Dashboard({ onNavigate }: { onNavigate: (key: string) => void }) {
  const flows = [
    {
      title: "学生学费",
      icon: ReceiptText,
      tone: "sky" as Tone,
      steps: ["课时管理", "学费账单", "收入记录", "Cash 确认"],
      page: "tuition-bills",
      status: "7月账单预览中",
    },
    {
      title: "学生结算",
      icon: ClipboardCheck,
      tone: "cyan" as Tone,
      steps: ["课时管理", "月度结算", "结转冻结", "下月账单"],
      page: "student-settlements",
      status: "6月待锁定 3 人",
    },
    {
      title: "老师工资",
      icon: GraduationCap,
      tone: "emerald" as Tone,
      steps: ["实际课时", "工资快照", "勤务表", "支出记录", "Cash"],
      page: "teacher-wages",
      status: "6月勤务表待回收",
    },
    {
      title: "外部授课",
      icon: BriefcaseBusiness,
      tone: "amber" as Tone,
      steps: ["预定课时", "实际课时", "结算锁定", "生成收入"],
      page: "external-settlements",
      status: "早稻田塾待生成收入",
    },
  ];

  const tasks = [
    ["课时管理", "2026年07月", "12 节待生成实际", "lesson-management", "amber" as Tone],
    ["学费账单", "2026年07月", "3 人待确认", "tuition-bills", "sky" as Tone],
    ["学生月度结算", "2026年06月", "2 人待锁定", "student-settlements", "cyan" as Tone],
    ["老师工资结算", "2026年06月", "4 份快照待确认", "teacher-wages", "emerald" as Tone],
    ["Cash 入站", "待入账", "2 条资金归集", "cash-inbound", "cyan" as Tone],
  ];

  return (
    <main className="flex-1 space-y-4 overflow-auto px-6 py-5 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-[#1687D9] ring-1 ring-border">
              <Home className="h-4 w-4" />
            </span>
            <h1 className="text-lg font-semibold text-foreground">V3 工作台</h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">按正式运营顺序查看学生、老师、财务和 Cash 的待处理事项</p>
        </div>
        <ActionButton icon={CalendarDays} variant="secondary">
          回到本月
        </ActionButton>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          metric={{
            label: "7月学费预计",
            value: money.jpy(840000),
            sub: "含 2 笔 CNY 结转",
            tone: "sky",
            icon: ReceiptText,
          }}
        />
        <MetricCard
          metric={{
            label: "6月老师工资",
            value: money.jpy(392000),
            sub: "4 位老师 · 6 个业务归属",
            tone: "emerald",
            icon: GraduationCap,
          }}
        />
        <MetricCard
          metric={{
            label: "待提交 Cash",
            value: money.cny(18432.4),
            sub: "收入 3 条 · 支出 2 条",
            tone: "amber",
            icon: Banknote,
          }}
        />
        <MetricCard
          metric={{
            label: "需要复核",
            value: "4 件",
            sub: "跨月补课、结转、Cash 拒绝",
            tone: "rose",
            icon: ShieldCheck,
          }}
        />
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-lg border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">主业务链路</span>
            <span className="text-xs text-muted-foreground">V3 demo</span>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {flows.map((flow) => {
              const Icon = flow.icon;
              const tone = toneClasses[flow.tone];
              return (
                <button
                  key={flow.title}
                  onClick={() => onNavigate(flow.page)}
                  className={`rounded-lg border ${tone.border} bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-md ${tone.card}`}>
                      <Icon className={`h-4 w-4 ${tone.icon}`} />
                    </span>
                    <StatusPill label={flow.status} tone={flow.tone} />
                  </div>
                  <h2 className="mt-3 text-sm font-semibold text-foreground">{flow.title}</h2>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {flow.steps.map((step, index) => (
                      <span className="inline-flex items-center gap-1" key={step}>
                        <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{step}</span>
                        {index < flow.steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-white">
          <div className="border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">今日待处理</span>
          </div>
          <div className="divide-y divide-border/70">
            {tasks.map(([title, month, desc, key, tone]) => (
              <button
                key={`${title}-${month}`}
                onClick={() => onNavigate(key)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/30"
              >
                <span>
                  <span className="block text-sm font-medium text-foreground">{title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {month} · {desc}
                  </span>
                </span>
                <span className={`h-2 w-2 rounded-full ${toneClasses[tone].dot}`} />
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function BusinessPage({
  page,
  selected,
  onToggleRow,
  onToggleAll,
  onOpenDetail,
  onPrimary,
}: {
  page: PageConfig;
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onOpenDetail: (row: DataRow) => void;
  onPrimary?: () => void;
}) {
  const [draftFilterValues, setDraftFilterValues] = useState<Record<string, string>>({});
  const [appliedFilterValues, setAppliedFilterValues] = useState<Record<string, string>>({});
  const [draftKeyword, setDraftKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const isTuitionBillPage = page.key === "tuition-bills";

  useEffect(() => {
    setDraftFilterValues({});
    setAppliedFilterValues({});
    setDraftKeyword("");
    setAppliedKeyword("");
  }, [page.key]);

  const visibleRows = useMemo(() => {
    if (!isTuitionBillPage) return page.rows;

    const selectedMonth = appliedFilterValues[commonFilters.month.label];
    const selectedStudent = appliedFilterValues[commonFilters.student.label];
    const selectedStatus = appliedFilterValues[commonFilters.status.label];
    const normalizedKeyword = appliedKeyword.trim().toLocaleLowerCase();

    return page.rows.filter((row) => {
      const record = row.tuitionBillRecord;
      if (selectedMonth && record?.yearMonth !== selectedMonth) return false;
      if (selectedStudent && row.title !== selectedStudent) return false;
      if (selectedStatus && row.status !== selectedStatus) return false;
      if (!normalizedKeyword) return true;

      return [
        row.title,
        row.subtitle,
        row.status,
        record?.student.code,
        record?.id,
      ].some((value) => String(value ?? "").toLocaleLowerCase().includes(normalizedKeyword));
    });
  }, [appliedFilterValues, appliedKeyword, isTuitionBillPage, page.rows]);
  const visiblePage = useMemo(
    () => isTuitionBillPage ? { ...page, rows: visibleRows } : page,
    [isTuitionBillPage, page, visibleRows],
  );

  const resetTuitionBillFilters = () => {
    setDraftFilterValues({});
    setAppliedFilterValues({});
    setDraftKeyword("");
    setAppliedKeyword("");
  };

  return (
    <main className="flex-1 space-y-4 overflow-auto px-6 py-5 pb-28">
      <PageHeader page={page} onPrimary={onPrimary} />
      <FilterPanel
        filters={page.filters}
        values={isTuitionBillPage ? draftFilterValues : undefined}
        keyword={isTuitionBillPage ? draftKeyword : undefined}
        onFilterChange={isTuitionBillPage ? (label, value) => {
          setDraftFilterValues((current) => ({ ...current, [label]: value }));
        } : undefined}
        onKeywordChange={isTuitionBillPage ? setDraftKeyword : undefined}
        onQuery={isTuitionBillPage ? () => {
          setAppliedFilterValues(draftFilterValues);
          setAppliedKeyword(draftKeyword);
        } : undefined}
        onReset={isTuitionBillPage ? resetTuitionBillFilters : undefined}
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {page.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>
      <DataTable
        page={visiblePage}
        selected={selected}
        onToggleAll={onToggleAll}
        onToggleRow={onToggleRow}
        onOpenDetail={onOpenDetail}
        showSelection={page.selectable !== false}
      />
    </main>
  );
}

function SettingsPage({
  page,
  settingsApi,
  activeTab,
  onTabChange,
  onOpenDetail,
}: {
  page: PageConfig;
  settingsApi: SettingsApiState;
  activeTab: SettingCategory;
  onTabChange: (tab: SettingCategory) => void;
  onOpenDetail: (row: DataRow) => void;
}) {
  const tab = settingTabs.find((item) => item.key === activeTab) ?? settingTabs[0];
  const rows =
    settingsApi.status === "ready"
      ? settingsApi.rows.filter((row) => row.settingCategory === tab.key)
      : page.rows.filter((row) => row.settingCategory === tab.key);
  const tablePage: PageConfig = {
    ...page,
    title: tab.label,
    columns: tab.columns,
    rows,
  };

  return (
    <main className="flex-1 space-y-4 overflow-auto px-6 py-5 pb-28">
      <PageHeader page={page} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {page.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>
      <section className="relative border-b border-border pt-1">
        <div className="flex flex-wrap items-end gap-1">
          {settingTabs.map((item) => {
            const isActive = item.key === activeTab;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                className={`relative -mb-px min-w-[120px] rounded-t-lg border px-4 py-2.5 text-xs font-medium transition ${
                  isActive
                    ? "z-10 border-border border-b-white bg-white text-foreground shadow-[0_-1px_0_rgba(15,23,42,0.04)]"
                    : "border-transparent bg-muted/40 text-muted-foreground hover:border-border/70 hover:bg-white hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </section>
      <DataTable
        page={tablePage}
        selected={new Set()}
        onToggleAll={() => undefined}
        onToggleRow={() => undefined}
        onOpenDetail={onOpenDetail}
        showSelection={false}
      />
    </main>
  );
}

const commonFilters = {
  month: { label: "业务月份", options: ["2026-07", "2026-06", "2026-05"] },
  student: { label: "学生", options: ["王小明", "陈美咲", "林拓海", "佐藤优"] },
  teacher: { label: "老师", options: ["高若天", "田中さくら", "吴老师"] },
  status: { label: "状态", options: ["预览", "已锁定", "已生成记录", "Cash 待确认", "已确认", "需要复核"] },
  entity: { label: "业务归属", options: ["青空塾", "青空塾外部", "短期课程"] },
};

function getRecordStatusView(status: StudentRecord["status"]): { label: string; tone: Tone } {
  if (status === "active") {
    return { label: "在读", tone: "emerald" };
  }

  if (status === "inactive") {
    return { label: "停用", tone: "amber" };
  }

  return { label: "归档", tone: "slate" };
}

function mapStudentRecordToRow(student: StudentRecord): DataRow {
  const status = getRecordStatusView(student.status);
  const entityName = student.primaryBusinessEntity?.name ?? "未设置";

  return {
    id: `student-${student.id}`,
    title: student.name,
    subtitle: student.code ? `编号 ${student.code}` : "未设置学生编号",
    status: status.label,
    tone: status.tone,
    apiRef: {
      resource: "student",
      id: student.id,
    },
    studentRecord: student,
    cells: {
      entity: entityName,
      grade: "-",
      subjects: "-",
      billing: "-",
    },
    detail: [
      {
        title: "学生资料",
        lines: [
          { label: "业务归属", value: entityName },
          { label: "假名", value: student.kanaName ?? "-" },
          { label: "备注", value: student.memo ?? "-" },
        ],
      },
    ],
  };
}

function buildStudentsPage(basePage: PageConfig, studentApi: StudentApiState): PageConfig {
  if (studentApi.status !== "ready") {
    return basePage;
  }

  const activeCount = studentApi.rows.filter((row) => row.status === "在读").length;
  const archivedCount = studentApi.rows.filter((row) => row.status === "归档").length;

  return {
    ...basePage,
    description: "学生基础资料、业务归属和运营状态入口",
    metrics: [
      { label: "在读学生", value: `${activeCount} 人`, sub: "来自 dev API", tone: "sky", icon: Users },
      { label: "学生总数", value: `${studentApi.total} 人`, sub: "当前接口返回总数", tone: "emerald", icon: BadgeCheck },
      { label: "待补资料", value: "-", sub: "等待字段级契约补充", tone: "amber", icon: FileText },
      { label: "归档学生", value: `${archivedCount} 人`, sub: "保留历史结算", tone: "slate", icon: LockKeyhole },
    ],
    rows: studentApi.rows,
  };
}

function getTeacherStatusView(status: TeacherRecord["status"]): { label: string; tone: Tone } {
  if (status === "active") {
    return { label: "启用", tone: "emerald" };
  }

  if (status === "inactive") {
    return { label: "停用", tone: "amber" };
  }

  return { label: "归档", tone: "slate" };
}

function mapTeacherRecordToRow(teacher: TeacherRecord): DataRow {
  const status = getTeacherStatusView(teacher.status);

  return {
    id: `teacher-${teacher.id}`,
    title: teacher.name,
    subtitle: teacher.code ? `编号 ${teacher.code}` : "未设置老师编号",
    status: status.label,
    tone: status.tone,
    apiRef: {
      resource: "teacher",
      id: teacher.id,
    },
    teacherRecord: teacher,
    cells: {
      entity: "-",
      subjects: "-",
      rule: "-",
      account: "-",
    },
    detail: [
      {
        title: "老师资料",
        lines: [
          { label: "假名", value: teacher.kanaName ?? "-" },
          { label: "备注", value: teacher.memo ?? "-" },
        ],
      },
    ],
  };
}

function buildTeachersPage(basePage: PageConfig, teacherApi: TeacherApiState): PageConfig {
  if (teacherApi.status !== "ready") {
    return basePage;
  }

  const activeCount = teacherApi.rows.filter((row) => row.status === "启用").length;
  const archivedCount = teacherApi.rows.filter((row) => row.status === "归档").length;

  return {
    ...basePage,
    description: "老师基础资料、启用状态和当前生效规则概览",
    metrics: [
      { label: "合作老师", value: `${activeCount} 人`, sub: "来自 dev API", tone: "emerald", icon: GraduationCap },
      { label: "老师总数", value: `${teacherApi.total} 人`, sub: "当前接口返回总数", tone: "sky", icon: FileText },
      { label: "待补信息", value: "-", sub: "等待字段级契约补充", tone: "amber", icon: ShieldCheck },
      { label: "归档老师", value: `${archivedCount} 人`, sub: "保留历史工资", tone: "slate", icon: LockKeyhole },
    ],
    rows: teacherApi.rows,
  };
}

const emptySettingsCounts: SettingsApiCounts = {
  businessEntities: 0,
  accounts: 0,
  subjects: 0,
  externalWorkplaces: 0,
};

const settingTabs: Array<{ key: SettingCategory; label: string; columns: Column[] }> = [
  {
    key: "businessEntities",
    label: "业务归属",
    columns: [
      { key: "code", label: "编码" },
      { key: "memo", label: "备注", wide: true },
      { key: "status", label: "状态" },
    ],
  },
  {
    key: "accounts",
    label: "账户",
    columns: [
      { key: "code", label: "编码" },
      { key: "accountType", label: "账户类型" },
      { key: "currency", label: "币种" },
      { key: "memo", label: "备注", wide: true },
      { key: "status", label: "状态" },
    ],
  },
  {
    key: "subjects",
    label: "科目",
    columns: [
      { key: "code", label: "编码" },
      { key: "category", label: "分类" },
      { key: "sortOrder", label: "排序", align: "right" },
      { key: "memo", label: "备注", wide: true },
      { key: "status", label: "状态" },
    ],
  },
  {
    key: "externalWorkplaces",
    label: "外部授课机构",
    columns: [
      { key: "code", label: "编码" },
      { key: "memo", label: "备注", wide: true },
      { key: "status", label: "状态" },
    ],
  },
];

function getSettingStatusView(status: BusinessEntityRecord["status"]): { label: string; tone: Tone } {
  if (status === "active") {
    return { label: "启用", tone: "emerald" };
  }

  if (status === "inactive") {
    return { label: "停用", tone: "amber" };
  }

  return { label: "归档", tone: "slate" };
}

function mapBusinessEntityToSettingRow(item: BusinessEntityRecord): DataRow {
  const status = getSettingStatusView(item.status);

  return {
    id: `setting-business-entity-${item.id}`,
    title: item.name,
    subtitle: `业务归属 · ${item.code}`,
    status: status.label,
    tone: status.tone,
    settingCategory: "businessEntities",
    cells: {
      code: item.code,
      type: "业务归属",
      name: item.name,
      owner: "系统管理员",
      memo: item.memo ?? "-",
    },
    detail: [{ title: "业务归属", lines: [{ label: "编码", value: item.code }, { label: "备注", value: item.memo ?? "-" }] }],
  };
}

function mapAccountToSettingRow(item: AccountRecord): DataRow {
  const status = getSettingStatusView(item.status);

  return {
    id: `setting-account-${item.id}`,
    title: item.name,
    subtitle: `${item.currency} · ${item.type}`,
    status: status.label,
    tone: status.tone,
    settingCategory: "accounts",
    cells: {
      code: item.code,
      type: "账户",
      name: item.name,
      accountType: item.type,
      currency: item.currency,
      owner: "管理员 / 财务",
      memo: item.memo ?? `${item.currency} / ${item.type}`,
    },
    detail: [
      {
        title: "账户资料",
        lines: [
          { label: "编码", value: item.code },
          { label: "币种", value: item.currency },
          { label: "类型", value: item.type },
          { label: "备注", value: item.memo ?? "-" },
        ],
      },
    ],
  };
}

function mapSubjectToSettingRow(item: SubjectRecord): DataRow {
  const status = getSettingStatusView(item.status);

  return {
    id: `setting-subject-${item.id}`,
    title: item.name,
    subtitle: `科目 · ${item.category}`,
    status: status.label,
    tone: status.tone,
    settingCategory: "subjects",
    cells: {
      code: item.code,
      type: "科目",
      name: item.name,
      category: item.category,
      sortOrder: item.sortOrder,
      owner: "系统管理员",
      memo: item.memo ?? `排序 ${item.sortOrder}`,
    },
    detail: [
      {
        title: "科目资料",
        lines: [
          { label: "编码", value: item.code },
          { label: "分类", value: item.category },
          { label: "排序", value: item.sortOrder },
          { label: "备注", value: item.memo ?? "-" },
        ],
      },
    ],
  };
}

function mapExternalWorkplaceToSettingRow(item: ExternalWorkplaceRecord): DataRow {
  const status = getSettingStatusView(item.status);

  return {
    id: `setting-external-workplace-${item.id}`,
    title: item.name,
    subtitle: `外部授课机构 · ${item.code}`,
    status: status.label,
    tone: status.tone,
    settingCategory: "externalWorkplaces",
    cells: {
      code: item.code,
      type: "外部授课机构",
      name: item.name,
      owner: "业务人员",
      memo: item.memo ?? "-",
    },
    detail: [{ title: "外部授课机构", lines: [{ label: "编码", value: item.code }, { label: "备注", value: item.memo ?? "-" }] }],
  };
}

function buildSettingsPage(basePage: PageConfig, settingsApi: SettingsApiState): PageConfig {
  const baseSettingsPage: PageConfig = {
    ...basePage,
    description: "基础设置按类型分区展示；新增和编辑入口后续按类型逐步接入",
    primaryAction: undefined,
  };

  if (settingsApi.status !== "ready") {
    return baseSettingsPage;
  }

  const total =
    settingsApi.counts.businessEntities +
    settingsApi.counts.accounts +
    settingsApi.counts.subjects +
    settingsApi.counts.externalWorkplaces;

  return {
    ...baseSettingsPage,
    description: "真实 API 只读设置列表；新增和编辑入口后续按类型逐步接入",
    metrics: [
      { label: "业务归属", value: `${settingsApi.counts.businessEntities} 个`, sub: "来自 dev API", tone: "sky", icon: BriefcaseBusiness },
      { label: "School 账户", value: `${settingsApi.counts.accounts} 个`, sub: "法人 + 垫付账户", tone: "emerald", icon: Landmark },
      { label: "科目", value: `${settingsApi.counts.subjects} 个`, sub: "课程和工资规则基础", tone: "violet", icon: BookOpen },
      { label: "外部授课机构", value: `${settingsApi.counts.externalWorkplaces} 个`, sub: `设置合计 ${total} 条`, tone: "amber", icon: Building2 },
    ],
    filters: [{ label: "设置类型", options: ["业务归属", "账户", "科目", "外部授课机构"] }, commonFilters.status],
    rows: settingsApi.rows,
  };
}

function createEmptyFinanceListState(): FinanceListState {
  return { status: "idle", rows: [], total: 0 };
}

function createEmptyFinanceApiState(): FinanceApiState {
  return {
    incomeRecords: createEmptyFinanceListState(),
    expenseRecords: createEmptyFinanceListState(),
    cashRequests: createEmptyFinanceListState(),
    cashInbound: createEmptyFinanceListState(),
    accountLedger: createEmptyFinanceListState(),
    reimbursements: createEmptyFinanceListState(),
  };
}

function createEmptyApiItemsState<T>(): ApiItemsState<T> {
  return { status: "idle", items: [], total: 0 };
}

function createEmptyStudentChainListState<T>(): StudentChainListState<T> {
  return createEmptyApiItemsState<T>();
}

function createEmptyStudentChainApiState(): StudentChainApiState {
  return {
    plannedLessons: createEmptyStudentChainListState<StudentPlannedLessonRecord>(),
    actualLessons: createEmptyStudentChainListState<StudentActualLessonRecord>(),
    tuitionBills: createEmptyFinanceListState(),
    settlements: createEmptyFinanceListState(),
  };
}

function createEmptyWorkflowApiState(): WorkflowApiState {
  return {
    wageRules: createEmptyFinanceListState(),
    wageSnapshots: createEmptyFinanceListState(),
    wageImports: createEmptyFinanceListState(),
    externalLessons: createEmptyApiItemsState<ExternalWorkLessonRecord>(),
    externalSettlements: createEmptyFinanceListState(),
    auditEvents: createEmptyFinanceListState(),
  };
}

function buildLessonManagementPage(basePage: PageConfig, studentChainApi: StudentChainApiState): PageConfig {
  const plannedState = studentChainApi.plannedLessons;
  const actualState = studentChainApi.actualLessons;
  const isReady = plannedState.status === "ready" && actualState.status === "ready";
  const isError = plannedState.status === "error" || actualState.status === "error";

  if (plannedState.status === "idle" && actualState.status === "idle") {
    return basePage;
  }

  if (!isReady) {
    return {
      ...basePage,
      description: isError
        ? `真实 API 课时读取失败：${plannedState.message ?? actualState.message ?? "请稍后重试"}`
        : "正在读取真实 API 课时列表；第一层只读展示",
      primaryAction: undefined,
      secondaryAction: undefined,
      metrics: [
        {
          label: "预定课时",
          value: isError ? "失败" : "读取中",
          sub: "来自 dev API",
          tone: isError ? "rose" : "amber",
          icon: CalendarDays,
        },
        { label: "实际课时", value: "-", sub: "等待接口返回", tone: "slate", icon: ClipboardCheck },
        { label: "待生成实际", value: "-", sub: "第二层接入动作", tone: "slate", icon: Clock },
        { label: "跨月补课", value: "-", sub: "读取后统计", tone: "slate", icon: RefreshCw },
      ],
      rows: [],
    };
  }

  const pendingActualCount = plannedState.items.filter(
    (lesson) => !lesson.actualLesson && ["scheduled", "makeup_pending"].includes(lesson.status),
  ).length;
  const makeupCount = plannedState.items.filter((lesson) =>
    ["makeup_pending", "makeup_completed"].includes(lesson.status),
  ).length;

  return {
    ...basePage,
    description: "真实 API 课时列表；支持新增预定课时、生成实际、取消、待补课和全新课时删除",
    primaryAction: "新增预定课时",
    secondaryAction: undefined,
    metrics: [
      { label: "预定课时", value: `${plannedState.total}`, sub: "来自 dev API", tone: "sky", icon: CalendarDays },
      { label: "实际课时", value: `${actualState.total}`, sub: "已生成或已完成", tone: "emerald", icon: ClipboardCheck },
      { label: "待生成实际", value: `${pendingActualCount}`, sub: "可继续处理", tone: "amber", icon: Clock },
      { label: "跨月补课", value: `${makeupCount}`, sub: "待补课 / 补课完成", tone: "cyan", icon: RefreshCw },
    ],
    rows: [],
  };
}

function getLessonPairsForPage(studentChainApi: StudentChainApiState) {
  if (studentChainApi.plannedLessons.status === "ready" && studentChainApi.actualLessons.status === "ready") {
    return buildLessonPairsFromApi(studentChainApi.plannedLessons.items, studentChainApi.actualLessons.items);
  }

  if (studentChainApi.plannedLessons.status === "error" || studentChainApi.actualLessons.status === "error") {
    return [];
  }

  return lessonPairs;
}

function buildLessonPairsFromApi(
  plannedLessons: StudentPlannedLessonRecord[],
  actualLessons: StudentActualLessonRecord[],
): LessonPair[] {
  const actualById = new Map(actualLessons.map((lesson) => [lesson.id, lesson]));
  const actualByPlannedId = new Map(
    actualLessons.flatMap((lesson) => (lesson.plannedLessonId ? [[lesson.plannedLessonId, lesson] as const] : [])),
  );
  const plannedIds = new Set(plannedLessons.map((lesson) => lesson.id));

  const plannedPairs = plannedLessons.map((planned) => {
    const actual = actualByPlannedId.get(planned.id) ?? (planned.actualLesson ? actualById.get(planned.actualLesson.id) : undefined);

    return {
      id: `lesson-pair-${planned.id}`,
      relation: getLessonRelationLabel(planned, actual),
      actionHint: getLessonActionHint(planned, actual),
      planned: mapPlannedLessonToCard(planned),
      actual: actual ? mapActualLessonToCard(actual) : undefined,
      plannedRecord: planned,
      actualRecord: actual,
    };
  });

  const actualOnlyPairs = actualLessons
    .filter((actual) => !actual.plannedLessonId || !plannedIds.has(actual.plannedLessonId))
    .map((actual) => ({
      id: `lesson-actual-only-${actual.id}`,
      relation: "无预定课时",
      actionHint: "这条实际课时未关联预定课时；第二层会补修正和查看来源入口。",
      planned: mapActualLessonToPlannedPlaceholder(actual),
      actual: mapActualLessonToCard(actual),
      actualRecord: actual,
    }));

  return [...plannedPairs, ...actualOnlyPairs];
}

function mapPlannedLessonToCard(record: StudentPlannedLessonRecord): LessonCardData {
  const status = getPlannedLessonStatusView(record.status);
  const duration = formatDurationHours(record.durationHours);
  const lessonNo = record.lessonNo === null ? "未编号" : `第${record.lessonNo}回`;

  return {
    date: formatApiDate(record.weekAnchorDate),
    dateSub: `${lessonNo} · ${formatTimeRange(record.plannedStartTime, record.plannedEndTime)}`,
    student: record.student.name,
    teacher: record.teacher.name,
    subject: record.subject.name,
    duration,
    amount: formatApiJpyAmount(record.plannedFeeJpy),
    businessEntity: record.businessEntity.name,
    content: record.content ?? record.memo ?? "-",
    status: status.label,
    tone: status.tone,
  };
}

function mapActualLessonToCard(record: StudentActualLessonRecord): LessonCardData {
  const status = getActualLessonStatusView(record.status);

  return {
    date: formatApiDate(record.actualDate),
    dateSub: formatTimeRange(record.startTime, record.endTime),
    student: record.student.name,
    teacher: record.teacher.name,
    subject: record.subject.name,
    duration: formatDurationHours(record.durationHours),
    amount: record.teacherWageEligible ? "工资待算" : "不计工资",
    businessEntity: record.businessEntity.name,
    content: record.content ?? record.memo ?? "-",
    status: status.label,
    tone: status.tone,
  };
}

function mapActualLessonToPlannedPlaceholder(record: StudentActualLessonRecord): LessonCardData {
  return {
    date: formatApiDate(record.actualDate),
    dateSub: "无关联预定课时",
    student: record.student.name,
    teacher: record.teacher.name,
    subject: record.subject.name,
    duration: "-",
    amount: "-",
    businessEntity: record.businessEntity.name,
    content: "仅有实际课时记录",
    status: "无预定",
    tone: "slate",
  };
}

function getLessonRelationLabel(
  planned: StudentPlannedLessonRecord,
  actual?: StudentActualLessonRecord,
) {
  if (actual) {
    return "已对应实际课时";
  }

  if (planned.status === "makeup_pending") {
    return "待补课";
  }

  if (planned.status === "cancelled") {
    return "已取消";
  }

  return "无对应实际课时";
}

function getLessonActionHint(
  planned: StudentPlannedLessonRecord,
  actual?: StudentActualLessonRecord,
) {
  if (isHistoricalImportedLesson(planned)) {
    return "这是从 V2 导入的历史课时，仅供对账与查看，不能在 Staging 中修改或继续生成业务记录。";
  }

  if (actual) {
    return "已关联实际课时；后续会继续接入编辑、取消和工资联动。";
  }

  if (planned.status === "cancelled") {
    return "取消记录保留用于审计；如误取消，可以恢复为待生成实际。";
  }

  if (planned.status === "makeup_pending") {
    return "待补课课时可在补课完成后生成实际；学生费用仍归属原预定月份。";
  }

  return "可以从预定课时生成实际课时、取消预定，或先标记为待补课。";
}

function getPlannedLessonStatusView(status: string): { label: string; tone: Tone } {
  const views: Record<string, { label: string; tone: Tone }> = {
    scheduled: { label: "待生成实际", tone: "amber" },
    actual_created: { label: "已对应", tone: "emerald" },
    makeup_pending: { label: "待补课", tone: "cyan" },
    makeup_completed: { label: "补课完成", tone: "emerald" },
    cancelled: { label: "已取消", tone: "rose" },
  };

  return views[status] ?? { label: status, tone: "slate" };
}

function getActualLessonStatusView(status: string): { label: string; tone: Tone } {
  if (status === "completed") {
    return { label: "已上课", tone: "emerald" };
  }

  if (status === "cancelled") {
    return { label: "已取消", tone: "rose" };
  }

  return { label: status, tone: "slate" };
}

function buildTuitionBillsPage(basePage: PageConfig, tuitionApi: FinanceListState): PageConfig {
  const recordMonths = tuitionApi.rows.flatMap((row) =>
    row.tuitionBillRecord ? [row.tuitionBillRecord.yearMonth] : [],
  );
  const recordStudents = tuitionApi.rows.map((row) => row.title);
  const recordStatuses = tuitionApi.rows.map((row) => row.status);
  const dynamicOptions = new Map<string, string[]>([
    [
      commonFilters.month.label,
      [...new Set([...recordMonths, ...commonFilters.month.options])].sort((left, right) => right.localeCompare(left)),
    ],
    [
      commonFilters.student.label,
      [...new Set(recordStudents)].sort((left, right) => left.localeCompare(right, "zh-CN")),
    ],
    [
      commonFilters.status.label,
      [...new Set(recordStatuses)],
    ],
  ]);
  const readonlyBasePage: PageConfig = {
    ...basePage,
    description:
      tuitionApi.status === "error"
        ? `真实 API 学费账单读取失败：${tuitionApi.message}`
        : "真实 API 学费账单列表；金额来自后端账单快照，收入和作废动作受状态保护",
    primaryAction: "生成账单",
    secondaryAction: undefined,
    batchAction: undefined,
    selectable: false,
    filters: basePage.filters.map((filter) => ({
      ...filter,
      options: dynamicOptions.get(filter.label) ?? filter.options,
    })),
    columns: [
      { key: "plannedCount", label: "预定课时", align: "right" },
      { key: "plannedAmount", label: "预定课时金额", align: "right" },
      { key: "carryover", label: "CNY 结转", align: "right" },
      { key: "income", label: "收入记录" },
      { key: "status", label: "状态" },
    ],
    rows: tuitionApi.rows,
  };

  if (tuitionApi.status === "idle") {
    return basePage;
  }

  if (tuitionApi.status !== "ready") {
    return {
      ...readonlyBasePage,
      metrics: [
        {
          label: "账单读取",
          value: tuitionApi.status === "error" ? "失败" : "读取中",
          sub: "来自 dev API",
          tone: tuitionApi.status === "error" ? "rose" : "amber",
          icon: ReceiptText,
        },
        { label: "已生成", value: "-", sub: "等待接口返回", tone: "slate", icon: FileText },
        { label: "收入已生成", value: "-", sub: "第二层接入动作", tone: "slate", icon: ReceiptText },
        { label: "已作废", value: "-", sub: "读取后统计", tone: "slate", icon: RotateCcw },
      ],
    };
  }

  const generatedCount = tuitionApi.rows.filter((row) => row.status === "已生成").length;
  const incomeCreatedCount = tuitionApi.rows.filter((row) => row.status === "收入已生成").length;
  const activeJpyTotal = tuitionApi.rows.reduce((total, row) => {
    if (row.status === "已作废") {
      return total;
    }

    const amountText = String(row.cells.plannedAmount ?? "");
    const numeric = Number(amountText.replace(/[^\d.-]/g, ""));
    return Number.isFinite(numeric) ? total + numeric : total;
  }, 0);

  return {
    ...readonlyBasePage,
    metrics: [
      { label: "账单记录", value: `${tuitionApi.total} 条`, sub: "来自 dev API", tone: "sky", icon: ReceiptText },
      { label: "已生成", value: `${generatedCount} 条`, sub: "待生成收入", tone: "amber", icon: Clock },
      { label: "收入已生成", value: `${incomeCreatedCount} 条`, sub: "已进入收入链路", tone: "emerald", icon: CheckCircle2 },
      { label: "JPY 应收", value: money.jpy(activeJpyTotal), sub: "未作废账单合计", tone: "cyan", icon: Banknote },
    ],
  };
}

function mapTuitionBillToRow(record: TuitionBillRecord): DataRow {
  const status = getTuitionBillStatusView(record.status);
  const plannedAmount = formatApiJpyAmount(record.plannedAmountJpy);
  const carryover = formatApiCnyAmount(record.carryoverAmountCny);
  const incomeStatus = record.incomeRecord ? getCashStatusLabel(record.incomeRecord.cashStatus) : "未生成收入";

  return {
    id: `bill-${record.id}`,
    title: record.student.name,
    subtitle: `${formatYearMonth(record.yearMonth)}学费账单`,
    status: status.label,
    tone: status.tone,
    apiRef: { resource: "tuitionBill", id: record.id },
    tuitionBillRecord: record,
    readOnlyActions: false,
    cells: {
      plannedCount: `${record.plannedLessonCount} 节`,
      plannedAmount,
      carryover,
      income: incomeStatus,
    },
    detail: [
      {
        title: "学费账单",
        lines: [
          { label: "学生", value: record.student.name },
          { label: "业务月份", value: formatYearMonth(record.yearMonth) },
          { label: "账单版本", value: `v${record.version}` },
          { label: "预定课时数", value: `${record.plannedLessonCount} 节` },
          { label: "预定课时金额", value: plannedAmount },
          { label: "CNY 结转", value: carryover },
          { label: "状态", value: status.label },
          { label: "生成时间", value: formatApiDate(record.generatedAt) },
        ],
      },
      {
        title: "收入联动",
        lines: [
          { label: "收入记录", value: record.incomeRecordId ?? "-" },
          { label: "Cash 状态", value: incomeStatus },
          {
            label: "收入金额",
            value: record.incomeRecord
              ? formatApiCurrencyAmount(
                  record.incomeRecord.originalCurrency,
                  record.incomeRecord.originalAmountJpy,
                  record.incomeRecord.originalAmountCny,
                )
              : "-",
          },
        ],
      },
      {
        title: "API 追踪",
        lines: [
          { label: "账单 ID", value: record.id },
          { label: "studentId", value: record.studentId },
        ],
      },
    ],
  };
}

function getTuitionBillStatusView(status: string): { label: string; tone: Tone } {
  if (status === "generated") {
    return { label: "已生成", tone: "amber" };
  }

  if (status === "income_created") {
    return { label: "收入已生成", tone: "emerald" };
  }

  if (status === "voided") {
    return { label: "已作废", tone: "slate" };
  }

  if (status === "superseded") {
    return { label: "已被替代", tone: "slate" };
  }

  return { label: status, tone: "slate" };
}

function buildStudentSettlementsPage(basePage: PageConfig, settlementApi: FinanceListState): PageConfig {
  const readonlyBasePage: PageConfig = {
    ...basePage,
    description:
      settlementApi.status === "error"
        ? `真实 API 月度结算读取失败：${settlementApi.message}`
        : "真实 API 学生月度结算；预览、锁定、撤销和重新锁定均由后端校验",
    primaryAction: settlementApi.status === "ready" ? "生成结算预览" : undefined,
    secondaryAction: undefined,
    batchAction: undefined,
    selectable: false,
    columns: [
      { key: "lessonCount", label: "课时", align: "right" },
      { key: "billableAmount", label: "应收课时费", align: "right" },
      { key: "received", label: "已收金额", align: "right" },
      { key: "carryover", label: "下月结转", align: "right" },
      { key: "status", label: "状态" },
    ],
    rows: settlementApi.rows,
  };

  if (settlementApi.status === "idle") {
    return basePage;
  }

  if (settlementApi.status !== "ready") {
    return {
      ...readonlyBasePage,
      metrics: [
        {
          label: "结算读取",
          value: settlementApi.status === "error" ? "失败" : "读取中",
          sub: "来自 dev API",
          tone: settlementApi.status === "error" ? "rose" : "amber",
          icon: ClipboardCheck,
        },
        { label: "已锁定", value: "-", sub: "等待接口返回", tone: "slate", icon: LockKeyhole },
        { label: "已撤销", value: "-", sub: "读取后统计", tone: "slate", icon: RotateCcw },
        { label: "CNY 结转", value: "-", sub: "读取后统计", tone: "slate", icon: RefreshCw },
      ],
    };
  }

  const lockedCount = settlementApi.rows.filter((row) => row.status === "已锁定").length;
  const revokedCount = settlementApi.rows.filter((row) => row.status === "已撤销").length;
  const carryoverTotal = settlementApi.rows.reduce((total, row) => {
    if (row.status === "已撤销") {
      return total;
    }

    const amountText = String(row.cells.carryover ?? "");
    const numeric = Number(amountText.replace(/[^\d.-]/g, ""));
    return Number.isFinite(numeric) ? total + numeric : total;
  }, 0);

  return {
    ...readonlyBasePage,
    metrics: [
      { label: "结算记录", value: `${settlementApi.total} 条`, sub: "来自 dev API", tone: "sky", icon: ClipboardCheck },
      { label: "已锁定", value: `${lockedCount} 条`, sub: "可进入下月账单", tone: "emerald", icon: LockKeyhole },
      { label: "已撤销", value: `${revokedCount} 条`, sub: "保留审计追踪", tone: "slate", icon: RotateCcw },
      { label: "CNY 结转", value: money.cny(carryoverTotal), sub: "未撤销合计", tone: "cyan", icon: RefreshCw },
    ],
  };
}

function mapStudentSettlementToRow(record: StudentSettlementRecord): DataRow {
  const status = getStudentSettlementStatusView(record.status);
  const billableAmount = formatApiJpyAmount(record.billableAmountJpy);
  const received = formatReceivedAmounts(record.receivedAmountJpy, record.receivedAmountCny);
  const previousCarryover = formatApiCnyAmount(record.previousCarryoverAmountCny);
  const adjustment = formatApiCnyAmount(record.adjustmentAmountCny);
  const carryover = formatApiCnyAmount(record.carryoverAmountCny);

  return {
    id: `settlement-${record.id}`,
    title: record.student.name,
    subtitle: `${formatYearMonth(record.yearMonth)}学生月度结算`,
    status: status.label,
    tone: status.tone,
    apiRef: { resource: "studentSettlement", id: record.id },
    studentSettlementRecord: record,
    readOnlyActions: false,
    cells: {
      lessonCount: `${record.billableLessonCount}/${record.plannedLessonCount} 节`,
      billableAmount,
      received,
      carryover,
    },
    detail: [
      {
        title: "结算口径",
        lines: [
          { label: "学生", value: record.student.name },
          { label: "业务月份", value: formatYearMonth(record.yearMonth) },
          { label: "预定课时", value: `${record.plannedLessonCount} 节` },
          { label: "计费课时", value: `${record.billableLessonCount} 节` },
          { label: "取消课时", value: `${record.cancelledLessonCount} 节` },
          { label: "实际课时", value: `${record.actualLessonCount} 节` },
          { label: "应收课时费", value: billableAmount },
        ],
      },
      {
        title: "收款和结转",
        lines: [
          { label: "已收金额", value: received },
          { label: "上月结转", value: previousCarryover },
          { label: "调整金额", value: adjustment },
          { label: "下月结转", value: carryover },
          { label: "结算汇率", value: record.settlementExchangeRate === null ? "-" : String(record.settlementExchangeRate) },
        ],
      },
      {
        title: "状态",
        lines: [
          { label: "状态", value: status.label },
          { label: "锁定时间", value: formatApiDate(record.lockedAt) },
          { label: "撤销时间", value: record.revokedAt ? formatApiDate(record.revokedAt) : "-" },
          { label: "备注", value: record.memo ?? "-" },
        ],
      },
      {
        title: "API 追踪",
        lines: [
          { label: "结算 ID", value: record.id },
          { label: "studentId", value: record.studentId },
        ],
      },
    ],
  };
}

function getStudentSettlementStatusView(status: string): { label: string; tone: Tone } {
  if (status === "locked") {
    return { label: "已锁定", tone: "emerald" };
  }

  if (status === "revoked") {
    return { label: "已撤销", tone: "slate" };
  }

  return { label: status, tone: "slate" };
}

function buildWageRulesPage(basePage: PageConfig, wageRuleApi: FinanceListState): PageConfig {
  const apiBasePage: PageConfig = {
    ...basePage,
    description:
      wageRuleApi.status === "error"
        ? `真实 API 工资规则读取失败：${wageRuleApi.message}`
        : "真实 API 工资规则列表；按老师和业务归属维护课时单价",
    primaryAction: wageRuleApi.status === "ready" ? "新增工资规则" : undefined,
    secondaryAction: undefined,
    batchAction: undefined,
    selectable: false,
    columns: [
      { key: "teacher", label: "老师" },
      { key: "entity", label: "业务归属" },
      { key: "rate", label: "课时单价", align: "right" },
      { key: "memo", label: "备注", wide: true },
      { key: "status", label: "状态" },
    ],
    rows: wageRuleApi.rows,
  };

  if (wageRuleApi.status === "idle") {
    return basePage;
  }

  if (wageRuleApi.status !== "ready") {
    return {
      ...apiBasePage,
      metrics: [
        {
          label: "规则读取",
          value: wageRuleApi.status === "error" ? "失败" : "读取中",
          sub: "来自 dev API",
          tone: wageRuleApi.status === "error" ? "rose" : "amber",
          icon: FileText,
        },
        { label: "生效中", value: "-", sub: "等待接口返回", tone: "slate", icon: CheckCircle2 },
        { label: "停用", value: "-", sub: "读取后统计", tone: "slate", icon: LockKeyhole },
        { label: "归档", value: "-", sub: "读取后统计", tone: "slate", icon: RotateCcw },
      ],
    };
  }

  const activeCount = wageRuleApi.rows.filter((row) => row.status === "生效中").length;
  const inactiveCount = wageRuleApi.rows.filter((row) => row.status === "停用").length;
  const archivedCount = wageRuleApi.rows.filter((row) => row.status === "归档").length;

  return {
    ...apiBasePage,
    metrics: [
      { label: "工资规则", value: `${wageRuleApi.total} 条`, sub: "来自 dev API", tone: "sky", icon: FileText },
      { label: "生效中", value: `${activeCount} 条`, sub: "参与工资快照", tone: "emerald", icon: CheckCircle2 },
      { label: "停用", value: `${inactiveCount} 条`, sub: "暂不参与计算", tone: "amber", icon: Clock },
      { label: "归档", value: `${archivedCount} 条`, sub: "保留历史追踪", tone: "slate", icon: LockKeyhole },
    ],
  };
}

function mapTeacherWageRuleToRow(record: TeacherWageRuleRecord): DataRow {
  const status = getWageRuleStatusView(record.status);
  const rate = formatApiJpyAmount(record.hourlyRateJpy);

  return {
    id: `rule-${record.id}`,
    title: `${record.teacher.name} / ${record.businessEntity.name}`,
    subtitle: "老师工资规则",
    status: status.label,
    tone: status.tone,
    apiRef: { resource: "teacherWageRule", id: record.id },
    teacherWageRuleRecord: record,
    cells: {
      teacher: record.teacher.name,
      entity: record.businessEntity.name,
      rate,
      memo: record.memo ?? "-",
    },
    detail: [
      {
        title: "工资规则",
        lines: [
          { label: "老师", value: record.teacher.name },
          { label: "业务归属", value: record.businessEntity.name },
          { label: "课时单价", value: rate },
          { label: "状态", value: status.label },
          { label: "备注", value: record.memo ?? "-" },
        ],
      },
      {
        title: "API 追踪",
        lines: [
          { label: "规则 ID", value: record.id },
          { label: "teacherId", value: record.teacherId },
          { label: "businessEntityId", value: record.businessEntityId },
        ],
      },
    ],
  };
}

function buildTeacherWagesPage(basePage: PageConfig, wageSnapshotApi: FinanceListState): PageConfig {
  const apiBasePage: PageConfig = {
    ...basePage,
    description:
      wageSnapshotApi.status === "error"
        ? `真实 API 工资结算读取失败：${wageSnapshotApi.message}`
        : "真实 API 工资快照列表；支持预览、锁定、工资调整、确认、撤销和版本化重锁",
    primaryAction: wageSnapshotApi.status === "ready" ? "生成工资预览" : undefined,
    secondaryAction: undefined,
    batchAction: undefined,
    selectable: false,
    rows: wageSnapshotApi.rows,
  };

  if (wageSnapshotApi.status === "idle") {
    return basePage;
  }

  if (wageSnapshotApi.status !== "ready") {
    return {
      ...apiBasePage,
      metrics: [
        {
          label: "快照读取",
          value: wageSnapshotApi.status === "error" ? "失败" : "读取中",
          sub: "来自 dev API",
          tone: wageSnapshotApi.status === "error" ? "rose" : "amber",
          icon: GraduationCap,
        },
        { label: "已锁定", value: "-", sub: "等待接口返回", tone: "slate", icon: LockKeyhole },
        { label: "调整已确认", value: "-", sub: "读取后统计", tone: "slate", icon: CheckCircle2 },
        { label: "已生成支出", value: "-", sub: "读取后统计", tone: "slate", icon: ReceiptText },
      ],
    };
  }

  const lockedCount = wageSnapshotApi.rows.filter((row) => row.status === "已锁定").length;
  const adjustmentConfirmedCount = wageSnapshotApi.rows.filter((row) => row.status === "调整已确认").length;
  const expenseCreatedCount = wageSnapshotApi.rows.filter((row) => row.status === "已生成支出").length;

  return {
    ...apiBasePage,
    metrics: [
      { label: "工资快照", value: `${wageSnapshotApi.total} 份`, sub: "老师 + 月份 + 业务归属", tone: "sky", icon: FileText },
      { label: "已锁定", value: `${lockedCount} 份`, sub: "等待调整或导出", tone: "amber", icon: LockKeyhole },
      { label: "调整已确认", value: `${adjustmentConfirmedCount} 份`, sub: "可生成支出", tone: "cyan", icon: CheckCircle2 },
      { label: "已生成支出", value: `${expenseCreatedCount} 份`, sub: "进入支出链路", tone: "emerald", icon: ReceiptText },
    ],
  };
}

function mapTeacherWageSnapshotToRow(record: TeacherWageSnapshotRecord): DataRow {
  const status = getTeacherWageSnapshotStatusView(record.status);
  const adjustments =
    (parseApiAmount(record.transportationFeeJpy) ?? 0) +
    (parseApiAmount(record.classroomFeeJpy) ?? 0) +
    (parseApiAmount(record.manualAdjustmentJpy) ?? 0);

  return {
    id: `wage-${record.id}`,
    title: record.teacher.name,
    subtitle: `${formatYearMonth(record.yearMonth)}工资快照 · 第${record.version}版`,
    status: status.label,
    tone: status.tone,
    apiRef: { resource: "teacherWageSnapshot", id: record.id },
    teacherWageSnapshotRecord: record,
    cells: {
      entity: record.businessEntity.name,
      lessons: `${record.lessonCount} 节 / ${formatDurationHours(record.totalLessonHours)}`,
      adjustments: money.jpy(adjustments),
      amount: formatApiJpyAmount(record.totalWageJpy),
    },
    detail: buildTeacherWageSnapshotDetail(record, status.label),
  };
}

function buildTeacherWageSnapshotDetail(record: TeacherWageSnapshotRecord, statusLabel: string): DetailSection[] {
  return [
    {
      title: "工资快照",
      lines: [
        { label: "老师", value: record.teacher.name },
        { label: "业务归属", value: record.businessEntity.name },
        { label: "业务月份", value: formatYearMonth(record.yearMonth) },
        { label: "快照版本", value: `第${record.version}版` },
        { label: "课时数", value: `${record.lessonCount} 节` },
        { label: "课时时长", value: formatDurationHours(record.totalLessonHours) },
        { label: "基础工资", value: formatApiJpyAmount(record.baseWageJpy) },
        { label: "交通费", value: formatApiJpyAmount(record.transportationFeeJpy) },
        { label: "教室费", value: formatApiJpyAmount(record.classroomFeeJpy) },
        { label: "手动调整", value: formatApiJpyAmount(record.manualAdjustmentJpy) },
        { label: "工资合计", value: formatApiJpyAmount(record.totalWageJpy) },
      ],
    },
    {
      title: "状态",
      lines: [
        { label: "快照状态", value: statusLabel },
        { label: "调整状态", value: getWageAdjustmentStatusLabel(record.adjustmentStatus) },
        { label: "支出记录", value: record.expenseRecordId ?? "-" },
        { label: "前一版本", value: record.replacesId ?? "-" },
        { label: "锁定时间", value: formatApiDate(record.lockedAt) },
        { label: "撤销时间", value: record.revokedAt ? formatApiDate(record.revokedAt) : "-" },
        { label: "备注", value: record.memo ?? "-" },
      ],
    },
    {
      title: "课时明细",
      lines: [
        { label: "明细条数", value: `${record.details.length} 条` },
        {
          label: "前 3 条",
          value:
            record.details
              .slice(0, 3)
              .map((detail) => `${formatApiDate(detail.actualDate)} ${detail.studentNameSnapshot}/${detail.subjectNameSnapshot}`)
              .join("；") || "-",
        },
      ],
    },
  ];
}

function buildWageImportPage(basePage: PageConfig, wageImportApi: FinanceListState): PageConfig {
  const readonlyBasePage: PageConfig = {
    ...basePage,
    description:
      wageImportApi.status === "error"
        ? `真实 API 勤务表状态读取失败：${wageImportApi.message}`
        : "每位老师每月一份勤务表；跨业务归属合并导出并分别写回工资快照",
    primaryAction: undefined,
    secondaryAction: undefined,
    batchAction: undefined,
    selectable: false,
    rows: wageImportApi.rows,
  };

  if (wageImportApi.status === "idle") {
    return basePage;
  }

  if (wageImportApi.status !== "ready") {
    return {
      ...readonlyBasePage,
      metrics: [
        {
          label: "勤务表读取",
          value: wageImportApi.status === "error" ? "失败" : "读取中",
          sub: "来自 dev API",
          tone: wageImportApi.status === "error" ? "rose" : "amber",
          icon: Download,
        },
        { label: "已导出", value: "-", sub: "等待接口返回", tone: "slate", icon: Download },
        { label: "已导入", value: "-", sub: "读取后统计", tone: "slate", icon: FileCheck2 },
        { label: "调整已确认", value: "-", sub: "读取后统计", tone: "slate", icon: CheckCircle2 },
      ],
    };
  }

  const exportedCount = wageImportApi.rows.filter((row) => row.status === "已导出").length;
  const importedCount = wageImportApi.rows.filter((row) => row.status === "已导入待确认").length;
  const confirmedCount = wageImportApi.rows.filter((row) => row.status === "调整已确认").length;

  return {
    ...readonlyBasePage,
    metrics: [
      { label: "老师勤务表", value: `${wageImportApi.total} 份`, sub: "老师 + 月份", tone: "sky", icon: Download },
      { label: "已导出", value: `${exportedCount} 份`, sub: "等待老师回填", tone: "cyan", icon: Download },
      { label: "已导入待确认", value: `${importedCount} 份`, sub: "费用已写回", tone: "amber", icon: RefreshCw },
      { label: "调整已确认", value: `${confirmedCount} 份`, sub: "可生成支出", tone: "emerald", icon: CheckCircle2 },
    ],
  };
}

function buildTeacherAttendanceGroupRows(records: TeacherWageSnapshotRecord[]) {
  const groups = new Map<string, TeacherAttendanceGroup>();
  for (const record of records.filter((item) => item.status !== "revoked")) {
    const key = `${record.teacherId}:${record.yearMonth}`;
    const group = groups.get(key) ?? {
      teacherId: record.teacherId,
      teacherName: record.teacher.name,
      yearMonth: record.yearMonth,
      snapshots: [],
    };
    group.snapshots.push(record);
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .sort((left, right) => right.yearMonth.localeCompare(left.yearMonth) || left.teacherName.localeCompare(right.teacherName, "zh-CN"))
    .map(mapTeacherAttendanceGroupToRow);
}

function mapTeacherAttendanceGroupToRow(group: TeacherAttendanceGroup): DataRow {
  const snapshots = [...group.snapshots].sort((left, right) => left.businessEntity.name.localeCompare(right.businessEntity.name, "zh-CN"));
  const status = getTeacherAttendanceGroupStatus(snapshots);
  const latestUpdatedAt = snapshots.reduce((latest, snapshot) => snapshot.updatedAt > latest ? snapshot.updatedAt : latest, "");
  const exported = snapshots.every((snapshot) => ["exported", "imported", "confirmed"].includes(snapshot.adjustmentStatus));
  const returned = snapshots.every((snapshot) => ["imported", "confirmed"].includes(snapshot.adjustmentStatus));

  return {
    id: `import-${group.teacherId}-${group.yearMonth}`,
    title: group.teacherName,
    subtitle: `${formatYearMonth(group.yearMonth)}勤务表 · ${snapshots.length} 个业务归属`,
    status: status.label,
    tone: status.tone,
    teacherAttendanceGroup: { ...group, snapshots },
    cells: {
      exported: exported ? formatApiDate(latestUpdatedAt) : "-",
      returned: returned ? formatApiDate(latestUpdatedAt) : "-",
      transport: formatApiJpyAmount(snapshots.reduce((sum, snapshot) => sum + (parseApiAmount(snapshot.transportationFeeJpy) ?? 0), 0)),
      classroom: formatApiJpyAmount(snapshots.reduce((sum, snapshot) => sum + (parseApiAmount(snapshot.classroomFeeJpy) ?? 0), 0)),
    },
    detail: [
      {
        title: "勤务表范围",
        lines: [
          { label: "老师", value: group.teacherName },
          { label: "业务月份", value: formatYearMonth(group.yearMonth) },
          { label: "业务归属", value: snapshots.map((snapshot) => snapshot.businessEntity.name).join("；") },
          { label: "工资快照", value: `${snapshots.length} 份` },
          { label: "课时明细", value: `${snapshots.reduce((sum, snapshot) => sum + snapshot.details.length, 0)} 条` },
        ],
      },
    ],
  };
}

function getTeacherAttendanceGroupStatus(snapshots: TeacherWageSnapshotRecord[]): { label: string; tone: Tone } {
  if (snapshots.every((snapshot) => snapshot.adjustmentStatus === "none" && snapshot.status === "locked")) {
    return { label: "未导出", tone: "slate" };
  }
  if (snapshots.every((snapshot) => snapshot.adjustmentStatus === "exported" && snapshot.status === "locked")) {
    return { label: "已导出", tone: "cyan" };
  }
  if (snapshots.every((snapshot) => snapshot.adjustmentStatus === "imported" && snapshot.status === "locked")) {
    return { label: "已导入待确认", tone: "amber" };
  }
  if (snapshots.every((snapshot) => snapshot.adjustmentStatus === "confirmed")) {
    return { label: "调整已确认", tone: "emerald" };
  }
  if (snapshots.some((snapshot) => snapshot.status === "expense_created")) {
    return { label: "已生成支出", tone: "emerald" };
  }
  return { label: "状态不一致", tone: "rose" };
}

function getTeacherWageSnapshotStatusView(status: string): { label: string; tone: Tone } {
  if (status === "locked") {
    return { label: "已锁定", tone: "amber" };
  }

  if (status === "adjustment_confirmed") {
    return { label: "调整已确认", tone: "cyan" };
  }

  if (status === "expense_created") {
    return { label: "已生成支出", tone: "emerald" };
  }

  if (status === "revoked") {
    return { label: "已撤销", tone: "slate" };
  }

  return { label: status, tone: "slate" };
}

function getWageImportStatusView(status: string): { label: string; tone: Tone } {
  const views: Record<string, { label: string; tone: Tone }> = {
    none: { label: "未导出", tone: "slate" },
    exported: { label: "已导出", tone: "cyan" },
    imported: { label: "已导入待确认", tone: "amber" },
    manual_adjusted: { label: "手动调整", tone: "amber" },
    confirmed: { label: "调整已确认", tone: "emerald" },
  };

  return views[status] ?? { label: status, tone: "slate" };
}

function getWageAdjustmentStatusLabel(status: string) {
  return getWageImportStatusView(status).label;
}

function buildExternalWorkLessonsPage(basePage: PageConfig, externalLessonApi: ApiItemsState<ExternalWorkLessonRecord>): PageConfig {
  if (externalLessonApi.status === "idle") {
    return basePage;
  }

  if (externalLessonApi.status !== "ready") {
    return {
      ...basePage,
      description:
        externalLessonApi.status === "error"
          ? `真实 API 打工课时读取失败：${externalLessonApi.message}`
          : "正在读取真实 API 打工课时列表；第一层只读展示",
      primaryAction: undefined,
      metrics: [
        {
          label: "打工课时",
          value: externalLessonApi.status === "error" ? "失败" : "读取中",
          sub: "来自 dev API",
          tone: externalLessonApi.status === "error" ? "rose" : "amber",
          icon: BookOpen,
        },
        { label: "预定课时", value: "-", sub: "等待接口返回", tone: "slate", icon: CalendarDays },
        { label: "实际课时", value: "-", sub: "等待接口返回", tone: "slate", icon: CheckCircle2 },
        { label: "已取消", value: "-", sub: "读取后统计", tone: "slate", icon: RotateCcw },
      ],
      rows: [],
    };
  }

  const plannedCount = externalLessonApi.items.filter((lesson) => lesson.lessonType === "planned").length;
  const actualCount = externalLessonApi.items.filter((lesson) => lesson.lessonType === "actual").length;
  const pendingActualCount = externalLessonApi.items.filter(
    (lesson) => lesson.lessonType === "planned" && !lesson.actualLesson && lesson.status === "scheduled",
  ).length;
  const cancelledCount = externalLessonApi.items.filter((lesson) => lesson.status === "cancelled").length;

  return {
    ...basePage,
    description: "真实 API 打工课时列表；第一层只读展示预定和实际课时对应关系",
    primaryAction: undefined,
    metrics: [
      { label: "预定课时", value: `${plannedCount} 节`, sub: "来自 dev API", tone: "sky", icon: CalendarDays },
      { label: "实际课时", value: `${actualCount} 节`, sub: "用于打工结算", tone: "emerald", icon: CheckCircle2 },
      { label: "待生成实际", value: `${pendingActualCount} 节`, sub: "第二层再接动作", tone: "amber", icon: Clock },
      { label: "已取消", value: `${cancelledCount} 节`, sub: "保留审计追踪", tone: "slate", icon: RotateCcw },
    ],
    rows: [],
  };
}

function getExternalWorkPairsForPage(workflowApi: WorkflowApiState) {
  if (workflowApi.externalLessons.status === "ready") {
    return buildExternalWorkPairsFromApi(workflowApi.externalLessons.items);
  }

  if (workflowApi.externalLessons.status === "error") {
    return [];
  }

  return externalWorkPairs;
}

function buildExternalWorkPairsFromApi(lessons: ExternalWorkLessonRecord[]): ExternalWorkPair[] {
  const plannedLessons = lessons.filter((lesson) => lesson.lessonType === "planned");
  const actualLessons = lessons.filter((lesson) => lesson.lessonType === "actual");
  const actualByPlannedId = new Map(
    actualLessons.flatMap((lesson) => (lesson.plannedLessonId ? [[lesson.plannedLessonId, lesson] as const] : [])),
  );
  const plannedIds = new Set(plannedLessons.map((lesson) => lesson.id));

  const plannedPairs = plannedLessons.map((planned) => {
    const actual = actualByPlannedId.get(planned.id);

    return {
      id: `external-pair-${planned.id}`,
      relation: actual ? "已对应实际课时" : getExternalLessonRelationLabel(planned.status),
      locked: true,
      planned: mapExternalWorkLessonToCard(planned),
      actual: actual ? mapExternalWorkLessonToCard(actual) : undefined,
      detailRow: mapExternalWorkLessonToRow(actual ?? planned),
    };
  });

  const actualOnlyPairs = actualLessons
    .filter((actual) => !actual.plannedLessonId || !plannedIds.has(actual.plannedLessonId))
    .map((actual) => ({
      id: `external-actual-only-${actual.id}`,
      relation: "无预定课时",
      locked: true,
      planned: mapExternalWorkActualToPlannedPlaceholder(actual),
      actual: mapExternalWorkLessonToCard(actual),
      detailRow: mapExternalWorkLessonToRow(actual),
    }));

  return [...plannedPairs, ...actualOnlyPairs];
}

function mapExternalWorkLessonToCard(record: ExternalWorkLessonRecord): ExternalWorkLessonData {
  const status = getExternalWorkLessonStatusView(record.status);

  return {
    date: formatApiDate(record.lessonDate),
    dateSub: formatTimeRange(record.startTime, record.endTime),
    workplace: record.workplace.name,
    instructor: record.instructorName,
    duration: formatDurationHours(record.durationHours),
    wage: formatApiJpyAmount(record.lessonWageJpy),
    transportation: formatApiJpyAmount(record.transportationFeeJpy),
    content: record.content ?? record.lessonTitle ?? record.memo ?? "-",
    status: status.label,
    tone: status.tone,
  };
}

function mapExternalWorkActualToPlannedPlaceholder(record: ExternalWorkLessonRecord): ExternalWorkLessonData {
  return {
    ...mapExternalWorkLessonToCard(record),
    dateSub: "无关联预定课时",
    wage: "-",
    transportation: "-",
    content: "仅有实际课时记录",
    status: "无预定",
    tone: "slate",
  };
}

function mapExternalWorkLessonToRow(record: ExternalWorkLessonRecord): DataRow {
  const status = getExternalWorkLessonStatusView(record.status);

  return {
    id: `external-lesson-${record.id}`,
    title: record.lessonTitle,
    subtitle: `${record.workplace.name} / ${record.instructorName}`,
    status: status.label,
    tone: status.tone,
    apiRef: { resource: "externalWorkLesson", id: record.id },
    readOnlyActions: true,
    cells: {
      workplace: record.workplace.name,
      instructor: record.instructorName,
      duration: formatDurationHours(record.durationHours),
      wage: formatApiJpyAmount(record.lessonWageJpy),
    },
    detail: [
      {
        title: "打工课时",
        lines: [
          { label: "机构", value: record.workplace.name },
          { label: "授课人", value: record.instructorName },
          { label: "日期", value: formatApiDate(record.lessonDate) },
          { label: "时间", value: formatTimeRange(record.startTime, record.endTime) },
          { label: "类型", value: record.lessonType === "planned" ? "预定" : "实际" },
          { label: "状态", value: status.label },
          { label: "课题", value: record.lessonTitle },
          { label: "内容", value: record.content ?? "-" },
        ],
      },
      {
        title: "金额",
        lines: [
          { label: "时长", value: formatDurationHours(record.durationHours) },
          { label: "课时单价", value: formatApiJpyAmount(record.hourlyRateJpy) },
          { label: "课时工资", value: formatApiJpyAmount(record.lessonWageJpy) },
          { label: "交通费", value: formatApiJpyAmount(record.transportationFeeJpy) },
        ],
      },
    ],
  };
}

function getExternalLessonRelationLabel(status: string) {
  if (status === "cancelled") {
    return "已取消";
  }

  return "无对应实际课时";
}

function getExternalWorkLessonStatusView(status: string): { label: string; tone: Tone } {
  const views: Record<string, { label: string; tone: Tone }> = {
    scheduled: { label: "待生成实际", tone: "amber" },
    actual_created: { label: "已对应", tone: "emerald" },
    completed: { label: "已完成", tone: "emerald" },
    cancelled: { label: "已取消", tone: "rose" },
  };

  return views[status] ?? { label: status, tone: "slate" };
}

function buildExternalWorkSettlementsPage(basePage: PageConfig, settlementApi: FinanceListState): PageConfig {
  const readonlyBasePage: PageConfig = {
    ...basePage,
    description:
      settlementApi.status === "error"
        ? `真实 API 打工结算读取失败：${settlementApi.message}`
        : "真实 API 打工结算列表；第一层只读展示，锁定、撤销和生成收入会在第二层接入",
    primaryAction: undefined,
    secondaryAction: undefined,
    batchAction: undefined,
    selectable: false,
    rows: settlementApi.rows,
  };

  if (settlementApi.status === "idle") {
    return basePage;
  }

  if (settlementApi.status !== "ready") {
    return {
      ...readonlyBasePage,
      metrics: [
        {
          label: "结算读取",
          value: settlementApi.status === "error" ? "失败" : "读取中",
          sub: "来自 dev API",
          tone: settlementApi.status === "error" ? "rose" : "amber",
          icon: BriefcaseBusiness,
        },
        { label: "已锁定", value: "-", sub: "等待接口返回", tone: "slate", icon: LockKeyhole },
        { label: "已生成收入", value: "-", sub: "读取后统计", tone: "slate", icon: ReceiptText },
        { label: "已撤销", value: "-", sub: "读取后统计", tone: "slate", icon: RotateCcw },
      ],
    };
  }

  const lockedCount = settlementApi.rows.filter((row) => row.status === "已锁定").length;
  const incomeCreatedCount = settlementApi.rows.filter((row) => row.status === "收入已生成").length;
  const revokedCount = settlementApi.rows.filter((row) => row.status === "已撤销").length;

  return {
    ...readonlyBasePage,
    metrics: [
      { label: "打工结算", value: `${settlementApi.total} 组`, sub: "来自 dev API", tone: "sky", icon: BriefcaseBusiness },
      { label: "已锁定", value: `${lockedCount} 组`, sub: "可生成收入", tone: "emerald", icon: LockKeyhole },
      { label: "收入已生成", value: `${incomeCreatedCount} 组`, sub: "进入收入链路", tone: "cyan", icon: ReceiptText },
      { label: "已撤销", value: `${revokedCount} 组`, sub: "保留审计追踪", tone: "slate", icon: RotateCcw },
    ],
  };
}

function mapExternalWorkSettlementToRow(record: ExternalWorkSettlementRecord): DataRow {
  const status = getExternalWorkSettlementStatusView(record.status);

  return {
    id: `external-settlement-${record.id}`,
    title: `${record.workplace.name} / ${formatYearMonth(record.yearMonth)}`,
    subtitle: "打工结算快照",
    status: status.label,
    tone: status.tone,
    apiRef: { resource: "externalWorkSettlement", id: record.id },
    readOnlyActions: true,
    cells: {
      workplace: record.workplace.name,
      lessons: `${record.lessonCount} 节 / ${formatDurationHours(record.totalLessonHours)}`,
      amount: formatApiJpyAmount(record.totalAmountJpy),
      income: record.incomeRecord ? getCashStatusLabel(record.incomeRecord.cashStatus) : "未生成收入",
    },
    detail: [
      {
        title: "打工结算",
        lines: [
          { label: "机构", value: record.workplace.name },
          { label: "业务月份", value: formatYearMonth(record.yearMonth) },
          { label: "课时数", value: `${record.lessonCount} 节` },
          { label: "总时长", value: formatDurationHours(record.totalLessonHours) },
          { label: "课时工资", value: formatApiJpyAmount(record.lessonWageJpy) },
          { label: "交通费", value: formatApiJpyAmount(record.transportationFeeJpy) },
          { label: "调整金额", value: formatApiJpyAmount(record.adjustmentAmountJpy) },
          { label: "结算金额", value: formatApiJpyAmount(record.totalAmountJpy) },
        ],
      },
      {
        title: "状态",
        lines: [
          { label: "状态", value: status.label },
          { label: "收入记录", value: record.incomeRecordId ?? "-" },
          { label: "Cash 状态", value: record.incomeRecord ? getCashStatusLabel(record.incomeRecord.cashStatus) : "-" },
          { label: "锁定时间", value: formatApiDate(record.lockedAt) },
          { label: "撤销时间", value: record.revokedAt ? formatApiDate(record.revokedAt) : "-" },
          { label: "备注", value: record.memo ?? "-" },
        ],
      },
    ],
  };
}

function getExternalWorkSettlementStatusView(status: string): { label: string; tone: Tone } {
  if (status === "locked") {
    return { label: "已锁定", tone: "emerald" };
  }

  if (status === "income_created") {
    return { label: "收入已生成", tone: "cyan" };
  }

  if (status === "revoked") {
    return { label: "已撤销", tone: "slate" };
  }

  return { label: status, tone: "slate" };
}

function buildAuditPage(basePage: PageConfig, auditApi: FinanceListState): PageConfig {
  const readonlyBasePage: PageConfig = {
    ...basePage,
    description:
      auditApi.status === "error"
        ? `真实 API 审计事件读取失败：${auditApi.message}`
        : "真实 API 审计事件列表；第一层只读展示关键业务操作记录",
    batchAction: undefined,
    selectable: false,
    rows: auditApi.rows,
  };

  if (auditApi.status === "idle") {
    return basePage;
  }

  if (auditApi.status !== "ready") {
    return {
      ...readonlyBasePage,
      metrics: [
        {
          label: "审计读取",
          value: auditApi.status === "error" ? "失败" : "读取中",
          sub: "来自 dev API",
          tone: auditApi.status === "error" ? "rose" : "amber",
          icon: History,
        },
        { label: "高风险", value: "-", sub: "等待接口返回", tone: "slate", icon: ShieldCheck },
        { label: "关键动作", value: "-", sub: "读取后统计", tone: "slate", icon: LockKeyhole },
        { label: "今日操作", value: "-", sub: "读取后统计", tone: "slate", icon: Clock },
      ],
    };
  }

  const highRiskCount = auditApi.rows.filter((row) => ["高", "严重"].includes(row.status)).length;
  const lockLikeCount = auditApi.rows.filter((row) => String(row.cells.action ?? "").includes("lock")).length;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = auditApi.rows.filter((row) => String(row.cells.time ?? "").startsWith(today)).length;

  return {
    ...readonlyBasePage,
    metrics: [
      { label: "审计事件", value: `${auditApi.total} 条`, sub: "来自 dev API", tone: "sky", icon: History },
      { label: "高风险", value: `${highRiskCount} 条`, sub: "高 / 严重", tone: "rose", icon: ShieldCheck },
      { label: "锁定类动作", value: `${lockLikeCount} 条`, sub: "action 包含 lock", tone: "emerald", icon: LockKeyhole },
      { label: "今日操作", value: `${todayCount} 条`, sub: today, tone: "cyan", icon: Clock },
    ],
  };
}

function mapAuditEventToRow(record: AuditEventRecord): DataRow {
  const risk = getAuditRiskView(record.riskLevel);
  const operator = record.actorUser?.displayName ?? record.actorUser?.email ?? "系统";

  return {
    id: `audit-${record.id}`,
    title: record.action,
    subtitle: `${record.targetType} / ${record.targetId ?? "-"}`,
    status: risk.label,
    tone: risk.tone,
    apiRef: { resource: "auditEvent", id: record.id },
    readOnlyActions: true,
    cells: {
      operator,
      time: formatApiDateTime(record.createdAt),
      action: record.action,
      target: `${record.targetType} / ${record.targetId ?? "-"}`,
    },
    detail: [
      {
        title: "审计事件",
        lines: [
          { label: "操作人", value: operator },
          { label: "动作", value: record.action },
          { label: "对象类型", value: record.targetType },
          { label: "对象 ID", value: record.targetId ?? "-" },
          { label: "风险等级", value: risk.label },
          { label: "原因", value: record.reason ?? "-" },
          { label: "时间", value: formatApiDateTime(record.createdAt) },
        ],
      },
      {
        title: "追踪",
        lines: [
          { label: "事件 ID", value: record.id },
          { label: "requestId", value: record.requestId ?? "-" },
        ],
      },
    ],
  };
}

function getAuditRiskView(riskLevel: string): { label: string; tone: Tone } {
  const views: Record<string, { label: string; tone: Tone }> = {
    low: { label: "低", tone: "slate" },
    medium: { label: "中", tone: "amber" },
    high: { label: "高", tone: "rose" },
    critical: { label: "严重", tone: "rose" },
  };

  return views[riskLevel] ?? { label: riskLevel, tone: "slate" };
}

function getWageRuleStatusView(status: "active" | "inactive" | "archived"): { label: string; tone: Tone } {
  if (status === "active") {
    return { label: "生效中", tone: "emerald" };
  }

  if (status === "inactive") {
    return { label: "停用", tone: "amber" };
  }

  return { label: "归档", tone: "slate" };
}

function buildIncomeRecordsPage(basePage: PageConfig, incomeApi: FinanceListState): PageConfig {
  if (incomeApi.status !== "ready") {
    return basePage;
  }

  const cashTodoCount = incomeApi.rows.filter((row) =>
    ["待提交 Cash", "Cash 待确认", "需要复核", "Cash 已拒绝"].includes(row.status),
  ).length;
  const confirmedCount = incomeApi.rows.filter((row) => ["Cash 已确认", "已生成流水"].includes(row.status)).length;
  const historicalConfirmedCount = incomeApi.rows.filter((row) => row.status === "历史已确认").length;

  return {
    ...basePage,
    description: "真实 API 收入记录列表；历史确认记录只读，不会重复提交 Cash",
    primaryAction: "新增手动收入",
    batchAction: undefined,
    selectable: false,
    metrics: [
      { label: "收入记录", value: `${incomeApi.total} 条`, sub: "来自当前环境 API", tone: "emerald", icon: ReceiptText },
      { label: "Cash 待处理", value: `${cashTodoCount} 条`, sub: "未提交 / 待确认 / 复核", tone: "amber", icon: Banknote },
      { label: "Cash 已确认", value: `${confirmedCount} 条`, sub: "Cash 已确认或已入账", tone: "sky", icon: CheckCircle2 },
      { label: "历史已确认", value: `${historicalConfirmedCount} 条`, sub: "只读，不创建 Cash", tone: "violet", icon: History },
    ],
    rows: incomeApi.rows,
  };
}

function buildExpenseRecordsPage(basePage: PageConfig, expenseApi: FinanceListState): PageConfig {
  if (expenseApi.status !== "ready") {
    return basePage;
  }

  const cashTodoCount = expenseApi.rows.filter((row) =>
    ["待提交 Cash", "Cash 待确认", "需要复核", "Cash 已拒绝"].includes(row.status),
  ).length;
  const confirmedCount = expenseApi.rows.filter((row) => ["Cash 已确认", "已生成流水"].includes(row.status)).length;
  const historicalConfirmedCount = expenseApi.rows.filter((row) => row.status === "历史已确认").length;

  return {
    ...basePage,
    description: "真实 API 支出记录列表；历史确认支出只读，不会重复提交 Cash",
    primaryAction: "新增手动支出",
    batchAction: undefined,
    selectable: false,
    metrics: [
      { label: "支出记录", value: `${expenseApi.total} 条`, sub: "来自当前环境 API", tone: "sky", icon: Banknote },
      { label: "Cash 待处理", value: `${cashTodoCount} 条`, sub: "未提交 / 待确认 / 复核", tone: "amber", icon: Clock },
      { label: "Cash 已确认", value: `${confirmedCount} 条`, sub: "Cash 已确认或已入账", tone: "emerald", icon: CheckCircle2 },
      { label: "历史已确认", value: `${historicalConfirmedCount} 条`, sub: "只读，不创建 Cash", tone: "violet", icon: History },
    ],
    rows: expenseApi.rows,
  };
}

function buildCashRequestsPage(basePage: PageConfig, cashRequestApi: FinanceListState): PageConfig {
  if (cashRequestApi.status !== "ready") {
    return basePage;
  }

  const requestRows = cashRequestApi.rows.filter((row) => row.apiRef?.resource === "cashRequest");
  const batchCount = cashRequestApi.rows.filter((row) => row.apiRef?.resource === "cashPaymentBatch").length;
  const requestedCount = requestRows.filter((row) => row.status === "Cash 待确认").length;
  const confirmedCount = requestRows.filter((row) => row.status === "Cash 已确认").length;
  const blockedCount = requestRows.filter((row) =>
    ["Cash 已拒绝", "需要复核", "Cash 已撤回"].includes(row.status),
  ).length;

  return {
    ...basePage,
    description: "真实 API Cash 请求列表；School 端可撤回待确认请求，确认和拒绝由 Cash 端回写",
    primaryAction: undefined,
    batchAction: undefined,
    selectable: false,
    metrics: [
      { label: "Cash 请求", value: `${cashRequestApi.total} 条`, sub: `另有 ${batchCount} 个聚合批次`, tone: "sky", icon: Send },
      { label: "待确认", value: `${requestedCount} 条`, sub: "已提交 Cash", tone: "amber", icon: Clock },
      { label: "已确认", value: `${confirmedCount} 条`, sub: "等待后续入账链路", tone: "emerald", icon: CheckCircle2 },
      { label: "需处理", value: `${blockedCount} 条`, sub: "拒绝 / 撤回 / 复核", tone: "rose", icon: ShieldCheck },
    ],
    rows: cashRequestApi.rows,
  };
}

function buildCashInboundPage(basePage: PageConfig, cashInboundApi: FinanceListState): PageConfig {
  if (cashInboundApi.status !== "ready") {
    return basePage;
  }

  const postedCount = cashInboundApi.rows.filter((row) => row.status === "已入账").length;
  const reversedInboundCount = cashInboundApi.rows.filter((row) => row.status === "已冲销").length;
  const linkedCount = cashInboundApi.rows.filter((row) => Number(row.cells.linkedIncomeCount ?? 0) > 0).length;

  return {
    ...basePage,
    description: "真实 API Cash 入站事件列表；入站请求由 Cash 端发起，School 端只处理已入账冲销",
    primaryAction: undefined,
    batchAction: undefined,
    selectable: false,
    metrics: [
      { label: "入站事件", value: `${cashInboundApi.total} 条`, sub: "来自 dev API", tone: "cyan", icon: WalletCards },
      { label: "已入账", value: `${postedCount} 条`, sub: "已生成账户流水", tone: "emerald", icon: CheckCircle2 },
      { label: "已冲销", value: `${reversedInboundCount} 条`, sub: "入站已撤销", tone: "slate", icon: RotateCcw },
      { label: "关联收入", value: `${linkedCount} 条`, sub: "联动收入状态", tone: "sky", icon: ReceiptText },
    ],
    rows: cashInboundApi.rows,
  };
}

function buildAccountLedgerPage(basePage: PageConfig, accountLedgerApi: FinanceListState): PageConfig {
  if (accountLedgerApi.status !== "ready") {
    return basePage;
  }

  const inCount = accountLedgerApi.rows.filter((row) => String(row.cells.direction) === "入金").length;
  const outCount = accountLedgerApi.rows.filter((row) => String(row.cells.direction) === "出金").length;
  const reversedCount = accountLedgerApi.rows.filter((row) => row.status === "已冲销").length;

  return {
    ...basePage,
    description: "真实 API 账户流水列表；新增流水、收入/支出入账和冲销动作后续接入",
    primaryAction: undefined,
    batchAction: undefined,
    selectable: false,
    metrics: [
      { label: "流水总数", value: `${accountLedgerApi.total} 条`, sub: "来自 dev API", tone: "sky", icon: History },
      { label: "入金", value: `${inCount} 条`, sub: "账户增加", tone: "emerald", icon: WalletCards },
      { label: "出金", value: `${outCount} 条`, sub: "账户减少", tone: "amber", icon: Banknote },
      { label: "已冲销", value: `${reversedCount} 条`, sub: "反向保留记录", tone: "slate", icon: RotateCcw },
    ],
    rows: accountLedgerApi.rows,
  };
}

function mapCashInboundEventToRow(record: CashInboundEventRecord): DataRow {
  const status = getCashInboundStatusView(record.status);
  const eventType = getCashInboundEventTypeLabel(record.eventType);
  const targetAmount = formatApiCurrencyAmount(record.targetCurrency, record.targetAmountJpy, record.targetAmountCny);
  const sourceAmount = record.sourceCurrency
    ? formatApiCurrencyAmount(record.sourceCurrency, record.sourceAmountJpy, record.sourceAmountCny)
    : "-";
  const feeAmount = record.feeCurrency
    ? formatApiCurrencyAmount(record.feeCurrency, record.feeAmountJpy, record.feeAmountCny)
    : "-";

  return {
    id: `cash-inbound-${record.id}`,
    title: `${eventType} / ${record.corporateAccount.name}`,
    subtitle: `Cash 入站事件 / ${record.externalCashEventId}`,
    status: status.label,
    tone: status.tone,
    apiRef: { resource: "cashInbound", id: record.id },
    readOnlyActions: record.status !== "account_transaction_created",
    cashInbound: { status: record.status },
    cells: {
      type: eventType,
      object: `${record.corporateAccount.name} (${record.corporateAccount.currency})`,
      amount: targetAmount,
      cashRef: record.externalCashEventId,
      linkedIncomeCount: record.linkedIncomeRecordIds.length,
    },
    detail: [
      {
        title: "Cash 入站",
        lines: [
          { label: "类型", value: eventType },
          { label: "入账账户", value: `${record.corporateAccount.name} / ${record.corporateAccount.code}` },
          { label: "入站日期", value: formatApiDate(record.eventDate) },
          { label: "Cash 引用", value: record.externalCashEventId },
          { label: "状态", value: status.label },
          { label: "备注", value: record.memo ?? "-" },
        ],
      },
      {
        title: "金额",
        lines: [
          { label: "Cash 原始金额", value: sourceAmount },
          { label: "School 入账金额", value: targetAmount },
          { label: "汇率", value: record.exchangeRate === null ? "-" : String(record.exchangeRate) },
          { label: "手续费", value: feeAmount },
        ],
      },
      {
        title: "联动",
        lines: [
          { label: "关联收入数", value: `${record.linkedIncomeRecordIds.length} 条` },
          { label: "账户流水 ID", value: record.accountTransactionId },
          { label: "流水状态", value: getAccountTransactionStatusView(record.accountTransaction.status).label },
        ],
      },
    ],
  };
}

function mapCashRequestToRow(record: CashRequestRecord): DataRow {
  const status = getCashRequestStatusView(record.status);
  const direction = record.direction === "income" ? "收入" : "支出";
  const sourceTitle = record.incomeRecord?.title ?? record.expenseRecord?.title ?? "未关联来源记录";
  const expectedAmount = formatApiCurrencyAmount(record.expectedCurrency, record.expectedAmountJpy, record.expectedAmountCny);
  const requestedAmount = formatApiCurrencyAmount(
    record.requestedCurrency,
    record.requestedAmountJpy,
    record.requestedAmountCny,
  );

  return {
    id: `cash-request-${record.id}`,
    title: sourceTitle,
    subtitle: `${direction} Cash 请求 / ${getCashRequestSourceLabel(record.sourceType)}`,
    status: status.label,
    tone: status.tone,
    apiRef: { resource: "cashRequest", id: record.id },
    cashRequest: { status: record.status, direction: record.direction },
    cells: {
      direction,
      source: sourceTitle,
      requestedAmount,
      cashAccount: record.cashAccountNameSnapshot ?? record.cashAccountCode ?? "-",
      createdAt: formatApiDate(record.createdAt),
    },
    detail: [
      {
        title: "Cash 请求",
        lines: [
          { label: "方向", value: direction },
          { label: "来源记录", value: sourceTitle },
          { label: "预期金额", value: expectedAmount },
          { label: "请求金额", value: requestedAmount },
          { label: "Cash 账户", value: record.cashAccountNameSnapshot ?? record.cashAccountCode ?? "-" },
          { label: "预期收 / 付款日", value: record.cashTransactedAt ? formatApiDate(record.cashTransactedAt) : "-" },
          { label: "汇率", value: record.exchangeRate === null ? "-" : String(record.exchangeRate) },
          { label: "取舍方式", value: getConversionMethodLabel(record.conversionMethod) },
          { label: "拒绝原因", value: record.rejectionReason ?? "-" },
        ],
      },
      {
        title: "API 追踪",
        lines: [
          { label: "请求 ID", value: record.id },
          { label: "sourceType", value: record.sourceType },
          { label: "sourceId", value: record.sourceId ?? "-" },
          { label: "incomeRecordId", value: record.incomeRecordId ?? "-" },
          { label: "expenseRecordId", value: record.expenseRecordId ?? "-" },
          { label: "externalCashRequestId", value: record.externalCashRequestId ?? "-" },
          { label: "externalCashEventId", value: record.externalCashEventId ?? "-" },
          { label: "externalCashTransactionId", value: record.externalCashTransactionId ?? "-" },
          { label: "同步尝试", value: `${record.syncAttemptCount} 次` },
          { label: "最近同步错误", value: record.lastSyncError ?? "-" },
        ],
      },
    ],
  };
}

function mapCashPaymentBatchToRow(record: CashPaymentBatchRecord): DataRow {
  const totalAmount = formatApiCurrencyAmount(
    record.currency,
    record.totalAmountJpy,
    record.totalAmountCny,
  );
  const itemLines = record.items.map((item) => ({
    label: `${item.itemOrder}. ${item.expenseRecord.businessEntity?.name ?? "未设置业务归属"}`,
    value: `${item.expenseRecord.title} / ${formatApiCurrencyAmount(record.currency, item.amountJpy, item.amountCny)}`,
  }));

  return {
    id: `cash-payment-batch-${record.id}`,
    title: `${record.yearMonth} ${record.teacherNameSnapshot} 工资聚合付款`,
    subtitle: `Cash 聚合批次 / ${record.items.length} 条 School 支出`,
    status: "聚合已确认",
    tone: "emerald",
    apiRef: { resource: "cashPaymentBatch", id: record.id },
    readOnlyActions: true,
    cells: {
      direction: "支出",
      source: `${record.teacherNameSnapshot} / ${record.yearMonth}`,
      requestedAmount: totalAmount,
      cashAccount: record.cashAccountId,
      createdAt: formatApiDate(record.approvedAt),
    },
    detail: [
      {
        title: "聚合付款",
        lines: [
          { label: "老师", value: record.teacherNameSnapshot },
          { label: "业务月份", value: record.yearMonth },
          { label: "合计金额", value: totalAmount },
          { label: "明细数量", value: `${record.items.length} 条` },
          { label: "Cash 账户 ID", value: record.cashAccountId },
          { label: "付款日期", value: formatApiDate(record.cashTransactedAt) },
          { label: "确认时间", value: formatApiDate(record.approvedAt) },
          { label: "状态", value: "Cash 已确认 · 只读" },
        ],
      },
      {
        title: "批次明细",
        lines: itemLines,
      },
      {
        title: "API 追踪",
        lines: [
          { label: "School 批次 ID", value: record.id },
          { label: "Cash 批次 ID", value: record.externalCashBatchId },
          { label: "Cash transaction ID", value: record.externalCashTransactionId },
          { label: "老师 ID", value: record.teacherId ?? "-" },
          ...record.items.flatMap((item) => [
            { label: `明细 ${item.itemOrder} / School request`, value: item.cashRequestId },
            { label: `明细 ${item.itemOrder} / Cash request`, value: item.externalCashRequestId },
            { label: `明细 ${item.itemOrder} / School expense`, value: item.expenseRecordId },
          ]),
        ],
      },
    ],
  };
}

function mapIncomeRecordToRow(record: IncomeRecord): DataRow {
  const status = getFinancialRecordStatusView(record.recordStatus, record.cashStatus);
  const sourceLabel = getIncomeSourceLabel(record.sourceType);
  const businessEntityName = record.businessEntity?.name ?? "未设置业务归属";
  const amount = formatApiCurrencyAmount(record.originalCurrency, record.originalAmountJpy, record.originalAmountCny);
  const cashStatus = getCashStatusLabel(record.cashStatus);
  const canVoid = canVoidIncomeRecord(record.sourceType, record.recordStatus, record.cashStatus);
  const canSubmitCash = canSubmitCashRequest(record.recordStatus, record.cashStatus);

  return {
    id: `income-${record.id}`,
    title: record.title,
    subtitle: `${sourceLabel} / ${businessEntityName}`,
    status: status.label,
    tone: status.tone,
    apiRef: {
      resource: "income",
      id: record.id,
    },
    migrationAuditTarget:
      record.recordStatus === "historical_confirmed"
        ? { targetTable: "income_records", targetId: record.id }
        : undefined,
    readOnlyActions: !canVoid && !canSubmitCash && !record.receiptEligible && !record.receiptIssued,
    financeRecord: {
      kind: "income",
      sourceType: record.sourceType,
      recordStatus: record.recordStatus,
      cashStatus: record.cashStatus,
      originalCurrency: record.originalCurrency,
      amountJpy: parseApiAmount(record.originalAmountJpy),
      amountCny: parseApiAmount(record.originalAmountCny),
      receiptEligible: record.receiptEligible,
      receiptIssued: record.receiptIssued,
    },
    cells: {
      source: sourceLabel,
      businessMonth: record.yearMonth,
      amount,
      cash: cashStatus,
    },
    detail: [
      {
        title: "收入记录",
        lines: [
          { label: "来源", value: sourceLabel },
          { label: "业务归属", value: businessEntityName },
          { label: "学生", value: record.student?.name ?? "-" },
          { label: "原始金额", value: amount },
          { label: "记录状态", value: status.label },
          { label: "Cash 状态", value: cashStatus },
          ...(record.recordStatus === "historical_confirmed"
            ? [{ label: "历史迁移保护", value: "仅保留来源确认事实；不会创建或提交 Cash 请求" }]
            : []),
          {
            label: "学费收据",
            value: record.receiptIssued
              ? `已开具 ${record.latestReceipt?.receiptNo ?? ""}`.trim()
              : record.receiptEligible
                ? "可生成"
                : record.receiptIneligibleReason ?? "不可生成",
          },
          { label: "备注", value: record.memo ?? "-" },
        ],
      },
      {
        title: "API 追踪",
        lines: [
          { label: "记录 ID", value: record.id },
          { label: "sourceType", value: record.sourceType },
          { label: "sourceId", value: record.sourceId ?? "-" },
        ],
      },
    ],
  };
}

function mapExpenseRecordToRow(record: ExpenseRecord): DataRow {
  const status = getFinancialRecordStatusView(record.recordStatus, record.cashStatus);
  const category = getExpenseSourceLabel(record.sourceType);
  const businessEntityName = record.businessEntity?.name ?? "未设置业务归属";
  const amount = formatApiCurrencyAmount(record.originalCurrency, record.originalAmountJpy, record.originalAmountCny);
  const cashStatus = getCashStatusLabel(record.cashStatus);
  const canVoid = canVoidExpenseRecord(record.sourceType, record.recordStatus, record.cashStatus);
  const canSubmitCash = canSubmitCashRequest(record.recordStatus, record.cashStatus);

  return {
    id: `expense-${record.id}`,
    title: record.title,
    subtitle: `${category} / ${businessEntityName}`,
    status: status.label,
    tone: status.tone,
    apiRef: {
      resource: "expense",
      id: record.id,
    },
    migrationAuditTarget:
      record.recordStatus === "historical_confirmed"
        ? { targetTable: "expense_records", targetId: record.id }
        : undefined,
    readOnlyActions: !canVoid && !canSubmitCash,
    financeRecord: {
      kind: "expense",
      sourceType: record.sourceType,
      recordStatus: record.recordStatus,
      cashStatus: record.cashStatus,
      originalCurrency: record.originalCurrency,
      amountJpy: parseApiAmount(record.originalAmountJpy),
      amountCny: parseApiAmount(record.originalAmountCny),
    },
    cells: {
      category,
      businessMonth: record.yearMonth,
      amount,
      cash: cashStatus,
    },
    detail: [
      {
        title: "支出记录",
        lines: [
          { label: "分类", value: category },
          { label: "业务归属", value: businessEntityName },
          { label: "老师", value: record.teacher?.name ?? "-" },
          { label: "原始金额", value: amount },
          { label: "记录状态", value: status.label },
          { label: "Cash 状态", value: cashStatus },
          ...(record.recordStatus === "historical_confirmed"
            ? [{ label: "历史迁移保护", value: "仅保留来源确认事实；不会创建或提交 Cash 请求" }]
            : []),
          { label: "备注", value: record.memo ?? "-" },
        ],
      },
      {
        title: "API 追踪",
        lines: [
          { label: "记录 ID", value: record.id },
          { label: "sourceType", value: record.sourceType },
          { label: "sourceId", value: record.sourceId ?? "-" },
        ],
      },
    ],
  };
}

function mapAccountTransactionToRow(record: AccountTransactionRecord): DataRow {
  const status = getAccountTransactionStatusView(record.status);
  const sourceLabel = getAccountTransactionSourceLabel(record.sourceType);
  const direction = record.direction === "in" ? "入金" : "出金";
  const amount = formatApiCurrencyAmount(record.currency, record.amountJpy, record.amountCny);
  const relatedRecordTitle = record.incomeRecord?.title ?? record.expenseRecord?.title ?? "-";

  return {
    id: `ledger-${record.id}`,
    title: record.title,
    subtitle: `${record.account.name} / ${sourceLabel}`,
    status: status.label,
    tone: status.tone,
    readOnlyActions: true,
    cells: {
      account: record.account.name,
      date: formatApiDate(record.transactionDate),
      direction,
      amount,
    },
    detail: [
      {
        title: "账户流水",
        lines: [
          { label: "账户", value: record.account.name },
          { label: "方向", value: direction },
          { label: "金额", value: amount },
          { label: "来源", value: sourceLabel },
          { label: "关联记录", value: relatedRecordTitle },
          { label: "备注", value: record.memo ?? "-" },
        ],
      },
      {
        title: "API 追踪",
        lines: [
          { label: "流水 ID", value: record.id },
          { label: "sourceType", value: record.sourceType },
          { label: "sourceId", value: record.sourceId ?? "-" },
          { label: "idempotencyKey", value: record.idempotencyKey ?? "-" },
          { label: "externalEventId", value: record.externalEventId ?? "-" },
        ],
      },
    ],
  };
}

function mapReimbursementRecordToRow(record: ReimbursementRecord): DataRow {
  const status = getReimbursementStatusView(record.status);
  const amount = formatApiCurrencyAmount(record.currency, record.amountJpy, record.amountCny);

  return {
    id: `reimbursement-${record.id}`,
    title: record.expenseRecord.title,
    subtitle: `${record.advanceAccount.name} -> ${record.corporateAccount.name}`,
    status: status.label,
    tone: status.tone,
    apiRef: { resource: "reimbursement", id: record.id },
    readOnlyActions: record.status !== "completed",
    reimbursement: { status: record.status },
    cells: {
      advanceAccount: record.advanceAccount.name,
      expense: record.expenseRecord.title,
      amount,
      fromAccount: record.corporateAccount.name,
    },
    detail: [
      {
        title: "报销记录",
        lines: [
          { label: "关联支出", value: record.expenseRecord.title },
          { label: "报销日期", value: formatApiDate(record.reimbursementDate) },
          { label: "报销金额", value: amount },
          { label: "法人出金账户", value: `${record.corporateAccount.name} / ${record.corporateAccount.code}` },
          { label: "垫付入金账户", value: `${record.advanceAccount.name} / ${record.advanceAccount.code}` },
          { label: "状态", value: status.label },
          { label: "备注", value: record.memo ?? "-" },
        ],
      },
      {
        title: "流水联动",
        lines: [
          { label: "法人出金流水", value: `${record.corporateTransactionId} / ${getAccountTransactionStatusView(record.corporateTransaction.status).label}` },
          { label: "垫付入金流水", value: `${record.advanceTransactionId} / ${getAccountTransactionStatusView(record.advanceTransaction.status).label}` },
          { label: "作废时间", value: record.voidedAt ? formatApiDate(record.voidedAt) : "-" },
        ],
      },
    ],
  };
}

function buildReimbursementsPage(basePage: PageConfig, reimbursementApi: FinanceListState): PageConfig {
  if (reimbursementApi.status !== "ready") {
    return basePage;
  }

  const completedCount = reimbursementApi.rows.filter((row) => row.status === "已完成").length;
  const voidedCount = reimbursementApi.rows.filter((row) => row.status === "已作废").length;
  const jpyTotal = reimbursementApi.rows.reduce((total, row) => {
    const amountText = String(row.cells.amount ?? "");
    const numeric = Number(amountText.replace(/[^\d.-]/g, ""));
    return amountText.includes("¥") && Number.isFinite(numeric) && row.status === "已完成" ? total + numeric : total;
  }, 0);

  return {
    ...basePage,
    description: "真实 API 报销列表；从垫付支出生成法人出金和垫付入金，已完成报销可作废",
    batchAction: undefined,
    selectable: false,
    metrics: [
      { label: "报销记录", value: `${reimbursementApi.total} 条`, sub: "来自 dev API", tone: "sky", icon: WalletCards },
      { label: "已完成", value: `${completedCount} 条`, sub: "双边流水已生成", tone: "emerald", icon: CheckCircle2 },
      { label: "已作废", value: `${voidedCount} 条`, sub: "双边流水已冲销", tone: "slate", icon: RotateCcw },
      { label: "JPY 完成额", value: money.jpy(jpyTotal), sub: "当前列表合计", tone: "cyan", icon: Landmark },
    ],
    rows: reimbursementApi.rows,
  };
}

function getReimbursementStatusView(status: string): { label: string; tone: Tone } {
  if (status === "completed") {
    return { label: "已完成", tone: "emerald" };
  }

  if (status === "voided") {
    return { label: "已作废", tone: "slate" };
  }

  return { label: status, tone: "slate" };
}

function getReimbursementCandidateAdvanceTransaction(candidate: ReimbursementCandidateExpenseRecord) {
  return (
    candidate.accountTransactions.find(
      (transaction) =>
        transaction.direction === "out" &&
        transaction.status === "active" &&
        transaction.account.type === "advance" &&
        transaction.account.status === "active",
    ) ?? null
  );
}

function getReimbursementCandidateAmount(candidate: ReimbursementCandidateExpenseRecord) {
  const transaction = getReimbursementCandidateAdvanceTransaction(candidate);

  if (transaction) {
    return formatApiCurrencyAmount(transaction.currency, transaction.amountJpy, transaction.amountCny);
  }

  return formatApiCurrencyAmount(candidate.originalCurrency, candidate.originalAmountJpy, candidate.originalAmountCny);
}

function getMatchingCorporateAccounts(accounts: AccountRecord[], currency: string) {
  return accounts.filter((account) => account.status === "active" && account.type === "corporate" && account.currency === currency);
}

function getDefaultReimbursementCorporateAccountId(
  accounts: AccountRecord[],
  candidate: ReimbursementCandidateExpenseRecord,
) {
  const transaction = getReimbursementCandidateAdvanceTransaction(candidate);
  const currency = transaction?.currency ?? candidate.originalCurrency;

  return getMatchingCorporateAccounts(accounts, currency)[0]?.id ?? "";
}

function getFinancialRecordStatusView(recordStatus: string, cashStatus: string): { label: string; tone: Tone } {
  if (recordStatus === "voided") {
    return { label: "已作废", tone: "slate" };
  }

  if (recordStatus === "historical_confirmed") {
    return { label: "历史已确认", tone: "violet" };
  }

  if (cashStatus === "account_transaction_created") {
    return { label: "已生成流水", tone: "emerald" };
  }

  if (recordStatus === "cash_confirmed" || cashStatus === "cash_confirmed") {
    return { label: "Cash 已确认", tone: "emerald" };
  }

  if (cashStatus === "cash_requested") {
    return { label: "Cash 待确认", tone: "amber" };
  }

  if (cashStatus === "needs_manual_review") {
    return { label: "需要复核", tone: "rose" };
  }

  if (cashStatus === "cash_rejected") {
    return { label: "Cash 已拒绝", tone: "rose" };
  }

  if (cashStatus === "cash_withdrawn") {
    return { label: "Cash 已撤回", tone: "slate" };
  }

  return { label: "待提交 Cash", tone: "amber" };
}

function getCashRequestStatusView(status: string): { label: string; tone: Tone } {
  if (status === "cash_requested") {
    return { label: "Cash 待确认", tone: "amber" };
  }

  if (status === "cash_confirmed") {
    return { label: "Cash 已确认", tone: "emerald" };
  }

  if (status === "account_transaction_created") {
    return { label: "已生成流水", tone: "emerald" };
  }

  if (status === "cash_rejected") {
    return { label: "Cash 已拒绝", tone: "rose" };
  }

  if (status === "cash_withdrawn") {
    return { label: "Cash 已撤回", tone: "slate" };
  }

  if (status === "needs_manual_review") {
    return { label: "需要复核", tone: "rose" };
  }

  return { label: status, tone: "slate" };
}

function getCashInboundStatusView(status: string): { label: string; tone: Tone } {
  if (status === "account_transaction_created") {
    return { label: "已入账", tone: "emerald" };
  }

  if (status === "rejected") {
    return { label: "已冲销", tone: "slate" };
  }

  return { label: status, tone: "slate" };
}

function canVoidManualFinanceRecord(sourceType: string, recordStatus: string, cashStatus: string) {
  const isManualRecord = sourceType === "manual_income" || sourceType === "manual_expense";
  const isPending = recordStatus === "pending";
  const cashIsNotLocked = ["not_requested", "cash_rejected", "cash_withdrawn"].includes(cashStatus);

  return isManualRecord && isPending && cashIsNotLocked;
}

function canVoidExpenseRecord(sourceType: string, recordStatus: string, cashStatus: string) {
  const canVoidManual = canVoidManualFinanceRecord(sourceType, recordStatus, cashStatus);
  const isTeacherWage = sourceType === "teacher_wage_snapshot";
  const isPending = recordStatus === "pending";
  const cashIsNotLocked = ["not_requested", "cash_rejected", "cash_withdrawn"].includes(cashStatus);

  return canVoidManual || (isTeacherWage && isPending && cashIsNotLocked);
}

function canVoidIncomeRecord(sourceType: string, recordStatus: string, cashStatus: string) {
  const canVoidManual = canVoidManualFinanceRecord(sourceType, recordStatus, cashStatus);
  const isTuitionIncome = sourceType === "student_tuition_bill";
  const isPending = recordStatus === "pending";
  const cashIsNotLocked = ["not_requested", "cash_rejected", "cash_withdrawn"].includes(cashStatus);

  return canVoidManual || (isTuitionIncome && isPending && cashIsNotLocked);
}

function canSubmitCashRequest(recordStatus: string, cashStatus: string) {
  return recordStatus === "pending" && ["not_requested", "cash_rejected"].includes(cashStatus);
}

function getAccountTransactionStatusView(status: string): { label: string; tone: Tone } {
  if (status === "reversed") {
    return { label: "已冲销", tone: "slate" };
  }

  return { label: "已入账", tone: "emerald" };
}

function getCashStatusLabel(status: string) {
  const labels: Record<string, string> = {
    not_requested: "未提交",
    cash_requested: "Cash 待确认",
    cash_withdrawn: "Cash 已撤回",
    cash_rejected: "Cash 已拒绝",
    cash_confirmed: "Cash 已确认",
    account_transaction_created: "已生成流水",
    needs_manual_review: "需要复核",
  };

  return labels[status] ?? status;
}

function getIncomeSourceLabel(sourceType: string) {
  const labels: Record<string, string> = {
    student_tuition_bill: "学生学费",
    external_work: "外部授课",
    manual_income: "手动收入",
  };

  return labels[sourceType] ?? sourceType;
}

function getExpenseSourceLabel(sourceType: string) {
  const labels: Record<string, string> = {
    teacher_wage_snapshot: "老师工资",
    manual_expense: "手动支出",
  };

  return labels[sourceType] ?? sourceType;
}

function getCashRequestSourceLabel(sourceType: string) {
  return getIncomeSourceLabel(sourceType) === sourceType ? getExpenseSourceLabel(sourceType) : getIncomeSourceLabel(sourceType);
}

function getConversionMethodLabel(method: string | null) {
  const labels: Record<string, string> = {
    "half-up": "四舍五入",
    ceil: "进位",
    floor: "舍去",
  };

  return method ? labels[method] ?? method : "-";
}

function getCashInboundEventTypeLabel(eventType: string) {
  const labels: Record<string, string> = {
    cash_to_school_corporate_deposit: "Cash 法人账户入金",
  };

  return labels[eventType] ?? eventType;
}

function getAccountTransactionSourceLabel(sourceType: string) {
  const labels: Record<string, string> = {
    manual_account_transaction: "手动流水",
    account_correction: "修正流水",
    account_transfer: "账户调拨",
    cash_inbound_event: "Cash 入站",
    reimbursement_record: "报销",
    manual_income: "手动收入",
    manual_expense: "手动支出",
  };

  return labels[sourceType] ?? sourceType;
}

function formatApiCurrencyAmount(
  currency: string,
  amountJpy: number | string | null | undefined,
  amountCny: number | string | null | undefined,
) {
  const amount = parseApiAmount(currency === "CNY" ? amountCny : amountJpy);

  if (amount === null) {
    return `${currency} -`;
  }

  return currency === "CNY" ? money.cny(amount) : money.jpy(amount);
}

function formatApiJpyAmount(value: number | string | null | undefined) {
  const amount = parseApiAmount(value);

  return amount === null ? "JPY -" : money.jpy(amount);
}

function formatApiCnyAmount(value: number | string | null | undefined) {
  const amount = parseApiAmount(value);

  return amount === null ? "CNY -" : money.cny(amount);
}

function formatReceivedAmounts(
  amountJpy: number | string | null | undefined,
  amountCny: number | string | null | undefined,
) {
  const jpy = parseApiAmount(amountJpy);
  const cny = parseApiAmount(amountCny);
  const parts = [];

  if (jpy && jpy !== 0) {
    parts.push(money.jpy(jpy));
  }

  if (cny && cny !== 0) {
    parts.push(money.cny(cny));
  }

  return parts.length > 0 ? parts.join(" / ") : `${money.jpy(0)} / ${money.cny(0)}`;
}

function parseApiAmount(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatApiDate(value: string) {
  return value.slice(0, 10);
}

function formatApiDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

function formatYearMonth(value: string) {
  const [year, month] = value.split("-");

  return year && month ? `${year}年${month}月` : value;
}

function formatDurationHours(value: number | string | null | undefined) {
  const amount = parseApiAmount(value);

  if (amount === null) {
    return "-";
  }

  return `${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)}H`;
}

function formatTimeRange(start: string | null, end: string | null) {
  if (start && end) {
    return `${start}-${end}`;
  }

  if (start) {
    return `${start}开始`;
  }

  if (end) {
    return `${end}结束`;
  }

  return "未指定具体时间";
}

interface LessonCardData {
  date: string;
  dateSub: string;
  student: string;
  teacher: string;
  subject: string;
  duration: string;
  amount: string;
  businessEntity: string;
  content: string;
  status: string;
  tone: Tone;
}

interface LessonPair {
  id: string;
  planned: LessonCardData;
  actual?: LessonCardData;
  relation: string;
  actionHint: string;
  plannedRecord?: StudentPlannedLessonRecord;
  actualRecord?: StudentActualLessonRecord;
}

type LessonActionKey =
  | "generateActual"
  | "cancelPlanned"
  | "markMakeupPending"
  | "restorePlanned"
  | "deleteFreshPlanned";

type LessonActualDialogState = { pair: LessonPair };

const lessonManagementPage: PageConfig = {
  key: "lesson-management",
  group: "学生链路",
  title: "课时管理",
  description: "预定课时和实际课时左右对应处理；右侧用于生成实际、取消或标记待补课",
  primaryAction: "新增预定课时",
  secondaryAction: "批量生成预定课时",
  icon: CalendarDays,
  metrics: [
    { label: "预定课时", value: "24", sub: "2026年07月", tone: "sky", icon: CalendarDays },
    { label: "实际课时", value: "12", sub: "已生成或已完成", tone: "emerald", icon: ClipboardCheck },
    { label: "待生成实际", value: "8", sub: "右侧操作区处理", tone: "amber", icon: Clock },
    { label: "跨月补课", value: "3", sub: "学生费用归原月，工资归完成月", tone: "cyan", icon: RefreshCw },
  ],
  filters: [
    commonFilters.month,
    commonFilters.student,
    commonFilters.teacher,
    { label: "科目", options: ["EJU日语", "EJU数学", "物理", "化学"] },
    { label: "课时类型", options: ["普通课", "同月补课", "跨月补课"] },
    { label: "对应状态", options: ["无对应实际课时", "已对应", "待补课", "已取消"] },
  ],
  columns: [],
  rows: [],
};

const lessonPairs: LessonPair[] = [
  {
    id: "pair-1",
    relation: "无对应实际课时",
    actionHint: "尚未生成实际课时，可从预定课时直接生成、标记取消或登记补课完成。",
    planned: {
      date: "7.6周",
      dateSub: "第1回 · 未指定具体时间",
      student: "陈加恩",
      teacher: "王亚楠",
      subject: "EJU日语",
      duration: "2H",
      amount: money.jpy(18000),
      businessEntity: "青空进学塾",
      content: "批量生成预定课时",
      status: "待上课",
      tone: "amber",
    },
  },
  {
    id: "pair-2",
    relation: "已对应实际课时",
    actionHint: "实际课时已完成，详情可查看；锁定结算前允许按权限编辑。",
    planned: {
      date: "7.6周",
      dateSub: "第2回 · 未指定具体时间",
      student: "李天伦",
      teacher: "赵天歌",
      subject: "EJU日语",
      duration: "2H",
      amount: money.jpy(26000),
      businessEntity: "个人名义",
      content: "EJU日语R-2-2 作文",
      status: "已对应",
      tone: "emerald",
    },
    actual: {
      date: "2026/07/08",
      dateSub: "18:00-20:00",
      student: "李天伦",
      teacher: "赵天歌",
      subject: "EJU日语",
      duration: "2H",
      amount: money.jpy(26000),
      businessEntity: "个人名义",
      content: "EJU日语R-2-2 作文 / 模板 + 语法写作",
      status: "已上课",
      tone: "emerald",
    },
  },
  {
    id: "pair-3",
    relation: "待补课",
    actionHint: "学生费用仍归属原预定课时月份；补课完成后只影响完成月份老师工资。",
    planned: {
      date: "7.13周",
      dateSub: "第3回 · 未指定具体时间",
      student: "陈红卓",
      teacher: "王亚楠",
      subject: "EJU日语",
      duration: "2H",
      amount: money.jpy(17000),
      businessEntity: "青空进学塾",
      content: "规定上课时间请假，等待跨月补课",
      status: "待补课",
      tone: "cyan",
    },
  },
  {
    id: "pair-4",
    relation: "已取消",
    actionHint: "取消课时不计学生本月课时费，也不进入老师工资。",
    planned: {
      date: "7.13周",
      dateSub: "第4回 · 未指定具体时间",
      student: "林拓海",
      teacher: "吴老师",
      subject: "EJU数学",
      duration: "2H",
      amount: money.jpy(0),
      businessEntity: "短期课程",
      content: "家长取消，本节课不计费",
      status: "已取消",
      tone: "rose",
    },
    actual: {
      date: "2026/07/12",
      dateSub: "-",
      student: "林拓海",
      teacher: "吴老师",
      subject: "EJU数学",
      duration: "0H",
      amount: money.jpy(0),
      businessEntity: "短期课程",
      content: "取消记录，仅保留审计痕迹",
      status: "取消",
      tone: "rose",
    },
  },
];

function LessonFactCard({
  label,
  lesson,
  emptyHint,
}: {
  label: string;
  lesson?: LessonCardData;
  emptyHint?: string;
}) {
  if (!lesson) {
    return (
      <div className="flex h-[76px] min-w-0 flex-col justify-center overflow-hidden rounded-lg border border-dashed border-border bg-white px-3.5 py-2.5">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 text-sm font-semibold text-foreground">尚无实际课时</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground" title={emptyHint}>
          {emptyHint}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[178px] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-white px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
            <StatusPill label={lesson.status} tone={lesson.tone} />
          </div>
          <div className="mt-1 flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-base font-semibold text-foreground">{lesson.date}</span>
            <span className="truncate text-xs text-muted-foreground" title={lesson.dateSub}>
              {lesson.dateSub}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-3 gap-x-4 gap-y-1.5 text-sm">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">学生</div>
          <div className="truncate font-medium text-foreground" title={lesson.student}>
            {lesson.student}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">老师</div>
          <div className="truncate font-medium text-foreground" title={lesson.teacher}>
            {lesson.teacher}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">科目</div>
          <div className="truncate font-medium text-foreground" title={lesson.subject}>
            {lesson.subject}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">业务归属</div>
          <div className="truncate font-medium text-foreground" title={lesson.businessEntity}>
            {lesson.businessEntity}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">时长</div>
          <div className="truncate font-medium text-foreground" title={lesson.duration}>
            {lesson.duration}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">金额</div>
          <div className="truncate font-mono font-semibold text-foreground" title={lesson.amount}>
            {lesson.amount}
          </div>
        </div>
      </div>
      <div className="mt-auto truncate border-t border-border/60 pt-2 text-xs text-muted-foreground" title={lesson.content}>
        内容：{lesson.content}
      </div>
    </div>
  );
}

function getLessonActionAvailability(pair: LessonPair) {
  const planned = pair.plannedRecord;
  const status = planned?.status;
  const hasActual = Boolean(pair.actualRecord || planned?.actualLesson);
  const isCompleted = status === "actual_created" || status === "makeup_completed";
  const isHistoricalImport = Boolean(planned && isHistoricalImportedLesson(planned));
  const canActOnPlanned = Boolean(planned) && !isHistoricalImport && !hasActual && !isCompleted;

  return {
    canGenerateActual: canActOnPlanned && status !== "cancelled",
    canCancel: canActOnPlanned && status !== "cancelled",
    canMarkMakeupPending: canActOnPlanned && status === "scheduled",
    canRestore: canActOnPlanned && (status === "cancelled" || status === "makeup_pending"),
    canDeleteFresh: canActOnPlanned && status === "scheduled",
  };
}

function isHistoricalImportedLesson(lesson: Pick<StudentPlannedLessonRecord | StudentActualLessonRecord, "sourceType">) {
  return lesson.sourceType === "legacy_v2_import";
}

function lessonActionButtonClass(
  variant: "primary" | "danger" | "cyan" | "neutral",
  disabled: boolean,
) {
  const base =
    "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-45";
  const variants = {
    primary: "bg-[#1687D9] text-white hover:bg-[#0f75bd] disabled:hover:bg-[#1687D9]",
    danger: "border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:hover:bg-rose-50",
    cyan: "border border-cyan-100 bg-cyan-50 text-cyan-600 hover:bg-cyan-100 disabled:hover:bg-cyan-50",
    neutral: "border border-border bg-white text-foreground hover:bg-muted disabled:hover:bg-white",
  };

  return `${base} ${variants[variant]}${disabled ? "" : " shadow-sm shadow-black/5"}`;
}

function LessonActionPanel({
  pair,
  compact = false,
  onLessonAction,
  isSubmitting = false,
}: {
  pair: LessonPair;
  compact?: boolean;
  onLessonAction?: (actionKey: LessonActionKey, pair: LessonPair) => void;
  isSubmitting?: boolean;
}) {
  const actions = getLessonActionAvailability(pair);
  const isHistoricalImport = Boolean(pair.plannedRecord && isHistoricalImportedLesson(pair.plannedRecord));
  const disabledTitle = isHistoricalImport
    ? "历史导入课时只读，不能在 Staging 中操作"
    : pair.plannedRecord
      ? "当前状态不能执行该动作"
      : "demo 数据没有后端记录";
  const canCall = Boolean(onLessonAction) && !isSubmitting;
  const plannedStatus = pair.plannedRecord?.status;
  const showGenerateButton = !pair.plannedRecord || plannedStatus !== "cancelled";
  const generateLabel = plannedStatus === "makeup_pending" ? "登记补课完成" : "生成实际";
  const restoreLabel = plannedStatus === "makeup_pending" ? "撤销待补课" : "恢复预定";
  const callAction = (actionKey: LessonActionKey) => {
    if (!canCall) {
      return;
    }

    onLessonAction?.(actionKey, pair);
  };

  return (
    <div className={`h-full overflow-hidden rounded-lg border border-border bg-white px-3.5 ${compact ? "py-2.5" : "py-3"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">实际课时操作</div>
          <div className="mt-0.5 truncate text-sm font-semibold text-foreground">{pair.relation}</div>
        </div>
        <StatusPill
          label={isHistoricalImport ? "历史导入 · 只读" : pair.plannedRecord ? "API" : "demo"}
          tone={isHistoricalImport ? "amber" : pair.plannedRecord ? "emerald" : "slate"}
        />
      </div>
      {!compact && <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{pair.actionHint}</p>}
      <div className={`${compact ? "mt-2" : "mt-3"} flex flex-wrap gap-2`}>
        {showGenerateButton && (
          <button
            type="button"
            disabled={!canCall || !actions.canGenerateActual}
            title={actions.canGenerateActual ? "按预定课时生成实际课时" : disabledTitle}
            onClick={() => callAction("generateActual")}
            className={lessonActionButtonClass("primary", !canCall || !actions.canGenerateActual)}
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            {isSubmitting ? "处理中" : generateLabel}
          </button>
        )}
        {actions.canCancel && (
          <button
            type="button"
            disabled={!canCall}
            title="取消这条预定课时"
            onClick={() => callAction("cancelPlanned")}
            className={lessonActionButtonClass("danger", !canCall)}
          >
            <X className="h-3.5 w-3.5" />
            取消
          </button>
        )}
        {actions.canDeleteFresh && (
          <button
            type="button"
            disabled={!canCall}
            title="仅删除全新且尚未进入任何下游链路的预定课时"
            onClick={() => callAction("deleteFreshPlanned")}
            className={lessonActionButtonClass("danger", !canCall)}
          >
            <X className="h-3.5 w-3.5" />
            删除全新预定
          </button>
        )}
        {actions.canMarkMakeupPending && (
          <button
            type="button"
            disabled={!canCall}
            title="标记为待补课"
            onClick={() => callAction("markMakeupPending")}
            className={lessonActionButtonClass("cyan", !canCall)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            标记待补课
          </button>
        )}
        {actions.canRestore && (
          <button
            type="button"
            disabled={!canCall}
            title={plannedStatus === "makeup_pending" ? "撤销待补课并恢复为待生成实际" : "恢复为待生成实际"}
            onClick={() => callAction("restorePlanned")}
            className={lessonActionButtonClass("neutral", !canCall)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {restoreLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function LessonActualColumn({
  pair,
  onLessonAction,
  isSubmitting,
}: {
  pair: LessonPair;
  onLessonAction?: (actionKey: LessonActionKey, pair: LessonPair) => void;
  isSubmitting?: boolean;
}) {
  if (pair.actual) {
    return <LessonFactCard label="实际课时" lesson={pair.actual} />;
  }

  return (
    <div className="grid h-[178px] grid-rows-[76px_1fr] gap-2">
      <LessonFactCard label="实际课时" emptyHint={`关联：${pair.relation}`} />
      <LessonActionPanel pair={pair} compact onLessonAction={onLessonAction} isSubmitting={isSubmitting} />
    </div>
  );
}

function LessonManagementPage({
  page,
  pairs,
  onPrimary,
  onLessonAction,
  lessonActionSubmittingId,
}: {
  page: PageConfig;
  pairs: LessonPair[];
  onPrimary?: () => void;
  onLessonAction?: (actionKey: LessonActionKey, pair: LessonPair) => void;
  lessonActionSubmittingId?: string | null;
}) {
  return (
    <main className="flex-1 space-y-4 overflow-auto px-6 py-5 pb-16">
      <PageHeader page={page} onPrimary={onPrimary} />
      <FilterPanel filters={page.filters} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {page.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      <section className="rounded-lg border border-border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">课时记录</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">默认左右对应展示；普通列表可作为辅助视角后续补充。</p>
          </div>
          <div className="flex items-center gap-2">
            <ActionButton icon={Layers3} variant="secondary">
              左右对应
            </ActionButton>
            <ActionButton icon={FileText} variant="quiet">
              普通列表
            </ActionButton>
            <ActionButton icon={Download} variant="quiet">
              导出学生课时 PDF
            </ActionButton>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="grid grid-cols-[1fr_1fr] gap-3 px-1 text-xs font-semibold text-muted-foreground">
            <span>预定课时</span>
            <span>实际课时 / 生成实际课时区</span>
          </div>
          {pairs.length > 0 ? (
            pairs.map((pair) => (
              <div className="grid items-stretch gap-3 xl:grid-cols-[1fr_1fr]" key={pair.id}>
                <LessonFactCard label="预定课时" lesson={pair.planned} />
                <LessonActualColumn
                  pair={pair}
                  onLessonAction={onLessonAction}
                  isSubmitting={lessonActionSubmittingId === pair.id}
                />
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              暂无课时记录
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function getCurrentWeekMondayInput() {
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const day = String(monday.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isMondayDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.getUTCDay() === 1;
}

function PlannedLessonCreateModal({
  state,
  students,
  teachers,
  subjects,
  businessEntities,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  state: PlannedLessonDialogState;
  students: StudentRecord[];
  teachers: TeacherRecord[];
  subjects: SubjectRecord[];
  businessEntities: BusinessEntityRecord[];
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: CreatePlannedLessonInput) => void;
}) {
  const activeStudents = students.filter((student) => student.status === "active");
  const activeTeachers = teachers.filter((teacher) => teacher.status === "active");
  const activeSubjects = subjects.filter((subject) => subject.status === "active");
  const operationalEntity = getOperationalBusinessEntity(businessEntities);
  const [studentId, setStudentId] = useState(state.defaultStudentId ?? activeStudents[0]?.id ?? "");
  const [teacherId, setTeacherId] = useState(activeTeachers[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState(activeSubjects[0]?.id ?? "");
  const [weekAnchorDate, setWeekAnchorDate] = useState(getCurrentWeekMondayInput);
  const [lessonNo, setLessonNo] = useState("1");
  const [plannedStartTime, setPlannedStartTime] = useState("10:00");
  const [plannedEndTime, setPlannedEndTime] = useState("11:00");
  const [durationHours, setDurationHours] = useState("1");
  const [plannedFeeJpy, setPlannedFeeJpy] = useState("");
  const [content, setContent] = useState("");
  const [memo, setMemo] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId && activeStudents[0]) setStudentId(activeStudents[0].id);
    if (!teacherId && activeTeachers[0]) setTeacherId(activeTeachers[0].id);
    if (!subjectId && activeSubjects[0]) setSubjectId(activeSubjects[0].id);
  }, [activeStudents, activeTeachers, activeSubjects, studentId, teacherId, subjectId]);

  const durationNumber = Number(durationHours);
  const feeNumber = Number(plannedFeeJpy);
  const lessonNoNumber = lessonNo.trim() ? Number(lessonNo) : null;
  const timePairComplete = Boolean(plannedStartTime) === Boolean(plannedEndTime);
  const timeOrderValid =
    !plannedStartTime || !plannedEndTime || plannedEndTime > plannedStartTime;
  const canSubmit =
    Boolean(studentId && teacherId && subjectId && operationalEntity) &&
    isMondayDateInput(weekAnchorDate) &&
    Number.isFinite(durationNumber) &&
    durationNumber > 0 &&
    durationNumber <= 24 &&
    Number.isInteger(feeNumber) &&
    feeNumber >= 0 &&
    (lessonNoNumber === null || (Number.isInteger(lessonNoNumber) && lessonNoNumber > 0)) &&
    timePairComplete &&
    timeOrderValid;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);

    if (!isMondayDateInput(weekAnchorDate)) {
      setValidationError("周起始日期必须选择周一。");
      return;
    }
    if (!timePairComplete) {
      setValidationError("开始时间和结束时间需要同时填写，或同时留空。");
      return;
    }
    if (!timeOrderValid) {
      setValidationError("结束时间必须晚于开始时间。");
      return;
    }
    if (!canSubmit) {
      setValidationError("请完整填写学生、老师、科目、时长和非负整数课时费。");
      return;
    }

    onSubmit({
      studentId,
      teacherId,
      subjectId,
      weekAnchorDate,
      lessonNo: lessonNoNumber,
      plannedStartTime: normalizeOptionalFormValue(plannedStartTime),
      plannedEndTime: normalizeOptionalFormValue(plannedEndTime),
      durationHours: durationNumber,
      plannedFeeJpy: feeNumber,
      content: normalizeOptionalFormValue(content),
      memo: normalizeOptionalFormValue(memo),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="关闭新增预定课时弹窗" />
      <form
        onSubmit={submit}
        className="relative z-10 flex max-h-[94vh] w-[min(760px,96vw)] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">新增预定课时</h2>
            <p className="mt-1 text-xs text-muted-foreground">正式预定课时会进入学费账单；业务月份由周起始日期确定。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">学生</span>
              <select required value={studentId} onChange={(event) => setStudentId(event.target.value)} className="h-10 w-full min-w-0 truncate rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15">
                <option value="">请选择学生</option>
                {activeStudents.map((student) => <option key={student.id} value={student.id}>{student.name}{student.code ? `（${student.code}）` : ""}</option>)}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">老师</span>
              <select required value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className="h-10 w-full min-w-0 truncate rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15">
                <option value="">请选择老师</option>
                {activeTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}{teacher.code ? `（${teacher.code}）` : ""}</option>)}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">科目</span>
              <select required value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="h-10 w-full min-w-0 truncate rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15">
                <option value="">请选择科目</option>
                {activeSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}（{subject.code}）</option>)}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">周起始日期（周一）</span>
              <input required type="date" value={weekAnchorDate} onChange={(event) => setWeekAnchorDate(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">课时序号</span>
              <input type="number" min="1" step="1" value={lessonNo} onChange={(event) => setLessonNo(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15" placeholder="选填" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">课时数</span>
              <input required type="number" min="0.25" max="24" step="0.25" value={durationHours} onChange={(event) => setDurationHours(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15" />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">开始时间</span>
              <input type="time" value={plannedStartTime} onChange={(event) => setPlannedStartTime(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">结束时间</span>
              <input type="time" value={plannedEndTime} onChange={(event) => setPlannedEndTime(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">预定课时费（JPY）</span>
              <input required type="number" min="0" step="1" value={plannedFeeJpy} onChange={(event) => setPlannedFeeJpy(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 font-mono text-sm outline-none focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15" placeholder="例如：6000" />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">授课内容</span>
            <input value={content} onChange={(event) => setContent(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15" placeholder="选填" />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">备注</span>
            <textarea value={memo} onChange={(event) => setMemo(event.target.value)} className="min-h-[76px] resize-none rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15" placeholder="选填" />
          </label>

          <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">
            业务归属：{operationalEntity?.name ?? "未找到可用运营归属"}。新业务归属由后端固定，不在此处自由选择。
          </div>
          {!activeStudents.length || !activeTeachers.length || !activeSubjects.length ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">需要至少一名有效学生、老师和科目后才能新增预定课时。</div>
          ) : null}
          {(validationError || error) && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{validationError ?? error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/10 px-6 py-4">
          <ActionButton variant="quiet" onClick={onClose}>取消</ActionButton>
          <button type="submit" disabled={isSubmitting || !studentId || !teacherId || !subjectId || !operationalEntity} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#1687D9] px-3 text-xs font-medium text-white transition hover:bg-[#0f74bd] disabled:cursor-not-allowed disabled:bg-[#8cbfe3]">
            {isSubmitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5" />}
            {isSubmitting ? "保存中" : "保存预定课时"}
          </button>
        </div>
      </form>
    </div>
  );
}

function normalizeTimeInputValue(value: string | null) {
  return value ? value.slice(0, 5) : "";
}

function LessonActualFormModal({
  state,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  state: LessonActualDialogState;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: GenerateActualLessonInput) => void;
}) {
  const planned = state.pair.plannedRecord;
  const defaultDuration = planned ? parseApiAmount(planned.durationHours) : null;
  const isMakeup = planned?.status === "makeup_pending";
  const [actualDate, setActualDate] = useState(planned ? formatApiDate(planned.weekAnchorDate) : "");
  const [startTime, setStartTime] = useState(normalizeTimeInputValue(planned?.plannedStartTime ?? null));
  const [endTime, setEndTime] = useState(normalizeTimeInputValue(planned?.plannedEndTime ?? null));
  const [durationHours, setDurationHours] = useState(defaultDuration === null ? "" : String(defaultDuration));
  const [content, setContent] = useState(planned?.content ?? "");
  const [memo, setMemo] = useState(planned?.memo ?? "");
  const [teacherWageEligible, setTeacherWageEligible] = useState(true);
  const actualMonth = actualDate.slice(0, 7);
  const durationNumber = Number(durationHours);
  const isActualDateInPlannedMonth = Boolean(planned && actualMonth === planned.yearMonth);
  const modeLabel = isMakeup ? (isActualDateInPlannedMonth ? "本月补课" : "跨月补课") : "普通实际课时";
  const canSubmit =
    Boolean(planned) &&
    /^\d{4}-\d{2}-\d{2}$/.test(actualDate) &&
    Number.isFinite(durationNumber) &&
    durationNumber > 0 &&
    (isMakeup || isActualDateInPlannedMonth);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    onSubmit({
      actualDate,
      teacherId: planned?.teacherId ?? null,
      startTime: normalizeOptionalFormValue(startTime),
      endTime: normalizeOptionalFormValue(endTime),
      durationHours: durationNumber,
      content: normalizeOptionalFormValue(content),
      memo: normalizeOptionalFormValue(memo),
      teacherWageEligible,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="关闭弹窗" />
      <form
        onSubmit={submit}
        className="relative z-10 flex w-[min(680px,94vw)] flex-col rounded-xl border border-border bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">{isMakeup ? "登记补课完成" : "生成实际课时"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {planned
                ? `${planned.student.name} / ${planned.subject.name} / 原业务月 ${planned.yearMonth}`
                : "请选择来自 dev API 的预定课时"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 px-6 py-5">
          <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 text-xs md:grid-cols-3">
            <div className="min-w-0">
              <div className="text-muted-foreground">老师</div>
              <div className="truncate font-medium text-foreground" title={planned?.teacher.name}>
                {planned?.teacher.name ?? "-"}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-muted-foreground">预定时间</div>
              <div className="truncate font-medium text-foreground">
                {planned
                  ? `${formatApiDate(planned.weekAnchorDate)} ${formatTimeRange(planned.plannedStartTime, planned.plannedEndTime)}`
                  : "-"}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-muted-foreground">处理类型</div>
              <div className="font-medium text-foreground">{modeLabel}</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_96px]">
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">实际日期</span>
              <input
                required
                type="date"
                value={actualDate}
                onChange={(event) => setActualDate(event.target.value)}
                className="h-10 w-full min-w-0 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
              />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">开始</span>
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="h-10 w-full min-w-0 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
              />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">结束</span>
              <input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="h-10 w-full min-w-0 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
              />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">时长</span>
              <input
                required
                min="0.25"
                step="0.25"
                type="number"
                value={durationHours}
                onChange={(event) => setDurationHours(event.target.value)}
                className="h-10 w-full min-w-0 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
              />
            </label>
          </div>

          {!isMakeup && planned && !isActualDateInPlannedMonth && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              普通实际课时的实际日期需要留在原业务月。跨月完成时，请先标记为待补课后再登记补课完成。
            </div>
          )}

          {isMakeup && (
            <div className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
              当前为{modeLabel}。学生费用仍归属原业务月，老师工资按实际日期所在月份归属。
            </div>
          )}

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">实际内容</span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-[76px] resize-none rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
              placeholder="例如：EJU 日语阅读 / 作文讲评"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">备注</span>
            <textarea
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              className="min-h-[64px] resize-none rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
              placeholder="选填"
            />
          </label>

          <div className="rounded-md border border-border bg-muted/10 px-3 py-2">
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={teacherWageEligible}
                onChange={(event) => setTeacherWageEligible(event.target.checked)}
                className="h-4 w-4 rounded border-border text-[#1687D9] focus:ring-[#1687D9]"
              />
              <span className="font-medium">计入老师工资快照</span>
            </label>
            <p className="mt-1 pl-6 text-xs leading-5 text-muted-foreground">
              正式上课和补课通常保持开启；仅在试听、不计薪或纯记录课时时关闭。
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/10 px-6 py-4">
          <ActionButton variant="quiet" onClick={onClose}>
            取消
          </ActionButton>
          <button
            type="submit"
            disabled={isSubmitting || !canSubmit}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#1687D9] px-3 text-xs font-medium text-white transition hover:bg-[#0f74bd] disabled:cursor-not-allowed disabled:bg-[#8cbfe3]"
          >
            {isSubmitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {isSubmitting ? "保存中" : "保存实际课时"}
          </button>
        </div>
      </form>
    </div>
  );
}

interface ExternalWorkLessonData {
  date: string;
  dateSub: string;
  workplace: string;
  instructor: string;
  duration: string;
  wage: string;
  transportation: string;
  content: string;
  status: string;
  tone: Tone;
}

interface ExternalWorkPair {
  id: string;
  relation: string;
  locked: boolean;
  planned: ExternalWorkLessonData;
  actual?: ExternalWorkLessonData;
  detailRow: DataRow;
}

const externalWorkLessonsPage: PageConfig = {
  key: "external-lessons",
  group: "外部授课",
  title: "打工课时",
  description: "外部机构授课独立链路；锁定前可编辑、删除和生成实际课时",
  primaryAction: "新增外部预定课时",
  icon: BookOpen,
  metrics: [
    { label: "预定课时", value: "12 节", sub: "按外部机构管理", tone: "sky", icon: CalendarDays },
    { label: "实际课时", value: "10 节", sub: "用于打工结算", tone: "emerald", icon: CheckCircle2 },
    { label: "待生成实际", value: "2 节", sub: "锁定前可处理", tone: "amber", icon: Clock },
    { label: "已锁定月份", value: "1 个", sub: "只读保护", tone: "slate", icon: LockKeyhole },
  ],
  filters: [commonFilters.month, { label: "授课机构", options: ["早稻田塾", "家庭教师", "夏期讲座"] }, commonFilters.status],
  columns: [],
  rows: [],
};

const externalWorkPairs: ExternalWorkPair[] = [
  {
    id: "external-pair-1",
    relation: "无对应实际课时",
    locked: false,
    planned: {
      date: "2026/07/10",
      dateSub: "18:00-21:00",
      workplace: "早稻田塾",
      instructor: "高若天",
      duration: "3H",
      wage: money.jpy(18000),
      transportation: money.jpy(520),
      content: "EJU日语讲座 / 阅读与作文",
      status: "待生成实际",
      tone: "amber",
    },
    detailRow: {
      id: "external-lesson-1",
      title: "早稻田塾 外部预定课时",
      subtitle: "2026/07/10 18:00-21:00",
      status: "待生成实际",
      tone: "amber",
      cells: {},
      detail: [
        { title: "编辑规则", lines: [{ label: "锁定前", value: "允许编辑、删除和生成实际课时" }, { label: "结算锁定后", value: "只读，不能再改课时" }] },
        { title: "模块边界", lines: [{ label: "学生课时", value: "不关联" }, { label: "老师工资", value: "不关联" }] },
      ],
    },
  },
  {
    id: "external-pair-2",
    relation: "已对应实际课时",
    locked: false,
    planned: {
      date: "2026/07/12",
      dateSub: "13:00-16:00",
      workplace: "早稻田塾",
      instructor: "高若天",
      duration: "3H",
      wage: money.jpy(18000),
      transportation: money.jpy(520),
      content: "EJU日语讲座 / 语法演习",
      status: "已对应",
      tone: "emerald",
    },
    actual: {
      date: "2026/07/12",
      dateSub: "13:00-16:00",
      workplace: "早稻田塾",
      instructor: "高若天",
      duration: "3H",
      wage: money.jpy(18000),
      transportation: money.jpy(520),
      content: "EJU日语讲座 / 语法演习完成",
      status: "实际完成",
      tone: "emerald",
    },
    detailRow: {
      id: "external-lesson-2",
      title: "早稻田塾 外部课时",
      subtitle: "预定课时已生成实际课时",
      status: "实际完成",
      tone: "emerald",
      cells: {},
      detail: [
        { title: "工资预览", lines: [{ label: "课时工资", value: money.jpy(18000) }, { label: "交通费", value: money.jpy(520) }] },
        { title: "结算影响", lines: [{ label: "打工结算", value: "进入早稻田塾 2026-07 结算预览" }] },
      ],
    },
  },
  {
    id: "external-pair-3",
    relation: "已锁定，只读",
    locked: true,
    planned: {
      date: "2026/06/21",
      dateSub: "14:00-17:00",
      workplace: "早稻田塾",
      instructor: "高若天",
      duration: "3H",
      wage: money.jpy(18000),
      transportation: money.jpy(520),
      content: "6月外部授课结算已锁定",
      status: "结算锁定",
      tone: "slate",
    },
    actual: {
      date: "2026/06/21",
      dateSub: "14:00-17:00",
      workplace: "早稻田塾",
      instructor: "高若天",
      duration: "3H",
      wage: money.jpy(18000),
      transportation: money.jpy(520),
      content: "锁定快照已生成，当前课时只读",
      status: "结算锁定",
      tone: "slate",
    },
    detailRow: {
      id: "external-lesson-3",
      title: "早稻田塾 6月外部课时",
      subtitle: "结算锁定后只读",
      status: "结算锁定",
      tone: "slate",
      cells: {},
      detail: [
        { title: "保护规则", lines: [{ label: "锁定后", value: "禁止新增、编辑、删除预定和实际课时" }, { label: "收入确认后", value: "整条链路只读" }] },
      ],
    },
  },
];

function ExternalWorkFactCard({
  label,
  lesson,
  emptyHint,
  actions,
}: {
  label: string;
  lesson?: ExternalWorkLessonData;
  emptyHint?: string;
  actions?: ReactNode;
}) {
  if (!lesson) {
    return (
      <div className="flex h-full min-h-[140px] flex-col justify-between rounded-lg border border-dashed border-border bg-white px-3.5 py-3">
        <div>
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="mt-1 text-sm font-semibold text-foreground">尚无实际课时</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{emptyHint}</div>
        </div>
        {actions && <div className="mt-3 border-t border-border/60 pt-2">{actions}</div>}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[140px] flex-col rounded-lg border border-border bg-white px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            <StatusPill label={lesson.status} tone={lesson.tone} />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-base font-semibold text-foreground">{lesson.date}</span>
            <span className="text-xs text-muted-foreground">{lesson.dateSub}</span>
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-1.5 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">机构</div>
          <div className="font-medium text-foreground">{lesson.workplace}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">授课人</div>
          <div className="font-medium text-foreground">{lesson.instructor}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">时长</div>
          <div className="font-medium text-foreground">{lesson.duration}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">工资预览</div>
          <div className="font-mono font-semibold text-foreground">{lesson.wage}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">交通费</div>
          <div className="font-mono font-semibold text-foreground">{lesson.transportation}</div>
        </div>
      </div>
      <div className="mt-auto truncate border-t border-border/60 pt-2 text-xs text-muted-foreground">内容：{lesson.content}</div>
    </div>
  );
}

function ExternalWorkInlineActions({
  pair,
  onOpenDetail,
  compact = false,
}: {
  pair: ExternalWorkPair;
  onOpenDetail: (row: DataRow) => void;
  compact?: boolean;
}) {
  const buttonBase =
    "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {pair.locked ? (
        <span className={`${buttonBase} border border-border bg-muted text-muted-foreground`}>
          <LockKeyhole className="h-3.5 w-3.5" />
          {compact ? "只读" : "锁定后只读"}
        </span>
      ) : (
        <>
          {!pair.actual && (
            <button className={`${buttonBase} bg-[#1687D9] text-white hover:bg-[#0f74bd]`}>
              <ClipboardCheck className="h-3.5 w-3.5" />
              生成实际
            </button>
          )}
          <button className={`${buttonBase} border border-border bg-white text-foreground hover:bg-muted`}>
            <PencilLine className="h-3.5 w-3.5" />
            编辑
          </button>
          <button className={`${buttonBase} border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`}>
            <X className="h-3.5 w-3.5" />
            删除
          </button>
        </>
      )}
      <button
        className={`${buttonBase} border border-border bg-white text-foreground hover:bg-muted`}
        onClick={() => onOpenDetail(pair.detailRow)}
      >
        <Eye className="h-3.5 w-3.5" />
        {compact ? "详情" : "查看详情"}
      </button>
    </div>
  );
}

function ExternalWorkActualColumn({
  pair,
  onOpenDetail,
}: {
  pair: ExternalWorkPair;
  onOpenDetail: (row: DataRow) => void;
}) {
  if (pair.actual) {
    return (
      <ExternalWorkFactCard
        label="实际课时"
        lesson={pair.actual}
        actions={<ExternalWorkInlineActions pair={pair} onOpenDetail={onOpenDetail} compact />}
      />
    );
  }

  return (
    <ExternalWorkFactCard
      label="实际课时"
      emptyHint={`关联：${pair.relation}`}
      actions={<ExternalWorkInlineActions pair={pair} onOpenDetail={onOpenDetail} />}
    />
  );
}

function ExternalWorkLessonsPage({
  page,
  pairs,
  onOpenDetail,
}: {
  page: PageConfig;
  pairs: ExternalWorkPair[];
  onOpenDetail: (row: DataRow) => void;
}) {
  return (
    <main className="flex-1 space-y-4 overflow-auto px-6 py-5 pb-16">
      <PageHeader page={page} />
      <FilterPanel filters={page.filters} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {page.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      <section className="rounded-lg border border-border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">外部课时记录</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              外部授课也按预定 / 实际左右配对；结算锁定前允许编辑和删除，锁定后只读。
            </p>
          </div>
          <ActionButton icon={Layers3} variant="secondary">
            左右对应
          </ActionButton>
        </div>
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-[1fr_1fr] gap-3 px-1 text-xs font-semibold text-muted-foreground">
            <span>外部预定课时</span>
            <span>外部实际课时 / 生成实际课时区</span>
          </div>
          {pairs.length > 0 ? (
            pairs.map((pair) => (
              <div className="grid gap-3 xl:grid-cols-[1fr_1fr]" key={pair.id}>
                <ExternalWorkFactCard label="预定课时" lesson={pair.planned} />
                <ExternalWorkActualColumn pair={pair} onOpenDetail={onOpenDetail} />
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              暂无外部课时记录
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

const pages: Record<string, PageConfig> = {
  quote: {
    key: "quote",
    group: "签约前",
    title: "报价单",
    description: "签约前费用预估，按周锚点和月份拆分展示，不直接写入正式课时",
    primaryAction: "新增报价",
    secondaryAction: "导出 PDF",
    icon: FileText,
    batchAction: "export",
    metrics: [
      { label: "本月生成", value: "8 份", sub: "未来 4-5 个月规划为主", tone: "sky", icon: FileText },
      { label: "待确认", value: "3 份", sub: "学生侧沟通中", tone: "amber", icon: Clock },
      { label: "已转签约", value: "2 份", sub: "仍需独立生成正式课时", tone: "emerald", icon: BadgeCheck },
      { label: "平均周期", value: "18 周", sub: "按周一日期归属月份", tone: "cyan", icon: CalendarDays },
    ],
    filters: [commonFilters.month, commonFilters.student, commonFilters.status],
    columns: [
      { key: "period", label: "报价周期", wide: true },
      { key: "subjects", label: "科目顺序", wide: true },
      { key: "amount", label: "参考合计", align: "right" },
      { key: "owner", label: "负责人" },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "quote-1",
        title: "王小明 7-11月课程报价",
        subtitle: "日语 / 数学 / 物理",
        status: "待确认",
        tone: "amber",
        cells: {
          period: "2026-07-06 至 2026-11-23",
          subjects: "日语 -> 数学 -> 物理",
          amount: money.cny(18320),
          owner: "销售负责人",
        },
        detail: [
          {
            title: "报价口径",
            lines: [
              { label: "周锚点", value: "每周周一日期" },
              { label: "跨月归属", value: "按周一所在月份" },
              { label: "正式边界", value: "不等于正式预定课时" },
            ],
          },
        ],
      },
      {
        id: "quote-2",
        title: "陈美咲 夏期强化报价",
        subtitle: "日语 / 化学",
        status: "已转签约",
        tone: "emerald",
        cells: {
          period: "2026-07-13 至 2026-09-28",
          subjects: "日语 -> 化学",
          amount: money.cny(9450),
          owner: "销售负责人",
        },
        detail: [
          {
            title: "报价口径",
            lines: [
              { label: "周内多次", value: "同一周锚点连续编号" },
              { label: "课程编号", value: "每门课程独立累计" },
            ],
          },
        ],
      },
    ],
  },
  contract: {
    key: "contract",
    group: "签约前",
    title: "合同草稿",
    description: "合同生成仍作为签约前独立模块，暂不进入 V3.0 主链路写入",
    primaryAction: "生成草稿",
    secondaryAction: "导出 PDF",
    icon: FileCheck2,
    batchAction: "export",
    metrics: [
      { label: "草稿", value: "5 份", sub: "等待内容确认", tone: "amber", icon: FileCheck2 },
      { label: "已发送", value: "4 份", sub: "本月", tone: "sky", icon: Send },
      { label: "已签约", value: "2 人", sub: "进入课时生成", tone: "emerald", icon: BadgeCheck },
      { label: "需修订", value: "1 份", sub: "付款条款复核", tone: "rose", icon: PencilLine },
    ],
    filters: [commonFilters.month, commonFilters.student, commonFilters.status],
    columns: [
      { key: "type", label: "合同类型" },
      { key: "period", label: "课程期间", wide: true },
      { key: "amount", label: "约定金额", align: "right" },
      { key: "owner", label: "负责人" },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "contract-1",
        title: "王小明 正式课程合同",
        subtitle: "基于 7-11月报价",
        status: "草稿",
        tone: "amber",
        cells: {
          type: "常规课程",
          period: "2026-07 至 2026-11",
          amount: money.cny(18320),
          owner: "销售负责人",
        },
        detail: [
          { title: "合同信息", lines: [{ label: "来源", value: "报价单确认后生成" }, { label: "写入边界", value: "不直接创建正式课时" }] },
        ],
      },
    ],
  },
  "course-plan": {
    key: "course-plan",
    group: "签约前",
    title: "课程计划",
    description: "长期计划草稿可作为未来批量生成预定课时的来源，当前 demo 仅做草稿展示",
    primaryAction: "新增计划",
    secondaryAction: "预览课时",
    icon: Layers3,
    batchAction: "lock",
    metrics: [
      { label: "计划草稿", value: "6 份", sub: "未生成正式课时", tone: "sky", icon: Layers3 },
      { label: "待检查冲突", value: "2 份", sub: "老师与课程频次", tone: "amber", icon: ShieldCheck },
      { label: "可生成", value: "3 份", sub: "等待确认", tone: "emerald", icon: CheckCircle2 },
      { label: "最长周期", value: "24 周", sub: "支持跨多个月", tone: "cyan", icon: CalendarDays },
    ],
    filters: [commonFilters.month, commonFilters.student, commonFilters.teacher, commonFilters.status],
    columns: [
      { key: "weekly", label: "每周安排" },
      { key: "subjects", label: "课程", wide: true },
      { key: "period", label: "期间", wide: true },
      { key: "conflict", label: "检查结果" },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "plan-1",
        title: "王小明 秋季长期计划",
        subtitle: "签约后课时生成候选",
        status: "可生成",
        tone: "emerald",
        cells: {
          weekly: "每周 4 次",
          subjects: "日语 2 / 数学 1 / 物理 1",
          period: "2026-09-07 至 2027-02-22",
          conflict: "无冲突",
        },
        detail: [
          { title: "计划边界", lines: [{ label: "数据性质", value: "草稿" }, { label: "生成保护", value: "预览、确认、去重、冲突检查后生成" }] },
        ],
      },
    ],
  },
  students: {
    key: "students",
    group: "学生链路",
    title: "学生管理",
    description: "学生基础资料、业务归属和运营状态入口",
    primaryAction: "新增学生",
    icon: Users,
    metrics: [
      { label: "在读学生", value: "24 人", sub: "含 3 人短期课程", tone: "sky", icon: Users },
      { label: "本月新增", value: "4 人", sub: "2 人已进入预定课时", tone: "emerald", icon: BadgeCheck },
      { label: "待补资料", value: "3 人", sub: "联系人或付款信息", tone: "amber", icon: FileText },
      { label: "停课/结课", value: "2 人", sub: "保留历史结算", tone: "slate", icon: LockKeyhole },
    ],
    filters: [commonFilters.month, commonFilters.student, commonFilters.entity, commonFilters.status],
    columns: [
      { key: "entity", label: "业务归属" },
      { key: "grade", label: "年级" },
      { key: "subjects", label: "课程", wide: true },
      { key: "billing", label: "学费方式" },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "student-1",
        title: "王小明",
        subtitle: "家长付款 · CNY",
        status: "在读",
        tone: "emerald",
        cells: {
          entity: "青空塾",
          grade: "高二",
          subjects: "日语 / 数学 / 物理",
          billing: "月初按预定课时",
        },
        detail: [
          { title: "学生资料", lines: [{ label: "业务归属", value: "青空塾" }, { label: "收费币种", value: "CNY" }] },
        ],
      },
      {
        id: "student-2",
        title: "陈美咲",
        subtitle: "本人付款 · JPY",
        status: "资料待补",
        tone: "amber",
        cells: {
          entity: "短期课程",
          grade: "高三",
          subjects: "日语 / 化学",
          billing: "月初按预定课时",
        },
        detail: [
          { title: "学生资料", lines: [{ label: "业务归属", value: "短期课程" }, { label: "待补内容", value: "紧急联系人" }] },
        ],
      },
    ],
  },
  "planned-lessons": {
    key: "planned-lessons",
    group: "学生链路",
    title: "预定课时",
    description: "正式学费生成基础，来源可手动新增或由长期计划生成",
    primaryAction: "新增预定课时",
    secondaryAction: "批量生成",
    icon: CalendarDays,
    batchAction: "lock",
    metrics: [
      { label: "7月预定", value: "168 节", sub: "正式学费基础", tone: "sky", icon: CalendarDays },
      { label: "计划生成", value: "96 节", sub: "来自课程计划", tone: "cyan", icon: Layers3 },
      { label: "手动新增", value: "8 节", sub: "临时加课", tone: "violet", icon: SquarePen },
      { label: "已取消", value: "5 节", sub: "不计学费", tone: "rose", icon: X },
    ],
    filters: [commonFilters.month, commonFilters.student, commonFilters.teacher, commonFilters.status],
    columns: [
      { key: "date", label: "日期" },
      { key: "subject", label: "科目" },
      { key: "teacher", label: "老师" },
      { key: "duration", label: "时长" },
      { key: "fee", label: "课时费", align: "right" },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "planned-1",
        title: "王小明",
        subtitle: "来自秋季长期计划",
        status: "已预定",
        tone: "sky",
        cells: {
          date: "2026-07-06",
          subject: "日语",
          teacher: "高若天",
          duration: "90 分钟",
          fee: money.jpy(9000),
        },
        detail: [
          { title: "来源追踪", lines: [{ label: "生成方式", value: "课程计划生成" }, { label: "正式性", value: "正式预定课时" }] },
        ],
      },
      {
        id: "planned-2",
        title: "陈美咲",
        subtitle: "临时加课",
        status: "已预定",
        tone: "sky",
        cells: {
          date: "2026-07-08",
          subject: "化学",
          teacher: "田中さくら",
          duration: "120 分钟",
          fee: money.jpy(12000),
        },
        detail: [
          { title: "来源追踪", lines: [{ label: "生成方式", value: "手动新增" }, { label: "用途", value: "进入当月学费账单" }] },
        ],
      },
      {
        id: "planned-3",
        title: "林拓海",
        subtitle: "家长取消",
        status: "已取消",
        tone: "rose",
        cells: {
          date: "2026-07-10",
          subject: "数学",
          teacher: "吴老师",
          duration: "90 分钟",
          fee: money.jpy(0),
        },
        detail: [
          { title: "费用影响", lines: [{ label: "学生学费", value: "不计入" }, { label: "老师工资", value: "不计入" }] },
        ],
      },
    ],
  },
  "actual-lessons": {
    key: "actual-lessons",
    group: "学生链路",
    title: "实际课时",
    description: "上课、请假、取消和跨月补课的执行事实，影响学生结算和老师工资",
    primaryAction: "登记实际课时",
    icon: ClipboardCheck,
    batchAction: "lock",
    metrics: [
      { label: "已完成", value: "142 节", sub: "6月实际记录", tone: "emerald", icon: CheckCircle2 },
      { label: "同月补课", value: "6 节", sub: "费用不变", tone: "cyan", icon: RefreshCw },
      { label: "跨月待补", value: "3 节", sub: "老师工资后置", tone: "amber", icon: Clock },
      { label: "取消", value: "4 节", sub: "学生学费减少", tone: "rose", icon: X },
    ],
    filters: [commonFilters.month, commonFilters.student, commonFilters.teacher, commonFilters.status],
    columns: [
      { key: "date", label: "上课日" },
      { key: "subject", label: "科目" },
      { key: "teacher", label: "老师" },
      { key: "studentFee", label: "学生费用" },
      { key: "teacherWage", label: "老师工资" },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "actual-1",
        title: "王小明",
        subtitle: "日语 · 原预定课时",
        status: "正常完成",
        tone: "emerald",
        cells: {
          date: "2026-06-08",
          subject: "日语",
          teacher: "高若天",
          studentFee: "正常计入",
          teacherWage: "计入 6月",
        },
        detail: [
          { title: "费用口径", lines: [{ label: "学生侧", value: "计入原预定月份" }, { label: "老师侧", value: "计入实际完成月份" }] },
        ],
      },
      {
        id: "actual-2",
        title: "陈美咲",
        subtitle: "数学 · 6月请假 7月补课",
        status: "跨月补课完成",
        tone: "cyan",
        cells: {
          date: "2026-07-03",
          subject: "数学",
          teacher: "田中さくら",
          studentFee: "6月已计费",
          teacherWage: "计入 7月",
        },
        detail: [
          { title: "跨月补课", lines: [{ label: "学生费用", value: "归属原预定课时月份" }, { label: "老师工资", value: "归属补课完成月份" }] },
        ],
      },
      {
        id: "actual-3",
        title: "林拓海",
        subtitle: "物理 · 当日取消",
        status: "取消",
        tone: "rose",
        cells: {
          date: "2026-06-14",
          subject: "物理",
          teacher: "吴老师",
          studentFee: "不计入",
          teacherWage: "不计入",
        },
        detail: [
          { title: "取消处理", lines: [{ label: "学生结算", value: "减少本月课时费" }, { label: "老师工资", value: "不生成工资明细" }] },
        ],
      },
    ],
  },
  "tuition-bills": {
    key: "tuition-bills",
    group: "学生链路",
    title: "学费账单",
    description: "按学生和月份生成，来源为预定课时 JPY 加上上月冻结 CNY 结转",
    primaryAction: "生成账单",
    secondaryAction: "通知预览",
    icon: ReceiptText,
    batchAction: "cash",
    metrics: [
      { label: "7月应收", value: money.jpy(840000), sub: "预定课时 JPY 基准", tone: "sky", icon: ReceiptText },
      { label: "CNY 结转", value: money.cny(126.35), sub: "来自上月锁定结算", tone: "cyan", icon: RefreshCw },
      { label: "待生成收入", value: "5 人", sub: "账单已锁定", tone: "amber", icon: Clock },
      { label: "Cash 已确认", value: "12 人", sub: "本月学费", tone: "emerald", icon: CheckCircle2 },
    ],
    filters: [commonFilters.month, commonFilters.student, commonFilters.status],
    columns: [
      { key: "planned", label: "预定课时金额", align: "right" },
      { key: "carryover", label: "CNY 结转", align: "right" },
      { key: "notice", label: "通知金额", align: "right" },
      { key: "income", label: "收入记录" },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "bill-1",
        title: "王小明",
        subtitle: "2026年07月学费",
        status: "待提交 Cash",
        tone: "amber",
        cells: {
          planned: money.jpy(72000),
          carryover: money.cny(0),
          notice: money.cny(3443.04),
          income: "已生成收入记录",
        },
        cashPreview: {
          sourceAmount: money.jpy(72000),
          exchangeRate: "0.04782",
          method: "四舍五入到 0.01 CNY",
          requestedAmount: money.cny(3443.04),
          account: "支付宝主账户",
        },
        detail: [
          { title: "账单构成", lines: [{ label: "预定课时", value: money.jpy(72000) }, { label: "上月结转", value: money.cny(0) }] },
          { title: "通知预览", lines: [{ label: "参考汇率", value: "0.04782" }, { label: "通知金额", value: money.cny(3443.04) }] },
        ],
      },
      {
        id: "bill-2",
        title: "陈美咲",
        subtitle: "2026年07月学费",
        status: "已确认",
        tone: "emerald",
        cells: {
          planned: money.jpy(60000),
          carryover: money.cny(126.35),
          notice: money.cny(2995.55),
          income: "Cash 已确认",
        },
        cashPreview: {
          sourceAmount: money.jpy(60000),
          exchangeRate: "0.04782",
          method: "四舍五入到 0.01 CNY",
          requestedAmount: money.cny(2995.55),
          account: "支付宝主账户",
        },
        detail: [
          { title: "账单构成", lines: [{ label: "预定课时", value: money.jpy(60000) }, { label: "上月结转", value: money.cny(126.35) }] },
        ],
      },
    ],
  },
  "student-settlements": {
    key: "student-settlements",
    group: "学生链路",
    title: "月度结算",
    description: "按学生和月份锁定实际课时费、收款结果和下月 CNY 结转",
    primaryAction: "批量检查 / 锁定",
    secondaryAction: "生成本月预览",
    icon: ClipboardCheck,
    batchAction: "lock",
    metrics: [
      { label: "待锁定", value: "3 人", sub: "6月课时已处理", tone: "amber", icon: Clock },
      { label: "已锁定", value: "18 人", sub: "可进入下月账单", tone: "emerald", icon: LockKeyhole },
      { label: "本月结转", value: money.cny(126.35), sub: "仅 CNY，不反算 JPY", tone: "cyan", icon: RefreshCw },
      { label: "需复核", value: "1 人", sub: "大额差额", tone: "rose", icon: ShieldCheck },
    ],
    filters: [commonFilters.month, commonFilters.student, commonFilters.status],
    columns: [
      { key: "actualFee", label: "实际课时费", align: "right" },
      { key: "received", label: "已收金额", align: "right" },
      { key: "difference", label: "差额", align: "right" },
      { key: "carryover", label: "下月结转", align: "right" },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "settlement-1",
        title: "王小明",
        subtitle: "2026年06月结算",
        status: "待锁定",
        tone: "amber",
        cells: {
          actualFee: money.jpy(72000),
          received: money.cny(3443.04),
          difference: money.cny(0),
          carryover: money.cny(0),
        },
        detail: [
          { title: "结算保护", lines: [{ label: "预览金额", value: "服务端口径" }, { label: "锁定后", value: "进入下月账单结转来源" }] },
        ],
      },
      {
        id: "settlement-2",
        title: "陈美咲",
        subtitle: "2026年06月结算",
        status: "已锁定",
        tone: "emerald",
        cells: {
          actualFee: money.jpy(58000),
          received: money.cny(2650),
          difference: money.cny(126.35),
          carryover: money.cny(126.35),
        },
        detail: [
          { title: "结转", lines: [{ label: "结转币种", value: "CNY" }, { label: "下月账单", value: "JPY 学费 + CNY 结转" }] },
        ],
      },
    ],
  },
  teachers: {
    key: "teachers",
    group: "老师链路",
    title: "老师管理",
    description: "老师基础资料、可授科目、启用状态和当前生效规则概览",
    primaryAction: "新增老师",
    icon: GraduationCap,
    metrics: [
      { label: "合作老师", value: "8 人", sub: "含兼职与固定老师", tone: "emerald", icon: GraduationCap },
      { label: "工资规则", value: "12 条", sub: "按课程或业务归属", tone: "sky", icon: FileText },
      { label: "待补信息", value: "1 人", sub: "收款账户", tone: "amber", icon: ShieldCheck },
      { label: "停用", value: "2 人", sub: "保留历史工资", tone: "slate", icon: LockKeyhole },
    ],
    filters: [commonFilters.teacher, commonFilters.entity, commonFilters.status],
    columns: [
      { key: "entity", label: "业务归属" },
      { key: "subjects", label: "可授科目", wide: true },
      { key: "rule", label: "工资规则" },
      { key: "account", label: "收款方式" },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "teacher-1",
        title: "高若天",
        subtitle: "日语 / 数学",
        status: "启用",
        tone: "emerald",
        cells: {
          entity: "青空塾 / 短期课程",
          subjects: "日语、数学、物理",
          rule: "按课时",
          account: "Cash 支付",
        },
        detail: [{ title: "老师资料", lines: [{ label: "结算方式", value: "按月工资快照" }] }],
      },
    ],
  },
  "teacher-rules": {
    key: "teacher-rules",
    group: "老师链路",
    title: "工资规则",
    description: "独立维护工资计算规则、适用业务归属、适用科目和生效期间",
    primaryAction: "新增工资规则",
    icon: FileText,
    metrics: [
      { label: "生效规则", value: "12 条", sub: "按老师 / 业务归属 / 科目", tone: "sky", icon: FileText },
      { label: "待确认", value: "2 条", sub: "新规则草稿", tone: "amber", icon: Clock },
      { label: "即将到期", value: "1 条", sub: "需要续设", tone: "rose", icon: ShieldCheck },
      { label: "已停用", value: "4 条", sub: "保留历史结算依据", tone: "slate", icon: LockKeyhole },
    ],
    filters: [commonFilters.teacher, commonFilters.entity, { label: "科目", options: ["EJU日语", "EJU数学", "物理", "化学"] }, commonFilters.status],
    columns: [
      { key: "teacher", label: "老师" },
      { key: "entity", label: "业务归属" },
      { key: "subject", label: "适用科目" },
      { key: "rate", label: "规则口径" },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "rule-1",
        title: "高若天 / 青空塾",
        subtitle: "EJU日语 · 2026年04月起",
        status: "生效中",
        tone: "emerald",
        cells: {
          teacher: "高若天",
          entity: "青空塾",
          subject: "EJU日语",
          rate: "按课时费比例 / 后端规则",
        },
        detail: [
          { title: "规则边界", lines: [{ label: "编辑入口", value: "工资规则模块" }, { label: "使用位置", value: "工资快照生成时读取" }] },
          { title: "审计要求", lines: [{ label: "历史结算", value: "使用快照规则，不受新规则覆盖" }] },
        ],
      },
      {
        id: "rule-2",
        title: "田中さくら / 短期课程",
        subtitle: "化学 · 夏期讲座",
        status: "待确认",
        tone: "amber",
        cells: {
          teacher: "田中さくら",
          entity: "短期课程",
          subject: "化学",
          rate: "固定课时单价 / 后端规则",
        },
        detail: [
          { title: "规则边界", lines: [{ label: "状态", value: "确认后才参与工资快照" }] },
        ],
      },
    ],
  },
  "teacher-wages": {
    key: "teacher-wages",
    group: "老师链路",
    title: "工资结算",
    description: "按老师、月份和业务归属生成工资快照，调整确认后生成支出记录",
    primaryAction: "生成 / 更新工资快照",
    secondaryAction: "导出勤务表",
    icon: GraduationCap,
    batchAction: "export",
    metrics: [
      { label: "工资快照", value: "6 份", sub: "老师 + 月份 + 业务归属", tone: "sky", icon: FileText },
      { label: "待调整", value: "3 份", sub: "交通费 / 教室费", tone: "amber", icon: PencilLine },
      { label: "已生成支出", value: "4 份", sub: "School 侧不聚合", tone: "emerald", icon: ReceiptText },
      { label: "待生成支出", value: "2 份", sub: "确认调整后生成", tone: "cyan", icon: Clock },
    ],
    filters: [commonFilters.month, commonFilters.teacher, commonFilters.entity, commonFilters.status],
    columns: [
      { key: "entity", label: "业务归属" },
      { key: "lessons", label: "结算课时" },
      { key: "adjustments", label: "交通/教室费", align: "right" },
      { key: "amount", label: "工资金额", align: "right" },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "wage-1",
        title: "高若天",
        subtitle: "2026年06月工资",
        status: "待生成支出",
        tone: "amber",
        cells: {
          entity: "青空塾",
          lessons: "18 节",
          adjustments: money.cny(1254),
          amount: money.cny(1254),
        },
        detail: [
          { title: "工资快照", lines: [{ label: "业务归属", value: "青空塾" }, { label: "调整对象", value: "交通费、教室费、结算课时" }] },
          { title: "支出记录", lines: [{ label: "School 粒度", value: "按业务归属分别生成" }, { label: "后续 Cash", value: "在支出记录模块操作" }] },
        ],
      },
      {
        id: "wage-2",
        title: "高若天",
        subtitle: "2026年06月工资",
        status: "待生成支出",
        tone: "amber",
        cells: {
          entity: "短期课程",
          lessons: "22 节",
          adjustments: money.cny(2675),
          amount: money.cny(2675),
        },
        detail: [
          { title: "工资快照", lines: [{ label: "业务归属", value: "短期课程" }, { label: "支出记录", value: "单独生成，不在 School 聚合" }] },
        ],
      },
    ],
  },
  "wage-import": {
    key: "wage-import",
    group: "老师链路",
    title: "勤务表导入",
    description: "保留 Excel 作为主要过渡方式，系统读取交通费和教室费后重新确认工资金额",
    primaryAction: "上传回传文件",
    secondaryAction: "下载勤务表",
    icon: Download,
    batchAction: "export",
    metrics: [
      { label: "已导出", value: "6 份", sub: "老师填写交通费/教室费", tone: "sky", icon: Download },
      { label: "已回收", value: "4 份", sub: "等待导入确认", tone: "cyan", icon: FileCheck2 },
      { label: "已导入待确认", value: "2 份", sub: "费用已写回快照", tone: "amber", icon: RefreshCw },
      { label: "调整已确认", value: "3 份", sub: "可生成支出", tone: "emerald", icon: CheckCircle2 },
    ],
    filters: [commonFilters.month, commonFilters.teacher, commonFilters.status],
    columns: [
      { key: "exported", label: "导出时间" },
      { key: "returned", label: "回收时间" },
      { key: "transport", label: "交通费", align: "right" },
      { key: "classroom", label: "教室费", align: "right" },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "import-1",
        title: "高若天",
        subtitle: "2026年06月勤务表",
        status: "已导入待确认",
        tone: "amber",
        cells: {
          exported: "2026-07-01 09:12",
          returned: "2026-07-02 18:20",
          transport: money.cny(420),
          classroom: money.cny(180),
        },
        detail: [
          { title: "导入范围", lines: [{ label: "读取字段", value: "交通费、教室费" }, { label: "结算课时", value: "系统内手动调整" }] },
          { title: "文件状态", lines: [{ label: "导出文件", value: "高若天_2026-06_勤务表.xlsx" }, { label: "回传文件", value: "高若天_交通费教室费_已填写.xlsx" }] },
        ],
      },
    ],
  },
  "external-lessons": {
    key: "external-lessons",
    group: "外部授课",
    title: "打工课时",
    description: "外部机构授课独立链路；锁定前可编辑、删除和生成实际课时",
    primaryAction: "新增外部预定课时",
    icon: BookOpen,
    metrics: [
      { label: "预定课时", value: "12 节", sub: "按外部机构管理", tone: "sky", icon: CalendarDays },
      { label: "实际课时", value: "10 节", sub: "用于打工结算", tone: "emerald", icon: CheckCircle2 },
      { label: "待生成实际", value: "2 节", sub: "锁定前可处理", tone: "amber", icon: Clock },
      { label: "已锁定月份", value: "1 个", sub: "只读保护", tone: "slate", icon: LockKeyhole },
    ],
    filters: [commonFilters.month, { label: "授课机构", options: ["早稻田塾", "家庭教师", "夏期讲座"] }, commonFilters.status],
    columns: [],
    rows: [],
  },
  "external-settlements": {
    key: "external-settlements",
    group: "外部授课",
    title: "打工结算",
    description: "按月份和外部机构锁定快照；业务链路到生成收入记录为止",
    primaryAction: "锁定结算",
    secondaryAction: "导出明细",
    icon: BriefcaseBusiness,
    batchAction: "lock",
    metrics: [
      { label: "待锁定", value: "1 组", sub: "6月早稻田塾", tone: "amber", icon: Clock },
      { label: "已锁定", value: "2 组", sub: "可生成收入", tone: "emerald", icon: LockKeyhole },
      { label: "已生成收入", value: "1 条", sub: "待提交 Cash", tone: "sky", icon: ReceiptText },
      { label: "Cash 已确认", value: "1 条", sub: "写回收入记录", tone: "cyan", icon: CheckCircle2 },
    ],
    filters: [commonFilters.month, { label: "授课机构", options: ["早稻田塾", "家庭教师", "夏期讲座"] }, commonFilters.status],
    columns: [
      { key: "workplace", label: "机构" },
      { key: "lessons", label: "课时" },
      { key: "amount", label: "结算金额", align: "right" },
      { key: "income", label: "收入记录" },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "external-settlement-1",
        title: "早稻田塾",
        subtitle: "2026年06月外部授课",
        status: "已锁定",
        tone: "amber",
        cells: {
          workplace: "早稻田塾",
          lessons: "10 节",
          amount: money.jpy(180000),
          income: "待生成收入记录",
        },
        detail: [
          { title: "链路保护", lines: [{ label: "锁定后", value: "外部课时只读" }, { label: "生成收入后", value: "Cash 提交由收入记录模块处理" }] },
        ],
      },
      {
        id: "external-settlement-2",
        title: "家庭教师",
        subtitle: "2026年06月外部授课",
        status: "收入记录已生成",
        tone: "emerald",
        cells: {
          workplace: "家庭教师",
          lessons: "4 节",
          amount: money.jpy(72000),
          income: "收入记录 #IN-PT-0618",
        },
        detail: [
          { title: "收入记录", lines: [{ label: "生成后", value: "在收入记录模块提交 Cash" }, { label: "School 账户", value: "不生成账户流水" }] },
        ],
      },
    ],
  },
  "income-records": {
    key: "income-records",
    group: "财务 / Cash",
    title: "收入记录",
    description: "统一承接学生学费、外部授课和低频手动收入，必要时提交 Cash",
    primaryAction: "新增收入",
    icon: ReceiptText,
    batchAction: "cash",
    metrics: [
      { label: "本月收入", value: money.jpy(1120000), sub: "School 原始金额", tone: "emerald", icon: ReceiptText },
      { label: "学生学费", value: "18 条", sub: "来自学费账单", tone: "sky", icon: Users },
      { label: "手动补充", value: "2 条", sub: "临时加课收款", tone: "violet", icon: SquarePen },
      { label: "Cash 待确认", value: "3 条", sub: "等待回写", tone: "amber", icon: Banknote },
    ],
    filters: [commonFilters.month, { label: "收入来源", options: ["学生学费", "外部授课", "手动补充"] }, commonFilters.status],
    columns: [
      { key: "source", label: "来源" },
      { key: "businessMonth", label: "业务月份" },
      { key: "amount", label: "原始金额", align: "right" },
      { key: "cash", label: "Cash 状态" },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "income-1",
        title: "王小明 7月学费",
        subtitle: "学费账单生成",
        status: "待提交 Cash",
        tone: "amber",
        cells: {
          source: "学生学费",
          businessMonth: "2026-07",
          amount: money.jpy(72000),
          cash: "未提交",
        },
        cashPreview: {
          sourceAmount: money.jpy(72000),
          exchangeRate: "0.04782",
          method: "四舍五入到 0.01 CNY",
          requestedAmount: money.cny(3443.04),
          account: "支付宝主账户",
        },
        detail: [{ title: "收入来源", lines: [{ label: "来源", value: "学费账单快照" }, { label: "手动金额", value: "不允许" }] }],
      },
      {
        id: "income-2",
        title: "早稻田塾 6月外部授课",
        subtitle: "外部授课结算生成",
        status: "Cash 已确认",
        tone: "emerald",
        cells: {
          source: "外部授课",
          businessMonth: "2026-06",
          amount: money.jpy(180000),
          cash: "已确认",
        },
        detail: [{ title: "账户影响", lines: [{ label: "School 账户", value: "无账户流水" }, { label: "Cash", value: "影响支付宝余额" }] }],
      },
    ],
  },
  "expense-records": {
    key: "expense-records",
    group: "财务 / Cash",
    title: "支出记录",
    description: "老师工资、法人账户支出和低频报销支出统一记录",
    primaryAction: "新增支出",
    icon: Banknote,
    batchAction: "cash",
    metrics: [
      { label: "本月支出", value: money.jpy(383000), sub: "含老师工资", tone: "sky", icon: Banknote },
      { label: "老师工资", value: money.cny(3929), sub: "待提交 Cash", tone: "amber", icon: GraduationCap },
      { label: "法人账户支付", value: money.jpy(150000), sub: "无需 Cash", tone: "slate", icon: Landmark },
      { label: "已支付", value: money.jpy(120000), sub: "已生成流水", tone: "emerald", icon: CheckCircle2 },
    ],
    filters: [commonFilters.month, { label: "支出分类", options: ["老师工资", "房租水电", "税务手续", "报销"] }, commonFilters.status],
    columns: [
      { key: "category", label: "分类" },
      { key: "businessMonth", label: "业务月份" },
      { key: "amount", label: "金额", align: "right" },
      { key: "cash", label: "Cash 状态" },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "expense-1",
        title: "高若天 工资",
        subtitle: "青空塾 / 2026年06月",
        status: "待提交 Cash",
        tone: "amber",
        cells: {
          category: "老师工资",
          businessMonth: "2026-06",
          amount: money.cny(1254),
          cash: "未提交",
        },
        cashPreview: {
          sourceAmount: money.jpy(30000),
          exchangeRate: "0.04180",
          method: "四舍五入到 0.01 CNY",
          requestedAmount: money.cny(1254),
          account: "余锦宝",
        },
        detail: [{ title: "支出来源", lines: [{ label: "来源", value: "老师工资快照" }, { label: "Cash 聚合", value: "Cash 端按老师显示" }] }],
      },
      {
        id: "expense-2",
        title: "事務所家賃",
        subtitle: "法人账户直接支付",
        status: "已支付",
        tone: "emerald",
        cells: {
          category: "房租水电",
          businessMonth: "2026-06",
          amount: money.jpy(120000),
          cash: "无需 Cash",
        },
        detail: [{ title: "账户流水", lines: [{ label: "账户", value: "公司法人账户" }, { label: "Cash", value: "不联动" }] }],
      },
    ],
  },
  "cash-requests": {
    key: "cash-requests",
    group: "财务 / Cash",
    title: "Cash 请求",
    description: "集中查看收入和支出提交到 Cash 的确认请求",
    primaryAction: "刷新请求",
    icon: Send,
    metrics: [
      { label: "Cash 请求", value: "5 条", sub: "收入 + 支出", tone: "sky", icon: Send },
      { label: "待确认", value: "3 条", sub: "等待 Cash 回写", tone: "amber", icon: Clock },
      { label: "已确认", value: "1 条", sub: "后续可入账", tone: "emerald", icon: CheckCircle2 },
      { label: "需处理", value: "1 条", sub: "拒绝 / 撤回 / 复核", tone: "rose", icon: ShieldCheck },
    ],
    filters: [commonFilters.month, { label: "方向", options: ["收入", "支出"] }, commonFilters.status],
    columns: [
      { key: "direction", label: "方向" },
      { key: "source", label: "来源记录", wide: true },
      { key: "requestedAmount", label: "请求金额", align: "right" },
      { key: "cashAccount", label: "Cash 账户" },
      { key: "createdAt", label: "提交日" },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "cash-request-demo-1",
        title: "王小明 7月学费",
        subtitle: "收入 Cash 请求",
        status: "Cash 待确认",
        tone: "amber",
        cells: {
          direction: "收入",
          source: "王小明 7月学费",
          requestedAmount: money.jpy(72000),
          cashAccount: "alipay-main",
          createdAt: "2026-07-07",
        },
        detail: [{ title: "Cash 请求", lines: [{ label: "说明", value: "真实 API 登录后显示后端请求队列" }] }],
      },
    ],
  },
  "cash-inbound": {
    key: "cash-inbound",
    group: "财务 / Cash",
    title: "Cash 入站",
    description: "处理 Cash 端发起的资金归集和法人账户入账事件；收入/支出提交 Cash 仍在原记录中操作",
    primaryAction: "刷新入站事件",
    icon: WalletCards,
    metrics: [
      { label: "待入账", value: "2 条", sub: "Cash 已发起", tone: "amber", icon: Clock },
      { label: "已入账", value: "6 条", sub: "已生成法人账户流水", tone: "emerald", icon: CheckCircle2 },
      { label: "需复核", value: "1 条", sub: "金额或引用不一致", tone: "rose", icon: ShieldCheck },
      { label: "本月归集", value: money.jpy(500000), sub: "CNY 购汇转入", tone: "cyan", icon: RefreshCw },
    ],
    filters: [commonFilters.month, { label: "入站类型", options: ["资金归集", "购汇入账", "修正入账"] }, commonFilters.status],
    columns: [
      { key: "type", label: "类型" },
      { key: "object", label: "入账对象", wide: true },
      { key: "amount", label: "入账金额", align: "right" },
      { key: "cashRef", label: "Cash 引用" },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "cash-2",
        title: "人民币购汇转入法人账户",
        subtitle: "Cash 入站事件",
        status: "待入账",
        tone: "cyan",
        cells: {
          type: "资金归集",
          object: "CNY -> JPY 公司法人账户",
          amount: money.jpy(500000),
          cashRef: "FX-202607-002",
        },
        detail: [{ title: "业务性质", lines: [{ label: "类型", value: "账户内部调拨 / 资金归集" }, { label: "收入", value: "不作为新增收入" }, { label: "School 结果", value: "生成公司法人账户入金流水" }] }],
      },
      {
        id: "cash-3",
        title: "购汇入账复核",
        subtitle: "Cash 入站事件",
        status: "需复核",
        tone: "rose",
        cells: {
          type: "购汇入账",
          object: "JPY 公司法人账户",
          amount: money.jpy(320000),
          cashRef: "FX-202607-003",
        },
        detail: [{ title: "复核原因", lines: [{ label: "引用", value: "Cash transaction id 未匹配" }, { label: "处理", value: "确认后再生成法人账户流水" }] }],
      },
    ],
  },
  "account-ledger": {
    key: "account-ledger",
    group: "财务 / Cash",
    title: "账户流水",
    description: "School 长期只展示法人账户和垫付账户，流水不解释业务来源",
    primaryAction: "新增流水",
    icon: Landmark,
    metrics: [
      { label: "法人账户", value: money.jpy(1480000), sub: "公司主账户", tone: "emerald", icon: Building2 },
      { label: "吴垫付账户", value: money.jpy(0), sub: "报销后归零", tone: "slate", icon: WalletCards },
      { label: "包垫付账户", value: money.jpy(-12000), sub: "待报销", tone: "amber", icon: WalletCards },
      { label: "本月流水", value: "12 条", sub: "不可删除，只能冲销", tone: "sky", icon: History },
    ],
    filters: [commonFilters.month, { label: "账户", options: ["公司法人账户", "吴垫付账户", "包垫付账户"] }, commonFilters.status],
    columns: [
      { key: "account", label: "账户" },
      { key: "date", label: "日期" },
      { key: "direction", label: "方向" },
      { key: "amount", label: "金额", align: "right" },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "ledger-1",
        title: "房租支付",
        subtitle: "法人账户",
        status: "已入账",
        tone: "emerald",
        cells: {
          account: "公司法人账户",
          date: "2026-07-01",
          direction: "支出",
          amount: money.jpy(120000),
        },
        detail: [{ title: "流水规则", lines: [{ label: "修正", value: "通过反向流水处理" }] }],
      },
    ],
  },
  reimbursements: {
    key: "reimbursements",
    group: "财务 / Cash",
    title: "报销管理",
    description: "低频保留链路：先记录垫付支出，再由法人账户报销垫付账户",
    primaryAction: "新增报销",
    icon: WalletCards,
    metrics: [
      { label: "待报销", value: money.jpy(12000), sub: "包垫付账户", tone: "amber", icon: WalletCards },
      { label: "本月报销", value: "1 笔", sub: "低频操作", tone: "sky", icon: ReceiptText },
      { label: "已完成", value: "3 笔", sub: "垫付账户归零", tone: "emerald", icon: CheckCircle2 },
      { label: "法人支出", value: money.jpy(12000), sub: "影响利润", tone: "cyan", icon: Landmark },
    ],
    filters: [commonFilters.month, { label: "垫付账户", options: ["吴垫付账户", "包垫付账户"] }, commonFilters.status],
    columns: [
      { key: "advanceAccount", label: "垫付账户" },
      { key: "expense", label: "关联支出", wide: true },
      { key: "amount", label: "报销金额", align: "right" },
      { key: "fromAccount", label: "出金账户" },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "reimburse-1",
        title: "广告费垫付报销",
        subtitle: "包垫付账户",
        status: "待报销",
        tone: "amber",
        cells: {
          advanceAccount: "包垫付账户",
          expense: "广告费支出",
          amount: money.jpy(12000),
          fromAccount: "公司法人账户",
        },
        detail: [{ title: "报销链路", lines: [{ label: "先决条件", value: "已新增支出" }, { label: "完成后", value: "法人账户减少，垫付账户归零" }] }],
      },
    ],
  },
  audit: {
    key: "audit",
    group: "系统管理",
    title: "审计中心",
    description: "集中追踪谁在何时生成、修改、锁定、撤销、回写了关键业务数据",
    icon: History,
    metrics: [
      { label: "今日操作", value: "32 条", sub: "含 6 条高风险", tone: "sky", icon: History },
      { label: "锁定动作", value: "8 条", sub: "学生结算 / 工资", tone: "emerald", icon: LockKeyhole },
      { label: "撤销重做", value: "2 条", sub: "保留历史版本", tone: "amber", icon: RefreshCw },
      { label: "异常复核", value: "1 条", sub: "Cash 金额不一致", tone: "rose", icon: ShieldCheck },
    ],
    filters: [commonFilters.month, { label: "操作类型", options: ["锁定", "撤销", "生成记录", "Cash 回写", "权限设置"] }, commonFilters.status],
    columns: [
      { key: "operator", label: "操作人" },
      { key: "time", label: "时间" },
      { key: "action", label: "动作", wide: true },
      { key: "target", label: "对象", wide: true },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "audit-1",
        title: "学生结算锁定",
        subtitle: "王小明 2026年06月",
        status: "成功",
        tone: "emerald",
        cells: {
          operator: "系统管理员",
          time: "2026-07-02 09:12",
          action: "锁定月度结算",
          target: "王小明 / 2026年06月",
        },
        detail: [{ title: "审计内容", lines: [{ label: "原因", value: "月末结算确认" }, { label: "版本", value: "生成新锁定版本" }] }],
      },
      {
        id: "audit-2",
        title: "Cash 入站入账",
        subtitle: "FX-202607-002",
        status: "成功",
        tone: "emerald",
        cells: {
          operator: "财务负责人",
          time: "2026-07-03 10:42",
          action: "确认资金归集并生成法人账户流水",
          target: "人民币购汇转入法人账户",
        },
        detail: [{ title: "追踪内容", lines: [{ label: "Cash 引用", value: "FX-202607-002" }, { label: "结果", value: "生成公司法人账户入金流水" }] }],
      },
      {
        id: "audit-3",
        title: "金额复核",
        subtitle: "学生学费 Cash 请求",
        status: "需要复核",
        tone: "rose",
        cells: {
          operator: "系统",
          time: "2026-07-03 11:08",
          action: "前端提交值与后端计算值不一致",
          target: "王小明 7月学费",
        },
        detail: [{ title: "保护规则", lines: [{ label: "处理", value: "拒绝写入，进入人工复核" }, { label: "金额权威", value: "后端 MoneyService" }] }],
      },
    ],
  },
  settings: {
    key: "settings",
    group: "系统管理",
    title: "基础设置",
    description: "同一设置页框架下管理不同设置类型；各类型使用各自专用表单",
    primaryAction: "新增当前类型",
    icon: Settings,
    metrics: [
      { label: "业务归属", value: "3 个", sub: "用于结算和利润分析", tone: "sky", icon: BriefcaseBusiness },
      { label: "School 账户", value: "3 个", sub: "法人 + 2 个垫付", tone: "emerald", icon: Landmark },
      { label: "系统角色", value: "4 个", sub: "管理员 / 财务 / 业务 / 销售", tone: "violet", icon: ShieldCheck },
      { label: "金额规则", value: "P0", sub: "后端统一口径", tone: "rose", icon: LockKeyhole },
    ],
    filters: [{ label: "设置类型", options: ["业务归属", "账户", "角色权限", "金额规则"] }, commonFilters.status],
    columns: [
      { key: "type", label: "类型" },
      { key: "name", label: "名称" },
      { key: "owner", label: "管理角色" },
      { key: "memo", label: "备注", wide: true },
      { key: "status", label: "状态" },
    ],
    rows: [
      {
        id: "setting-1",
        title: "公司法人账户",
        subtitle: "School 长期账户",
        status: "启用",
        tone: "emerald",
        cells: {
          type: "账户",
          name: "公司法人账户",
          owner: "管理员 / 财务",
          memo: "直接支付固定支出和资金归集入账",
        },
        detail: [{ title: "账户边界", lines: [{ label: "Cash 账户", value: "不长期显示在 School" }] }],
      },
      {
        id: "setting-2",
        title: "青空塾",
        subtitle: "业务归属",
        status: "启用",
        tone: "sky",
        cells: {
          type: "业务归属",
          name: "青空塾",
          owner: "系统管理员",
          memo: "用于课时、结算、工资和利润分析归属",
        },
        detail: [{ title: "专用表单", lines: [{ label: "字段", value: "名称、启用状态、默认账户、利润分析归属" }, { label: "说明", value: "不与账户或角色共用同一个表单" }] }],
      },
      {
        id: "setting-3",
        title: "财务负责人",
        subtitle: "角色权限",
        status: "启用",
        tone: "violet",
        cells: {
          type: "角色权限",
          name: "财务负责人",
          owner: "系统管理员",
          memo: "可处理收入、支出、Cash 提交和财务复核",
        },
        detail: [{ title: "权限范围", lines: [{ label: "可操作", value: "收入、支出、Cash 提交、财务复核" }, { label: "不可操作", value: "系统级 Cash 确认和基础权限设置" }] }],
      },
      {
        id: "setting-4",
        title: "金额规则",
        subtitle: "P0 架构原则",
        status: "只读",
        tone: "rose",
        cells: {
          type: "金额规则",
          name: "JPY 0 位 / CNY 2 位",
          owner: "后端 MoneyService",
          memo: "前端只展示规则，不作为普通设置随意修改",
        },
        detail: [{ title: "金额权威", lines: [{ label: "计算层", value: "后端 / DB 统一确认" }, { label: "前端", value: "只展示结果和收集显式输入" }] }],
      },
    ],
  },
};

function LoginScreen({
  apiHealth,
  onLogin,
  onRefreshApi,
}: {
  apiHealth: ApiHealthSnapshot;
  onLogin: (session: AuthSession | null, mode: AuthMode, remember: boolean) => void;
  onRefreshApi: () => void;
}) {
  const [email, setEmail] = useState("polariss710@gmail.com");
  const [password, setPassword] = useState("");
  const [rememberLogin, setRememberLogin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const apiReady = apiHealth.status === "online" && apiHealth.database === "online";

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError(null);

    if (!apiReady) {
      setLoginError(
        apiHealth.status === "checking"
          ? "Staging API 正在从冷启动恢复。请等待状态变为“真实 API 已连接”后再登录。"
          : "Staging API 暂不可用。请点击“重试”，确认 API 与数据库均已连接后再登录。",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await loginWithPassword({ email, password });
      onLogin(session, "api", rememberLogin);
    } catch (error) {
      if (isApiRequestError(error)) {
        setLoginError("账号或密码不正确，或账号尚未启用。");
        return;
      }

      onLogin(null, "demo", false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const apiStatusClass =
    apiHealth.status === "online" && apiHealth.database === "online"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : apiHealth.status === "checking"
        ? "border-sky-200 bg-sky-50 text-sky-800"
      : "border-amber-200 bg-amber-50 text-amber-800";
  const apiStatusLabel =
    apiReady
      ? "真实 API 已连接"
      : apiHealth.status === "checking"
        ? "正在唤醒 staging API（首次访问最长约 90 秒）"
        : apiHealth.status === "online"
          ? "API 已连接，但数据库尚未就绪"
          : "Staging API 暂未连接";

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground"
      style={{ fontFamily: "'Noto Sans SC', sans-serif", fontSize: 14 }}
    >
      <section className="grid w-full max-w-[980px] overflow-hidden rounded-lg border border-border bg-white shadow-sm lg:grid-cols-[0.95fr_1.05fr]">
        <div className="flex min-h-[520px] flex-col justify-between border-b border-border bg-[#F7FBFE] px-8 py-8 lg:border-b-0 lg:border-r">
          <div>
            <img
              src="/favicon.ico"
              alt="青空进学塾"
              className="h-12 w-12 rounded-md bg-white object-contain shadow-sm ring-1 ring-border"
            />
            <div className="mt-5">
              <h1 className="text-2xl font-semibold tracking-normal text-foreground">青空进学塾</h1>
              <p className="mt-2 text-sm text-muted-foreground">V3 管理后台</p>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-lg border border-border bg-white px-4 py-3">
              <div className="text-xs text-muted-foreground">系统定位</div>
              <div className="mt-1 text-sm font-medium text-foreground">正式运营系统入口</div>
            </div>
            <div className="rounded-lg border border-border bg-white px-4 py-3">
              <div className="text-xs text-muted-foreground">访问控制</div>
              <div className="mt-1 text-sm font-medium text-foreground">按角色进入授权范围</div>
            </div>
          </div>
        </div>

        <div className="flex min-h-[520px] items-center px-8 py-10">
          <form className="w-full" onSubmit={submitLogin}>
            <div>
              <h2 className="text-lg font-semibold text-foreground">登录系统</h2>
              <p className="mt-1 text-xs text-muted-foreground">使用管理员或授权账号继续</p>
            </div>

            <div className="mt-8 grid gap-4">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">账号</span>
                <input
                  className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">密码</span>
                <input
                  className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">登录角色</span>
                <select className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-[#1687D9] focus:ring-2 focus:ring-[#1687D9]/15">
                  <option>系统管理员</option>
                  <option>财务负责人</option>
                  <option>业务人员</option>
                  <option>销售人员</option>
                </select>
              </label>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-[#1687D9]"
                  checked={rememberLogin}
                  onChange={(event) => setRememberLogin(event.target.checked)}
                />
                保持登录
              </label>
              <button type="button" className="text-xs font-medium text-[#1687D9] hover:underline">
                忘记密码
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !apiReady}
              className="mt-7 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#1687D9] px-4 text-sm font-medium text-white transition hover:bg-[#0f74bd] disabled:cursor-wait disabled:bg-[#8cbfe3]"
            >
              {isSubmitting ? "登录中" : apiReady ? "登录" : "等待 API 就绪"}
              {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </button>

            {loginError && (
              <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {loginError}
              </div>
            )}

            <div className={`mt-5 rounded-md border px-3 py-2 text-xs ${apiStatusClass}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{apiStatusLabel}</span>
                <button type="button" onClick={onRefreshApi} className="font-medium hover:underline">
                  重试
                </button>
              </div>
              <div className="mt-1 truncate font-mono text-[11px] opacity-75">{apiHealth.apiBaseUrl}</div>
              {apiHealth.status === "checking" && (
                <div className="mt-1.5 leading-5 opacity-80">冷启动期间请保持本页打开；API 就绪后将自动允许登录。</div>
              )}
              {apiHealth.status !== "checking" && apiHealth.message && (
                <div className="mt-1.5 leading-5 opacity-80">{apiHealth.message}</div>
              )}
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [initialStoredAuth] = useState(readStoredAuthSession);
  const [isAuthRestoring, setIsAuthRestoring] = useState(Boolean(initialStoredAuth));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("demo");
  const [apiHealth, setApiHealth] = useState<ApiHealthSnapshot>(createInitialApiHealth);
  const [studentApi, setStudentApi] = useState<StudentApiState>({ status: "idle", rows: [], total: 0 });
  const [studentReloadKey, setStudentReloadKey] = useState(0);
  const [studentDialog, setStudentDialog] = useState<StudentDialogState | null>(null);
  const [isStudentSubmitting, setIsStudentSubmitting] = useState(false);
  const [studentMutationError, setStudentMutationError] = useState<string | null>(null);
  const [teacherApi, setTeacherApi] = useState<TeacherApiState>({ status: "idle", rows: [], total: 0 });
  const [teacherReloadKey, setTeacherReloadKey] = useState(0);
  const [teacherDialog, setTeacherDialog] = useState<TeacherDialogState | null>(null);
  const [isTeacherSubmitting, setIsTeacherSubmitting] = useState(false);
  const [teacherMutationError, setTeacherMutationError] = useState<string | null>(null);
  const [settingsApi, setSettingsApi] = useState<SettingsApiState>({
    status: "idle",
    rows: [],
    counts: emptySettingsCounts,
    businessEntities: [],
    subjects: [],
  });
  const [studentChainApi, setStudentChainApi] = useState<StudentChainApiState>(createEmptyStudentChainApiState);
  const [studentChainReloadKey, setStudentChainReloadKey] = useState(0);
  const [plannedLessonDialog, setPlannedLessonDialog] = useState<PlannedLessonDialogState | null>(null);
  const [isPlannedLessonSubmitting, setIsPlannedLessonSubmitting] = useState(false);
  const [plannedLessonMutationError, setPlannedLessonMutationError] = useState<string | null>(null);
  const [tuitionBillDialog, setTuitionBillDialog] = useState<TuitionBillDialogState | null>(null);
  const [isTuitionBillSubmitting, setIsTuitionBillSubmitting] = useState(false);
  const [tuitionBillMutationError, setTuitionBillMutationError] = useState<string | null>(null);
  const [studentSettlementDialog, setStudentSettlementDialog] = useState<StudentSettlementDialogState | null>(null);
  const [lessonActionSubmittingId, setLessonActionSubmittingId] = useState<string | null>(null);
  const [lessonActualDialog, setLessonActualDialog] = useState<LessonActualDialogState | null>(null);
  const [isLessonActualSubmitting, setIsLessonActualSubmitting] = useState(false);
  const [lessonActualError, setLessonActualError] = useState<string | null>(null);
  const [workflowApi, setWorkflowApi] = useState<WorkflowApiState>(createEmptyWorkflowApiState);
  const [workflowReloadKey, setWorkflowReloadKey] = useState(0);
  const [teacherWageRuleDialog, setTeacherWageRuleDialog] = useState<TeacherWageRuleDialogState | null>(null);
  const [isTeacherWageRuleSubmitting, setIsTeacherWageRuleSubmitting] = useState(false);
  const [teacherWageRuleError, setTeacherWageRuleError] = useState<string | null>(null);
  const [teacherWageDialog, setTeacherWageDialog] = useState<TeacherWageDialogState | null>(null);
  const [teacherWageAdjustmentDialog, setTeacherWageAdjustmentDialog] = useState<TeacherWageAdjustmentDialogState | null>(null);
  const [teacherAttendanceImportDialog, setTeacherAttendanceImportDialog] = useState<TeacherAttendanceImportDialogState | null>(null);
  const [financeApi, setFinanceApi] = useState<FinanceApiState>(createEmptyFinanceApiState);
  const [financeReloadKey, setFinanceReloadKey] = useState(0);
  const [financeDialog, setFinanceDialog] = useState<FinanceDialogState | null>(null);
  const [isFinanceSubmitting, setIsFinanceSubmitting] = useState(false);
  const [financeMutationError, setFinanceMutationError] = useState<string | null>(null);
  const [tuitionReceiptDialog, setTuitionReceiptDialog] = useState<TuitionReceiptDialogState | null>(null);
  const [isTuitionReceiptIssuing, setIsTuitionReceiptIssuing] = useState(false);
  const [cashRequestDialog, setCashRequestDialog] = useState<CashRequestDialogState | null>(null);
  const [isCashRequestSubmitting, setIsCashRequestSubmitting] = useState(false);
  const [cashRequestError, setCashRequestError] = useState<string | null>(null);
  const [cashEligibleAccounts, setCashEligibleAccounts] = useState<CashEligibleAccountRecord[]>([]);
  const [cashIntegrationMode, setCashIntegrationMode] = useState<"mock" | "supabase" | "disabled">("disabled");
  const [reimbursementDialog, setReimbursementDialog] = useState<ReimbursementDialogState | null>(null);
  const [isReimbursementSubmitting, setIsReimbursementSubmitting] = useState(false);
  const [reimbursementMutationError, setReimbursementMutationError] = useState<string | null>(null);
  const [migrationAuditDialog, setMigrationAuditDialog] = useState<MigrationAuditDialogState | null>(null);
  const [settingsActiveTab, setSettingsActiveTab] = useState<SettingCategory>("businessEntities");
  const [actionNotice, setActionNotice] = useState<{ tone: "emerald" | "rose" | "amber"; text: string } | null>(null);
  const [activeKey, setActiveKey] = useState("dashboard");
  const [selectedByPage, setSelectedByPage] = useState<Record<string, Set<string>>>({});
  const [detailRow, setDetailRow] = useState<DataRow | null>(null);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showSettlementBatchModal, setShowSettlementBatchModal] = useState(false);

  const baseActivePage = activeKey === "lesson-management" ? lessonManagementPage : pages[activeKey];
  const activePage = useMemo(() => {
    if (activeKey === "students" && baseActivePage) {
      return buildStudentsPage(baseActivePage, studentApi);
    }

    if (activeKey === "teachers" && baseActivePage) {
      return buildTeachersPage(baseActivePage, teacherApi);
    }

    if (activeKey === "settings" && baseActivePage) {
      return buildSettingsPage(baseActivePage, settingsApi);
    }

    if (activeKey === "lesson-management" && baseActivePage) {
      return buildLessonManagementPage(baseActivePage, studentChainApi);
    }

    if (activeKey === "tuition-bills" && baseActivePage) {
      return buildTuitionBillsPage(baseActivePage, studentChainApi.tuitionBills);
    }

    if (activeKey === "student-settlements" && baseActivePage) {
      return buildStudentSettlementsPage(baseActivePage, studentChainApi.settlements);
    }

    if (activeKey === "teacher-rules" && baseActivePage) {
      return buildWageRulesPage(baseActivePage, workflowApi.wageRules);
    }

    if (activeKey === "teacher-wages" && baseActivePage) {
      return buildTeacherWagesPage(baseActivePage, workflowApi.wageSnapshots);
    }

    if (activeKey === "wage-import" && baseActivePage) {
      return buildWageImportPage(baseActivePage, workflowApi.wageImports);
    }

    if (activeKey === "external-lessons" && baseActivePage) {
      return buildExternalWorkLessonsPage(baseActivePage, workflowApi.externalLessons);
    }

    if (activeKey === "external-settlements" && baseActivePage) {
      return buildExternalWorkSettlementsPage(baseActivePage, workflowApi.externalSettlements);
    }

    if (activeKey === "audit" && baseActivePage) {
      return buildAuditPage(baseActivePage, workflowApi.auditEvents);
    }

    if (activeKey === "income-records" && baseActivePage) {
      return buildIncomeRecordsPage(baseActivePage, financeApi.incomeRecords);
    }

    if (activeKey === "expense-records" && baseActivePage) {
      return buildExpenseRecordsPage(baseActivePage, financeApi.expenseRecords);
    }

    if (activeKey === "cash-requests" && baseActivePage) {
      return buildCashRequestsPage(baseActivePage, financeApi.cashRequests);
    }

    if (activeKey === "cash-inbound" && baseActivePage) {
      return buildCashInboundPage(baseActivePage, financeApi.cashInbound);
    }

    if (activeKey === "account-ledger" && baseActivePage) {
      return buildAccountLedgerPage(baseActivePage, financeApi.accountLedger);
    }

    if (activeKey === "reimbursements" && baseActivePage) {
      return buildReimbursementsPage(baseActivePage, financeApi.reimbursements);
    }

    return baseActivePage;
  }, [activeKey, baseActivePage, studentApi, teacherApi, settingsApi, studentChainApi, workflowApi, financeApi]);
  const activeLessonPairs = useMemo(() => getLessonPairsForPage(studentChainApi), [studentChainApi]);
  const activeExternalWorkPairs = useMemo(() => getExternalWorkPairsForPage(workflowApi), [workflowApi]);
  const selected = selectedByPage[activeKey] ?? new Set<string>();
  const selectedRows = useMemo(() => {
    if (!activePage) {
      return [];
    }
    return activePage.rows.filter((row) => selected.has(row.id));
  }, [activePage, selected]);

  const refreshApiHealth = () => {
    setApiHealth((current) => ({ ...current, status: "checking", database: "checking" }));
    void fetchApiHealthSnapshot().then(setApiHealth);
  };

  useEffect(() => {
    let isMounted = true;

    const checkApiHealth = async () => {
      setApiHealth((current) => ({ ...current, status: "checking", database: "checking" }));
      const next = await fetchApiHealthSnapshot();
      if (isMounted) {
        setApiHealth(next);
      }
    };

    void checkApiHealth();
    const timer = window.setInterval(checkApiHealth, 60_000);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!initialStoredAuth) {
      return;
    }

    let isMounted = true;

    void getCurrentUser(initialStoredAuth.session.accessToken)
      .then(({ user }) => {
        if (!isMounted) {
          return;
        }

        const restoredSession = { ...initialStoredAuth.session, user };
        persistAuthSession(restoredSession, initialStoredAuth.remember);
        setAuthSession(restoredSession);
        setAuthMode("api");
        setIsAuthenticated(true);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        clearStoredAuthSession();
        setAuthSession(null);
        setAuthMode("demo");
        setIsAuthenticated(false);
      })
      .finally(() => {
        if (isMounted) {
          setIsAuthRestoring(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [initialStoredAuth]);

  useEffect(() => {
    if (!actionNotice) {
      return;
    }

    const timer = window.setTimeout(() => setActionNotice(null), 8000);

    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  useEffect(() => {
    if (!authSession) {
      setStudentApi({ status: "idle", rows: [], total: 0 });
      return;
    }

    let isMounted = true;

    setStudentApi((current) => ({
      status: "loading",
      rows: current.rows,
      total: current.total,
    }));

    void listStudents(authSession.accessToken)
      .then((response) => {
        if (!isMounted) {
          return;
        }

        setStudentApi({
          status: "ready",
          rows: response.items.map(mapStudentRecordToRow),
          total: response.total,
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setStudentApi({
          status: "error",
          rows: [],
          total: 0,
          message: error instanceof Error ? error.message : "Students API request failed",
        });
      });

    return () => {
      isMounted = false;
    };
  }, [authSession, studentReloadKey]);

  useEffect(() => {
    if (!authSession) {
      setTeacherApi({ status: "idle", rows: [], total: 0 });
      return;
    }

    let isMounted = true;

    setTeacherApi((current) => ({
      status: "loading",
      rows: current.rows,
      total: current.total,
    }));

    void listTeachers(authSession.accessToken)
      .then((response) => {
        if (!isMounted) {
          return;
        }

        setTeacherApi({
          status: "ready",
          rows: response.items.map(mapTeacherRecordToRow),
          total: response.total,
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setTeacherApi({
          status: "error",
          rows: [],
          total: 0,
          message: error instanceof Error ? error.message : "Teachers API request failed",
        });
      });

    return () => {
      isMounted = false;
    };
  }, [authSession, teacherReloadKey]);

  useEffect(() => {
    if (!authSession) {
      setSettingsApi({ status: "idle", rows: [], counts: emptySettingsCounts, businessEntities: [], subjects: [] });
      return;
    }

    let isMounted = true;

    setSettingsApi((current) => ({
      status: "loading",
      rows: current.rows,
      counts: current.counts,
      businessEntities: current.businessEntities,
      subjects: current.subjects,
    }));

    void Promise.all([
      listBusinessEntities(authSession.accessToken),
      listAccounts(authSession.accessToken),
      listSubjects(authSession.accessToken),
      listExternalWorkplaces(authSession.accessToken),
    ])
      .then(([businessEntities, accounts, subjects, externalWorkplaces]) => {
        if (!isMounted) {
          return;
        }

        setSettingsApi({
          status: "ready",
          rows: [
            ...businessEntities.items.map(mapBusinessEntityToSettingRow),
            ...accounts.items.map(mapAccountToSettingRow),
            ...subjects.items.map(mapSubjectToSettingRow),
            ...externalWorkplaces.items.map(mapExternalWorkplaceToSettingRow),
          ],
          counts: {
            businessEntities: businessEntities.items.length,
            accounts: accounts.items.length,
            subjects: subjects.items.length,
            externalWorkplaces: externalWorkplaces.items.length,
          },
          businessEntities: businessEntities.items,
          subjects: subjects.items,
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setSettingsApi({
          status: "error",
          rows: [],
          counts: emptySettingsCounts,
          businessEntities: [],
          subjects: [],
          message: error instanceof Error ? error.message : "Settings API request failed",
        });
      });

    return () => {
      isMounted = false;
    };
  }, [authSession]);

  useEffect(() => {
    if (!authSession) {
      setStudentChainApi(createEmptyStudentChainApiState());
      return;
    }

    let isMounted = true;

    setStudentChainApi((current) => ({
      plannedLessons: {
        status: "loading",
        items: current.plannedLessons.items,
        total: current.plannedLessons.total,
      },
      actualLessons: {
        status: "loading",
        items: current.actualLessons.items,
        total: current.actualLessons.total,
      },
      tuitionBills: {
        status: "loading",
        rows: current.tuitionBills.rows,
        total: current.tuitionBills.total,
      },
      settlements: {
        status: "loading",
        rows: current.settlements.rows,
        total: current.settlements.total,
      },
    }));

    void Promise.all([
      listPlannedLessons(authSession.accessToken),
      listActualLessons(authSession.accessToken),
      listTuitionBills(authSession.accessToken),
      listStudentSettlements(authSession.accessToken),
    ])
      .then(([plannedLessons, actualLessons, tuitionBills, settlements]) => {
        if (!isMounted) {
          return;
        }

        setStudentChainApi({
          plannedLessons: {
            status: "ready",
            items: plannedLessons.items,
            total: plannedLessons.total,
          },
          actualLessons: {
            status: "ready",
            items: actualLessons.items,
            total: actualLessons.total,
          },
          tuitionBills: {
            status: "ready",
            rows: tuitionBills.items.map(mapTuitionBillToRow),
            total: tuitionBills.total,
          },
          settlements: {
            status: "ready",
            rows: settlements.items.map(mapStudentSettlementToRow),
            total: settlements.total,
          },
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        const message = error instanceof Error ? error.message : "Student chain API request failed";
        setStudentChainApi({
          plannedLessons: { status: "error", items: [], total: 0, message },
          actualLessons: { status: "error", items: [], total: 0, message },
          tuitionBills: { status: "error", rows: [], total: 0, message },
          settlements: { status: "error", rows: [], total: 0, message },
        });
      });

    return () => {
      isMounted = false;
    };
  }, [authSession, studentChainReloadKey]);

  useEffect(() => {
    if (!authSession) {
      setWorkflowApi(createEmptyWorkflowApiState());
      return;
    }

    let isMounted = true;

    setWorkflowApi((current) => ({
      wageRules: {
        status: "loading",
        rows: current.wageRules.rows,
        total: current.wageRules.total,
      },
      wageSnapshots: {
        status: "loading",
        rows: current.wageSnapshots.rows,
        total: current.wageSnapshots.total,
      },
      wageImports: {
        status: "loading",
        rows: current.wageImports.rows,
        total: current.wageImports.total,
      },
      externalLessons: {
        status: "loading",
        items: current.externalLessons.items,
        total: current.externalLessons.total,
      },
      externalSettlements: {
        status: "loading",
        rows: current.externalSettlements.rows,
        total: current.externalSettlements.total,
      },
      auditEvents: {
        status: "loading",
        rows: current.auditEvents.rows,
        total: current.auditEvents.total,
      },
    }));

    void Promise.all([
      listTeacherWageRules(authSession.accessToken),
      listTeacherWageSnapshots(authSession.accessToken),
      listExternalWorkLessons(authSession.accessToken),
      listExternalWorkSettlements(authSession.accessToken),
      listAuditEvents(authSession.accessToken),
    ])
      .then(([wageRules, wageSnapshots, externalLessons, externalSettlements, auditEvents]) => {
        if (!isMounted) {
          return;
        }

        const attendanceRows = buildTeacherAttendanceGroupRows(wageSnapshots.items);
        setWorkflowApi({
          wageRules: {
            status: "ready",
            rows: wageRules.items.map(mapTeacherWageRuleToRow),
            total: wageRules.total,
          },
          wageSnapshots: {
            status: "ready",
            rows: wageSnapshots.items.map(mapTeacherWageSnapshotToRow),
            total: wageSnapshots.total,
          },
          wageImports: {
            status: "ready",
            rows: attendanceRows,
            total: attendanceRows.length,
          },
          externalLessons: {
            status: "ready",
            items: externalLessons.items,
            total: externalLessons.total,
          },
          externalSettlements: {
            status: "ready",
            rows: externalSettlements.items.map(mapExternalWorkSettlementToRow),
            total: externalSettlements.total,
          },
          auditEvents: {
            status: "ready",
            rows: auditEvents.items.map(mapAuditEventToRow),
            total: auditEvents.total,
          },
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        const message = error instanceof Error ? error.message : "Workflow API request failed";
        setWorkflowApi({
          wageRules: { status: "error", rows: [], total: 0, message },
          wageSnapshots: { status: "error", rows: [], total: 0, message },
          wageImports: { status: "error", rows: [], total: 0, message },
          externalLessons: { status: "error", items: [], total: 0, message },
          externalSettlements: { status: "error", rows: [], total: 0, message },
          auditEvents: { status: "error", rows: [], total: 0, message },
        });
      });

    return () => {
      isMounted = false;
    };
  }, [authSession, workflowReloadKey]);

  useEffect(() => {
    if (!authSession) {
      setFinanceApi(createEmptyFinanceApiState());
      return;
    }

    let isMounted = true;

    setFinanceApi((current) => ({
      incomeRecords: {
        status: "loading",
        rows: current.incomeRecords.rows,
        total: current.incomeRecords.total,
      },
      expenseRecords: {
        status: "loading",
        rows: current.expenseRecords.rows,
        total: current.expenseRecords.total,
      },
      cashRequests: {
        status: "loading",
        rows: current.cashRequests.rows,
        total: current.cashRequests.total,
      },
      cashInbound: {
        status: "loading",
        rows: current.cashInbound.rows,
        total: current.cashInbound.total,
      },
      accountLedger: {
        status: "loading",
        rows: current.accountLedger.rows,
        total: current.accountLedger.total,
      },
      reimbursements: {
        status: "loading",
        rows: current.reimbursements.rows,
        total: current.reimbursements.total,
      },
    }));

    void Promise.all([
      listIncomeRecords(authSession.accessToken),
      listExpenseRecords(authSession.accessToken),
      listCashRequests(authSession.accessToken),
      listCashPaymentBatches(authSession.accessToken),
      listCashInboundEvents(authSession.accessToken),
      listAccountTransactions(authSession.accessToken),
      listReimbursements(authSession.accessToken),
    ])
      .then(([incomeRecords, expenseRecords, cashRequests, cashPaymentBatches, cashInboundEvents, accountTransactions, reimbursements]) => {
        if (!isMounted) {
          return;
        }

        setFinanceApi({
          incomeRecords: {
            status: "ready",
            rows: incomeRecords.items.map(mapIncomeRecordToRow),
            total: incomeRecords.total,
          },
          expenseRecords: {
            status: "ready",
            rows: expenseRecords.items.map(mapExpenseRecordToRow),
            total: expenseRecords.total,
          },
          cashRequests: {
            status: "ready",
            rows: [
              ...cashPaymentBatches.items.map(mapCashPaymentBatchToRow),
              ...cashRequests.items.map(mapCashRequestToRow),
            ],
            total: cashRequests.total,
          },
          cashInbound: {
            status: "ready",
            rows: cashInboundEvents.items.map(mapCashInboundEventToRow),
            total: cashInboundEvents.total,
          },
          accountLedger: {
            status: "ready",
            rows: accountTransactions.items.map(mapAccountTransactionToRow),
            total: accountTransactions.total,
          },
          reimbursements: {
            status: "ready",
            rows: reimbursements.items.map(mapReimbursementRecordToRow),
            total: reimbursements.total,
          },
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        const message = error instanceof Error ? error.message : "Finance API request failed";
        setFinanceApi({
          incomeRecords: { status: "error", rows: [], total: 0, message },
          expenseRecords: { status: "error", rows: [], total: 0, message },
          cashRequests: { status: "error", rows: [], total: 0, message },
          cashInbound: { status: "error", rows: [], total: 0, message },
          accountLedger: { status: "error", rows: [], total: 0, message },
          reimbursements: { status: "error", rows: [], total: 0, message },
        });
      });

    return () => {
      isMounted = false;
    };
  }, [authSession, financeReloadKey]);

  const handleLogin = (session: AuthSession | null, mode: AuthMode, remember: boolean) => {
    if (session && mode === "api") {
      persistAuthSession(session, remember);
    } else {
      clearStoredAuthSession();
    }

    setAuthSession(session);
    setAuthMode(mode);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearStoredAuthSession();
    setAuthSession(null);
    setAuthMode("demo");
    setIsAuthenticated(false);
  };

  const openStudentCreate = () => {
    setStudentMutationError(null);
    setStudentDialog({ mode: "create" });
  };

  const openTeacherCreate = () => {
    setTeacherMutationError(null);
    setTeacherDialog({ mode: "create" });
  };

  const openFinanceCreate = (kind: "income" | "expense") => {
    setFinanceMutationError(null);
    setFinanceDialog({ kind });
  };

  const openTuitionBillCreate = () => {
    setTuitionBillMutationError(null);
    setTuitionBillDialog({ mode: "create", yearMonth: new Date().toISOString().slice(0, 7) });
  };

  const openPlannedLessonCreate = () => {
    setPlannedLessonMutationError(null);
    setPlannedLessonDialog({});
  };

  const submitPlannedLessonForm = async (input: CreatePlannedLessonInput) => {
    if (!authSession) {
      setPlannedLessonMutationError("请先使用真实 API 登录后再新增预定课时。");
      return;
    }

    setIsPlannedLessonSubmitting(true);
    setPlannedLessonMutationError(null);

    try {
      await createPlannedLesson(authSession.accessToken, input);
      setPlannedLessonDialog(null);
      setStudentChainReloadKey((current) => current + 1);
      setActionNotice({ tone: "emerald", text: "预定课时已创建，并已刷新课时管理列表。" });
    } catch (error) {
      setPlannedLessonMutationError(formatApiError(error));
    } finally {
      setIsPlannedLessonSubmitting(false);
    }
  };

  const openStudentSettlementCreate = () => {
    setStudentSettlementDialog({
      mode: "lock",
      yearMonth: new Date().toISOString().slice(0, 7),
    });
  };

  const requestStudentSettlementPreview = async (input: StudentSettlementInput) => {
    if (!authSession) {
      throw new Error("请先使用真实 API 登录后再生成结算预览。");
    }

    const result = await previewStudentSettlement(authSession.accessToken, input);
    return result.preview;
  };

  const submitStudentSettlementLock = async (input: LockStudentSettlementInput) => {
    if (!authSession) {
      throw new Error("请先使用真实 API 登录后再锁定结算。");
    }

    await lockStudentSettlement(authSession.accessToken, input);
    setStudentSettlementDialog(null);
    setStudentChainReloadKey((current) => current + 1);
    setActionNotice({
      tone: "emerald",
      text: studentSettlementDialog?.mode === "relock" ? "学生月度结算已重新锁定。" : "学生月度结算已锁定。",
    });
  };

  const openTeacherWageRuleCreate = () => {
    setTeacherWageRuleError(null);
    setTeacherWageRuleDialog({ mode: "create" });
  };

  const submitTeacherWageRule = async (input: TeacherWageRuleInput) => {
    if (!authSession || !teacherWageRuleDialog) {
      setTeacherWageRuleError("请先使用真实 API 登录后再保存工资规则。");
      return;
    }
    setIsTeacherWageRuleSubmitting(true);
    setTeacherWageRuleError(null);
    try {
      if (teacherWageRuleDialog.mode === "edit") {
        await updateTeacherWageRule(authSession.accessToken, teacherWageRuleDialog.rule.id, {
          hourlyRateJpy: input.hourlyRateJpy,
          memo: input.memo,
        });
      } else {
        await createTeacherWageRule(authSession.accessToken, input);
      }
      setTeacherWageRuleDialog(null);
      setDetailRow(null);
      setWorkflowReloadKey((current) => current + 1);
      setActionNotice({ tone: "emerald", text: teacherWageRuleDialog.mode === "edit" ? "工资规则已更新。" : "工资规则已创建。" });
    } catch (error) {
      setTeacherWageRuleError(formatApiError(error));
    } finally {
      setIsTeacherWageRuleSubmitting(false);
    }
  };

  const openTeacherWageCreate = () => {
    setTeacherWageDialog({ mode: "lock", yearMonth: new Date().toISOString().slice(0, 7) });
  };

  const requestTeacherWagePreview = async (input: TeacherWageInput) => {
    if (!authSession) throw new Error("请先使用真实 API 登录后再生成工资预览。");
    const result = await previewTeacherWage(authSession.accessToken, input);
    return result.preview;
  };

  const submitTeacherWageLock = async (input: TeacherWageInput & { memo?: string | null }) => {
    if (!authSession) throw new Error("请先使用真实 API 登录后再锁定工资快照。");
    await lockTeacherWage(authSession.accessToken, input);
    const relocked = teacherWageDialog?.mode === "relock";
    setTeacherWageDialog(null);
    setWorkflowReloadKey((current) => current + 1);
    setActionNotice({ tone: "emerald", text: relocked ? "新版本工资快照已锁定，旧版本继续保留。" : "老师工资快照已锁定。" });
  };

  const submitTeacherWageAdjustments = async (snapshotId: string, input: TeacherWageAdjustmentInput) => {
    if (!authSession) throw new Error("请先使用真实 API 登录后再调整工资。");
    const result = await updateTeacherWageAdjustments(authSession.accessToken, snapshotId, input);
    setWorkflowReloadKey((current) => current + 1);
    setActionNotice({ tone: "emerald", text: "工资调整已保存，工资合计已由后端重新计算。" });
    return result.snapshot;
  };

  const requestTeacherAttendanceImportPreview = async (
    file: File,
    group: TeacherAttendanceGroup,
  ) => {
    if (!authSession) throw new Error("请先使用真实 API 登录后再导入勤务表。");
    const input = await parseTeacherAttendanceWorkbook(file);
    if (input.teacherId !== group.teacherId || input.yearMonth !== group.yearMonth) {
      throw new Error("所选文件与当前老师或业务月份不一致。");
    }
    const result = await previewTeacherAttendanceWorkbookImport(authSession.accessToken, input);
    return { input, preview: result.preview };
  };

  const submitTeacherAttendanceImport = async (input: TeacherAttendanceWorkbookImportInput) => {
    if (!authSession) throw new Error("请先使用真实 API 登录后再导入勤务表。");
    await confirmTeacherAttendanceWorkbookImport(authSession.accessToken, input);
    setTeacherAttendanceImportDialog(null);
    setWorkflowReloadKey((current) => current + 1);
    setActionNotice({ tone: "emerald", text: "勤务表费用已按业务归属写回工资快照，请继续确认工资调整。" });
  };

  const submitTuitionBillForm = async (input: GenerateTuitionBillInput) => {
    if (!authSession) {
      setTuitionBillMutationError("请先使用真实 API 登录后再生成账单。");
      return;
    }

    setIsTuitionBillSubmitting(true);
    setTuitionBillMutationError(null);

    try {
      const result = await generateTuitionBill(authSession.accessToken, input);
      setTuitionBillDialog(null);
      setStudentChainReloadKey((current) => current + 1);
      const wasCreated = result.created ?? true;
      setActionNotice({
        tone: wasCreated ? "emerald" : "amber",
        text: wasCreated
          ? "学费账单已生成，金额来自后端账单快照。"
          : "相同账单已经存在，本次没有重复生成。",
      });
    } catch (error) {
      setTuitionBillMutationError(formatApiError(error));
    } finally {
      setIsTuitionBillSubmitting(false);
    }
  };

  const requestTuitionBillPreview = async (input: GenerateTuitionBillInput) => {
    if (!authSession) throw new Error("请先使用真实 API 登录后再生成账单预览。");
    setTuitionBillMutationError(null);
    const result = await previewTuitionBill(authSession.accessToken, input);
    return result.preview;
  };

  const openReimbursementCreate = async () => {
    if (!authSession) {
      setActionNotice({ tone: "amber", text: "请先使用真实 API 登录后再新增报销。" });
      return;
    }

    setReimbursementMutationError(null);
    setReimbursementDialog({ isLoading: true, candidates: [], accounts: [] });

    try {
      const [candidateExpenses, accounts] = await Promise.all([
        listReimbursementCandidateExpenses(authSession.accessToken),
        listAccounts(authSession.accessToken),
      ]);
      setReimbursementDialog({
        isLoading: false,
        candidates: candidateExpenses.items,
        accounts: accounts.items,
      });
    } catch (error) {
      setReimbursementMutationError(formatApiError(error));
      setReimbursementDialog({ isLoading: false, candidates: [], accounts: [] });
    }
  };

  const handleLessonAction = async (actionKey: LessonActionKey, pair: LessonPair) => {
    if (!authSession || !pair.plannedRecord) {
      setActionNotice({ tone: "amber", text: "请先使用真实 API 登录，并选择来自 dev API 的预定课时。" });
      return;
    }

    const planned = pair.plannedRecord;
    let successMessage = "";

    if (actionKey === "generateActual") {
      setLessonActualError(null);
      setLessonActualDialog({ pair });
      return;
    }

    if (actionKey === "deleteFreshPlanned") {
      const confirmed = window.confirm(
        `确认永久删除「${planned.student.name}」${formatApiDate(planned.weekAnchorDate)} 的全新预定课时？\n\n仅限尚未生成实际、结算、工资或学费账单引用的记录；删除后不保留课时记录。`,
      );
      if (!confirmed) {
        return;
      }

      setLessonActionSubmittingId(pair.id);
      try {
        await deleteFreshPlannedLesson(authSession.accessToken, planned.id, {
          expectedUpdatedAt: planned.updatedAt,
          confirmDelete: true,
        });
        setStudentChainReloadKey((current) => current + 1);
        setActionNotice({ tone: "emerald", text: "全新预定课时已删除。" });
      } catch (error) {
        setActionNotice({ tone: "rose", text: formatApiError(error) });
      } finally {
        setLessonActionSubmittingId(null);
      }
      return;
    }

    if (actionKey === "cancelPlanned") {
      const confirmed = window.confirm(`确认取消「${planned.student.name}」${formatApiDate(planned.weekAnchorDate)} 的预定课时？`);
      if (!confirmed) {
        return;
      }
      successMessage = "预定课时已取消。";
    } else if (actionKey === "markMakeupPending") {
      const confirmed = window.confirm(`确认把「${planned.student.name}」${formatApiDate(planned.weekAnchorDate)} 的预定课时标记为待补课？`);
      if (!confirmed) {
        return;
      }
      successMessage = "预定课时已标记为待补课。";
    } else {
      const confirmed = window.confirm(`确认恢复「${planned.student.name}」${formatApiDate(planned.weekAnchorDate)} 的预定课时？`);
      if (!confirmed) {
        return;
      }
      successMessage = "预定课时已恢复。";
    }

    setLessonActionSubmittingId(pair.id);
    try {
      if (actionKey === "cancelPlanned") {
        await cancelPlannedLesson(authSession.accessToken, planned.id);
      } else if (actionKey === "markMakeupPending") {
        await markPlannedLessonMakeupPending(authSession.accessToken, planned.id);
      } else {
        await restorePlannedLesson(authSession.accessToken, planned.id);
      }

      setStudentChainReloadKey((current) => current + 1);
      setActionNotice({ tone: "emerald", text: successMessage });
    } catch (error) {
      setActionNotice({ tone: "rose", text: formatApiError(error) });
    } finally {
      setLessonActionSubmittingId(null);
    }
  };

  const submitLessonActualForm = async (input: GenerateActualLessonInput) => {
    if (!authSession || !lessonActualDialog?.pair.plannedRecord) {
      setLessonActualError("请先使用真实 API 登录，并选择来自 dev API 的预定课时。");
      return;
    }

    const pair = lessonActualDialog.pair;
    const planned = pair.plannedRecord;
    setIsLessonActualSubmitting(true);
    setLessonActionSubmittingId(pair.id);
    setLessonActualError(null);

    try {
      await generateActualLesson(authSession.accessToken, planned.id, input);
      setLessonActualDialog(null);
      setStudentChainReloadKey((current) => current + 1);
      setActionNotice({
        tone: "emerald",
        text: planned.status === "makeup_pending" ? "补课实际课时已生成。" : "实际课时已生成。",
      });
    } catch (error) {
      setLessonActualError(formatApiError(error));
    } finally {
      setIsLessonActualSubmitting(false);
      setLessonActionSubmittingId(null);
    }
  };

  const submitStudentForm = async (input: StudentWriteInput) => {
    if (!authSession) {
      setStudentMutationError("请先使用真实 API 登录后再保存。");
      return;
    }

    if (studentDialog?.mode === "edit" && !studentDialog.row.apiRef) {
      setStudentMutationError("这条 demo 数据没有后端记录，不能提交保存。");
      return;
    }

    setIsStudentSubmitting(true);
    setStudentMutationError(null);

    try {
      if (studentDialog?.mode === "edit") {
        await updateStudent(authSession.accessToken, studentDialog.row.apiRef!.id, input);
        setActionNotice({ tone: "emerald", text: "学生基础信息已保存。" });
      } else {
        await createStudent(authSession.accessToken, input);
        setActionNotice({ tone: "emerald", text: "学生已创建。" });
      }

      setStudentDialog(null);
      setDetailRow(null);
      setStudentReloadKey((current) => current + 1);
    } catch (error) {
      setStudentMutationError(formatApiError(error));
    } finally {
      setIsStudentSubmitting(false);
    }
  };

  const handleDrawerAction = async (actionKey: DrawerActionKey, row: DataRow) => {
    if (actionKey === "migrationAudit.view") {
      if (!authSession || !row.migrationAuditTarget) {
        setActionNotice({ tone: "amber", text: "请先使用真实 API 登录，并选择已迁移的历史记录。" });
        return;
      }

      setMigrationAuditDialog({ title: row.title, isLoading: true, records: [] });
      try {
        const result = await listMigrationRecordAudits(
          authSession.accessToken,
          row.migrationAuditTarget.targetTable,
          row.migrationAuditTarget.targetId,
        );
        setMigrationAuditDialog({ title: row.title, isLoading: false, records: result.items });
      } catch (error) {
        setMigrationAuditDialog({
          title: row.title,
          isLoading: false,
          records: [],
          error: formatApiError(error),
        });
      }
      return;
    }

    if (actionKey === "student.edit") {
      setStudentMutationError(null);
      setStudentDialog({ mode: "edit", row });
      return;
    }

    if (actionKey === "teacher.edit") {
      setTeacherMutationError(null);
      setTeacherDialog({ mode: "edit", row });
      return;
    }

    if (
      actionKey === "tuitionBill.generate" ||
      actionKey === "tuitionBill.generateIncome" ||
      actionKey === "tuitionBill.void"
    ) {
      if (!authSession || row.apiRef?.resource !== "tuitionBill" || !row.tuitionBillRecord) {
        setActionNotice({ tone: "amber", text: "请先使用真实 API 登录，并选择来自 dev API 的学费账单。" });
        return;
      }

      const tuitionBill = row.tuitionBillRecord;

      if (actionKey === "tuitionBill.generate") {
        if (tuitionBill.student.status && tuitionBill.student.status !== "active") {
          setDetailRow(null);
          setActionNotice({
            tone: "amber",
            text: "该学生已归档或停用，不能生成新的学费账单。请先恢复学生状态后再操作。",
          });
          return;
        }

        setDetailRow(null);
        setTuitionBillMutationError(null);
        setTuitionBillDialog({
          mode: "regenerate",
          studentId: tuitionBill.studentId,
          yearMonth: tuitionBill.yearMonth,
        });
        return;
      }

      if (actionKey === "tuitionBill.generateIncome") {
        const confirmed = window.confirm(`确认从「${tuitionBill.student.name}」${tuitionBill.yearMonth} 学费账单生成收入记录？`);
        if (!confirmed) {
          return;
        }

        try {
          await generateTuitionBillIncome(authSession.accessToken, tuitionBill.id);
          setDetailRow(null);
          setStudentChainReloadKey((current) => current + 1);
          setFinanceReloadKey((current) => current + 1);
          setActionNotice({ tone: "emerald", text: "收入记录已生成，下一步可提交 Cash 请求。" });
        } catch (error) {
          setActionNotice({ tone: "rose", text: formatApiError(error) });
        }
        return;
      }

      const reason = window.prompt(`确认作废「${tuitionBill.student.name}」${tuitionBill.yearMonth} 的学费账单？请输入原因（可留空）：`, "测试作废账单");
      if (reason === null) {
        return;
      }

      try {
        await voidTuitionBill(authSession.accessToken, tuitionBill.id, normalizeOptionalFormValue(reason));
        setDetailRow(null);
        setStudentChainReloadKey((current) => current + 1);
        setActionNotice({ tone: "emerald", text: "学费账单已作废。" });
      } catch (error) {
        setActionNotice({ tone: "rose", text: formatApiError(error) });
      }
      return;
    }

    if (actionKey === "studentSettlement.relock" || actionKey === "studentSettlement.revoke") {
      if (!authSession || row.apiRef?.resource !== "studentSettlement" || !row.studentSettlementRecord) {
        setActionNotice({ tone: "amber", text: "请先使用真实 API 登录，并选择来自 dev API 的学生月度结算。" });
        return;
      }

      const settlement = row.studentSettlementRecord;

      if (actionKey === "studentSettlement.relock") {
        setDetailRow(null);
        setStudentSettlementDialog({
          mode: "relock",
          studentId: settlement.studentId,
          yearMonth: settlement.yearMonth,
          settlement,
        });
        return;
      }

      const reason = window.prompt(
        `确认撤销「${settlement.student.name}」${settlement.yearMonth} 的月度结算？请输入原因（可留空）：`,
        "测试撤销月度结算",
      );
      if (reason === null) {
        return;
      }

      try {
        await revokeStudentSettlement(authSession.accessToken, settlement.id, normalizeOptionalFormValue(reason));
        setDetailRow(null);
        setStudentChainReloadKey((current) => current + 1);
        setActionNotice({ tone: "emerald", text: "学生月度结算已撤销，旧快照继续保留用于审计。" });
      } catch (error) {
        setActionNotice({ tone: "rose", text: formatApiError(error) });
      }
      return;
    }

    if (actionKey === "teacherWageRule.edit") {
      if (!authSession || !row.teacherWageRuleRecord) {
        setActionNotice({ tone: "amber", text: "请先使用真实 API 登录，并选择来自 dev API 的工资规则。" });
        return;
      }
      setTeacherWageRuleError(null);
      setDetailRow(null);
      setTeacherWageRuleDialog({ mode: "edit", rule: row.teacherWageRuleRecord });
      return;
    }

    if (
      actionKey === "teacherWageSnapshot.relock" ||
      actionKey === "teacherWageSnapshot.revoke" ||
      actionKey === "teacherWageSnapshot.adjust" ||
      actionKey === "teacherWageSnapshot.confirmAdjustments" ||
      actionKey === "teacherWageSnapshot.generateExpense" ||
      actionKey === "teacherWageSnapshot.viewExpense"
    ) {
      if (!authSession || !row.teacherWageSnapshotRecord) {
        setActionNotice({ tone: "amber", text: "请先使用真实 API 登录，并选择来自 dev API 的工资快照。" });
        return;
      }
      const snapshot = row.teacherWageSnapshotRecord;
      if (actionKey === "teacherWageSnapshot.viewExpense") {
        setDetailRow(null);
        setActiveKey("expense-records");
        setActionNotice({ tone: "emerald", text: "已切换到支出记录，请按工资名称或金额核对对应记录。" });
        return;
      }

      if (actionKey === "teacherWageSnapshot.generateExpense") {
        const confirmed = window.confirm(
          `确认从「${snapshot.teacher.name}」${snapshot.yearMonth} / ${snapshot.businessEntity.name} 的工资快照生成支出记录？\n\n支出金额将使用后端已确认工资合计 ${formatApiJpyAmount(snapshot.totalWageJpy)}。`,
        );
        if (!confirmed) return;
        try {
          await createExpenseFromTeacherWage(authSession.accessToken, snapshot.id, snapshot.memo);
          setDetailRow(null);
          setWorkflowReloadKey((current) => current + 1);
          setFinanceReloadKey((current) => current + 1);
          setActionNotice({ tone: "emerald", text: "工资支出记录已生成，可前往支出记录提交 Cash 请求。" });
        } catch (error) {
          setActionNotice({ tone: "rose", text: formatApiError(error) });
        }
        return;
      }

      if (actionKey === "teacherWageSnapshot.adjust") {
        setDetailRow(null);
        setTeacherWageAdjustmentDialog({ snapshot });
        return;
      }

      if (actionKey === "teacherWageSnapshot.confirmAdjustments") {
        const confirmed = window.confirm(
          `确认「${snapshot.teacher.name}」${snapshot.yearMonth} / ${snapshot.businessEntity.name} 的工资调整？\n\n确认后金额进入只读保护；如需修改，必须先撤销整份工资快照。`,
        );
        if (!confirmed) return;
        try {
          await confirmTeacherWageAdjustments(authSession.accessToken, snapshot.id, snapshot.memo);
          setDetailRow(null);
          setWorkflowReloadKey((current) => current + 1);
          setActionNotice({ tone: "emerald", text: "工资调整已确认，金额已进入只读保护。" });
        } catch (error) {
          setActionNotice({ tone: "rose", text: formatApiError(error) });
        }
        return;
      }

      if (actionKey === "teacherWageSnapshot.relock") {
        setDetailRow(null);
        setTeacherWageDialog({
          mode: "relock",
          teacherId: snapshot.teacherId,
          businessEntityId: snapshot.businessEntityId,
          yearMonth: snapshot.yearMonth,
          snapshot,
        });
        return;
      }

      const reason = window.prompt(
        `确认撤销「${snapshot.teacher.name}」${snapshot.yearMonth} / ${snapshot.businessEntity.name} 的第${snapshot.version}版工资快照？请输入原因（可留空）：`,
        "测试撤销工资快照",
      );
      if (reason === null) return;
      try {
        await revokeTeacherWage(authSession.accessToken, snapshot.id, normalizeOptionalFormValue(reason));
        setDetailRow(null);
        setWorkflowReloadKey((current) => current + 1);
        setActionNotice({ tone: "emerald", text: "工资快照已撤销，可从该记录重新生成新版本。" });
      } catch (error) {
        setActionNotice({ tone: "rose", text: formatApiError(error) });
      }
      return;
    }

    if (actionKey === "teacherAttendance.export" || actionKey === "teacherAttendance.import") {
      if (!authSession || !row.teacherAttendanceGroup) {
        setActionNotice({ tone: "amber", text: "请先使用真实 API 登录，并选择老师勤务表记录。" });
        return;
      }
      const group = row.teacherAttendanceGroup;
      if (actionKey === "teacherAttendance.import") {
        setDetailRow(null);
        setTeacherAttendanceImportDialog({ group });
        return;
      }

      try {
        const result = await exportTeacherAttendanceWorkbook(authSession.accessToken, {
          teacherId: group.teacherId,
          yearMonth: group.yearMonth,
        });
        await downloadTeacherAttendanceWorkbook(result.exportPayload);
        setDetailRow(null);
        setWorkflowReloadKey((current) => current + 1);
        setActionNotice({ tone: "emerald", text: "勤务表 Excel 已导出；同一老师的多个业务归属已合并到一个文件。" });
      } catch (error) {
        setActionNotice({ tone: "rose", text: formatApiError(error) });
      }
      return;
    }

    if (actionKey === "income.receipt") {
      if (!authSession || row.apiRef?.resource !== "income") {
        setActionNotice({ tone: "amber", text: "请先使用真实 API 登录后再生成学费收据。" });
        return;
      }

      try {
        const result = await getTuitionReceipt(authSession.accessToken, row.apiRef.id);
        setDetailRow(null);
        setTuitionReceiptDialog({ receipt: result.receipt });
      } catch (error) {
        setActionNotice({ tone: "rose", text: formatApiError(error) });
      }
      return;
    }

    if (actionKey === "cash.submit") {
      if (!authSession || !row.apiRef || !row.financeRecord) {
        setActionNotice({ tone: "amber", text: "请先使用真实 API 登录后再执行该动作。" });
        return;
      }

      setCashRequestError(null);
      setCashRequestDialog({ row });
      return;
    }

    if (actionKey === "cash.withdraw") {
      if (!authSession || row.apiRef?.resource !== "cashRequest") {
        setActionNotice({ tone: "amber", text: "请先使用真实 API 登录后再执行该动作。" });
        return;
      }

      try {
        const reason = window.prompt(`确认撤回 Cash 请求「${row.title}」？请输入撤回原因（可留空）：`, "测试撤回");
        if (reason === null) {
          return;
        }

        await withdrawCashRequest(authSession.accessToken, row.apiRef.id, {
          reason: normalizeOptionalFormValue(reason),
        });
        setDetailRow(null);
        setFinanceReloadKey((current) => current + 1);
        setActionNotice({ tone: "emerald", text: "Cash 请求已撤回，来源记录已释放。" });
      } catch (error) {
        setActionNotice({ tone: "rose", text: formatApiError(error) });
      }
      return;
    }

    if (actionKey === "cashInbound.reject") {
      if (!authSession || row.apiRef?.resource !== "cashInbound") {
        setActionNotice({ tone: "amber", text: "请先使用真实 API 登录后再执行该动作。" });
        return;
      }

      const reason = window.prompt(
        `确认冲销 Cash 入站「${row.title}」？这会冲销对应账户流水，并把关联收入退回 Cash 已确认。请输入原因（可留空）：`,
        "测试冲销入站",
      );
      if (reason === null) {
        return;
      }

      try {
        await rejectCashInboundEvent(authSession.accessToken, row.apiRef.id, {
          reason: normalizeOptionalFormValue(reason),
        });
        setDetailRow(null);
        setFinanceReloadKey((current) => current + 1);
        setActionNotice({ tone: "emerald", text: "Cash 入站已冲销，对应账户流水已冲销。" });
      } catch (error) {
        setActionNotice({ tone: "rose", text: formatApiError(error) });
      }
      return;
    }

    if (actionKey === "reimbursement.void") {
      if (!authSession || row.apiRef?.resource !== "reimbursement") {
        setActionNotice({ tone: "amber", text: "请先使用真实 API 登录后再执行该动作。" });
        return;
      }

      const memo = window.prompt(
        `确认作废报销「${row.title}」？这会冲销法人出金和垫付入金两条流水。请输入原因（可留空）：`,
        "测试作废报销",
      );
      if (memo === null) {
        return;
      }

      try {
        const result = await voidReimbursement(authSession.accessToken, row.apiRef.id, {
          memo: normalizeOptionalFormValue(memo),
        });
        setDetailRow(null);
        setFinanceReloadKey((current) => current + 1);
        setActionNotice({
          tone: "emerald",
          text: result.idempotent ? "该报销已经作废，列表已刷新。" : "报销已作废，关联账户流水已冲销。",
        });
      } catch (error) {
        setActionNotice({ tone: "rose", text: formatApiError(error) });
      }
      return;
    }

    if (actionKey === "income.void" || actionKey === "expense.void") {
      if (!authSession || !row.apiRef) {
        setActionNotice({ tone: "amber", text: "请先使用真实 API 登录后再执行该动作。" });
        return;
      }

      const reason = window.prompt(`确认作废「${row.title}」？请输入作废原因（可留空）：`, "测试作废");
      if (reason === null) {
        return;
      }

      try {
        if (actionKey === "income.void") {
          await voidIncomeRecord(authSession.accessToken, row.apiRef.id, {
            reason: normalizeOptionalFormValue(reason),
          });
        } else {
          await voidExpenseRecord(authSession.accessToken, row.apiRef.id, {
            reason: normalizeOptionalFormValue(reason),
          });
        }

        setDetailRow(null);
        setFinanceReloadKey((current) => current + 1);
        if (actionKey === "income.void") {
          setStudentChainReloadKey((current) => current + 1);
        }
        if (actionKey === "expense.void" && row.financeRecord?.sourceType === "teacher_wage_snapshot") {
          setWorkflowReloadKey((current) => current + 1);
          setActionNotice({ tone: "emerald", text: "老师工资支出已作废，工资快照已释放，可继续撤销或重新生成。" });
        } else {
          setActionNotice({ tone: "emerald", text: "财务记录已作废。" });
        }
      } catch (error) {
        setActionNotice({ tone: "rose", text: formatApiError(error) });
      }
      return;
    }

    if (!authSession || !row.apiRef) {
      setActionNotice({ tone: "amber", text: "请先使用真实 API 登录后再执行该动作。" });
      return;
    }

    const isTeacherAction = actionKey.startsWith("teacher.");
    const isRestore = actionKey === "student.restore" || actionKey === "teacher.restore";
    const entityLabel = isTeacherAction ? "老师" : "学生";
    const confirmed = window.confirm(`确认${isRestore ? "恢复" : "归档"}${entityLabel}「${row.title}」？`);
    if (!confirmed) {
      return;
    }

    try {
      if (actionKey === "student.restore") {
        await restoreStudent(authSession.accessToken, row.apiRef.id);
      } else if (actionKey === "student.archive") {
        await archiveStudent(authSession.accessToken, row.apiRef.id);
      } else if (actionKey === "teacher.restore") {
        await restoreTeacher(authSession.accessToken, row.apiRef.id);
      } else {
        await archiveTeacher(authSession.accessToken, row.apiRef.id);
      }

      setDetailRow(null);
      if (isTeacherAction) {
        setTeacherReloadKey((current) => current + 1);
      } else {
        setStudentReloadKey((current) => current + 1);
      }
      setActionNotice({ tone: "emerald", text: isRestore ? `${entityLabel}已恢复。` : `${entityLabel}已归档。` });
    } catch (error) {
      setActionNotice({ tone: "rose", text: formatApiError(error) });
    }
  };

  const submitTeacherForm = async (input: TeacherWriteInput) => {
    if (!authSession) {
      setTeacherMutationError("请先使用真实 API 登录后再保存。");
      return;
    }

    if (teacherDialog?.mode === "edit" && !teacherDialog.row.apiRef) {
      setTeacherMutationError("这条 demo 数据没有后端记录，不能提交保存。");
      return;
    }

    setIsTeacherSubmitting(true);
    setTeacherMutationError(null);

    try {
      if (teacherDialog?.mode === "edit") {
        await updateTeacher(authSession.accessToken, teacherDialog.row.apiRef!.id, input);
        setActionNotice({ tone: "emerald", text: "老师基础信息已保存。" });
      } else {
        await createTeacher(authSession.accessToken, input);
        setActionNotice({ tone: "emerald", text: "老师已创建。" });
      }

      setTeacherDialog(null);
      setDetailRow(null);
      setTeacherReloadKey((current) => current + 1);
    } catch (error) {
      setTeacherMutationError(formatApiError(error));
    } finally {
      setIsTeacherSubmitting(false);
    }
  };

  const submitFinanceForm = async (input: ManualIncomeInput | ManualExpenseInput) => {
    if (!authSession || !financeDialog) {
      setFinanceMutationError("请先使用真实 API 登录后再保存。");
      return;
    }

    setIsFinanceSubmitting(true);
    setFinanceMutationError(null);

    try {
      if (financeDialog.kind === "income") {
        await createManualIncome(authSession.accessToken, input as ManualIncomeInput);
        setActionNotice({ tone: "emerald", text: "手动收入已创建。" });
      } else {
        await createManualExpense(authSession.accessToken, input as ManualExpenseInput);
        setActionNotice({ tone: "emerald", text: "手动支出已创建。" });
      }

      setFinanceDialog(null);
      setDetailRow(null);
      setFinanceReloadKey((current) => current + 1);
    } catch (error) {
      setFinanceMutationError(formatApiError(error));
    } finally {
      setIsFinanceSubmitting(false);
    }
  };

  const submitCashRequestForm = async (input: SubmitCashRequestInput) => {
    if (!authSession || !cashRequestDialog?.row.apiRef || !cashRequestDialog.row.financeRecord) {
      setCashRequestError("请先使用真实 API 登录后再提交 Cash 请求。");
      return;
    }

    setIsCashRequestSubmitting(true);
    setCashRequestError(null);

    try {
      if (cashRequestDialog.row.financeRecord.kind === "income") {
        await submitIncomeCashRequest(authSession.accessToken, cashRequestDialog.row.apiRef.id, input);
      } else {
        await submitExpenseCashRequest(authSession.accessToken, cashRequestDialog.row.apiRef.id, input);
      }

      setCashRequestDialog(null);
      setDetailRow(null);
      setFinanceReloadKey((current) => current + 1);
      setStudentChainReloadKey((current) => current + 1);
      setActionNotice({ tone: "emerald", text: "Cash 请求已提交。" });
    } catch (error) {
      setCashRequestError(formatApiError(error));
    } finally {
      setIsCashRequestSubmitting(false);
    }
  };

  useEffect(() => {
    if (!authSession || !cashRequestDialog) {
      return;
    }

    let isMounted = true;
    setCashRequestError(null);
    void listCashEligibleAccounts(authSession.accessToken)
      .then((result) => {
        if (!isMounted) return;
        setCashEligibleAccounts(result.items);
        setCashIntegrationMode(result.mode);
        if (result.items.length === 0) {
          setCashRequestError("当前环境没有可用的 Cash 账户，请先检查联动配置。");
        }
      })
      .catch((error) => {
        if (!isMounted) return;
        setCashEligibleAccounts([]);
        setCashIntegrationMode("disabled");
        setCashRequestError(formatApiError(error));
      });

    return () => {
      isMounted = false;
    };
  }, [authSession, cashRequestDialog]);

  const issueCurrentTuitionReceipt = async () => {
    if (!authSession || !tuitionReceiptDialog) {
      setActionNotice({ tone: "amber", text: "请先使用真实 API 登录后再开具学费收据。" });
      return;
    }

    setIsTuitionReceiptIssuing(true);

    try {
      const result = await issueTuitionReceipt(
        authSession.accessToken,
        tuitionReceiptDialog.receipt.incomeRecordId,
      );
      setTuitionReceiptDialog({ receipt: result.receipt });
      setFinanceReloadKey((current) => current + 1);
      setActionNotice({
        tone: "emerald",
        text: result.created
          ? `学费收据 ${result.receipt.receiptNo ?? ""} 已开具并固定快照。`
          : `已读取现有学费收据 ${result.receipt.receiptNo ?? ""}。`,
      });
    } catch (error) {
      setActionNotice({ tone: "rose", text: formatApiError(error) });
    } finally {
      setIsTuitionReceiptIssuing(false);
    }
  };

  const submitReimbursementForm = async (input: ReimbursementFormInput) => {
    if (!authSession) {
      setReimbursementMutationError("请先使用真实 API 登录后再生成报销。");
      return;
    }

    setIsReimbursementSubmitting(true);
    setReimbursementMutationError(null);

    try {
      await createReimbursementFromExpense(authSession.accessToken, input.expenseRecordId, {
        corporateAccountId: input.corporateAccountId,
        reimbursementDate: input.reimbursementDate,
        memo: input.memo,
      });
      setReimbursementDialog(null);
      setDetailRow(null);
      setFinanceReloadKey((current) => current + 1);
      setActionNotice({ tone: "emerald", text: "报销已生成，法人账户和垫付账户流水已创建。" });
    } catch (error) {
      setReimbursementMutationError(formatApiError(error));
    } finally {
      setIsReimbursementSubmitting(false);
    }
  };

  const setSelected = (next: Set<string>) => {
    setSelectedByPage((current) => ({ ...current, [activeKey]: next }));
  };

  const toggleRow = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  };

  const toggleAll = () => {
    if (!activePage) {
      return;
    }
    if (selected.size === activePage.rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(activePage.rows.map((row) => row.id)));
    }
  };

  const navigate = (key: string) => {
    setActiveKey(key);
    setDetailRow(null);
    setShowCashModal(false);
    setShowSettlementBatchModal(false);
    setStudentDialog(null);
    setTeacherDialog(null);
    setTuitionBillDialog(null);
    setStudentSettlementDialog(null);
    setFinanceDialog(null);
    setPlannedLessonDialog(null);
    setTuitionReceiptDialog(null);
    setCashRequestDialog(null);
    setReimbursementDialog(null);
    setMigrationAuditDialog(null);
    setLessonActionSubmittingId(null);
    setLessonActualDialog(null);
    setLessonActualError(null);
  };

  const pageForTopBar = activePage ?? {
    group: "工作台",
    title: "首页",
  };
  const currentUser = authSession?.user ?? {
    displayName: "系统管理员",
    email: "polariss710@gmail.com",
  };

  if (isAuthRestoring) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <div className="flex items-center gap-2 text-sm">
          <RefreshCw className="h-4 w-4 animate-spin" />
          正在恢复登录状态
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen apiHealth={apiHealth} onLogin={handleLogin} onRefreshApi={refreshApiHealth} />;
  }

  return (
    <div
      className="flex min-h-screen bg-background text-foreground"
      style={{ fontFamily: "'Noto Sans SC', sans-serif", fontSize: 14 }}
    >
      <Sidebar activeKey={activeKey} onNavigate={navigate} user={currentUser} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          page={pageForTopBar}
          apiHealth={apiHealth}
          authMode={authMode}
          onRefreshApi={refreshApiHealth}
          onLogout={handleLogout}
        />
        {activeKey === "dashboard" ? (
          <Dashboard onNavigate={navigate} />
        ) : activeKey === "lesson-management" && activePage ? (
          <LessonManagementPage
            page={activePage}
            pairs={activeLessonPairs}
            onPrimary={openPlannedLessonCreate}
            onLessonAction={handleLessonAction}
            lessonActionSubmittingId={lessonActionSubmittingId}
          />
        ) : activeKey === "external-lessons" && activePage ? (
          <ExternalWorkLessonsPage page={activePage} pairs={activeExternalWorkPairs} onOpenDetail={setDetailRow} />
        ) : activeKey === "settings" && activePage ? (
          <SettingsPage
            page={activePage}
            settingsApi={settingsApi}
            activeTab={settingsActiveTab}
            onTabChange={setSettingsActiveTab}
            onOpenDetail={setDetailRow}
          />
        ) : activePage ? (
          <BusinessPage
            page={activePage}
            selected={selected}
            onToggleAll={toggleAll}
            onToggleRow={toggleRow}
            onOpenDetail={setDetailRow}
            onPrimary={
              activeKey === "students"
                  ? openStudentCreate
                  : activeKey === "teachers"
                    ? openTeacherCreate
                    : activeKey === "tuition-bills"
                      ? openTuitionBillCreate
                    : activeKey === "student-settlements"
                      ? openStudentSettlementCreate
                    : activeKey === "teacher-rules"
                      ? openTeacherWageRuleCreate
                    : activeKey === "teacher-wages"
                      ? openTeacherWageCreate
                    : activeKey === "income-records"
                      ? () => openFinanceCreate("income")
                    : activeKey === "expense-records"
                      ? () => openFinanceCreate("expense")
                    : activeKey === "reimbursements"
                      ? openReimbursementCreate
                  : undefined
            }
          />
        ) : (
          <Dashboard onNavigate={navigate} />
        )}
      </div>

      {activePage && (
        <BatchActionBar
          page={activePage}
          selectedRows={selectedRows}
          onClear={() => setSelected(new Set())}
          onCash={() => setShowCashModal(true)}
          onLock={activeKey === "student-settlements" ? () => setShowSettlementBatchModal(true) : undefined}
        />
      )}
      <DetailDrawer row={detailRow} onClose={() => setDetailRow(null)} onAction={handleDrawerAction} />
      {showCashModal && <CashModal rows={selectedRows} onClose={() => setShowCashModal(false)} />}
      {showSettlementBatchModal && <SettlementBatchModal onClose={() => setShowSettlementBatchModal(false)} />}
      {studentDialog && (
        <StudentFormModal
          state={studentDialog}
          isSubmitting={isStudentSubmitting}
          error={studentMutationError}
          onClose={() => setStudentDialog(null)}
          onSubmit={submitStudentForm}
        />
      )}
      {teacherDialog && (
        <TeacherFormModal
          state={teacherDialog}
          isSubmitting={isTeacherSubmitting}
          error={teacherMutationError}
          onClose={() => setTeacherDialog(null)}
          onSubmit={submitTeacherForm}
        />
      )}
      {plannedLessonDialog && (
        <PlannedLessonCreateModal
          state={plannedLessonDialog}
          students={studentApi.rows.flatMap((row) => (row.studentRecord ? [row.studentRecord] : []))}
          teachers={teacherApi.rows.flatMap((row) => (row.teacherRecord ? [row.teacherRecord] : []))}
          subjects={settingsApi.subjects}
          businessEntities={settingsApi.businessEntities}
          isSubmitting={isPlannedLessonSubmitting}
          error={plannedLessonMutationError}
          onClose={() => setPlannedLessonDialog(null)}
          onSubmit={submitPlannedLessonForm}
        />
      )}
      {tuitionBillDialog && (
        <TuitionBillGenerateModal
          students={studentApi.rows.flatMap((row) => (row.studentRecord ? [row.studentRecord] : []))}
          state={tuitionBillDialog}
          isSubmitting={isTuitionBillSubmitting}
          error={tuitionBillMutationError}
          onClose={() => setTuitionBillDialog(null)}
          onPreview={requestTuitionBillPreview}
          onSubmit={submitTuitionBillForm}
        />
      )}
      {studentSettlementDialog && (
        <StudentSettlementModal
          students={studentApi.rows.flatMap((row) => (row.studentRecord ? [row.studentRecord] : []))}
          state={studentSettlementDialog}
          onClose={() => setStudentSettlementDialog(null)}
          onPreview={requestStudentSettlementPreview}
          onLock={submitStudentSettlementLock}
        />
      )}
      {teacherWageRuleDialog && (
        <TeacherWageRuleModal
          teachers={teacherApi.rows.flatMap((row) => (row.teacherRecord ? [row.teacherRecord] : []))}
          businessEntities={settingsApi.businessEntities}
          state={teacherWageRuleDialog}
          isSubmitting={isTeacherWageRuleSubmitting}
          error={teacherWageRuleError}
          onClose={() => setTeacherWageRuleDialog(null)}
          onSubmit={submitTeacherWageRule}
        />
      )}
      {teacherWageDialog && (
        <TeacherWageModal
          teachers={teacherApi.rows.flatMap((row) => (row.teacherRecord ? [row.teacherRecord] : []))}
          businessEntities={settingsApi.businessEntities}
          state={teacherWageDialog}
          onClose={() => setTeacherWageDialog(null)}
          onPreview={requestTeacherWagePreview}
          onLock={submitTeacherWageLock}
        />
      )}
      {teacherWageAdjustmentDialog && (
        <TeacherWageAdjustmentModal
          state={teacherWageAdjustmentDialog}
          onClose={() => setTeacherWageAdjustmentDialog(null)}
          onSave={submitTeacherWageAdjustments}
        />
      )}
      {teacherAttendanceImportDialog && (
        <TeacherAttendanceImportModal
          state={teacherAttendanceImportDialog}
          onClose={() => setTeacherAttendanceImportDialog(null)}
          onPreview={requestTeacherAttendanceImportPreview}
          onConfirm={submitTeacherAttendanceImport}
        />
      )}
      {financeDialog && (
        <FinanceRecordFormModal
          state={financeDialog}
          businessEntities={settingsApi.businessEntities}
          isSubmitting={isFinanceSubmitting}
          error={financeMutationError}
          onClose={() => setFinanceDialog(null)}
          onSubmit={submitFinanceForm}
        />
      )}
      {tuitionReceiptDialog && (
        <TuitionReceiptModal
          state={tuitionReceiptDialog}
          isIssuing={isTuitionReceiptIssuing}
          onClose={() => setTuitionReceiptDialog(null)}
          onIssue={issueCurrentTuitionReceipt}
          onPrintError={(message) => setActionNotice({ tone: "rose", text: message })}
        />
      )}
      {cashRequestDialog && (
        <CashRequestFormModal
          state={cashRequestDialog}
          accounts={cashEligibleAccounts}
          integrationMode={cashIntegrationMode}
          isSubmitting={isCashRequestSubmitting}
          error={cashRequestError}
          onClose={() => setCashRequestDialog(null)}
          onSubmit={submitCashRequestForm}
        />
      )}
      {reimbursementDialog && (
        <ReimbursementFormModal
          state={reimbursementDialog}
          isSubmitting={isReimbursementSubmitting}
          error={reimbursementMutationError}
          onClose={() => setReimbursementDialog(null)}
          onSubmit={submitReimbursementForm}
        />
      )}
      {migrationAuditDialog && (
        <MigrationAuditDialog state={migrationAuditDialog} onClose={() => setMigrationAuditDialog(null)} />
      )}
      {lessonActualDialog && (
        <LessonActualFormModal
          state={lessonActualDialog}
          isSubmitting={isLessonActualSubmitting}
          error={lessonActualError}
          onClose={() => {
            setLessonActualDialog(null);
            setLessonActualError(null);
          }}
          onSubmit={submitLessonActualForm}
        />
      )}
      <ActionNotice notice={actionNotice} onClose={() => setActionNotice(null)} />
    </div>
  );
}
