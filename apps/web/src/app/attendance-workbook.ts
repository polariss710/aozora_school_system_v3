import type * as XlsxTypes from "xlsx-js-style";
import type {
  TeacherAttendanceWorkbookImportInput,
  TeacherAttendanceWorkbookPayload,
} from "./api";

const detailSheetName = "勤务申报表";
const metadataSheetName = "__meta";
type XlsxModule = typeof import("xlsx-js-style");
const headers = [
  "业务归属",
  "日期",
  "学生",
  "科目 / 工作内容",
  "结算课时",
  "课时工资 JPY",
  "交通费 JPY",
  "教室费 JPY",
  "快照 ID",
  "明细 ID",
];

export async function downloadTeacherAttendanceWorkbook(payload: TeacherAttendanceWorkbookPayload) {
  const XLSX = await import("xlsx-js-style");
  const rows: unknown[][] = [
    ["勤务申报表（讲师填写用）"],
    ["老师", payload.teacher.name, "业务月份", payload.yearMonth],
    ["请只填写黄色的交通费和教室费。课时信息由系统快照生成，请勿修改。"],
    headers,
    ...payload.rows.map((row) => [
      row.businessEntityName,
      row.actualDate,
      row.studentName,
      [row.subjectName, row.content].filter(Boolean).join(" / "),
      Number(row.durationHours ?? 0),
      Number(row.lessonWageJpy ?? 0),
      Number(row.transportationFeeJpy ?? 0),
      Number(row.classroomFeeJpy ?? 0),
      row.snapshotId,
      row.detailId,
    ]),
  ];

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!merges"] = [XLSX.utils.decode_range("A1:J1"), XLSX.utils.decode_range("A3:J3")];
  sheet["!cols"] = [
    { wch: 24 }, { wch: 12 }, { wch: 22 }, { wch: 32 }, { wch: 12 },
    { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 4, hidden: true }, { wch: 4, hidden: true },
  ];
  sheet["!freeze"] = { xSplit: 0, ySplit: 4 };

  styleRange(XLSX, sheet, "A1:J1", { font: { bold: true, sz: 16 }, alignment: { horizontal: "center" }, fill: { fgColor: { rgb: "DDEBF7" } } });
  styleRange(XLSX, sheet, "A3:J3", { font: { color: { rgb: "9C6500" } }, fill: { fgColor: { rgb: "FFF2CC" } } });
  styleRange(XLSX, sheet, "A4:J4", { font: { bold: true }, fill: { fgColor: { rgb: "D9EAF7" } }, alignment: { horizontal: "center", wrapText: true } });
  if (payload.rows.length > 0) {
    const endRow = payload.rows.length + 4;
    styleRange(XLSX, sheet, `A5:F${endRow}`, { fill: { fgColor: { rgb: "F3F6FA" } } });
    styleRange(XLSX, sheet, `G5:H${endRow}`, { fill: { fgColor: { rgb: "FFFCEB" } } });
    styleRange(XLSX, sheet, `I5:J${endRow}`, { fill: { fgColor: { rgb: "F3F6FA" } } });
    for (let row = 5; row <= endRow; row += 1) {
      if (sheet[`E${row}`]) sheet[`E${row}`].z = "0.##";
      if (sheet[`F${row}`]) sheet[`F${row}`].z = "#,##0";
      if (sheet[`G${row}`]) sheet[`G${row}`].z = "#,##0";
      if (sheet[`H${row}`]) sheet[`H${row}`].z = "#,##0";
    }
  }
  XLSX.utils.book_append_sheet(workbook, sheet, detailSheetName);

  const metadata = XLSX.utils.aoa_to_sheet([
    ["schemaVersion", payload.schemaVersion],
    ["teacherId", payload.teacher.id],
    ["teacherName", payload.teacher.name],
    ["yearMonth", payload.yearMonth],
    ["snapshotIds", payload.snapshots.map((snapshot) => snapshot.id).join(",")],
  ]);
  XLSX.utils.book_append_sheet(workbook, metadata, metadataSheetName);
  if (workbook.Workbook?.Sheets) {
    const metadataSheet = workbook.Workbook.Sheets.find((item) => item.name === metadataSheetName);
    if (metadataSheet) metadataSheet.Hidden = 1;
  }

  XLSX.writeFile(workbook, `${sanitizeFileName(payload.teacher.name)}_${payload.yearMonth}_勤务申报表.xlsx`, {
    bookType: "xlsx",
    cellStyles: true,
  });
}

export async function parseTeacherAttendanceWorkbook(file: File): Promise<TeacherAttendanceWorkbookImportInput> {
  const XLSX = await import("xlsx-js-style");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const metadataSheet = workbook.Sheets[metadataSheetName];
  const detailSheet = workbook.Sheets[detailSheetName];
  if (!metadataSheet || !detailSheet) {
    throw new Error("文件不是系统导出的勤务申报表，或工作表结构已被修改。");
  }

  const metadataRows = XLSX.utils.sheet_to_json<unknown[]>(metadataSheet, { header: 1, defval: "" });
  const metadata = new Map(metadataRows.map((row) => [String(row[0] ?? ""), String(row[1] ?? "")]));
  if (metadata.get("schemaVersion") !== "1" || !metadata.get("teacherId") || !metadata.get("yearMonth")) {
    throw new Error("勤务申报表的系统识别信息不完整。");
  }

  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(detailSheet, { range: 3, defval: "" });
  const parsedRows = records
    .filter((record) => String(record["明细 ID"] ?? "").trim())
    .map((record, index) => ({
      snapshotId: requiredText(record["快照 ID"], `第 ${index + 5} 行快照映射`),
      detailId: requiredText(record["明细 ID"], `第 ${index + 5} 行明细映射`),
      transportationFeeJpy: nonNegativeJpy(record["交通费 JPY"], `第 ${index + 5} 行交通费`),
      classroomFeeJpy: nonNegativeJpy(record["教室费 JPY"], `第 ${index + 5} 行教室费`),
    }));
  if (parsedRows.length === 0) {
    throw new Error("勤务申报表中没有可导入的课时明细。");
  }

  return {
    teacherId: metadata.get("teacherId")!,
    yearMonth: metadata.get("yearMonth")!,
    importSource: file.name,
    rows: parsedRows,
  };
}

function styleRange(XLSX: XlsxModule, sheet: XlsxTypes.WorkSheet, range: string, style: Record<string, unknown>) {
  const decoded = XLSX.utils.decode_range(range);
  for (let row = decoded.s.r; row <= decoded.e.r; row += 1) {
    for (let column = decoded.s.c; column <= decoded.e.c; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      if (!sheet[address]) sheet[address] = { t: "s", v: "" };
      sheet[address].s = { ...(sheet[address].s ?? {}), ...style };
    }
  }
}

function requiredText(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label}缺失，请使用系统导出的原始文件。`);
  return text;
}

function nonNegativeJpy(value: unknown, label: string) {
  if (value === "" || value === null || value === undefined) return 0;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(amount)) {
    throw new Error(`${label}必须是 0 以上的整数 JPY。`);
  }
  return amount;
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "teacher";
}
