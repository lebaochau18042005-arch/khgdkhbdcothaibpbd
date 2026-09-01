/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Bộ bóc tách cấu trúc bảng Phân phối chương trình (Word DOCX & Excel XLSX)
 * Trích xuất 100% nguyên văn từng gạch đầu dòng YCCĐ từ ô bảng, không qua tóm tắt AI
 */

export interface ParsedCurriculumItem {
  order?: string;
  lessonContent: string;
  lessonName?: string;
  lesson?: string;
  topic?: string;
  periods: string;
  yccd: string;
  lessonGoal?: string;
  timing?: string;
  time?: string;
}

const normalizeHeader = (text: string): string =>
  (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Trích xuất văn bản từ thẻ HTML của ô <td> / <th>, bảo toàn ngắt dòng và gạch đầu dòng
 */
function extractCellContent(cellHtml: string): string {
  if (!cellHtml) return "";

  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div>${cellHtml}</div>`, "text/html");
      const container = doc.body.firstElementChild || doc.body;

      const listItems = container.querySelectorAll("li");
      listItems.forEach((li) => {
        const text = li.textContent?.trim() || "";
        if (text) {
          li.textContent = text.startsWith("-") || text.startsWith("+") || text.startsWith("•") ? text : `- ${text}`;
        }
      });

      const paragraphs = container.querySelectorAll("p, div, tr, br, li");
      paragraphs.forEach((el) => {
        el.after(doc.createTextNode("\n"));
      });

      const rawText = container.textContent || "";
      return rawText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n");
    } catch {
      // fallback
    }
  }

  return cellHtml
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<p[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Bóc tách bảng phân phối chương trình từ chuỗi HTML do mammoth xuất ra từ file .docx
 */
export function parseDocxHtmlTable(html: string): ParsedCurriculumItem[] {
  if (!html || !html.includes("<table")) return [];

  if (typeof DOMParser === "undefined") return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const tables = doc.querySelectorAll("table");

  for (let tIdx = 0; tIdx < tables.length; tIdx++) {
    const table = tables[tIdx];
    const trs = Array.from(table.querySelectorAll("tr"));
    if (trs.length < 2) continue;

    let headerRowIndex = -1;
    let colLesson = -1;
    let colYccd = -1;
    let colPeriods = -1;
    let colTiming = -1;
    let colOrder = -1;

    for (let r = 0; r < Math.min(5, trs.length); r++) {
      const cells = Array.from(trs[r].querySelectorAll("th, td"));
      const cellTexts = cells.map((c) => normalizeHeader(c.textContent || ""));

      let foundLesson = -1;
      let foundYccd = -1;
      let foundPeriods = -1;
      let foundTiming = -1;
      let foundOrder = -1;

      cellTexts.forEach((header, idx) => {
        if (colLesson === -1 && /(bai hoc|ten bai|chu de|noi dung|ten bai hoc|ten chu de|bai|lesson|topic)/.test(header)) {
          foundLesson = idx;
        }
        if (colYccd === -1 && /(yeu cau can dat|yccd|muc tieu|yeu cau|objectives|goal)/.test(header)) {
          foundYccd = idx;
        }
        if (colPeriods === -1 && /(so tiet|thoi luong|tiet|periods|duration)/.test(header)) {
          foundPeriods = idx;
        }
        if (colTiming === -1 && /(tuan|thoi diem|thoi gian|timing|time)/.test(header)) {
          foundTiming = idx;
        }
        if (colOrder === -1 && /(stt|thu tu|tiet thu|order)/.test(header)) {
          foundOrder = idx;
        }
      });

      if (foundLesson !== -1 && (foundYccd !== -1 || foundPeriods !== -1)) {
        headerRowIndex = r;
        colLesson = foundLesson;
        colYccd = foundYccd;
        colPeriods = foundPeriods;
        colTiming = foundTiming;
        colOrder = foundOrder;
        break;
      }
    }

    if (headerRowIndex === -1 || colLesson === -1) continue;

    const items: ParsedCurriculumItem[] = [];
    let weekCounter = 1;

    for (let r = headerRowIndex + 1; r < trs.length; r++) {
      const cells = Array.from(trs[r].querySelectorAll("td, th"));
      if (cells.length <= colLesson) continue;

      const lessonNameRaw = extractCellContent(cells[colLesson].innerHTML || cells[colLesson].textContent || "");
      if (!lessonNameRaw || lessonNameRaw.length < 2) continue;

      const normLesson = normalizeHeader(lessonNameRaw);
      if (
        /^(hoc ky i|hoc ky ii|hoc ki 1|hoc ki 2|tong so tiet|tong cong|phan i|phan ii|chu de \d+$)/.test(normLesson) &&
        cells.length <= 2
      ) {
        continue;
      }

      const yccdRaw = colYccd !== -1 && cells[colYccd]
        ? extractCellContent(cells[colYccd].innerHTML || cells[colYccd].textContent || "")
        : "";

      const periodsRaw = colPeriods !== -1 && cells[colPeriods]
        ? cells[colPeriods].textContent?.trim() || "1"
        : "1";
      const periodsMatch = periodsRaw.match(/\d+/);
      const periods = periodsMatch ? periodsMatch[0] : "1";

      const timingRaw = colTiming !== -1 && cells[colTiming]
        ? cells[colTiming].textContent?.trim() || ""
        : "";

      const orderRaw = colOrder !== -1 && cells[colOrder]
        ? cells[colOrder].textContent?.trim() || ""
        : "";

      const timing = timingRaw || (orderRaw && orderRaw.toLowerCase().includes("tuần") ? orderRaw : `Tuần ${weekCounter}`);
      if (items.length % 2 === 1) {
        weekCounter++;
      }

      items.push({
        order: orderRaw || `Tiết ${items.length + 1}`,
        lessonContent: lessonNameRaw,
        lessonName: lessonNameRaw,
        lesson: lessonNameRaw,
        topic: lessonNameRaw,
        periods,
        yccd: yccdRaw,
        lessonGoal: yccdRaw,
        timing,
        time: timing
      });
    }

    if (items.length >= 2) {
      return items;
    }
  }

  return [];
}

/**
 * Bóc tách bảng phân phối chương trình từ dữ liệu bảng tính Excel 2D mảng
 */
export function parseExcelCurriculumTable(tables: Record<string, any[][]>): ParsedCurriculumItem[] {
  if (!tables || Object.keys(tables).length === 0) return [];

  const sheetNames = Object.keys(tables);

  for (const sheetName of sheetNames) {
    const rows = tables[sheetName];
    if (!rows || rows.length < 2) continue;

    let headerRowIndex = -1;
    let colLesson = -1;
    let colYccd = -1;
    let colPeriods = -1;
    let colTiming = -1;
    let colOrder = -1;

    for (let r = 0; r < Math.min(10, rows.length); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;

      const cellTexts = row.map((c) => normalizeHeader(String(c || "")));

      let foundLesson = -1;
      let foundYccd = -1;
      let foundPeriods = -1;
      let foundTiming = -1;
      let foundOrder = -1;

      cellTexts.forEach((header, idx) => {
        if (foundLesson === -1 && /(bai hoc|ten bai|chu de|noi dung|ten bai hoc|ten chu de|bai|lesson|topic)/.test(header)) {
          foundLesson = idx;
        }
        if (foundYccd === -1 && /(yeu cau can dat|yccd|muc tieu|yeu cau|objectives|goal)/.test(header)) {
          foundYccd = idx;
        }
        if (foundPeriods === -1 && /(so tiet|thoi luong|tiet|periods|duration)/.test(header)) {
          foundPeriods = idx;
        }
        if (foundTiming === -1 && /(tuan|thoi diem|thoi gian|timing|time)/.test(header)) {
          foundTiming = idx;
        }
        if (foundOrder === -1 && /(stt|thu tu|tiet thu|order)/.test(header)) {
          foundOrder = idx;
        }
      });

      if (foundLesson !== -1 && (foundYccd !== -1 || foundPeriods !== -1)) {
        headerRowIndex = r;
        colLesson = foundLesson;
        colYccd = foundYccd;
        colPeriods = foundPeriods;
        colTiming = foundTiming;
        colOrder = foundOrder;
        break;
      }
    }

    if (headerRowIndex === -1 || colLesson === -1) continue;

    const items: ParsedCurriculumItem[] = [];
    let weekCounter = 1;

    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row) || row.length <= colLesson) continue;

      const lessonNameRaw = String(row[colLesson] || "").trim();
      if (!lessonNameRaw || lessonNameRaw.length < 2) continue;

      const normLesson = normalizeHeader(lessonNameRaw);
      if (
        /^(hoc ky i|hoc ky ii|hoc ki 1|hoc ki 2|tong so tiet|tong cong|phan i|phan ii)$/.test(normLesson)
      ) {
        continue;
      }

      const yccdRaw = colYccd !== -1 && row[colYccd] ? String(row[colYccd]).trim() : "";
      const periodsRaw = colPeriods !== -1 && row[colPeriods] ? String(row[colPeriods]).trim() : "1";
      const periodsMatch = periodsRaw.match(/\d+/);
      const periods = periodsMatch ? periodsMatch[0] : "1";

      const timingRaw = colTiming !== -1 && row[colTiming] ? String(row[colTiming]).trim() : "";
      const orderRaw = colOrder !== -1 && row[colOrder] ? String(row[colOrder]).trim() : "";

      const timing = timingRaw || (orderRaw && orderRaw.toLowerCase().includes("tuần") ? orderRaw : `Tuần ${weekCounter}`);
      if (items.length % 2 === 1) {
        weekCounter++;
      }

      items.push({
        order: orderRaw || `Tiết ${items.length + 1}`,
        lessonContent: lessonNameRaw,
        lessonName: lessonNameRaw,
        lesson: lessonNameRaw,
        topic: lessonNameRaw,
        periods,
        yccd: yccdRaw,
        lessonGoal: yccdRaw,
        timing,
        time: timing
      });
    }

    if (items.length >= 2) {
      return items;
    }
  }

  return [];
}
