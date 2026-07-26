import { Fragment, useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, FileText, PencilLine, Plus, Search, Trash2, X } from "lucide-react";
import { createQuote, listQuotes, removeQuotePlanRow, updateQuote } from "./api";
import type { QuoteCalculationRow, QuoteRecord, QuoteWriteInput } from "./api";
import {
  applyQueryFilterDraft,
  createQueryFilterState,
  resetQueryFilterDraft,
  updateQueryFilterDraft,
} from "./query-filter-state.js";
import { readAppliedFilterQuery, replaceAppliedFilterQueryUrl } from "./filter-query-url.js";

const blank = (): QuoteWriteInput => ({
  prospectiveStudentName: "",
  title: "课程计划",
  courseTrack: "science",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  exchangeRate: 0.05,
  note: "",
  courses: [{ name: "日语", content: "日语", hoursPerSession: 2, weeklyFrequency: 1, unitPriceJpy: 10000 }],
});

const format = (value: string | number) => Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
const formatDate = (value: string) => value.slice(0, 10).replaceAll("-", "/");

function escapeQuoteHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function quotePlanRows(quote: QuoteRecord): QuoteCalculationRow[] {
  const removed = new Set(quote.calculationSnapshot?.removedRowKeys ?? []);
  return Array.isArray(quote.calculationSnapshot?.rows)
    ? quote.calculationSnapshot.rows.filter((row) => !removed.has(quotePlanRowKey(row)))
    : [];
}

function quotePlanRowKey(row: QuoteCalculationRow) {
  return `course:${row.courseIndex}:date:${row.weekAnchorDate}:slot:${row.occurrence}`;
}

function courseForRow(quote: QuoteRecord, row: QuoteCalculationRow) {
  return quote.courses.find((course) => course.sortOrder === row.courseIndex) ?? quote.courses[row.courseIndex];
}

type QuotePlanEntry = QuoteCalculationRow & {
  courseName: string;
  content: string;
  lessonNumber: number;
  monthKey: string;
  monthLabel: string;
  weekLabel: string;
};

type QuotePlanMonth = {
  key: string;
  label: string;
  rows: QuotePlanEntry[];
  totalHours: number;
  totalJpy: number;
  totalCny: number;
};

function formatMonthLabel(value: string) {
  const [year, month] = value.split("-");
  return `${year}年${Number(month)}月`;
}

function formatWeekLabel(value: string) {
  const [, month, day] = value.slice(0, 10).split("-");
  return `${Number(month)}.${Number(day)}周`;
}

function quotePlanMonths(quote: QuoteRecord): QuotePlanMonth[] {
  const counters = new Map<number, number>();
  const months = new Map<string, QuotePlanMonth>();
  const exchangeRate = Number(quote.exchangeRate);

  for (const row of quotePlanRows(quote)) {
    const course = courseForRow(quote, row);
    const lessonNumber = (counters.get(row.courseIndex) ?? 0) + 1;
    counters.set(row.courseIndex, lessonNumber);
    const monthKey = row.weekAnchorDate.slice(0, 7);
    const entry: QuotePlanEntry = {
      ...row,
      courseName: course?.name ?? "课程",
      content: course?.content ?? "",
      lessonNumber,
      monthKey,
      monthLabel: formatMonthLabel(monthKey),
      weekLabel: formatWeekLabel(row.weekAnchorDate),
    };
    const month = months.get(monthKey) ?? {
      key: monthKey,
      label: entry.monthLabel,
      rows: [],
      totalHours: 0,
      totalJpy: 0,
      totalCny: 0,
    };
    month.rows.push(entry);
    month.totalHours += Number(row.hours);
    month.totalJpy += Number(row.amountJpy);
    month.totalCny = Number((month.totalJpy * exchangeRate).toFixed(2));
    months.set(monthKey, month);
  }

  return [...months.values()];
}

function groupRowsByCourse(rows: QuotePlanEntry[]) {
  const groups = new Map<string, QuotePlanEntry[]>();
  for (const row of rows) groups.set(row.courseName, [...(groups.get(row.courseName) ?? []), row]);
  return [...groups.entries()].map(([courseName, courseRows]) => ({ courseName, rows: courseRows }));
}

function quoteDocumentTitle(quote: QuoteRecord) {
  const studentName = quote.prospectiveStudent.name.trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "");
  const title = quote.title.trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "") || "课程计划";
  return studentName ? `${studentName.endsWith("同学") ? studentName : `${studentName}同学`}${title}` : title;
}

function renderQuotePrintSummary(quote: QuoteRecord, monthCount: number) {
  return `<section class="quote-print-summary"><div><span>报价月份</span><strong>${monthCount} 个月</strong></div><div><span>总课时</span><strong>${escapeQuoteHtml(format(quote.totalHours))} H</strong></div><div><span>报价合计</span><strong>${escapeQuoteHtml(format(quote.totalJpy))} JPY</strong></div><div><span>人民币参考</span><strong>${escapeQuoteHtml(format(quote.totalCny))} CNY</strong></div></section>`;
}

function renderQuotePrintRows(rows: QuotePlanEntry[]) {
  return groupRowsByCourse(rows).map((group) => `<tr class="quote-course-group"><td colspan="5">${escapeQuoteHtml(group.courseName)}</td></tr>${group.rows.map((row) => `<tr><td>${escapeQuoteHtml(row.courseName)}</td><td>${escapeQuoteHtml(row.weekLabel)}</td><td>第${row.lessonNumber}回</td><td>${escapeQuoteHtml(row.content)}</td><td>${escapeQuoteHtml(format(row.hours))}</td></tr>`).join("")}`).join("");
}

function printQuotePlan(quote: QuoteRecord) {
  const printWindow = window.open("", "_blank", "width=900,height=1000");
  if (!printWindow) {
    throw new Error("浏览器阻止了打印窗口，请允许此页面打开弹窗后重试。");
  }

  printWindow.opener = null;
  const months = quotePlanMonths(quote);
  const period = `${formatDate(quote.startDate)} - ${formatDate(quote.endDate)}`;
  const pages = months.map((month, index) => `<article class="quote-print-page">
    <header class="quote-print-header"><div><p class="quote-print-kicker">${escapeQuoteHtml(quote.prospectiveStudent.name)}</p><h1>${escapeQuoteHtml(month.label)} ${escapeQuoteHtml(quote.title)}</h1><p class="quote-print-period">${escapeQuoteHtml(period)}</p></div><span class="quote-print-page-number">${index + 1} / ${months.length}</span></header>
    ${renderQuotePrintSummary(quote, months.length)}
    <table><thead><tr><th>科目</th><th>日期</th><th>回数</th><th>内容</th><th>时长(H)</th></tr></thead><tbody>${renderQuotePrintRows(month.rows)}</tbody></table>
    <footer class="quote-print-footer"><div><span>月度课时</span><strong>${escapeQuoteHtml(format(month.totalHours))} H</strong></div><div><span>月度合计</span><strong>${escapeQuoteHtml(format(month.totalJpy))} JPY</strong></div><div><span>人民币参考</span><strong>${escapeQuoteHtml(format(month.totalCny))} CNY</strong></div></footer>
  </article>`).join("");
  const quoteHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeQuoteHtml(quoteDocumentTitle(quote))}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #172033; font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", "Noto Sans CJK SC", sans-serif; }
    .quote-print-page { min-height: 260mm; break-after: page; page-break-after: always; } .quote-print-page:last-child { break-after: auto; page-break-after: auto; }
    .quote-print-header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #1687d9; padding: 0 0 9px; } .quote-print-kicker { margin: 0; color: #0f74bd; font-size: 12px; font-weight: 700; } h1 { margin: 3px 0 4px; font-size: 25px; line-height: 1.2; } .quote-print-period { margin: 0; color: #596579; font-size: 13px; font-weight: 600; } .quote-print-page-number { align-self: start; border: 1px solid #cfd8e6; border-radius: 999px; padding: 4px 9px; color: #596579; font-size: 11px; font-weight: 700; }
    .quote-print-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0; } .quote-print-summary div, .quote-print-footer div { border: 1px solid #b7d8ed; border-radius: 7px; background: #f4f8fd; padding: 8px; } .quote-print-summary span, .quote-print-footer span { display: block; color: #596579; font-size: 10px; } .quote-print-summary strong, .quote-print-footer strong { display: block; margin-top: 3px; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; } th, td { border: 1px solid #172033; padding: 6px 8px; text-align: left; vertical-align: middle; } th { background: #eaf1f8; text-align: center; font-weight: 700; } .quote-course-group td { background: #eaf5fd; color: #0f74bd; font-weight: 700; }
    .quote-print-footer { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
    @media print { .quote-print-page { min-height: 0; } }
  </style>
</head>
<body>
  <main>${pages || "<p>暂无已保存的计划行。</p>"}</main>
  <script>window.addEventListener("load", () => { window.focus(); window.print(); });<\/script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(quoteHtml);
  printWindow.document.close();
}

export function QuotePage({ accessToken }: { accessToken: string }) {
  const [items, setItems] = useState<QuoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const initialFilterScope = () => readAppliedFilterQuery(window.location.search, ["quote"], [])?.scope ?? { values: {}, keyword: "" };
  const [queryFilters, setQueryFilters] = useState(() => createQueryFilterState(initialFilterScope()));
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<QuoteRecord | null | undefined>(undefined);
  const [planning, setPlanning] = useState<QuoteRecord | null>(null);
  const [removingPlanRowKey, setRemovingPlanRowKey] = useState<string | null>(null);
  const [planRemovalError, setPlanRemovalError] = useState("");

  const reload = () => {
    setLoading(true);
    listQuotes(accessToken)
      .then((result) => setItems(result.items))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "报价读取失败"))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [accessToken]);

  const visible = useMemo(() => items.filter((item) => (
    `${item.title} ${item.prospectiveStudent.name}`.toLocaleLowerCase().includes(queryFilters.applied.keyword.toLocaleLowerCase())
  )), [items, queryFilters.applied.keyword]);
  const applyFilters = () => {
    const next = applyQueryFilterDraft(queryFilters);
    setQueryFilters(next);
    replaceAppliedFilterQueryUrl("quote", next.applied.values, next.applied.keyword);
    setNotice("");
  };
  const resetFilters = () => {
    setQueryFilters((current) => resetQueryFilterDraft(current, { values: {}, keyword: "" }));
    setNotice("已重置筛选条件；点击查询后刷新结果。");
  };
  const exportPlan = (quote: QuoteRecord) => {
    try {
      printQuotePlan(quote);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "打开 PDF 导出失败。");
    }
  };
  const removePlanRow = async (quote: QuoteRecord, row: QuoteCalculationRow) => {
    const rowKey = quotePlanRowKey(row);
    setRemovingPlanRowKey(rowKey);
    setPlanRemovalError("");
    try {
      const result = await removeQuotePlanRow(accessToken, quote.id, rowKey);
      setItems((current) => current.map((item) => item.id === result.quote.id ? result.quote : item));
      setPlanning(result.quote);
      setNotice("已从报价草稿移除该计划行；汇总与 PDF 已同步更新。");
    } catch (reason) {
      setPlanRemovalError(reason instanceof Error ? reason.message : "删除计划行失败。");
    } finally {
      setRemovingPlanRowKey(null);
    }
  };

  return <main className="flex-1 space-y-4 overflow-auto px-6 py-5 pb-16">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-xl font-semibold">报价单</h1><p className="mt-1 text-sm text-muted-foreground">签约前独立草稿，不创建正式学生、课时或财务记录。</p></div>
      <button type="button" className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground" onClick={() => setEditing(null)}><Plus size={16} />新增报价</button>
    </div>
    <section className="rounded-lg border border-border bg-white p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]"><input value={queryFilters.draft.keyword} onChange={(event) => setQueryFilters((current) => updateQueryFilterDraft(current, { keyword: event.target.value }))} placeholder="搜索潜在学生或标题" className="h-9 rounded-md border border-input px-3 text-sm" /><button type="button" className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 text-sm text-primary-foreground" onClick={applyFilters}><Search size={15} />查询</button><button type="button" className="rounded-md border border-border px-3 text-sm" onClick={resetFilters}>重置</button></div>
      {notice && <p className="mt-2 text-xs text-muted-foreground">{notice}</p>}
    </section>
    <div className="grid gap-3 md:grid-cols-3"><Metric label="报价草稿" value={items.filter((item) => item.status === "draft").length} /><Metric label="当前查询" value={visible.length} /><Metric label="报价参考合计" value={`JPY ${format(visible.reduce((sum, item) => sum + item.totalJpy, 0))}`} /></div>
    <section className="rounded-lg border border-border bg-white">
      <div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">报价草稿记录</h2></div>
      {loading ? <p className="p-8 text-center text-sm text-muted-foreground">正在读取真实报价草稿…</p> : error ? <p className="p-8 text-center text-sm text-rose-600">{error}</p> : visible.length ? <div className="divide-y divide-border">{visible.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{item.prospectiveStudent.name} · {item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.startDate.slice(0, 10)} 至 {item.endDate.slice(0, 10)} · {item.courseTrack === "science" ? "理科" : "文科"} · {item.courses.map((course) => course.name).join(" / ")}</p></div><div className="flex flex-wrap items-center justify-end gap-2"><div className="mr-1 text-right text-sm"><p className="font-medium">JPY {format(item.totalJpy)}</p><p className="text-xs text-muted-foreground">CNY 参考 {format(item.totalCny)}</p></div><button type="button" className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm" onClick={() => setPlanning(item)}><CalendarDays size={15} />课程计划</button><button type="button" className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm" onClick={() => exportPlan(item)}><Download size={15} />导出 PDF</button><button type="button" className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm" onClick={() => setEditing(item)}><PencilLine size={15} />编辑</button></div></div>)}</div> : <p className="p-8 text-center text-sm text-muted-foreground">暂无符合条件的报价草稿</p>}
    </section>
    {editing !== undefined && <QuoteModal quote={editing} accessToken={accessToken} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); reload(); setNotice("报价草稿已保存。"); }} />}
    {planning && <QuotePlanModal quote={planning} onClose={() => { setPlanning(null); setPlanRemovalError(""); }} onExport={() => exportPlan(planning)} onRemove={(row) => removePlanRow(planning, row)} removingPlanRowKey={removingPlanRowKey} removalError={planRemovalError} />}
  </main>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-border bg-white p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>;
}

function QuotePlanModal({ quote, onClose, onExport, onRemove, removingPlanRowKey, removalError }: { quote: QuoteRecord; onClose: () => void; onExport: () => void; onRemove: (row: QuoteCalculationRow) => void; removingPlanRowKey: string | null; removalError: string }) {
  const months = quotePlanMonths(quote);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4"><section className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-lg bg-white p-5 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 font-semibold"><CalendarDays size={18} />课程计划预览</h2><p className="mt-1 text-xs text-muted-foreground">按月阅读；每科“第 N 回”在整份报价内连续计数。计划仅来自已保存的报价快照。</p></div><button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-muted" onClick={onClose} aria-label="关闭课程计划预览"><X size={18} /></button></div><div className="mt-5 space-y-5">{months.length ? months.map((month, index) => <article key={month.key} className="overflow-hidden rounded-lg border border-border"><header className="flex items-start justify-between gap-4 border-b-2 border-[#1687D9] px-4 py-4"><div><p className="text-xs font-semibold text-[#0f74bd]">{quote.prospectiveStudent.name}</p><h3 className="mt-1 text-lg font-semibold">{month.label} {quote.title}</h3><p className="mt-1 text-xs font-medium text-muted-foreground">{formatDate(quote.startDate)} - {formatDate(quote.endDate)}</p></div><span className="rounded-full border border-border px-2 py-1 text-xs font-semibold text-muted-foreground">{index + 1} / {months.length}</span></header><div className="grid gap-2 border-b border-border bg-slate-50 p-3 md:grid-cols-4"><Metric label="报价月份" value={`${months.length} 个月`} /><Metric label="总课时" value={`${format(quote.totalHours)} H`} /><Metric label="报价合计" value={`${format(quote.totalJpy)} JPY`} /><Metric label="人民币参考" value={`${format(quote.totalCny)} CNY`} /></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead className="bg-slate-100 text-left text-xs"><tr><th className="border border-border px-3 py-2 text-center">科目</th><th className="border border-border px-3 py-2 text-center">日期</th><th className="border border-border px-3 py-2 text-center">回数</th><th className="border border-border px-3 py-2">内容</th><th className="border border-border px-3 py-2 text-center">时长(H)</th></tr></thead><tbody>{groupRowsByCourse(month.rows).map((group) => <Fragment key={group.courseName}><tr className="bg-[#eaf5fd] text-[#0f74bd]"><td colSpan={5} className="border border-border px-3 py-2 font-semibold">{group.courseName}</td></tr>{group.rows.map((row) => <tr key={`${row.weekAnchorDate}-${row.courseIndex}-${row.occurrence}`}><td className="border border-border px-3 py-2 text-center">{row.courseName}</td><td className="border border-border px-3 py-2 text-center">{row.weekLabel}</td><td className="border border-border px-3 py-2 text-center">第{row.lessonNumber}回</td><td className="border border-border px-3 py-2">{row.content}</td><td className="border border-border px-3 py-2 text-center"><span>{format(row.hours)}</span>{quote.status === "draft" && <button type="button" disabled={removingPlanRowKey !== null} onClick={() => onRemove(row)} className="ml-2 inline-flex items-center gap-1 rounded border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"><Trash2 size={12} />{removingPlanRowKey === quotePlanRowKey(row) ? "删除中…" : "删除"}</button>}</td></tr>)}</Fragment>)}</tbody></table></div><footer className="grid gap-2 p-3 md:grid-cols-3"><Metric label="月度课时" value={`${format(month.totalHours)} H`} /><Metric label="月度合计" value={`${format(month.totalJpy)} JPY`} /><Metric label="人民币参考" value={`${format(month.totalCny)} CNY`} /></footer></article>) : <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">此报价缺少已保存的计划快照。</p>}</div>{removalError && <p className="mt-3 text-sm text-rose-600">{removalError}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded-md border border-border px-3 py-2 text-sm" onClick={onClose}>关闭</button><button type="button" className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={onExport}><Download size={15} />打印 / 保存 PDF</button></div></section></div>;
}

function QuoteModal({ quote, accessToken, onClose, onSaved }: { quote: QuoteRecord | null; accessToken: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<QuoteWriteInput>(() => quote ? { prospectiveStudentName: quote.prospectiveStudent.name, prospectiveStudentMemo: quote.prospectiveStudent.memo, title: quote.title, courseTrack: quote.courseTrack as "science" | "humanities", startDate: quote.startDate.slice(0, 10), endDate: quote.endDate.slice(0, 10), exchangeRate: Number(quote.exchangeRate), note: quote.note, courses: quote.courses.map((course) => ({ name: course.name, content: course.content, hoursPerSession: Number(course.hoursPerSession), weeklyFrequency: course.weeklyFrequency, unitPriceJpy: course.unitPriceJpy })) } : blank());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = <K extends keyof QuoteWriteInput>(key: K, value: QuoteWriteInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const updateCourse = (index: number, patch: Partial<QuoteWriteInput["courses"][number]>) => update("courses", form.courses.map((item, currentIndex) => currentIndex === index ? { ...item, ...patch } : item));
  const save = async () => { setSaving(true); setError(""); try { quote ? await updateQuote(accessToken, quote.id, form) : await createQuote(accessToken, form); onSaved(); } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败"); } finally { setSaving(false); } };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-5 shadow-xl"><div className="flex items-center gap-2"><FileText size={18} /><h2 className="font-semibold">{quote ? "编辑报价草稿" : "新增报价草稿"}</h2></div><div className="mt-4 grid gap-3 md:grid-cols-2"><Field label="潜在学生姓名" value={form.prospectiveStudentName} onChange={(value) => update("prospectiveStudentName", value)} /><Field label="文件标题" value={form.title ?? ""} onChange={(value) => update("title", value)} /><Field label="开始日期" type="date" value={form.startDate} onChange={(value) => update("startDate", value)} /><Field label="结束日期" type="date" value={form.endDate} onChange={(value) => update("endDate", value)} /><Field label="内部汇率 (1 JPY = CNY)" type="number" step="0.0001" min="0.0000001" value={String(form.exchangeRate)} onChange={(value) => update("exchangeRate", Number(value))} /><select aria-label="课程方向" value={form.courseTrack} onChange={(event) => update("courseTrack", event.target.value as "science" | "humanities")} className="h-10 rounded-md border border-input px-3 text-sm"><option value="science">理科</option><option value="humanities">文科</option></select></div><div className="mt-5 space-y-3"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">课程目录</h3><button type="button" className="text-sm text-primary" onClick={() => update("courses", [...form.courses, { name: "", content: "", hoursPerSession: 2, weeklyFrequency: 1, unitPriceJpy: 10000 }])}>新增课程</button></div>{form.courses.map((course, index) => <div key={index} className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-5"><Field label="课程" value={course.name} onChange={(value) => updateCourse(index, { name: value })} /><Field label="内容" value={course.content ?? ""} onChange={(value) => updateCourse(index, { content: value })} /><Field label="每次 H" type="number" step="0.25" min="0.01" value={String(course.hoursPerSession)} onChange={(value) => updateCourse(index, { hoursPerSession: Number(value) })} /><Field label="每周次数" type="number" step="1" min="1" value={String(course.weeklyFrequency)} onChange={(value) => updateCourse(index, { weeklyFrequency: Number(value) })} /><Field label="JPY/H" type="number" step="1" min="0" value={String(course.unitPriceJpy)} onChange={(value) => updateCourse(index, { unitPriceJpy: Number(value) })} /></div>)}</div>{error && <p className="mt-3 text-sm text-rose-600">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded-md border border-border px-3 py-2 text-sm" onClick={onClose}>取消</button><button type="button" disabled={saving} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={save}>{saving ? "保存中…" : "保存草稿"}</button></div></div></div>;
}

function Field({ label, value, onChange, type = "text", step, min }: { label: string; value: string; onChange: (value: string) => void; type?: string; step?: string; min?: string }) {
  return <label className="grid gap-1 text-xs text-muted-foreground"><span>{label}</span><input type={type} value={value} step={step} min={min} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-md border border-input px-3 text-sm text-foreground" /></label>;
}
