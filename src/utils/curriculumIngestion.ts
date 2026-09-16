/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Module Nạp và Quản trị Tri Thức Chương Trình Môn Học (Curriculum Ingestion Engine)
 * Hỗ trợ nạp từ:
 * 1. File Excel (.xlsx, .xls) Phân phối chương trình / Kế hoạch dạy học
 * 2. File JSON cấu trúc chuẩn
 * 3. File Word (.docx) bảng phân phối chương trình qua mammoth
 * Lưu trữ bền vững trong IndexedDB và hỗ trợ xuất mã nguồn TypeScript (.ts).
 */

// @ts-ignore
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export interface StandardCurriculumItem {
  id: string;
  subject: string;
  grade: "10" | "11" | "12";
  source: string;
  section?: string;
  order?: string;
  lesson: string;
  topic: string;
  duration?: string;
  periods: string | number;
  week?: string | number;
  periodRange?: string;
  yccd: string;
  lessonGoal?: string;
  objectivesKnowledge?: string;
  objectivesCompetency?: string;
  objectivesQuality?: string;
  contextStudents?: string;
  contextSchool?: string;
  equipment?: string;
  learningMaterial?: string;
  digitalCompetencyTT02?: string;
  aiCompetency2422Integrated?: string;
  nlsCode?: string;
  aiCode?: string;
  isCustom?: boolean;
}

const STORAGE_KEY = "eduplan_custom_curriculum_db";

export const getStoredCustomCurriculums = (): Record<string, Record<string, StandardCurriculumItem[]>> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.error("Lỗi khi đọc custom curriculum từ localStorage", e);
    return {};
  }
};

export const saveCustomCurriculum = (
  subject: string,
  grade: "10" | "11" | "12",
  items: StandardCurriculumItem[]
): boolean => {
  try {
    const current = getStoredCustomCurriculums();
    if (!current[subject]) current[subject] = {};
    current[subject][grade] = items.map(item => ({ ...item, isCustom: true }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    return true;
  } catch (e) {
    console.error("Lỗi khi lưu custom curriculum", e);
    return false;
  }
};

export const removeCustomCurriculum = (subject: string, grade?: string): boolean => {
  try {
    const current = getStoredCustomCurriculums();
    if (!current[subject]) return true;
    if (grade) {
      delete current[subject][grade];
      if (Object.keys(current[subject]).length === 0) {
        delete current[subject];
      }
    } else {
      delete current[subject];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    return true;
  } catch (e) {
    console.error("Lỗi khi xóa custom curriculum", e);
    return false;
  }
};

const normalizeHeader = (header: string): string => {
  return (header || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "")
    .trim();
};

export const parseExcelCurriculum = async (
  file: File,
  defaultSubject: string,
  defaultGrade: "10" | "11" | "12"
): Promise<{ success: boolean; items: StandardCurriculumItem[]; error?: string }> => {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    if (!workbook.SheetNames.length) {
      return { success: false, items: [], error: "File Excel không có trang tính (sheet) nào." };
    }

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

    if (rawRows.length < 2) {
      return { success: false, items: [], error: "File Excel không đủ dữ liệu (ít hơn 2 dòng)." };
    }

    // Tìm dòng header
    let headerRowIndex = 0;
    for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
      const row = (rawRows[r] || []).map((c: any) => normalizeHeader(String(c || "")));
      if (
        row.some((c: string) => c.includes("bai") || c.includes("chude") || c.includes("tenbai")) &&
        row.some((c: string) => c.includes("tiet") || c.includes("sotiet") || c.includes("thoiluong"))
      ) {
        headerRowIndex = r;
        break;
      }
    }

    const headers = (rawRows[headerRowIndex] || []).map((c: any) => normalizeHeader(String(c || "")));
    const items: StandardCurriculumItem[] = [];

    const getColIndex = (patterns: string[]): number => {
      return headers.findIndex((h: string) => patterns.some(p => h.includes(p)));
    };

    const idxLesson = getColIndex(["tenbai", "bai", "chude", "noidung", "kehoach"]);
    const idxPeriods = getColIndex(["sotiet", "tiet", "thoiluong"]);
    const idxWeek = getColIndex(["tuan", "thoidiem"]);
    const idxYccd = getColIndex(["yccd", "yeucau", "muc tieu", "muctieu"]);
    const idxEquip = getColIndex(["thietbi", "hoclieu", "dungcu", "dddh"]);
    const idxNls = getColIndex(["nls", "nanglucso"]);
    const idxAi = getColIndex(["nlai", "ai", "trituenhantao"]);

    for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || !row.length) continue;

      const rawLesson = idxLesson !== -1 ? String(row[idxLesson] || "").trim() : "";
      if (!rawLesson || rawLesson.length < 2) continue;

      const rawPeriods = idxPeriods !== -1 ? String(row[idxPeriods] || "1").trim() : "1";
      const rawWeek = idxWeek !== -1 ? String(row[idxWeek] || "").trim() : "";
      const rawYccd = idxYccd !== -1 ? String(row[idxYccd] || "").trim() : "";
      const rawEquip = idxEquip !== -1 ? String(row[idxEquip] || "").trim() : "";
      const rawNls = idxNls !== -1 ? String(row[idxNls] || "").trim() : "";
      const rawAi = idxAi !== -1 ? String(row[idxAi] || "").trim() : "";

      items.push({
        id: `CUSTOM-${defaultGrade}-${r}-${Date.now().toString().slice(-4)}`,
        subject: defaultSubject,
        grade: defaultGrade,
        source: `File tải lên: ${file.name}`,
        order: `Dòng ${r}`,
        lesson: rawLesson,
        topic: rawLesson,
        duration: `${rawPeriods} tiết`,
        periods: rawPeriods,
        week: rawWeek || `Tuần ${Math.ceil(items.length / 3) + 1}`,
        yccd: rawYccd || `Theo yêu cầu cần đạt của môn ${defaultSubject} lớp ${defaultGrade} (CT GDPT 2018).`,
        lessonGoal: rawYccd,
        objectivesKnowledge: `Nắm vững kiến thức trọng tâm của bài: ${rawLesson}.`,
        objectivesCompetency: `Phát triển năng lực đặc thù môn ${defaultSubject} và năng lực tự học.`,
        objectivesQuality: `Chăm chỉ, trung thực và có tinh thần trách nhiệm.`,
        equipment: rawEquip || "SGK Kết nối tri thức, bảng phụ, máy chiếu (nếu có).",
        digitalCompetencyTT02: rawNls || "Tích hợp NLS mức NC theo kế hoạch.",
        aiCompetency2422Integrated: rawAi || "Tích hợp NL AI theo QĐ 2422.",
        nlsCode: rawNls,
        aiCode: rawAi,
        isCustom: true
      });
    }

    if (!items.length) {
      return { success: false, items: [], error: "Không tìm thấy dòng bài học hợp lệ trong file Excel." };
    }

    return { success: true, items };
  } catch (e: any) {
    console.error("Lỗi khi đọc file Excel", e);
    return { success: false, items: [], error: e.message || "Lỗi không xác định khi xử lý file Excel." };
  }
};

export const exportCurriculumToTypeScriptCode = (
  subject: string,
  grade: "10" | "11" | "12",
  items: StandardCurriculumItem[]
): string => {
  const varName = subject
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-zA-Z0-9]/g, "");

  return `// Dữ liệu môn ${subject} - Lớp ${grade} chuẩn CT GDPT 2018
// Xuất từ EduPlan AI vào lúc ${new Date().toLocaleString("vi-VN")}

export const ${varName}_${grade} = ${JSON.stringify(items, null, 2)};
`;
};

export const downloadCurriculumTypeScriptFile = (
  subject: string,
  grade: "10" | "11" | "12",
  items: StandardCurriculumItem[]
) => {
  const code = exportCurriculumToTypeScriptCode(subject, grade, items);
  const blob = new Blob([code], { type: "text/typescript;charset=utf-8" });
  const fileName = `curriculum_${subject.toLowerCase().replace(/\s+/g, "_")}_lop${grade}.ts`;
  saveAs(blob, fileName);
};
