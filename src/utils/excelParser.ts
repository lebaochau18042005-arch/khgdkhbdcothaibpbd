/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Bộ Tiện Ích Đọc & Xuất File Excel (.xlsx / .xls)
 * Hỗ trợ nạp KHTCM, PPCT, Bảng đối chiếu 22 cột và Giáo án từ bảng tính Excel
 */

import * as XLSX from "xlsx";
import { AlignmentRow } from "../components/IntermediateAlignmentTable";
import { saveAs } from "file-saver";

export interface ExcelParseResult {
  text: string;
  sheetNames: string[];
  tables: Record<string, any[][]>;
}

/**
 * Đọc file Excel (.xlsx / .xls) và chuyển đổi thành văn bản có cấu trúc bảng
 */
export async function parseExcelFile(file: File): Promise<ExcelParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  
  const sheetNames = workbook.SheetNames;
  const tables: Record<string, any[][]> = {};
  const textParts: string[] = [];

  sheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return;

    // Convert sheet to 2D array of rows
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });
    if (!rows || rows.length === 0) return;

    tables[sheetName] = rows;

    textParts.push(`=== BẢNG TÍNH (SHEET): ${sheetName} ===`);
    
    // Format rows as plain readable table lines
    rows.forEach((row, rIdx) => {
      const filteredCells = row.map((cell: any) => String(cell || "").trim());
      if (filteredCells.some((c: string) => c.length > 0)) {
        textParts.push(filteredCells.join(" | "));
      }
    });
    textParts.push(""); // empty line between sheets
  });

  return {
    text: textParts.join("\n"),
    sheetNames,
    tables
  };
}

/**
 * Xuất Bảng Đối Chiếu Trung Gian 22 Cột ra file Excel (.xlsx)
 */
export function exportAlignmentRowsToExcel(rows: AlignmentRow[], fileName = "Bang_Doi_Chieu_Trung_Gian_22_Cot.xlsx"): void {
  const headers = [
    "STT",
    "Môn",
    "Lớp",
    "Bài / Chủ đề",
    "YCCĐ môn học nguyên văn (CT 2018)",
    "Động từ hành động",
    "Nội dung kiến thức",
    "Hoạt động dạy học",
    "Nhiệm vụ học tập",
    "Hành vi số / AI quan sát được",
    "Sản phẩm học sinh",
    "Minh chứng đánh giá",
    "Mã NLS (TT 02 Mức NC)",
    "Chỉ báo NLS",
    "Thành phần AI",
    "YCCĐ AI theo QĐ 2422",
    "Mã AI (QĐ 2422)",
    "Công cụ số / Nền tảng AI",
    "Cách kiểm chứng",
    "Tiêu chí đánh giá",
    "Nguồn tài liệu",
    "Trạng thái kiểm định",
    "Phương án ngoại tuyến (Offline Fallback)"
  ];

  const dataRows = rows.map((r, idx) => [
    idx + 1,
    r.subject || "",
    r.grade || "",
    r.topicOrLesson || "",
    r.yccdSubjectRaw || "",
    r.actionVerb || "",
    r.knowledgeContent || "",
    r.activityName || "",
    r.learningTask || "",
    r.studentBehavior || "",
    r.product || "",
    r.evidence || "",
    r.nlsCode || "",
    r.nlsIndicatorText || "",
    r.aiComponent || "",
    r.aiRequirementText || "",
    r.aiCode || "",
    r.tool || "",
    r.verificationMethod || "",
    r.assessmentCriteria || "",
    r.sourceRef || "",
    r.status || "",
    r.offlineAlternative || ""
  ]);

  const worksheetData = [headers, ...dataRows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths for better readability
  worksheet["!cols"] = [
    { wch: 6 },  // STT
    { wch: 12 }, // Môn
    { wch: 8 },  // Lớp
    { wch: 30 }, // Bài / Chủ đề
    { wch: 45 }, // YCCĐ
    { wch: 20 }, // Động từ
    { wch: 25 }, // Kiến thức
    { wch: 30 }, // Hoạt động
    { wch: 35 }, // Nhiệm vụ
    { wch: 40 }, // Hành vi
    { wch: 30 }, // Sản phẩm
    { wch: 30 }, // Minh chứng
    { wch: 15 }, // Mã NLS
    { wch: 35 }, // Chỉ báo NLS
    { wch: 12 }, // Thành phần AI
    { wch: 40 }, // YCCĐ AI
    { wch: 15 }, // Mã AI
    { wch: 25 }, // Công cụ
    { wch: 35 }, // Kiểm chứng
    { wch: 35 }, // Tiêu chí
    { wch: 30 }, // Nguồn
    { wch: 20 }, // Trạng thái
    { wch: 40 }  // Ngoại tuyến
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Doi_Chieu_22_Cot");

  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, fileName);
}

/**
 * Nhập Bảng Đối Chiếu Trung Gian từ file Excel (.xlsx / .xls)
 */
export async function importAlignmentRowsFromExcel(file: File): Promise<AlignmentRow[]> {
  const parseRes = await parseExcelFile(file);
  const firstSheet = parseRes.sheetNames[0];
  const rows = parseRes.tables[firstSheet] || [];

  if (rows.length < 2) {
    throw new Error("File Excel không có đủ dữ liệu bảng.");
  }

  // Find header row or use index-based mapping
  const dataRows = rows.slice(1);
  return dataRows
    .filter((r) => r && r.length > 0 && r.some((c) => String(c).trim().length > 0))
    .map((r, idx) => {
      const gradeVal = String(r[2] || "").trim();
      const grade = (gradeVal === "11" ? "11" : gradeVal === "12" ? "12" : "10") as "10" | "11" | "12";
      const aiCompVal = String(r[14] || "").trim();
      const aiComp = (["NLa", "NLb", "NLc", "NLd"].includes(aiCompVal) ? aiCompVal : "Không") as any;

      return {
        id: `imported-${idx + 1}-${Date.now()}`,
        stt: idx + 1,
        subject: String(r[1] || "Khác").trim(),
        grade,
        topicOrLesson: String(r[3] || `Bài học ${idx + 1}`).trim(),
        yccdSubjectRaw: String(r[4] || "").trim(),
        actionVerb: String(r[5] || "").trim(),
        knowledgeContent: String(r[6] || "").trim(),
        activityName: String(r[7] || `Hoạt động ${idx + 1}`).trim(),
        learningTask: String(r[8] || "").trim(),
        studentBehavior: String(r[9] || "").trim(),
        product: String(r[10] || "").trim(),
        evidence: String(r[11] || "").trim(),
        nlsCode: String(r[12] || "Không").trim(),
        nlsIndicatorText: String(r[13] || "").trim(),
        aiComponent: aiComp,
        aiRequirementText: String(r[15] || "").trim(),
        aiCode: String(r[16] || "Không").trim(),
        tool: String(r[17] || "").trim(),
        verificationMethod: String(r[18] || "").trim(),
        assessmentCriteria: String(r[19] || "").trim(),
        sourceRef: String(r[20] || "SGK Kết nối tri thức").trim(),
        status: (String(r[21] || "Đã xác minh").trim() as any),
        offlineAlternative: String(r[22] || "").trim()
      };
    });
}
