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
  createStudent,
  createTeacher,
  fetchApiHealthSnapshot,
  isApiRequestError,
  listAccountTransactions,
  listAccounts,
  listBusinessEntities,
  listExpenseRecords,
  listExternalWorkplaces,
  listIncomeRecords,
  listSubjects,
  listStudents,
  listTeachers,
  loginWithPassword,
  restoreStudent,
  restoreTeacher,
  updateStudent,
  updateTeacher,
} from "./api";
import type {
  ApiHealthSnapshot,
  AccountRecord,
  AccountTransactionRecord,
  AuthSession,
  BusinessEntityRecord,
  ExpenseRecord,
  ExternalWorkplaceRecord,
  IncomeRecord,
  StudentRecord,
  StudentWriteInput,
  SubjectRecord,
  TeacherRecord,
  TeacherWriteInput,
} from "./api";

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
    resource: "student" | "teacher";
    id: string;
  };
  studentRecord?: StudentRecord;
  teacherRecord?: TeacherRecord;
  settingCategory?: SettingCategory;
  readOnlyActions?: boolean;
}

type DrawerActionVariant = "primary" | "secondary" | "quiet" | "danger" | "warning";
type DrawerActionKey =
  | "student.edit"
  | "student.archive"
  | "student.restore"
  | "teacher.edit"
  | "teacher.archive"
  | "teacher.restore";

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

type SettingCategory = "businessEntities" | "accounts" | "subjects" | "externalWorkplaces";

interface SettingsApiCounts {
  businessEntities: number;
  accounts: number;
  subjects: number;
  externalWorkplaces: number;
}

type SettingsApiState =
  | { status: "idle" | "loading"; rows: DataRow[]; counts: SettingsApiCounts; message?: string }
  | { status: "ready"; rows: DataRow[]; counts: SettingsApiCounts; message?: string }
  | { status: "error"; rows: DataRow[]; counts: SettingsApiCounts; message: string };

type FinanceListState =
  | { status: "idle" | "loading"; rows: DataRow[]; total: number; message?: string }
  | { status: "ready"; rows: DataRow[]; total: number; message?: string }
  | { status: "error"; rows: DataRow[]; total: number; message: string };

interface FinanceApiState {
  incomeRecords: FinanceListState;
  expenseRecords: FinanceListState;
  accountLedger: FinanceListState;
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
      ? "API 检查中"
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

function FilterSelect({ filter }: { filter: Filter }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{filter.label}</span>
      <span className="relative">
        <select className="h-9 w-full appearance-none rounded-md border border-border bg-white py-1.5 pl-3 pr-8 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-ring">
          <option>全部</option>
          {filter.options.map((option) => (
            <option key={option}>{option}</option>
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

function FilterPanel({ filters }: { filters: Filter[] }) {
  return (
    <section className="rounded-lg border border-border bg-white px-5 py-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {filters.map((filter) => (
          <FilterSelect key={filter.label} filter={filter} />
        ))}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">关键词</span>
          <span className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-9 w-full rounded-md border border-border bg-white py-1.5 pl-8 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-ring"
              placeholder="搜索姓名、对象或备注"
            />
          </span>
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-border/70 pt-3">
        <ActionButton icon={Search}>查询</ActionButton>
        <ActionButton icon={RotateCcw} variant="quiet">
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
                        onClick={() => onOpenDetail(row)}
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        title="查看详情"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        title="更多操作"
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
  if (row.readOnlyActions) {
    return [];
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
    if (row.status === "待提交 Cash") {
      return [
        {
          title: "学费账单操作",
          actions: [
            { label: "提交 Cash 请求", icon: Send, variant: "primary", hint: "由后端确认请求金额后提交 Cash" },
            { label: "查看通知金额预览", icon: FileText, variant: "secondary" },
            { label: "查看收入记录", icon: ReceiptText, variant: "secondary" },
            { label: "作废账单", icon: X, variant: "danger" },
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
    if (row.status === "待锁定") {
      return [
        {
          title: "月度结算操作",
          actions: [
            { label: "锁定结算", icon: LockKeyhole, variant: "primary" },
            { label: "重新生成预览", icon: RefreshCw, variant: "secondary" },
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
          { label: "查看下月结转", icon: RefreshCw, variant: "secondary" },
          { label: "查看课时明细", icon: CalendarDays, variant: "quiet" },
          { label: "撤销锁定", icon: X, variant: "warning" },
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
          { label: "编辑规则", icon: PencilLine, variant: "primary" },
          { label: "复制为新规则", icon: FileText, variant: "secondary" },
          { label: "停用规则", icon: X, variant: "warning" },
          { label: "查看操作记录", icon: History, variant: "quiet" },
        ],
      },
    ];
  }

  if (row.id.startsWith("wage-")) {
    return [
      {
        title: "工资结算操作",
        actions: [
          { label: "查看工资明细", icon: Eye, variant: "secondary" },
          { label: "确认调整", icon: CheckCircle2, variant: "primary" },
          { label: "生成支出记录", icon: ReceiptText, variant: "primary" },
          { label: "查看已生成支出记录", icon: FileText, variant: "quiet" },
          { label: "查看操作记录", icon: History, variant: "quiet" },
        ],
      },
    ];
  }

  if (row.id.startsWith("import-")) {
    return [
      {
        title: "勤务表导入操作",
        actions: [
          { label: "下载勤务表", icon: Download, variant: "secondary" },
          { label: "上传老师回传文件", icon: FileText, variant: "primary" },
          { label: "预览读取结果", icon: Eye, variant: "secondary" },
          { label: "导入交通费 / 教室费", icon: RefreshCw, variant: "primary" },
          { label: "查看导入日志", icon: History, variant: "quiet" },
          { label: "作废本次导入", icon: X, variant: "warning" },
        ],
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

function formatApiError(error: unknown) {
  if (isApiRequestError(error)) {
    return error.responseText || `HTTP ${error.status}`;
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
  return (
    <main className="flex-1 space-y-4 overflow-auto px-6 py-5 pb-28">
      <PageHeader page={page} onPrimary={onPrimary} />
      <FilterPanel filters={page.filters} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {page.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>
      <DataTable
        page={page}
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
    description: "真实 dev API 只读设置列表；新增和编辑入口后续按类型逐步接入",
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
    accountLedger: createEmptyFinanceListState(),
  };
}

function buildIncomeRecordsPage(basePage: PageConfig, incomeApi: FinanceListState): PageConfig {
  if (incomeApi.status !== "ready") {
    return basePage;
  }

  const cashTodoCount = incomeApi.rows.filter((row) =>
    ["待提交 Cash", "Cash 待确认", "需要复核", "Cash 已拒绝"].includes(row.status),
  ).length;
  const confirmedCount = incomeApi.rows.filter((row) => ["Cash 已确认", "已生成流水"].includes(row.status)).length;
  const voidedCount = incomeApi.rows.filter((row) => row.status === "已作废").length;

  return {
    ...basePage,
    description: "真实 dev API 收入记录列表；新增和 Cash 提交动作后续接入",
    primaryAction: undefined,
    batchAction: undefined,
    selectable: false,
    metrics: [
      { label: "收入记录", value: `${incomeApi.total} 条`, sub: "来自 dev API", tone: "emerald", icon: ReceiptText },
      { label: "Cash 待处理", value: `${cashTodoCount} 条`, sub: "未提交 / 待确认 / 复核", tone: "amber", icon: Banknote },
      { label: "已确认", value: `${confirmedCount} 条`, sub: "Cash 已确认或已入账", tone: "sky", icon: CheckCircle2 },
      { label: "已作废", value: `${voidedCount} 条`, sub: "保留审计追踪", tone: "slate", icon: LockKeyhole },
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
  const voidedCount = expenseApi.rows.filter((row) => row.status === "已作废").length;

  return {
    ...basePage,
    description: "真实 dev API 支出记录列表；新增、工资生成和 Cash 提交动作后续接入",
    primaryAction: undefined,
    batchAction: undefined,
    selectable: false,
    metrics: [
      { label: "支出记录", value: `${expenseApi.total} 条`, sub: "来自 dev API", tone: "sky", icon: Banknote },
      { label: "Cash 待处理", value: `${cashTodoCount} 条`, sub: "未提交 / 待确认 / 复核", tone: "amber", icon: Clock },
      { label: "已确认", value: `${confirmedCount} 条`, sub: "Cash 已确认或已入账", tone: "emerald", icon: CheckCircle2 },
      { label: "已作废", value: `${voidedCount} 条`, sub: "保留审计追踪", tone: "slate", icon: LockKeyhole },
    ],
    rows: expenseApi.rows,
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
    description: "真实 dev API 账户流水列表；新增流水、收入/支出入账和冲销动作后续接入",
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

function mapIncomeRecordToRow(record: IncomeRecord): DataRow {
  const status = getFinancialRecordStatusView(record.recordStatus, record.cashStatus);
  const sourceLabel = getIncomeSourceLabel(record.sourceType);
  const businessEntityName = record.businessEntity?.name ?? "未设置业务归属";
  const amount = formatApiCurrencyAmount(record.originalCurrency, record.originalAmountJpy, record.originalAmountCny);
  const cashStatus = getCashStatusLabel(record.cashStatus);

  return {
    id: `income-${record.id}`,
    title: record.title,
    subtitle: `${sourceLabel} / ${businessEntityName}`,
    status: status.label,
    tone: status.tone,
    readOnlyActions: true,
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
          { label: "Cash 状态", value: cashStatus },
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

  return {
    id: `expense-${record.id}`,
    title: record.title,
    subtitle: `${category} / ${businessEntityName}`,
    status: status.label,
    tone: status.tone,
    readOnlyActions: true,
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
          { label: "Cash 状态", value: cashStatus },
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

function getFinancialRecordStatusView(recordStatus: string, cashStatus: string): { label: string; tone: Tone } {
  if (recordStatus === "voided") {
    return { label: "已作废", tone: "slate" };
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
}

const lessonManagementPage: PageConfig = {
  key: "lesson-management",
  group: "学生链路",
  title: "课时管理",
  description: "预定课时和实际课时左右对应处理；右侧用于生成实际、取消或登记补课完成",
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
      <div className="flex min-h-[76px] flex-col justify-center rounded-lg border border-dashed border-border bg-white px-3.5 py-2.5">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 text-sm font-semibold text-foreground">尚无实际课时</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{emptyHint}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[152px] flex-col rounded-lg border border-border bg-white px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            <StatusPill label={lesson.status} tone={lesson.tone} />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-base font-semibold text-foreground">{lesson.date}</span>
            <span className="truncate text-xs text-muted-foreground">{lesson.dateSub}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-1.5 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">学生</div>
          <div className="font-medium text-foreground">{lesson.student}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">老师</div>
          <div className="font-medium text-foreground">{lesson.teacher}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">科目</div>
          <div className="font-medium text-foreground">{lesson.subject}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">业务归属</div>
          <div className="font-medium text-foreground">{lesson.businessEntity}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">时长</div>
          <div className="font-medium text-foreground">{lesson.duration}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">金额</div>
          <div className="font-mono font-semibold text-foreground">{lesson.amount}</div>
        </div>
      </div>
      <div className="mt-auto truncate border-t border-border/60 pt-2 text-xs text-muted-foreground">内容：{lesson.content}</div>
    </div>
  );
}

function LessonActionPanel({ pair, compact = false }: { pair: LessonPair; compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-border bg-white px-3.5 ${compact ? "py-2.5" : "py-3"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">实际课时操作区</div>
          <div className="mt-0.5 truncate text-sm font-semibold text-foreground">{pair.relation}</div>
        </div>
        <button className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border bg-white px-2.5 text-xs font-medium text-foreground transition hover:bg-muted">
          <Eye className="h-3.5 w-3.5" />
          查看详情
        </button>
      </div>
      {!compact && <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{pair.actionHint}</p>}
      <div className={`${compact ? "mt-2" : "mt-3"} flex flex-wrap gap-2`}>
        <button
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[#1687D9] px-3 text-xs font-medium text-white transition hover:bg-[#0f74bd]"
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          生成实际
        </button>
        <button
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
        >
          <X className="h-3.5 w-3.5" />
          取消
        </button>
        <button
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-medium text-cyan-700 transition hover:bg-cyan-100"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          补课完成
        </button>
      </div>
    </div>
  );
}

function LessonActualColumn({ pair }: { pair: LessonPair }) {
  if (pair.actual) {
    return <LessonFactCard label="实际课时" lesson={pair.actual} />;
  }

  return (
    <div className="grid min-h-[152px] grid-rows-[76px_1fr] gap-2">
      <LessonFactCard label="实际课时" emptyHint={`关联：${pair.relation}`} />
      <LessonActionPanel pair={pair} compact />
    </div>
  );
}

function LessonManagementPage() {
  return (
    <main className="flex-1 space-y-4 overflow-auto px-6 py-5 pb-16">
      <PageHeader page={lessonManagementPage} />
      <FilterPanel filters={lessonManagementPage.filters} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {lessonManagementPage.metrics.map((metric) => (
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
          {lessonPairs.map((pair) => (
            <div className="grid items-start gap-3 xl:grid-cols-[1fr_1fr]" key={pair.id}>
              <LessonFactCard label="预定课时" lesson={pair.planned} />
              <LessonActualColumn pair={pair} />
            </div>
          ))}
        </div>
      </section>
    </main>
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

function ExternalWorkLessonsPage({ onOpenDetail }: { onOpenDetail: (row: DataRow) => void }) {
  return (
    <main className="flex-1 space-y-4 overflow-auto px-6 py-5 pb-16">
      <PageHeader page={externalWorkLessonsPage} />
      <FilterPanel filters={externalWorkLessonsPage.filters} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {externalWorkLessonsPage.metrics.map((metric) => (
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
          {externalWorkPairs.map((pair) => (
            <div className="grid gap-3 xl:grid-cols-[1fr_1fr]" key={pair.id}>
              <ExternalWorkFactCard label="预定课时" lesson={pair.planned} />
              <ExternalWorkActualColumn pair={pair} onOpenDetail={onOpenDetail} />
            </div>
          ))}
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
  onLogin: (session: AuthSession | null, mode: AuthMode) => void;
  onRefreshApi: () => void;
}) {
  const [email, setEmail] = useState("polariss710@gmail.com");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError(null);
    setIsSubmitting(true);

    try {
      const session = await loginWithPassword({ email, password });
      onLogin(session, "api");
    } catch (error) {
      if (isApiRequestError(error)) {
        setLoginError("账号或密码不正确，或账号尚未启用。");
        return;
      }

      onLogin(null, "demo");
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
    apiHealth.status === "online" && apiHealth.database === "online"
      ? "真实 API 已连接"
      : apiHealth.status === "checking"
        ? "正在检查 API"
        : "API 未连接，登录将进入 demo 模式";

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
                <input type="checkbox" className="h-4 w-4 rounded border-border text-[#1687D9]" defaultChecked />
                保持登录
              </label>
              <button type="button" className="text-xs font-medium text-[#1687D9] hover:underline">
                忘记密码
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-7 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#1687D9] px-4 text-sm font-medium text-white transition hover:bg-[#0f74bd] disabled:cursor-wait disabled:bg-[#8cbfe3]"
            >
              {isSubmitting ? "登录中" : "登录"}
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
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

export default function App() {
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
  });
  const [financeApi, setFinanceApi] = useState<FinanceApiState>(createEmptyFinanceApiState);
  const [settingsActiveTab, setSettingsActiveTab] = useState<SettingCategory>("businessEntities");
  const [actionNotice, setActionNotice] = useState<{ tone: "emerald" | "rose" | "amber"; text: string } | null>(null);
  const [activeKey, setActiveKey] = useState("dashboard");
  const [selectedByPage, setSelectedByPage] = useState<Record<string, Set<string>>>({});
  const [detailRow, setDetailRow] = useState<DataRow | null>(null);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showSettlementBatchModal, setShowSettlementBatchModal] = useState(false);

  const baseActivePage = pages[activeKey];
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

    if (activeKey === "income-records" && baseActivePage) {
      return buildIncomeRecordsPage(baseActivePage, financeApi.incomeRecords);
    }

    if (activeKey === "expense-records" && baseActivePage) {
      return buildExpenseRecordsPage(baseActivePage, financeApi.expenseRecords);
    }

    if (activeKey === "account-ledger" && baseActivePage) {
      return buildAccountLedgerPage(baseActivePage, financeApi.accountLedger);
    }

    return baseActivePage;
  }, [activeKey, baseActivePage, studentApi, teacherApi, settingsApi, financeApi]);
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
      setSettingsApi({ status: "idle", rows: [], counts: emptySettingsCounts });
      return;
    }

    let isMounted = true;

    setSettingsApi((current) => ({
      status: "loading",
      rows: current.rows,
      counts: current.counts,
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
          message: error instanceof Error ? error.message : "Settings API request failed",
        });
      });

    return () => {
      isMounted = false;
    };
  }, [authSession]);

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
      accountLedger: {
        status: "loading",
        rows: current.accountLedger.rows,
        total: current.accountLedger.total,
      },
    }));

    void Promise.all([
      listIncomeRecords(authSession.accessToken),
      listExpenseRecords(authSession.accessToken),
      listAccountTransactions(authSession.accessToken),
    ])
      .then(([incomeRecords, expenseRecords, accountTransactions]) => {
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
          accountLedger: {
            status: "ready",
            rows: accountTransactions.items.map(mapAccountTransactionToRow),
            total: accountTransactions.total,
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
          accountLedger: { status: "error", rows: [], total: 0, message },
        });
      });

    return () => {
      isMounted = false;
    };
  }, [authSession]);

  const handleLogin = (session: AuthSession | null, mode: AuthMode) => {
    setAuthSession(session);
    setAuthMode(mode);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
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
  };

  const pageForTopBar =
    activeKey === "lesson-management"
      ? lessonManagementPage
      : activePage ?? {
          group: "工作台",
          title: "首页",
        };
  const currentUser = authSession?.user ?? {
    displayName: "系统管理员",
    email: "polariss710@gmail.com",
  };

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
        ) : activeKey === "lesson-management" ? (
          <LessonManagementPage />
        ) : activeKey === "external-lessons" ? (
          <ExternalWorkLessonsPage onOpenDetail={setDetailRow} />
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
              activeKey === "student-settlements"
                ? () => setShowSettlementBatchModal(true)
                : activeKey === "students"
                  ? openStudentCreate
                  : activeKey === "teachers"
                    ? openTeacherCreate
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
      <ActionNotice notice={actionNotice} onClose={() => setActionNotice(null)} />
    </div>
  );
}
