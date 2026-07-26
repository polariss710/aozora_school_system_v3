import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, FileText, PencilLine, Plus, Search, X } from "lucide-react";
import { createQuote, listQuotes, updateQuote } from "./api";
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
  return Array.isArray(quote.calculationSnapshot?.rows) ? quote.calculationSnapshot.rows : [];
}

function groupedPlanRows(quote: QuoteRecord) {
  return quotePlanRows(quote).reduce<Array<{ weekAnchorDate: string; rows: QuoteCalculationRow[] }>>((weeks, row) => {
    const current = weeks.at(-1);
    if (current?.weekAnchorDate === row.weekAnchorDate) {
      current.rows.push(row);
      return weeks;
    }
    weeks.push({ weekAnchorDate: row.weekAnchorDate, rows: [row] });
    return weeks;
  }, []);
}

function courseForRow(quote: QuoteRecord, row: QuoteCalculationRow) {
  return quote.courses.find((course) => course.sortOrder === row.courseIndex) ?? quote.courses[row.courseIndex];
}

function printQuotePlan(quote: QuoteRecord) {
  const printWindow = window.open("", "_blank", "width=900,height=1000");
  if (!printWindow) {
    throw new Error("浏览器阻止了打印窗口，请允许此页面打开弹窗后重试。");
  }

  printWindow.opener = null;
  const rows = quotePlanRows(quote);
  const scheduleRows = rows.map((row, index) => {
    const course = courseForRow(quote, row);
    return `<tr><td>${index + 1}</td><td>${escapeQuoteHtml(formatDate(row.weekAnchorDate))}</td><td>${escapeQuoteHtml(course?.name ?? "课程")}</td><td>${escapeQuoteHtml(course?.content ?? "")}</td><td>${escapeQuoteHtml(format(row.hours))} H</td><td>第 ${row.occurrence + 1} 节</td><td>JPY ${escapeQuoteHtml(format(row.amountJpy))}</td></tr>`;
  }).join("");
  const quoteHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeQuoteHtml(quote.title)} - ${escapeQuoteHtml(quote.prospectiveStudent.name)}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #172033; font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", "Noto Sans CJK SC", sans-serif; }
    h1 { margin: 0; font-size: 27px; } h2 { margin: 26px 0 10px; font-size: 16px; }
    .sub { margin-top: 7px; color: #596579; font-size: 12px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 22px; }
    .summary div { border: 1px solid #cfd8e6; padding: 11px; } .summary span { display: block; color: #596579; font-size: 11px; } .summary strong { display: block; margin-top: 4px; font-size: 17px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; } th, td { border: 1px solid #cfd8e6; padding: 7px; text-align: left; vertical-align: top; } th { background: #eef6fd; font-weight: 600; }
    .note { margin-top: 24px; border-top: 1px solid #e2e7ef; padding-top: 10px; color: #596579; font-size: 10px; line-height: 1.6; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeQuoteHtml(quote.title)}</h1>
    <div class="sub">${escapeQuoteHtml(quote.prospectiveStudent.name)} · ${escapeQuoteHtml(formatDate(quote.startDate))} 至 ${escapeQuoteHtml(formatDate(quote.endDate))} · ${quote.courseTrack === "science" ? "理科" : "文科"}</div>
    <section class="summary"><div><span>计划课时</span><strong>${escapeQuoteHtml(format(quote.totalHours))} H</strong></div><div><span>参考合计</span><strong>JPY ${escapeQuoteHtml(format(quote.totalJpy))}</strong></div><div><span>CNY 参考</span><strong>${escapeQuoteHtml(format(quote.totalCny))}</strong></div></section>
    <h2>每周课程计划</h2>
    <table><thead><tr><th>#</th><th>计划周</th><th>课程</th><th>内容</th><th>时长</th><th>周内序号</th><th>参考金额</th></tr></thead><tbody>${scheduleRows || "<tr><td colspan=\"7\">暂无已保存的计划行。</td></tr>"}</tbody></table>
    <div class="note">本文件为签约前报价草稿的已保存计划快照。它不会创建正式学生、正式预定课时、账单、收入、支出或 Cash 记录；计划周不代表实际授课日期和时间。</div>
  </main>
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
      {loading ? <p className="p-8 text-center text-sm text-muted-foreground">正在读取真实报价草稿…</p> : error ? <p className="p-8 text-center text-sm text-rose-600">{error}</p> : visible.length ? <div className="divide-y divide-border">{visible.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{item.prospectiveStudent.name} · {item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.startDate.slice(0, 10)} 至 {item.endDate.slice(0, 10)} · {item.courseTrack === "science" ? "理科" : "文科"} · {item.courses.map((course) => course.name).join(" / ")}</p></div><div className="flex flex-wrap items-center justify-end gap-2"><div className="mr-1 text-right text-sm"><p className="font-medium">JPY {format(item.totalJpy)}</p><p className="text-xs text-muted-foreground">CNY 参考 {format(item.totalCny)}</p></div><button type="button" className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm" onClick={() => setPlanning(item)}><CalendarDays size={15} />每周计划</button><button type="button" className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm" onClick={() => exportPlan(item)}><Download size={15} />导出 PDF</button><button type="button" className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm" onClick={() => setEditing(item)}><PencilLine size={15} />编辑</button></div></div>)}</div> : <p className="p-8 text-center text-sm text-muted-foreground">暂无符合条件的报价草稿</p>}
    </section>
    {editing !== undefined && <QuoteModal quote={editing} accessToken={accessToken} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); reload(); setNotice("报价草稿已保存。"); }} />}
    {planning && <QuotePlanModal quote={planning} onClose={() => setPlanning(null)} onExport={() => exportPlan(planning)} />}
  </main>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-border bg-white p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>;
}

function QuotePlanModal({ quote, onClose, onExport }: { quote: QuoteRecord; onClose: () => void; onExport: () => void }) {
  const weeks = groupedPlanRows(quote);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4"><section className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-lg bg-white p-5 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 font-semibold"><CalendarDays size={18} />每周课程计划</h2><p className="mt-1 text-xs text-muted-foreground">{quote.prospectiveStudent.name} · 已保存的报价草稿快照；不代表正式课时或实际授课时间。</p></div><button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-muted" onClick={onClose} aria-label="关闭每周课程计划"><X size={18} /></button></div><div className="mt-4 grid gap-3 md:grid-cols-3"><Metric label="计划课时" value={`${format(quote.totalHours)} H`} /><Metric label="计划行数" value={quotePlanRows(quote).length} /><Metric label="参考合计" value={`JPY ${format(quote.totalJpy)}`} /></div><div className="mt-5 space-y-3">{weeks.length ? weeks.map((week) => <section key={week.weekAnchorDate} className="overflow-hidden rounded-md border border-border"><div className="border-b border-border bg-slate-50 px-4 py-2 text-sm font-medium">计划周：{formatDate(week.weekAnchorDate)}</div><div className="divide-y divide-border">{week.rows.map((row, index) => { const course = courseForRow(quote, row); return <div key={`${row.weekAnchorDate}-${row.courseIndex}-${row.occurrence}-${index}`} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]"><span className="font-medium">{course?.name ?? "课程"}</span><span className="text-muted-foreground">{course?.content ?? ""}</span><span>{format(row.hours)} H · 第 {row.occurrence + 1} 节</span><span className="text-right font-medium">JPY {format(row.amountJpy)}</span></div>; })}</div></section>) : <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">此报价缺少已保存的计划快照。</p>}</div><div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded-md border border-border px-3 py-2 text-sm" onClick={onClose}>关闭</button><button type="button" className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={onExport}><Download size={15} />打印 / 保存 PDF</button></div></section></div>;
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
