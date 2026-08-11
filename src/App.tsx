/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
// @ts-ignore
import html2pdf from "html2pdf.js";
// @ts-ignore
import * as mammoth from "mammoth";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, VerticalAlign, ImageRun, Math as DocxMath, MathRun, MathFraction, MathRadical, MathSubScript, MathSuperScript } from "docx";
import { saveAs } from "file-saver";
import {
  BookOpen,
  Calendar,
  FileText,
  Download,
  Copy,
  Printer,
  ChevronRight,
  Sparkles,
  Search,
  School,
  BrainCircuit,
  Loader2,
  FileJson,
  FileDown,
  LayoutGrid,
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  Settings,
  Zap,
  UploadCloud,
  Trash2,
  Laptop,
  Image as ImageIcon,
  UserCircle,
  Clock,
  FileCode,
  Presentation,
  Map,
  Menu,
  Wifi,
  WifiOff
} from "lucide-react";
import { generateLessonPlan, generateEducationalPlan, generateDepartmentPlan, generateEducationalActivitiesPlan, generateCompetencyEvaluation, parseCurriculumAppendix, generateAiCompetencyFramework, analyzeLessonSource, evaluateLessonPlan, suggestNlsIndicators, LessonPlanInput } from "./services/geminiService";
import UpgradePlan from "./components/UpgradePlan";
import NlsLookup, { INDICATORS } from "./components/NlsLookup";
import SuDiaSkills from "./components/SuDiaSkills";
import { GEO_10_KNTT } from "./services/curriculumData";

// Add competency mapper utility function
const mapAiCompetencyText = (code: string) => {
  if (!code || code.toLowerCase().includes("không")) return "Không tích hợp";

  let groupName = "";
  if (/\.A\./i.test(code) || code.includes("NLa")) groupName = "Tư duy lấy con người làm trung tâm (NLa)";
  else if (/\.B\./i.test(code) || code.includes("NLb")) groupName = "Đạo đức và trách nhiệm xã hội (NLb)";
  else if (/\.C\./i.test(code) || code.includes("NLc")) groupName = "Kỹ thuật và ứng dụng (NLc)";
  else if (/\.D\./i.test(code) || code.includes("NLd")) groupName = "Thiết kế hệ thống và GQVD (NLd)";
  else return code; // return raw code if no match

  return `${code} - ${groupName}`;
};

type AppMode = "dashboard" | "khbd-gen" | "khgd-gen" | "kh-tcm-gen" | "kh-hdgd-gen" | "upgrade-plan" | "ai-framework-gen" | "su-dia-skills" | "nls-lookup" | "history";

const normalizeKey = (value?: string) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const readLessonTitle = (item: any) =>
  String(item?.lesson || item?.topic || item?.lessonContent || item?.lessonName || item?.title || "Nội dung cần bổ sung");

const readLessonGoal = (item: any) =>
  String(
    item?.yccd ||
    item?.lessonGoal ||
    [item?.objectivesKnowledge, item?.objectivesCompetency, item?.objectivesQuality].filter(Boolean).join("; ") ||
    "Tổ chuyên môn rà soát và bổ sung yêu cầu cần đạt theo Chương trình GDPT 2018."
  );

const readPeriods = (item: any) => {
  const raw = String(item?.periods || item?.duration || item?.timeAmount || "1");
  const match = raw.match(/\d+/);
  return match ? match[0] : raw;
};

const hasMeaningfulText = (value: any) => {
  const text = String(value || "").trim();
  return !!text && !["undefined", "null", "...", "........"].includes(text.toLowerCase());
};

const isGeographySubject = (subject: string) => /địa|dia/i.test(subject.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

const CV5512_ACTIVITY_ORDER = [
  {
    prefix: "Hoạt động 1. KHỞI ĐỘNG",
    keywords: ["khoi dong", "mo dau", "xac dinh van de", "tinh huong xuat phat"]
  },
  {
    prefix: "Hoạt động 2. HÌNH THÀNH KIẾN THỨC MỚI",
    keywords: ["hinh thanh", "kien thuc moi", "kham pha", "tim hieu"]
  },
  {
    prefix: "Hoạt động 3. LUYỆN TẬP",
    keywords: ["luyen tap", "thuc hanh", "cung co"]
  },
  {
    prefix: "Hoạt động 4. VẬN DỤNG",
    keywords: ["van dung", "mo rong", "ung dung"]
  }
];

const CV5512_STEP_ORDER = [
  {
    name: "Bước 1: Chuyển giao nhiệm vụ",
    keywords: ["chuyen giao", "giao nhiem vu"]
  },
  {
    name: "Bước 2: Thực hiện nhiệm vụ",
    keywords: ["thuc hien", "lam viec", "xu li", "xu ly"]
  },
  {
    name: "Bước 3: Báo cáo, thảo luận",
    keywords: ["bao cao", "thao luan", "trinh bay", "phan bien"]
  },
  {
    name: "Bước 4: Kết luận, nhận định",
    keywords: ["ket luan", "nhan dinh", "chot", "chuan hoa"]
  }
];

const appendText = (base?: string, addition?: string) =>
  [base, addition].filter(value => String(value || "").trim()).join("\n");

const stripCv5512Prefix = (name?: string) =>
  String(name || "")
    .replace(/^hoạt\s*động\s*\d+[\s.:-]*/i, "")
    .replace(/^(khởi động|mở đầu|xác định vấn đề|hình thành kiến thức mới|luyện tập|vận dụng)[\s:.-]*/i, "")
    .trim();

const normalizeProcedureToCv5512 = (activity: any) => {
  const procedures = Array.isArray(activity?.procedure) ? activity.procedure : [];
  const used = new Set<number>();

  return CV5512_STEP_ORDER.map((requiredStep, index) => {
    let foundIndex = procedures.findIndex((step: any, stepIndex: number) => {
      if (used.has(stepIndex)) return false;
      const stepKey = normalizeKey(step?.stepName);
      return requiredStep.keywords.some(keyword => stepKey.includes(keyword));
    });
    if (foundIndex < 0 && procedures[index] && !used.has(index)) foundIndex = index;
    const found = foundIndex >= 0 ? procedures[foundIndex] : null;
    if (foundIndex >= 0) used.add(foundIndex);

    return {
      stepName: requiredStep.name,
      teacherStudentActivities:
        found?.teacherStudentActivities ||
        found?.content ||
        (index === 0
          ? `GV chuyển giao nhiệm vụ gắn với mục tiêu của hoạt động: ${activity?.objective || "cần đạt của bài học"}. HS tiếp nhận yêu cầu và chuẩn bị học liệu.`
          : index === 1
            ? `HS thực hiện nhiệm vụ học tập theo nội dung: ${activity?.content || "nội dung bài học"}. GV quan sát, hỗ trợ và đặt câu hỏi gợi mở.`
            : index === 2
              ? "HS báo cáo kết quả, trao đổi và phản biện theo tiêu chí đã nêu. GV điều phối thảo luận."
              : `<bold>GV kết luận, nhận định và chuẩn hóa kiến thức trọng tâm của hoạt động.</bold>`),
      expectedProduct:
        found?.expectedProduct ||
        found?.product ||
        (index === 3 ? activity?.product : "Minh chứng học tập của học sinh theo yêu cầu hoạt động.")
    };
  });
};

const normalizeKhbdToCv5512 = (data: any) => {
  if (!data || !Array.isArray(data.activities)) return data;

  const activities = data.activities;
  const used = new Set<number>();
  const normalizedActivities = CV5512_ACTIVITY_ORDER.map((requiredActivity, index) => {
    let foundIndex = activities.findIndex((activity: any, activityIndex: number) => {
      if (used.has(activityIndex)) return false;
      const nameKey = normalizeKey(activity?.name);
      return requiredActivity.keywords.some(keyword => nameKey.includes(keyword));
    });
    if (foundIndex < 0 && activities[index] && !used.has(index)) foundIndex = index;
    const found = foundIndex >= 0 ? activities[foundIndex] : {};
    if (foundIndex >= 0) used.add(foundIndex);

    const customTitle = stripCv5512Prefix(found?.name);
    return {
      ...found,
      name: customTitle ? `${requiredActivity.prefix}: ${customTitle}` : requiredActivity.prefix,
      objective: found?.objective || "Xác định mục tiêu học tập của hoạt động theo yêu cầu cần đạt.",
      content: found?.content || "Tổ chức nhiệm vụ học tập phù hợp với nội dung bài học.",
      product: found?.product || "Sản phẩm học tập thể hiện mức độ đạt mục tiêu của học sinh.",
      procedure: normalizeProcedureToCv5512(found)
    };
  });

  const unusedActivities = activities.filter((_: any, index: number) => !used.has(index));
  if (unusedActivities.length > 0) {
    const merged = unusedActivities.map((activity: any) => {
      const procedureText = (activity?.procedure || [])
        .map((step: any) => `${step?.stepName || "Bước bổ sung"}: ${step?.teacherStudentActivities || ""}`)
        .join("\n");
      return `${activity?.name || "Hoạt động bổ sung"}\n${activity?.content || ""}\n${procedureText}`;
    }).join("\n\n");
    normalizedActivities[1] = {
      ...normalizedActivities[1],
      content: appendText(normalizedActivities[1].content, `Nội dung bổ sung từ các hoạt động AI tạo thêm:\n${merged}`),
      product: appendText(normalizedActivities[1].product, unusedActivities.map((activity: any) => activity?.product).filter(Boolean).join("\n")),
      procedure: normalizedActivities[1].procedure.map((step: any, index: number) => index === 1
        ? { ...step, teacherStudentActivities: appendText(step.teacherStudentActivities, merged) }
        : step
      )
    };
  }

  return { ...data, activities: normalizedActivities };
};

const extractFormulaText = (text: string) =>
  text
    .replace(/^\[Công thức:\s*/i, "")
    .replace(/\]$/g, "")
    .replace(/^\$|\$$/g, "")
    .replace(/^\\\(|\\\)$/g, "")
    .trim();

const normalizeFormulaText = (formula: string) =>
  extractFormulaText(formula)
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\leq/g, "≤")
    .replace(/\\geq/g, "≥")
    .replace(/\\neq/g, "≠")
    .replace(/\\to/g, "→")
    .replace(/\\pi/g, "π")
    .replace(/\\Delta/g, "Δ")
    .replace(/\\sqrt\{([^{}]+)\}/g, "√($1)")
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1 / $2")
    .replace(/\s+/g, " ")
    .trim();

const formulaToMathComponents = (formula: string): any[] => {
  const source = extractFormulaText(formula);
  const components: any[] = [];
  const tokenPattern = /(\\frac\{([^{}]+)\}\{([^{}]+)\}|\\sqrt\{([^{}]+)\}|([A-Za-zÀ-ỹ0-9]+)\^\{?([A-Za-zÀ-ỹ0-9+\-]+)\}?|([A-Za-zÀ-ỹ]+)_\{?([A-Za-zÀ-ỹ0-9+\-]+)\}?)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushRun = (value: string) => {
    const normalized = normalizeFormulaText(value);
    if (normalized) components.push(new MathRun(normalized));
  };

  while ((match = tokenPattern.exec(source)) !== null) {
    pushRun(source.slice(lastIndex, match.index));
    if (match[2] && match[3]) {
      components.push(new MathFraction({
        numerator: [new MathRun(normalizeFormulaText(match[2]))],
        denominator: [new MathRun(normalizeFormulaText(match[3]))]
      }));
    } else if (match[4]) {
      components.push(new MathRadical({ children: [new MathRun(normalizeFormulaText(match[4]))] }));
    } else if (match[5] && match[6]) {
      components.push(new MathSuperScript({
        children: [new MathRun(normalizeFormulaText(match[5]))],
        superScript: [new MathRun(normalizeFormulaText(match[6]))]
      }));
    } else if (match[7] && match[8]) {
      components.push(new MathSubScript({
        children: [new MathRun(normalizeFormulaText(match[7]))],
        subScript: [new MathRun(normalizeFormulaText(match[8]))]
      }));
    }
    lastIndex = tokenPattern.lastIndex;
  }

  pushRun(source.slice(lastIndex));
  return components.length ? components : [new MathRun(normalizeFormulaText(source) || source)];
};

const getKhtcmExpectedLessons = (subject: string, grade: string, customData?: any[] | null) => {
  if (Array.isArray(customData) && customData.length > 0) return customData;
  if (isGeographySubject(subject) && grade === "10") return GEO_10_KNTT;
  return CURRICULUM_DB[subject]?.[grade] || [];
};

const completeDepartmentPlanRows = (rows: any[], sourceLessons: any[]) => {
  const source = Array.isArray(sourceLessons) ? sourceLessons : [];
  const existing = (Array.isArray(rows) ? rows : []).map((row, index) => ({ ...row, __index: index }));
  const used = new Set<number>();
  let runningWeek = 1;

  const completeRow = (row: any, sourceItem: any | null, index: number) => {
    const periods = hasMeaningfulText(row?.periods) ? String(row.periods) : readPeriods(sourceItem);
    const lessonContent = hasMeaningfulText(row?.lessonContent || row?.lessonName || row?.topic)
      ? String(row.lessonContent || row.lessonName || row.topic)
      : readLessonTitle(sourceItem);
    const lessonGoal = hasMeaningfulText(row?.lessonGoal) ? String(row.lessonGoal) : readLessonGoal(sourceItem);
    const time = hasMeaningfulText(row?.time) ? String(row.time) : `Tuần ${Math.max(1, runningWeek)}`;
    const periodCount = parseInt(String(periods).match(/\d+/)?.[0] || "1", 10);
    runningWeek += Math.max(1, Math.ceil(periodCount / 2));

    return {
      time,
      lessonContent,
      periods,
      lessonGoal,
      digitalCompetencyTT02: hasMeaningfulText(row?.digitalCompetencyTT02)
        ? String(row.digitalCompetencyTT02)
        : "Không tích hợp - cần tổ chuyên môn rà soát thêm căn cứ YCCĐ trước khi gán mã NLS.",
      aiCompetency3439Integrated: hasMeaningfulText(row?.aiCompetency3439Integrated)
        ? String(row.aiCompetency3439Integrated)
        : "Không tích hợp - chưa có căn cứ YCCĐ đủ rõ để gán mã NL AI.",
      sourceStatus: row ? "AI tạo, app đã rà soát đủ ô" : "App bổ sung từ danh mục chương trình để tránh thiếu dòng"
    };
  };

  if (source.length === 0) {
    return existing.map((row, index) => completeRow(row, null, index));
  }

  const completed = source.map((sourceItem, index) => {
    const sourceKey = normalizeKey(readLessonTitle(sourceItem));
    let matchIndex = existing.findIndex((row) => {
      if (used.has(row.__index)) return false;
      const rowKey = normalizeKey(readLessonTitle(row));
      return !!sourceKey && !!rowKey && (rowKey.includes(sourceKey) || sourceKey.includes(rowKey));
    });
    if (matchIndex < 0 && existing[index] && !used.has(existing[index].__index)) matchIndex = index;
    const matched = matchIndex >= 0 ? existing[matchIndex] : null;
    if (matched) used.add(matched.__index);
    return completeRow(matched, sourceItem, index);
  });

  existing.forEach((row, index) => {
    if (!used.has(row.__index)) completed.push(completeRow(row, null, source.length + index));
  });

  return completed;
};

const buildKhtcmSupplement = (subject: string, grade: string, rows: any[]) => {
  const lessonRows = Array.isArray(rows) ? rows : [];
  const hasThptTopics = ["10", "11", "12"].includes(grade);
  const assessmentRows = lessonRows
    .filter((row: any) => /kiểm tra|kiem tra|đánh giá|danh gia|giữa kì|giua ki|cuối kì|cuoi ki/i.test(`${row.lessonContent || ""} ${row.time || ""}`))
    .map((row: any) => ({
      time: row.time || "Theo PPCT",
      content: row.lessonContent || "Kiểm tra, đánh giá định kỳ",
      form: "Bài kiểm tra viết/thực hành theo ma trận, kết hợp câu hỏi vận dụng và khai thác tư liệu/số liệu phù hợp môn học",
      duration: row.periods || "1"
    }));

  return {
    overview: [
      `Môn học/Hoạt động giáo dục: ${subject}`,
      `Khối lớp: ${grade}`,
      `Số dòng phân phối chương trình: ${lessonRows.length}`,
      "Kế hoạch đã giữ đủ các ô bắt buộc: thời gian, nội dung, số tiết, YCCĐ CT 2018, NLS theo TT 02/CV 3456 và NL AI theo QĐ 3439."
    ],
    situation: [
      "Số lớp: .............; Số học sinh: .............; Số học sinh học chuyên đề lựa chọn (nếu có): .............",
      "Tình hình đội ngũ: Số giáo viên: .............; Trình độ đào tạo: .............; Phân công giảng dạy: .............",
      "Điều kiện thực hiện: bảo đảm thiết bị trình chiếu, học liệu số, tài khoản công cụ AI/GIS/bảng tính khi bài học có yêu cầu tích hợp."
    ],
    equipmentRows: [
      {
        name: "Máy tính/TV/máy chiếu, loa, bảng phụ",
        lessons: "Các bài có hoạt động trình bày, thảo luận, báo cáo sản phẩm học tập",
        note: "Giáo viên kiểm tra thiết bị trước giờ dạy; chuẩn bị phương án thay thế khi mất mạng."
      },
      {
        name: isGeographySubject(subject) ? "Atlat, bản đồ, lược đồ, biểu đồ, bảng số liệu" : "Tư liệu văn bản, hình ảnh, phiếu học tập, timeline/bảng hệ thống",
        lessons: isGeographySubject(subject) ? "Các bài thực hành bản đồ/GIS, biểu đồ, bảng số liệu và công thức Địa lí" : "Các bài khai thác tư liệu, sự kiện, nhân vật, nguyên nhân - hệ quả",
        note: "Nguồn học liệu cần được kiểm chứng, ghi rõ xuất xứ và phù hợp YCCĐ."
      },
      {
        name: "Công cụ số/AI có kiểm soát",
        lessons: "Chỉ dùng ở các dòng có căn cứ YCCĐ và có sản phẩm/minh chứng rõ",
        note: "Không thay thế tư duy môn học; học sinh phải kiểm chứng, chỉnh sửa và chịu trách nhiệm sản phẩm."
      }
    ],
    rooms: [
      {
        room: "Phòng học bộ môn/phòng học có thiết bị trình chiếu",
        lessons: "Các tiết hình thành kiến thức, luyện tập, báo cáo sản phẩm",
        note: "Ưu tiên khi bài học cần bản đồ số, biểu đồ, video, học liệu tương tác."
      },
      {
        room: "Phòng máy tính hoặc thiết bị cá nhân có kiểm soát",
        lessons: "Các tiết thực hành số/AI/GIS/bảng tính",
        note: "Có phương án ngoại tuyến: phiếu dữ liệu in, ảnh bản đồ, bảng số liệu dự phòng."
      }
    ],
    selectedTopics: hasThptTopics
      ? [
          {
            topic: `Chuyên đề lựa chọn/bổ trợ ${subject} ${grade}`,
            periods: "Theo PPCT nhà trường",
            time: "Sắp xếp theo kế hoạch năm học",
            requirement: "Tổ chuyên môn rà soát chuyên đề đang áp dụng của trường và cập nhật YCCĐ, học liệu, kiểm tra đánh giá tương ứng."
          }
        ]
      : [],
    assessmentRows: assessmentRows.length > 0 ? assessmentRows : [
      { time: "Giữa học kì I", content: "Kiểm tra, đánh giá giữa kì I", form: "Theo ma trận/đặc tả của tổ chuyên môn", duration: "1" },
      { time: "Cuối học kì I", content: "Kiểm tra, đánh giá cuối kì I", form: "Theo ma trận/đặc tả của tổ chuyên môn", duration: "1" },
      { time: "Giữa học kì II", content: "Kiểm tra, đánh giá giữa kì II", form: "Theo ma trận/đặc tả của tổ chuyên môn", duration: "1" },
      { time: "Cuối học kì II", content: "Kiểm tra, đánh giá cuối kì II", form: "Theo ma trận/đặc tả của tổ chuyên môn", duration: "1" }
    ],
    professionalActivities: [
      "Rà soát PPCT, thống nhất YCCĐ, chuẩn kiểm tra đánh giá và học liệu dùng chung theo học kì.",
      "Sinh hoạt chuyên môn theo nghiên cứu bài học; dự giờ, góp ý các bài có tích hợp NLS/NL AI.",
      "Cập nhật kho học liệu số, ngân hàng câu hỏi, minh chứng sản phẩm học sinh và điều chỉnh kế hoạch sau kiểm tra định kỳ.",
      "Rà soát an toàn dữ liệu, bản quyền học liệu và quy tắc sử dụng AI có trách nhiệm trong từng chủ đề."
    ]
  };
};

const KhtcmSupplementSections = ({ subject, grade, rows }: { subject: string; grade: string; rows: any[] }) => {
  const supplement = buildKhtcmSupplement(subject, grade, rows);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border-b border-slate-200 pb-4">
          <h4 className="text-sm font-black text-brand-sidebar uppercase tracking-wider mb-3">Thông tin chung</h4>
          <ul className="space-y-2 text-sm text-slate-700 font-medium">
            {supplement.overview.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </div>
        <div className="border-b border-slate-200 pb-4">
          <h4 className="text-sm font-black text-brand-sidebar uppercase tracking-wider mb-3">I. Đặc điểm tình hình</h4>
          <ul className="space-y-2 text-sm text-slate-700 font-medium">
            {supplement.situation.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </div>
      </div>

      <div className="border-b border-slate-200 pb-5 overflow-x-auto">
        <h4 className="text-sm font-black text-brand-sidebar uppercase tracking-wider mb-3">Thiết bị dạy học và phòng học bộ môn</h4>
        <table className="w-full min-w-[760px] text-left text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="p-3 font-black text-slate-700">Thiết bị/Phòng học</th>
              <th className="p-3 font-black text-slate-700">Bài/Chủ đề áp dụng</th>
              <th className="p-3 font-black text-slate-700">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {[...supplement.equipmentRows, ...supplement.rooms.map(r => ({ name: r.room, lessons: r.lessons, note: r.note }))].map((row) => (
              <tr key={row.name} className="border-b border-slate-100 align-top">
                <td className="p-3 font-bold text-brand-sidebar">{row.name}</td>
                <td className="p-3 text-slate-600">{row.lessons}</td>
                <td className="p-3 text-slate-600">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-b border-slate-200 pb-5">
        <h4 className="text-sm font-black text-brand-sidebar uppercase tracking-wider mb-3">III. Kiểm tra, đánh giá định kỳ</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {supplement.assessmentRows.map((row) => (
            <div key={`${row.time}-${row.content}`} className="border-l-4 border-emerald-500 pl-3 py-1">
              <p className="text-xs font-black text-brand-sidebar">{row.time} - {row.content}</p>
              <p className="text-[11px] text-slate-600 mt-1">{row.form}</p>
              <p className="text-[10px] text-slate-500 mt-1">Số tiết: {row.duration}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="pb-2">
        <h4 className="text-sm font-black text-brand-sidebar uppercase tracking-wider mb-3">IV. Sinh hoạt chuyên môn và nội dung khác</h4>
        <ul className="space-y-2 text-sm text-slate-700 font-medium">
          {supplement.professionalActivities.map((item) => <li key={item}>- {item}</li>)}
        </ul>
      </div>
    </div>
  );
};


const SUBJECTS_THPT = [
  "Toán học",
  "Ngữ văn",
  "Tiếng Anh",
  "Vật lý",
  "Hóa học",
  "Sinh học",
  "Lịch sử",
  "Địa lý",
  "Giáo dục kinh tế và pháp luật",
  "Tin học",
  "Công nghệ",
  "Giáo dục quốc phòng và an ninh",
  "Giáo dục thể chất",
  "Hoạt động trải nghiệm, hướng nghiệp",
  "Giáo dục địa phương"
];

const SUBJECTS_THCS = [
  "Toán học",
  "Ngữ văn",
  "Tiếng Anh",
  "Khoa học tự nhiên",
  "Lịch sử và Địa lí",
  "Giáo dục công dân",
  "Tin học",
  "Công nghệ",
  "Giáo dục thể chất",
  "Hoạt động trải nghiệm, hướng nghiệp",
  "Giáo dục địa phương"
];


const GRADES = ["6", "7", "8", "9", "10", "11", "12"];

const PROVINCES = [
  "Hà Nội (Thành phố)", "TP. Hồ Chí Minh (Thành phố)", "Hải Phòng (Thành phố)", "Đà Nẵng (Thành phố)", "Cần Thơ (Thành phố)", "Thừa Thiên Huế (Thành phố)",
  "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Ninh", "Bình Định", "Bình Dương", "Bình Phước", "Bình Thuận",
  "Cà Mau", "Đắk Lắk", "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Tĩnh", "Hải Dương", "Hòa Bình", "Khánh Hòa",
  "Kiên Giang", "Lâm Đồng", "Lạng Sơn", "Long An", "Nam Định", "Nghệ An", "Ninh Bình", "Phú Thọ", "Quảng Ninh",
  "Thái Bình", "Thanh Hóa"
];

import { CURRICULUM_DB } from "./data/curriculumDb";
import { saveHistoryToDB, loadHistoryFromDB } from "./utils/idb";

// --- Canvas Graphics Drawers for DOCX Export (VN Standard) ---
const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const createDrawingCanvas = (width = 600, height = 320) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
  }
  return { canvas, ctx };
};

const drawMindmap = (title: string): Uint8Array => {
  const { canvas, ctx } = createDrawingCanvas(600, 320);
  if (!ctx) return new Uint8Array();

  ctx.fillStyle = "#fafbfc";
  ctx.fillRect(0, 0, 600, 320);
  ctx.strokeStyle = "rgba(99, 102, 241, 0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x < 600; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 320); ctx.stroke();
  }
  for (let y = 0; y < 320; y += 20) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(600, y); ctx.stroke();
  }

  const centerX = 300;
  const centerY = 160;
  const branches = [
    { x: 120, y: 70, color: "#ef4444", text: "Nội dung chính 1" },
    { x: 480, y: 70, color: "#3b82f6", text: "Nội dung chính 2" },
    { x: 120, y: 250, color: "#10b981", text: "Ứng dụng & Thực hành" },
    { x: 480, y: 250, color: "#f59e0b", text: "Tổng kết & Đánh giá" }
  ];

  branches.forEach(b => {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.bezierCurveTo(centerX + (b.x - centerX) / 2, centerY, centerX + (b.x - centerX) / 2, b.y, b.x, b.y);
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.roundRect(b.x - 75, b.y - 18, 150, 36, 8);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.text, b.x, b.y);
  });

  const grad = ctx.createLinearGradient(centerX - 95, centerY - 25, centerX + 95, centerY + 25);
  grad.addColorStop(0, "#4f46e5");
  grad.addColorStop(1, "#6366f1");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(centerX - 100, centerY - 25, 200, 50, 10);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const words = title.split(" ");
  if (words.length > 3) {
    ctx.fillText(words.slice(0, 3).join(" "), centerX, centerY - 10);
    ctx.fillText(words.slice(3).join(" "), centerX, centerY + 10);
  } else {
    ctx.fillText(title, centerX, centerY);
  }

  const base64 = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
  return base64ToUint8Array(base64);
};

const drawChart = (title: string): Uint8Array => {
  const { canvas, ctx } = createDrawingCanvas(600, 320);
  if (!ctx) return new Uint8Array();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 600, 320);
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, 560, 280);

  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title || "Biểu đồ số liệu bài học", 300, 42);

  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 70);
  ctx.lineTo(80, 250);
  ctx.lineTo(520, 250);
  ctx.stroke();

  const barData = [40, 75, 90, 55, 85];
  const labels = ["Mẫu 1", "Mẫu 2", "Mẫu 3", "Mẫu 4", "Mẫu 5"];
  const colors = ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ec4899"];

  for (let i = 0; i < barData.length; i++) {
    const x = 110 + i * 80;
    const height = (barData[i] / 100) * 160;
    const y = 250 - height;

    const grad = ctx.createLinearGradient(x, y, x + 40, 250);
    grad.addColorStop(0, colors[i]);
    grad.addColorStop(1, colors[i] + "cc");
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.roundRect(x, y, 40, height, [4, 4, 0, 0]);
    ctx.fill();

    ctx.fillStyle = "#334155";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${barData[i]}%`, x + 20, y - 8);

    ctx.fillStyle = "#475569";
    ctx.font = "10px sans-serif";
    ctx.fillText(labels[i], x + 20, 268);
  }

  ctx.strokeStyle = "rgba(71, 85, 105, 0.1)";
  ctx.lineWidth = 1;
  const values = [25, 50, 75, 100];
  values.forEach(val => {
    const y = 250 - (val / 100) * 160;
    ctx.beginPath();
    ctx.moveTo(80, y);
    ctx.lineTo(520, y);
    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${val}%`, 72, y + 3);
  });

  const base64 = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
  return base64ToUint8Array(base64);
};

const drawGeographicalMap = (title: string): Uint8Array => {
  const { canvas, ctx } = createDrawingCanvas(600, 320);
  if (!ctx) return new Uint8Array();

  ctx.fillStyle = "#e0f2fe";
  ctx.fillRect(0, 0, 600, 320);

  ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  for (let x = 0; x < 600; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 320); ctx.stroke();
    ctx.fillStyle = "#0369a1";
    ctx.font = "8px sans-serif";
    ctx.fillText(`${100 + x / 12}°E`, x + 2, 312);
  }
  for (let y = 0; y < 320; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(600, y); ctx.stroke();
    ctx.fillStyle = "#0369a1";
    ctx.font = "8px sans-serif";
    ctx.fillText(`${25 - y / 15}°N`, 2, y - 2);
  }
  ctx.setLineDash([]);

  ctx.fillStyle = "#fef08a";
  ctx.strokeStyle = "#eab308";
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(180, 50);
  ctx.lineTo(240, 60);
  ctx.bezierCurveTo(260, 80, 240, 130, 220, 160);
  ctx.bezierCurveTo(210, 180, 240, 200, 230, 230);
  ctx.bezierCurveTo(220, 260, 180, 280, 160, 270);
  ctx.bezierCurveTo(150, 260, 165, 240, 170, 220);
  ctx.bezierCurveTo(180, 190, 160, 170, 150, 150);
  ctx.bezierCurveTo(135, 120, 170, 70, 180, 50);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(380, 240, 8, 0, Math.PI * 2);
  ctx.arc(320, 180, 5, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(180, 150);
  ctx.quadraticCurveTo(280, 180, 320, 180);
  ctx.stroke();
  ctx.setLineDash([]);

  const cx = 530, cy = 70;
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy + 20);
  ctx.moveTo(cx - 20, cy); ctx.lineTo(cx + 20, cy);
  ctx.stroke();
  ctx.font = "bold 9px sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center";
  ctx.fillText("N", cx, cy - 23);
  ctx.fillText("S", cx, cy + 29);

  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.beginPath();
  ctx.roundRect(15, 15, 320, 36, 6);
  ctx.fill();
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(title || "Bản đồ minh họa trong bài dạy", 25, 36);

  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(480, 290);
  ctx.lineTo(550, 290);
  ctx.moveTo(480, 286); ctx.lineTo(480, 294);
  ctx.moveTo(515, 286); ctx.lineTo(515, 294);
  ctx.moveTo(550, 286); ctx.lineTo(550, 294);
  ctx.stroke();
  ctx.fillStyle = "#334155";
  ctx.font = "8px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("0", 480, 280);
  ctx.fillText("100 km", 550, 280);

  const base64 = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
  return base64ToUint8Array(base64);
};

const drawSchematic = (title: string): Uint8Array => {
  const { canvas, ctx } = createDrawingCanvas(600, 320);
  if (!ctx) return new Uint8Array();

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, 600, 320);

  ctx.strokeStyle = "rgba(56, 189, 248, 0.15)";
  ctx.lineWidth = 0.5;
  for (let x = 0; x < 600; x += 15) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 320); ctx.stroke();
  }
  for (let y = 0; y < 320; y += 15) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(600, y); ctx.stroke();
  }

  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(150, 260); ctx.lineTo(250, 260);
  ctx.moveTo(180, 260); ctx.lineTo(180, 100);
  ctx.moveTo(180, 140); ctx.lineTo(240, 140);
  ctx.stroke();

  ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
  ctx.beginPath();
  ctx.roundRect(220, 110, 40, 90, [0, 0, 12, 12]);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(236, 72, 153, 0.5)";
  ctx.beginPath();
  ctx.roundRect(222, 160, 36, 38, [0, 0, 10, 10]);
  ctx.fill();

  ctx.strokeStyle = "#38bdf8";
  ctx.beginPath();
  ctx.moveTo(215, 260);
  ctx.lineTo(225, 230);
  ctx.lineTo(255, 230);
  ctx.lineTo(265, 260);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.moveTo(240, 230);
  ctx.bezierCurveTo(230, 220, 235, 205, 240, 200);
  ctx.bezierCurveTo(245, 205, 250, 220, 240, 230);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px Courier New";
  ctx.textAlign = "center";
  ctx.fillText(title || "SO DO THIET BI THUC NGHIEM / HINH VE", 300, 35);
  ctx.strokeRect(20, 15, 560, 290);

  const base64 = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
  return base64ToUint8Array(base64);
};

const QuestionAttachments = ({ q }: { q: any }) => {
  if (!q) return null;
  return (
    <>
      {q.imagePlaceholder && (
        <div className="w-full p-6 border-2 border-dashed border-indigo-200 rounded-lg flex flex-col items-center justify-center bg-indigo-50/50 my-3">
          <ImageIcon className="w-8 h-8 text-indigo-300 mb-2" />
          <p className="text-indigo-600 font-medium text-sm text-center">
             {q.imagePlaceholder}
          </p>
          <p className="text-indigo-400 text-[10px] mt-1">(Giáo viên chèn ảnh vào vị trí này khi xuất file Word)</p>
        </div>
      )}
      {q.tableData && q.tableData.headers && q.tableData.rows && (
        <div className="w-full overflow-x-auto my-3 border border-slate-200 rounded-lg">
          <table className="w-full text-sm text-left border-collapse bg-white">
            {q.tableData.caption && <caption className="p-3 text-slate-700 font-bold bg-slate-50 border-b border-slate-200">{q.tableData.caption}</caption>}
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {q.tableData.headers.map((h: string, hi: number) => (
                  <th key={hi} className="border-b border-r last:border-r-0 border-slate-200 px-4 py-3 font-bold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.tableData.rows.map((row: string[], ri: number) => (
                <tr key={ri} className="hover:bg-slate-50 border-b last:border-b-0 border-slate-100">
                  {row.map((cell: string, ci: number) => (
                    <td key={ci} className="border-r last:border-r-0 border-slate-100 px-4 py-2 text-slate-600">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {q.tableData.source && <p className="text-xs text-slate-500 p-2 bg-slate-50 italic border-t border-slate-200">Nguồn: {q.tableData.source}</p>}
        </div>
      )}
    </>
  );
};

export interface HistoryItem {
  id: string;
  timestamp: number;
  type: string;
  title: string;
  data: any;
  evaluationResult?: any;
}

export default function App() {
  const [mode, setMode] = useState<AppMode>("dashboard");
  const [loading, setLoading] = useState(false);
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  useEffect(() => {
    loadHistoryFromDB().then(h => {
      if (h) {
        setHistory(h);
      }
    });
  }, []);

  useEffect(() => {
    if (result && !result.loadedFromHistory) {
      setHistory(prev => {
        const newHistory = [...prev];
        const existingIdx = newHistory.findIndex(h => h.data === result.data);
        if (existingIdx >= 0) {
          newHistory[existingIdx] = {
            ...newHistory[existingIdx],
            evaluationResult: evaluationResult
          };
        } else {
          const title = result.data?.title || result.data?.lesson || result.data?.theme || result.type.toUpperCase();
          newHistory.unshift({
            id: Date.now().toString(),
            timestamp: Date.now(),
            type: result.type,
            title,
            data: result.data,
            evaluationResult
          });
        }
        const trimmed = newHistory.slice(0, 15);
        saveHistoryToDB(trimmed);
        return trimmed;
      });
    }
  }, [result, evaluationResult]);

  const [departmentPlanRef, setDepartmentPlanRef] = useState<any[] | null>(null);
  const [customCurriculumData, setCustomCurriculumData] = useState<any[] | null>(null);
  const [isParsingCurriculum, setIsParsingCurriculum] = useState(false);
  const [province, setProvince] = useState("TP. Hồ Chí Minh (Thành phố)");
  const [uploadingSource, setUploadingSource] = useState(false);
  const [evaluatingCouncil, setEvaluatingCouncil] = useState(false);
  const [councilEvaluation, setCouncilEvaluation] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(() => !localStorage.getItem("GEMINI_API_KEY"));
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("GEMINI_API_KEY") || "");
  const [aiModel, setAiModel] = useState(() => {
    const saved = localStorage.getItem("GEMINI_MODEL");
    if (saved === "gemini-2.5-flash" || saved === "gemini-3.1-flash-lite") {
      localStorage.setItem("GEMINI_MODEL", "gemini-3.5-flash");
      return "gemini-3.5-flash";
    }
    return saved || "gemini-3.5-flash";
  });
  const [apiTestResult, setApiTestResult] = useState<string | null>(null);
  const [apiTesting, setApiTesting] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const contentRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const [availableLessons, setAvailableLessons] = useState<any[]>([]);

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    updateOnlineState();
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  const requireOnlineForAi = (featureName = "tính năng AI") => {
    if (isOnline) return true;
    alert(`Bạn đang ngoại tuyến. ${featureName} cần Internet để gọi AI. Bạn vẫn có thể xem lịch sử đã lưu, chỉnh nội dung trên máy và tải các file đã tạo trước đó.`);
    return false;
  };

  const mobileNavItems: { mode: AppMode; label: string; icon: React.ReactNode }[] = [
    { mode: "dashboard", label: "Tổng quan", icon: <BookOpen className="w-4 h-4" /> },
    { mode: "khbd-gen", label: "KHBD", icon: <FileText className="w-4 h-4" /> },
    { mode: "upgrade-plan", label: "DOCX", icon: <Zap className="w-4 h-4" /> },
    { mode: "su-dia-skills", label: "Sử-Địa", icon: <Map className="w-4 h-4" /> },
    { mode: "nls-lookup", label: "NLS", icon: <Search className="w-4 h-4" /> },
    { mode: "history", label: "Đã lưu", icon: <Clock className="w-4 h-4" /> },
  ];

  const handleSubjectOrGradeChange = (subject: string, grade: string) => {
    // Chỉ nạp dữ liệu từ DB nếu môn học không phải Giáo dục địa phương 
    // HOẶC nếu địa phương là TP.HCM (vì DB hiện tại chỉ có dữ liệu TP.HCM)
    const lessons = (subject === "Giáo dục địa phương" && province !== "TP. Hồ Chí Minh (Thành phố)")
      ? []
      : (CURRICULUM_DB[subject]?.[grade] || []);

    setAvailableLessons(lessons);
    setLessonPlanInput(prev => ({
      ...prev,
      subject,
      grade,
      topic: "",
      duration: "2 tiết",
      contextStudents: "",
      contextSchool: "",
      objectivesKnowledge: "",
      objectivesCompetency: "",
      objectivesQuality: "",
      additionalNotes: ""
    }));
  };

  const handleLessonSelect = (lessonTitle: string) => {
    const lesson = availableLessons.find(l => l.topic === lessonTitle);
    if (lesson) {
      setLessonPlanInput(prev => ({
        ...prev,
        ...lesson
      }));
    } else {
      setLessonPlanInput(prev => ({
        ...prev,
        topic: lessonTitle,
        indicatorCode: undefined
      }));
    }
  };

  // Lesson Plan Form State
  const [lessonPlanInput, setLessonPlanInput] = useState<LessonPlanInput>({
    subject: "Toán học",
    grade: "10",
    topic: "",
    duration: "2 tiết",
    contextStudents: "",
    contextSchool: "",
    objectivesKnowledge: "",
    objectivesCompetency: "",
    objectivesQuality: "",
    additionalNotes: "",
    useLaTeX: false,
    detailDrawings: false,
    socialIntegrations: [],
    selectedNlsIndicators: []
  });

  const [suggestedNlsIndicators, setSuggestedNlsIndicators] = useState<{ code: string; rationale: string; name: string }[]>([]);
  const [isSuggestingNls, setIsSuggestingNls] = useState(false);

  const handleSuggestNls = async () => {
    if (!requireOnlineForAi("Đề xuất chỉ báo NLS/NL AI")) return;
    if (!lessonPlanInput.topic || !lessonPlanInput.subject) {
      alert("Vui lòng nhập Tên bài học và Môn học trước khi dùng AI đề xuất!");
      return;
    }
    if (!apiKey) {
      alert("Vui lòng nhập API Key để sử dụng AI đề xuất!");
      return;
    }
    setIsSuggestingNls(true);
    try {
      const suggestions = await suggestNlsIndicators(
        lessonPlanInput.topic,
        (lessonPlanInput.objectivesKnowledge || "") + " " + (lessonPlanInput.objectivesCompetency || ""),
        lessonPlanInput.grade,
        { apiKey, aiModel }
      );
      
      const mapped = (Array.isArray(suggestions) ? suggestions : []).map(s => {
        const found = INDICATORS.find(i => i.code === s.code);
        return {
          code: s.code,
          rationale: s.rationale,
          name: found ? found.description : "Chỉ báo Năng lực số / Năng lực AI"
        };
      });
      setSuggestedNlsIndicators(mapped);
    } catch (e: any) {
      console.error(e);
      alert("Có lỗi khi gọi AI đề xuất: " + e.message);
    } finally {
      setIsSuggestingNls(false);
    }
  };

  // Edu Plan Form State
  const [eduPlanInput, setEduPlanInput] = useState({
    subject: "Toán học",
    grade: "10",
    useLaTeX: false,
    detailDrawings: false,
    socialIntegrations: []
  });

  const highlightAI = (text: string) => {
    if (!text) return text;
    const parts = text.split(/(\[Công thức:\s*.*?\]|\\\(.*?\\\)|\$[^$\n]+\$|<bold>.*?<\/bold>|<ai>.*?<\/ai>|\*\*.*?\*\*|AI|Trí tuệ nhân tạo|Prompt|ChatGPT|Gemini)/gi);
    return parts.map((part, i) => {
      if (/^\[Công thức:\s*.*?\]$/i.test(part) || /^\\\(.*\\\)$/.test(part) || /^\$[^$\n]+\$$/.test(part)) {
        return (
          <span key={i} className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 mx-0.5 text-sky-900 font-semibold" style={{ fontFamily: "'Cambria Math', 'Times New Roman', serif" }}>
            {normalizeFormulaText(part)}
          </span>
        );
      }
      if (/^<bold>(.*)<\/bold>$/i.test(part)) return <span key={i} className="font-extrabold">{part.replace(/<bold>|<\/bold>/gi, '')}</span>;
      if (/^<ai>(.*)<\/ai>$/i.test(part)) return <span key={i} className="text-red-600 font-bold">{part.replace(/<ai>|<\/ai>/gi, '')}</span>;
      if (/^\*\*(.*?)\*\*$/i.test(part)) return <span key={i} className="font-bold">{part.replace(/\*\*/g, '')}</span>;
      if (/^(AI|Trí tuệ nhân tạo|Prompt|ChatGPT|Gemini)$/i.test(part)) return <span key={i} className="text-red-500 font-bold">{part}</span>;
      return part;
    });
  };

  const isMarkdownTableLine = (line: string) => /^\s*\|.+\|\s*$/.test(line || "");

  const isMarkdownSeparatorLine = (line: string) => {
    const cells = splitMarkdownTableRow(line);
    return cells.length > 1 && cells.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
  };

  const splitMarkdownTableRow = (line: string) =>
    (line || "")
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map(cell => cell.trim());

  const renderChartPreview = (title: string, key: React.Key) => {
    const bars = [45, 72, 58, 86, 64];
    return (
      <div key={key} className="my-3 rounded-xl border border-cyan-200 bg-white/80 p-3 shadow-sm">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-cyan-800 mb-3">Biểu đồ số liệu: {title}</p>
        <div className="h-32 flex items-end gap-3 border-l border-b border-slate-300 pl-3 pb-2">
          {bars.map((height, idx) => (
            <div key={idx} className="flex-1 min-w-[28px] flex flex-col items-center justify-end gap-1">
              <div className="w-full max-w-10 rounded-t-md bg-gradient-to-t from-cyan-500 to-blue-500" style={{ height: `${height}%` }} />
              <span className="text-[9px] font-semibold text-slate-500">M{idx + 1}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderRichTextBlock = (text: string) => {
    if (!text) return null;
    const lines = String(text).split("\n");
    const nodes: React.ReactNode[] = [];
    let buffer: string[] = [];

    const flushBuffer = () => {
      const value = buffer.join("\n").trim();
      if (value) {
        nodes.push(
          <div key={`p-${nodes.length}`} className="whitespace-pre-line">
            {highlightAI(value)}
          </div>
        );
      }
      buffer = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const chartMatch = trimmed.match(/^\[Biểu đồ:\s*(.*?)\]/i);

      if (chartMatch) {
        flushBuffer();
        nodes.push(renderChartPreview(chartMatch[1], `chart-${nodes.length}`));
        continue;
      }

      if (isMarkdownTableLine(line)) {
        const tableLines: string[] = [];
        while (i < lines.length && isMarkdownTableLine(lines[i])) {
          tableLines.push(lines[i]);
          i++;
        }
        i--;

        if (tableLines.length >= 2 && isMarkdownSeparatorLine(tableLines[1])) {
          flushBuffer();
          const headers = splitMarkdownTableRow(tableLines[0]);
          const rows = tableLines.slice(2).map(splitMarkdownTableRow);
          nodes.push(
            <div key={`table-${nodes.length}`} className="my-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[520px] border-collapse text-[11px]">
                <thead className="bg-cyan-50 text-cyan-900">
                  <tr>{headers.map((header, idx) => <th key={idx} className="border border-slate-200 px-3 py-2 text-left font-extrabold">{highlightAI(header)}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => (
                    <tr key={rowIdx} className={rowIdx % 2 ? "bg-slate-50/60" : "bg-white"}>
                      {headers.map((_, cellIdx) => (
                        <td key={cellIdx} className="border border-slate-200 px-3 py-2 align-top">{highlightAI(row[cellIdx] || "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          continue;
        }

        buffer.push(...tableLines);
        continue;
      }

      buffer.push(line);
    }

    flushBuffer();
    return <div className="space-y-2">{nodes}</div>;
  };

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem("GEMINI_API_KEY", apiKey.trim());
      localStorage.setItem("GEMINI_MODEL", aiModel);
      setShowSettings(false);
      alert("Đã lưu Cài đặt thành công!");
    } else {
      localStorage.removeItem("GEMINI_API_KEY");
      setApiKey("");
      alert("Đã xóa API Key!");
    }
  };

  const handleGenerateKHBD = async () => {
    if (!requireOnlineForAi("Tạo kế hoạch bài dạy")) return;
    if (!apiKey.trim()) {
      alert("Vui lòng lấy API key để sử dụng app!");
      setShowSettings(true);
      return;
    }
    setLoading(true);
    setResult(null);
    setEvaluationResult(null);
    try {
      const data = await generateLessonPlan(lessonPlanInput);
      setResult({ type: "khbd", data: normalizeKhbdToCv5512(data) });
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("QUOTA_EXHAUSTED")) {
        alert("❌ API Key đã hết hạn mức sử dụng miễn phí hôm nay.\n\n💡 Giải pháp:\n1. Dùng API key của tài khoản Gmail khác (vào https://aistudio.google.com/api-keys để lấy key mới)\n2. Hoặc chờ đến ngày mai để dùng tiếp key hiện tại.");
        setShowSettings(true);
      } else if (msg.includes("MODEL_OVERLOADED")) {
        alert("⚠️ Model Gemini đang quá tải tạm thời.\n\n💡 Hệ thống đã thử các model dự phòng. Vui lòng:\n1. Thử lại sau 30 giây\n2. Hoặc chọn model nhẹ hơn (Flash Lite) trong Cài đặt");
      } else if (msg.includes("API_KEY") || msg.includes("401") || msg.includes("403")) {
        alert("❌ API Key không hợp lệ. Vui lòng kiểm tra lại Cài đặt.");
        setShowSettings(true);
      } else {
        alert(`❌ Lỗi khi tạo giáo án: ${msg || "Lỗi không xác định. Vui lòng thử lại."}`);
      }
      console.error("[KHBD Error]", err);
    } finally {
      setLoading(false);
    }
  };

  // Hàm generate giáo án trực tiếp từ input (không phụ thuộc vào lessonPlanInput state)
  const handleGenerateKHBDWithInput = async (input: typeof lessonPlanInput) => {
    if (!requireOnlineForAi("Tạo kế hoạch bài dạy")) return;
    if (!apiKey.trim()) {
      alert("Vui lòng lấy API key để sử dụng app!");
      setShowSettings(true);
      return;
    }
    setLoading(true);
    setResult(null);
    setEvaluationResult(null);
    try {
      const data = await generateLessonPlan(input);
      setResult({ type: "khbd", data: normalizeKhbdToCv5512(data) });
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("QUOTA_EXHAUSTED")) {
        alert("❌ API Key đã hết quota hôm nay.\n💡 Vào https://aistudio.google.com/api-keys lấy key khác hoặc chờ ngày mai.");
        setShowSettings(true);
      } else if (msg.includes("MODEL_OVERLOADED")) {
        alert("⚠️ Model Gemini đang quá tải. Vui lòng thử lại sau 30 giây.");
      } else if (msg.includes("API_KEY") || msg.includes("401") || msg.includes("403")) {
        alert("❌ API Key không hợp lệ. Vui lòng kiểm tra lại Cài đặt.");
        setShowSettings(true);
      } else {
        alert(`❌ Lỗi khi tạo giáo án: ${msg || "Lỗi không xác định."}`);
      }
      console.error("[KHBD WithInput Error]", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAiFramework = async () => {
    if (!requireOnlineForAi("Tạo khung năng lực AI")) return;
    if (!apiKey.trim()) {
      alert("Vui lòng lấy API key để sử dụng app!");
      setShowSettings(true);
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await generateAiCompetencyFramework({
        subject: lessonPlanInput.subject,
        grade: lessonPlanInput.grade,
        topic: lessonPlanInput.topic,
        requirementsText: lessonPlanInput.objectivesKnowledge + "\n" + lessonPlanInput.objectivesCompetency
      }, { apiKey, aiModel });
      setResult({ type: "ai-framework", data });
    } catch (err: any) {
      alert(`❌ Lỗi khi tạo Khung năng lực AI: ${err?.message || "Lỗi không xác định."}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset input so same file can be re-selected after an error
    event.target.value = "";
    if (!file) return;
    if (!requireOnlineForAi("Đọc ảnh/PDF bằng AI")) return;

    if (!apiKey.trim()) {
      alert("Vui lòng lấy API key để sử dụng tính năng đọc ảnh/PDF!");
      setShowSettings(true);
      return;
    }

    // File type validation: only images and PDF
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isImage && !isPdf) {
      alert("❌ Chỉ hỗ trợ file ảnh (JPG, PNG, WEBP) hoặc PDF. Vui lòng thử lại.");
      return;
    }

    // File size limit: 10MB for images, 20MB for PDF
    const maxSizeMB = isPdf ? 20 : 10;
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`❌ File quá lớn (tối đa ${maxSizeMB}MB). Vui lòng nén file hoặc dùng file nhỏ hơn.`);
      return;
    }

    setUploadingSource(true);
    try {
      const reader = new FileReader();
      reader.onerror = () => {
        alert("❌ Không đọc được file. Vui lòng thử lại.");
        setUploadingSource(false);
      };
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        try {
          const data = await analyzeLessonSource(base64Data, file.type, { apiKey, aiModel });
          setLessonPlanInput(prev => ({
            ...prev,
            topic: data.topic || prev.topic,
            objectivesKnowledge: data.objectives || prev.objectivesKnowledge,
            objectivesCompetency: data.methodologies
              ? (prev.objectivesCompetency ? prev.objectivesCompetency + "\n" + data.methodologies : data.methodologies)
              : prev.objectivesCompetency,
          }));
          alert("✅ Phân tích thành công! Đã tự động điền thông tin vào form.");
        } catch (err: any) {
          alert(`❌ Lỗi phân tích ảnh/PDF: ${err?.message}`);
        } finally {
          setUploadingSource(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert("❌ Lỗi đọc file: " + err?.message);
      setUploadingSource(false);
    }
  };

  const handleEvaluateCouncil = async () => {
    if (!requireOnlineForAi("Hội đồng AI đánh giá giáo án")) return;
    if (!apiKey.trim()) {
      setShowSettings(true);
      return;
    }
    if (!result || result.type !== "khbd") return;
    setEvaluatingCouncil(true);
    try {
      const data = await evaluateLessonPlan(JSON.stringify(result.data), { apiKey, aiModel });
      setCouncilEvaluation(data);
    } catch (err: any) {
      alert(`❌ Lỗi khi gọi Hội đồng AI đánh giá: ${err?.message}`);
    } finally {
      setEvaluatingCouncil(false);
    }
  };

  const handleGenerateEvaluation = async () => {
    if (!requireOnlineForAi("Tạo đánh giá năng lực")) return;
    if (!apiKey.trim()) {
      setShowSettings(true);
      return;
    }
    if (!result || result.type !== "khbd") return;
    setEvaluationLoading(true);
    try {
      const data = await generateCompetencyEvaluation(result.data);
      setEvaluationResult(data);
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("QUOTA_EXHAUSTED")) {
        alert("❌ API Key đã hết quota hôm nay.\n💡 Vào https://aistudio.google.com/api-keys lấy key khác hoặc chờ ngày mai.");
        setShowSettings(true);
      } else if (msg.includes("MODEL_OVERLOADED")) {
        alert("⚠️ Model Gemini đang quá tải tạm thời. Vui lòng thử lại sau 30 giây.");
      } else if (msg.includes("API_KEY") || msg.includes("401") || msg.includes("403")) {
        alert("❌ API Key không hợp lệ. Vui lòng kiểm tra lại Cài đặt.");
        setShowSettings(true);
      } else {
        alert(`❌ Lỗi khi tạo đánh giá năng lực: ${msg || "Lỗi không xác định. Vui lòng thử lại."}`);
      }
      console.error("[Evaluation Error]", err);
    } finally {
      setEvaluationLoading(false);
    }
  };

  const handleGenerateKHGD = async (customRef?: any[]) => {
    if (!requireOnlineForAi("Tạo kế hoạch giáo viên")) return;
    if (!apiKey.trim()) {
      setShowSettings(true);
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const activeRef = customRef || (departmentPlanRef && departmentPlanRef[0]?.subject === eduPlanInput.subject && departmentPlanRef[0]?.grade === eduPlanInput.grade ? departmentPlanRef : null);
      const data = await generateEducationalPlan(eduPlanInput.subject, eduPlanInput.grade, province, activeRef || undefined, {
        useLaTeX: eduPlanInput.useLaTeX,
        detailDrawings: eduPlanInput.detailDrawings,
        curriculumDbData: (!customCurriculumData && province === "TP. Hồ Chí Minh (Thành phố)") ? (CURRICULUM_DB[eduPlanInput.subject]?.[eduPlanInput.grade] || CURRICULUM_DB["Địa lý"]?.[eduPlanInput.grade]) : undefined,
        socialIntegrations: eduPlanInput.socialIntegrations
      });
      setResult({ type: "khgd", data });
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("QUOTA_EXHAUSTED")) {
        alert("❌ API Key đã hết quota hôm nay.\n💡 Vào https://aistudio.google.com/api-keys lấy key khác hoặc chờ ngày mai.");
        setShowSettings(true);
      } else if (msg.includes("MODEL_OVERLOADED")) {
        alert("⚠️ Model Gemini đang quá tải tạm thời. Vui lòng thử lại sau 30 giây.");
      } else if (msg.includes("API_KEY") || msg.includes("401") || msg.includes("403")) {
        alert("❌ API Key không hợp lệ. Vui lòng kiểm tra lại Cài đặt.");
        setShowSettings(true);
      } else {
        alert(`❌ Lỗi khi tạo kế hoạch giáo dục: ${msg || "Lỗi không xác định. Vui lòng thử lại."}`);
      }
      console.error("[KHGD Error]", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKHTCM = async () => {
    if (!requireOnlineForAi("Tạo kế hoạch tổ chuyên môn")) return;
    if (!apiKey.trim()) {
      setShowSettings(true);
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await generateDepartmentPlan(eduPlanInput.subject, eduPlanInput.grade, province, {
        useLaTeX: eduPlanInput.useLaTeX,
        detailDrawings: eduPlanInput.detailDrawings,
        customCurriculumData: customCurriculumData || undefined,
        curriculumDbData: customCurriculumData ? undefined : (eduPlanInput.subject === "Giáo dục địa phương" && province !== "TP. Hồ Chí Minh (Thành phố)" ? undefined : CURRICULUM_DB[eduPlanInput.subject]?.[eduPlanInput.grade])
      });
      const expectedLessons = getKhtcmExpectedLessons(eduPlanInput.subject, eduPlanInput.grade, customCurriculumData);
      const completedData = completeDepartmentPlanRows(data, expectedLessons);
      setResult({ type: "kh-tcm", data: completedData });
      setDepartmentPlanRef(completedData);
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("QUOTA_EXHAUSTED")) {
        alert("❌ API Key đã hết quota hôm nay.\n💡 Vào https://aistudio.google.com/api-keys lấy key khác hoặc chờ ngày mai.");
        setShowSettings(true);
      } else if (msg.includes("MODEL_OVERLOADED")) {
        alert("⚠️ Model Gemini đang quá tải tạm thời. Vui lòng thử lại sau 30 giây.");
      } else if (msg.includes("API_KEY") || msg.includes("401") || msg.includes("403")) {
        alert("❌ API Key không hợp lệ. Vui lòng kiểm tra lại Cài đặt.");
        setShowSettings(true);
      } else {
        alert(`❌ Lỗi khi tạo kế hoạch tổ chuyên môn: ${msg || "Lỗi không xác định. Vui lòng thử lại."}`);
      }
      console.error("[KHTCM Error]", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKHHDGD = async () => {
    if (!requireOnlineForAi("Tạo kế hoạch hoạt động giáo dục")) return;
    if (!apiKey.trim()) {
      setShowSettings(true);
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await generateEducationalActivitiesPlan(eduPlanInput.subject, eduPlanInput.grade, {
        useLaTeX: eduPlanInput.useLaTeX,
      });
      setResult({ type: "kh-hdgd", data });
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("QUOTA_EXHAUSTED")) {
        alert("❌ API Key đã hết quota hôm nay.\n💡 Vào https://aistudio.google.com/api-keys lấy key khác hoặc chờ ngày mai.");
        setShowSettings(true);
      } else if (msg.includes("MODEL_OVERLOADED")) {
        alert("⚠️ Model Gemini đang quá tải tạm thời. Vui lòng thử lại sau 30 giây.");
      } else if (msg.includes("API_KEY") || msg.includes("401") || msg.includes("403")) {
        alert("❌ API Key không hợp lệ. Vui lòng kiểm tra lại Cài đặt.");
        setShowSettings(true);
      } else {
        alert(`❌ Lỗi khi tạo kế hoạch tổ chức HĐGD: ${msg || "Lỗi không xác định. Vui lòng thử lại."}`);
      }
      console.error("[KHHDGD Error]", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCurriculumUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    if (!requireOnlineForAi("Phân tích phụ lục chương trình")) {
      e.target.value = "";
      return;
    }

    if (!apiKey.trim()) {
      alert("Vui lòng nhập API Key ở phần Cài đặt trước khi tải phụ lục.");
      return;
    }

    setIsParsingCurriculum(true);
    setCustomCurriculumData(null);

    try {
      const isPdf = uploadedFile.type === "application/pdf" || uploadedFile.name.toLowerCase().endsWith(".pdf");
      const isDocx = uploadedFile.name.toLowerCase().endsWith(".docx") || uploadedFile.name.toLowerCase().endsWith(".doc");
      let data: any;

      if (isPdf) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64String = result.split(',')[1];
            if (base64String) resolve(base64String);
            else reject(new Error("Không thể đọc file PDF"));
          };
          reader.onerror = () => reject(new Error("Lỗi FileReader khi đọc PDF"));
          reader.readAsDataURL(uploadedFile);
        });
        data = await parseCurriculumAppendix("", base64);
      } else if (isDocx) {
        const buffer = await uploadedFile.arrayBuffer();
        const resultObj = await mammoth.extractRawText({ arrayBuffer: buffer });
        const text = resultObj.value;
        if (!text || text.trim().length < 50) throw new Error("File Word không có nội dung hoặc đọc bị trống. Hãy kiểm tra lại file.");
        data = await parseCurriculumAppendix(text);
      } else {
        throw new Error(`Định dạng file "${uploadedFile.name}" không được hỗ trợ. Chỉ chấp nhận .docx, .doc và .pdf.`);
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error("AI không trích xuất được bài học nào. File có thể không phải Phụ lục Chương trình hoặc bị mã hóa.");
      }

      setCustomCurriculumData(data);
      alert(`🎉 Đã nạp thành công Phụ lục Chương trình (${data.length} bài học).\nHệ thống sẽ sử dụng danh sách này làm lõi (bỏ qua mặc định).`);
    } catch (err: any) {
      console.error("[CurriculumUpload Error]", err);
      const message = err?.message || "Lỗi không xác định";
      alert(`❌ Lỗi bóc tách file: ${message}`);
    } finally {
      setIsParsingCurriculum(false);
      e.target.value = ''; // Reset
    }
  };

  const handleCopy = () => {

    navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
    alert("Đã sao chép vào bộ nhớ tạm!");
  };

  // ===== EXPORT HTML =====
  const downloadHTML = () => {
    if (!result || !result.data) return;
    const currentSubject = lessonPlanInput.subject || eduPlanInput.subject;
    const element = result.type === "khbd" ? contentRef.current : tableRef.current;
    if (!element) return;

    const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>khgdkhbdcothaibpbd - ${currentSubject}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Be Vietnam Pro', Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 24px; }
  .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 40px; }
  h1 { color: #1e40af; font-size: 22px; font-weight: 800; margin-bottom: 8px; }
  h2 { color: #1e40af; font-size: 16px; font-weight: 700; margin: 24px 0 12px; border-left: 4px solid #3b82f6; padding-left: 12px; }
  h3 { color: #334155; font-size: 14px; font-weight: 700; margin: 16px 0 8px; }
  p, li { font-size: 13px; line-height: 1.7; color: #475569; }
  ul { padding-left: 20px; margin: 8px 0; }
  li { margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
  th { background: #1e40af; color: white; padding: 10px 12px; text-align: left; font-weight: 600; }
  td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; margin: 2px; }
  .ai-badge { background: #f0fdf4; color: #166534; }
  .header-bar { background: linear-gradient(135deg, #1e40af, #4f46e5); color: white; padding: 20px 40px; margin: -40px -40px 32px; border-radius: 12px 12px 0 0; }
  .header-bar h1 { color: white; font-size: 20px; }
  .header-bar p { color: rgba(255,255,255,0.8); font-size: 13px; margin-top: 4px; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 11px; }
  @media print { body { padding: 0; background: white; } .container { box-shadow: none; padding: 20px; } }
</style>
</head>
<body>
<div class="container">
  <div class="header-bar">
    <h1>khgdkhbdcothaibpbd — Kế hoạch Giáo dục</h1>
    <p>Môn: ${currentSubject} | Khối: ${lessonPlanInput.grade || eduPlanInput.grade} | Chuẩn CV 5512 + QĐ 3439/BGDĐT</p>
  </div>
  ${element.innerHTML}
  <div class="footer">Tạo bởi khgdkhbdcothaibpbd • Hệ thống Kế hoạch Giáo dục Thông minh • ${new Date().toLocaleDateString('vi-VN')}</div>
</div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.type.toUpperCase()}_${currentSubject}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ===== EXPORT PPTX (via JSZip Open XML) =====
  const downloadPPTX = async () => {
    if (!result || !result.data) return;
    const currentSubject = lessonPlanInput.subject || eduPlanInput.subject;
    const grade = lessonPlanInput.grade || eduPlanInput.grade;

    // Build slide content based on result type
    const slides: Array<{ title: string; bullets: string[] }> = [];

    if (result.type === "khbd") {
      const d = normalizeKhbdToCv5512(result.data);
      slides.push({ title: d.title || "Kế hoạch Bài dạy", bullets: [`Môn: ${currentSubject}`, `Khối: ${grade}`, "Chuẩn CV 5512/BGDĐT + QĐ 3439"] });
      slides.push({ title: "I. MỤC TIÊU", bullets: [...(d.objectives?.knowledge || []).slice(0, 5).map((k: string) => `• KT: ${k}`), ...(d.objectives?.aiSpecific || []).slice(0, 3).map((a: string) => `• AI: ${a}`)] });
      (d.activities || []).forEach((act: any) => {
        slides.push({ title: act.name || "Hoạt động", bullets: [`Mục tiêu: ${act.objective || ""}`, `Nội dung: ${act.content || ""}`, `Sản phẩm: ${act.product || ""}`] });
      });
      slides.push({ title: "IV. KẾ HOẠCH ĐÁNH GIÁ", bullets: (d.assessment || []).slice(0, 6) });
    } else if (result.type === "kh-tcm") {
      const data = completeDepartmentPlanRows(
        Array.isArray(result.data) ? result.data : [],
        getKhtcmExpectedLessons(eduPlanInput.subject, eduPlanInput.grade, customCurriculumData)
      );
      const supplement = buildKhtcmSupplement(eduPlanInput.subject, eduPlanInput.grade, data);
      slides.push({ title: "KẾ HOẠCH TỔ CHUYÊN MÔN TÍCH HỢP AI", bullets: [`Môn: ${currentSubject}`, `Khối: ${grade}`, `Tổng số dòng PPCT: ${data.length}`] });
      slides.push({ title: "I. Đặc điểm tình hình", bullets: supplement.situation.map(item => `• ${item}`) });
      slides.push({ title: "Thiết bị và phòng học", bullets: [...supplement.equipmentRows, ...supplement.rooms.map(r => ({ name: r.room, note: r.note }))].map((item: any) => `• ${item.name}: ${item.note}`) });
      slides.push({ title: "III. Kiểm tra, đánh giá định kỳ", bullets: supplement.assessmentRows.slice(0, 6).map(row => `• ${row.time}: ${row.content} (${row.duration} tiết)`) });
      // Chunk lessons into groups of 8 per slide
      for (let i = 0; i < data.length; i += 8) {
        const chunk = data.slice(i, i + 8);
        slides.push({ title: `Phân phối chương trình (${i + 1}–${Math.min(i + 8, data.length)})`, bullets: chunk.map((item: any) => `${item.time || ""}: ${item.lessonContent || item.lessonName || ""} (${item.periods || ""} tiết)`) });
      }
    } else {
      const data = Array.isArray(result.data) ? result.data : [];
      slides.push({ title: `KẾ HOẠCH GIÁO DỤC - ${currentSubject}`, bullets: [`Môn: ${currentSubject}`, `Khối: ${grade}`, `Tổng số mục: ${data.length}`] });
      data.slice(0, 20).forEach((item: any, i: number) => {
        if (i % 6 === 0) slides.push({ title: `Nội dung (${i + 1}–${Math.min(i + 6, data.length)})`, bullets: data.slice(i, i + 6).map((it: any) => `• ${it.lesson || it.lessonContent || it.theme || ""} - ${it.periods || ""} tiết`) });
      });
    }

    // Generate PPTX XML using JSZip
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    const slideWidth = 9144000; // EMU for 10 inches
    const slideHeight = 5143500; // EMU for 7.5 inches

    // [Content_Types].xml
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  ${slides.map((_: any, i: number) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("\n  ")}
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);

    // _rels/.rels
    zip.folder("_rels")!.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);

    // ppt/presentation.xml
    const pptFolder = zip.folder("ppt")!;
    pptFolder.file("presentation.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldSz cx="${slideWidth}" cy="${slideHeight}"/>
  <p:notesSz cx="${slideHeight}" cy="${slideWidth}"/>
  <p:sldIdLst>
    ${slides.map((_: any, i: number) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join("\n    ")}
  </p:sldIdLst>
</p:presentation>`);

    // ppt/_rels/presentation.xml.rels
    pptFolder.folder("_rels")!.file("presentation.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${slides.map((_: any, i: number) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join("\n  ")}
</Relationships>`);

    // Minimal slideMaster
    const masterFolder = pptFolder.folder("slideMasters")!;
    masterFolder.file("slideMaster1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`);
    masterFolder.folder("_rels")!.file("slideMaster1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`);

    // Minimal slideLayout
    const layoutFolder = pptFolder.folder("slideLayouts")!;
    layoutFolder.file("slideLayout1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" type="title" preserve="1">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
</p:sldLayout>`);
    layoutFolder.folder("_rels")!.file("slideLayout1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`);

    // Helper to escape XML
    const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    // Generate each slide
    const slidesFolder = pptFolder.folder("slides")!;
    const slideRelsFolder = slidesFolder.folder("_rels")!;
    const colors = ["1E40AF", "4F46E5", "0F766E", "7C3AED", "BE185D"];

    slides.forEach((slide, idx) => {
      const bgColor = idx === 0 ? "1E40AF" : colors[idx % colors.length];
      const isTitle = idx === 0;
      const bulletItems = (slide.bullets || []).slice(0, 10);

      const bulletXml = bulletItems.map((b: string) => `
        <a:p>
          <a:pPr marL="228600" indent="-228600"><a:buNone/></a:pPr>
          <a:r><a:rPr lang="vi-VN" sz="1600" b="0"><a:solidFill><a:srgbClr val="${isTitle ? "FFFFFF" : "1E293B"}"/></a:solidFill></a:rPr>
          <a:t>${esc(b)}</a:t></a:r>
        </a:p>`).join("");

      slidesFolder.file(`slide${idx + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="${isTitle ? bgColor : "F8FAFC"}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${slideWidth}" cy="${slideHeight}"/><a:chOff x="0" y="0"/><a:chExt cx="${slideWidth}" cy="${slideHeight}"/></a:xfrm></p:grpSpPr>
      
      <!-- Title bar -->
      <p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="457200" y="274638"/><a:ext cx="8229600" cy="960000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${bgColor}"/></a:solidFill></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r>
          <a:rPr lang="vi-VN" sz="2400" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr>
          <a:t>${esc(slide.title)}</a:t>
        </a:r></a:p></p:txBody>
      </p:sp>
      
      <!-- Content -->
      <p:sp><p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="457200" y="1320000"/><a:ext cx="8229600" cy="3520000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${isTitle ? bgColor : "FFFFFF"}"/></a:solidFill></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/>${bulletXml}</p:txBody>
      </p:sp>
      
      <!-- Footer -->
      <p:sp><p:nvSpPr><p:cNvPr id="4" name="Footer"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="457200" y="4800000"/><a:ext cx="8229600" cy="300000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${bgColor}"/></a:solidFill></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r>
          <a:rPr lang="vi-VN" sz="1000" b="0"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr>
          <a:t>khgdkhbdcothaibpbd — ${currentSubject} Lớp ${grade} • Slide ${idx + 1}/${slides.length}</a:t>
        </a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`);

      slideRelsFolder.file(`slide${idx + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`);
    });

    // docProps/app.xml
    zip.folder("docProps")!.file("app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>khgdkhbdcothaibpbd</Application>
  <Slides>${slides.length}</Slides>
</Properties>`);

    const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.type.toUpperCase()}_${currentSubject}.pptx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {

    const element = result.type === "khbd" ? contentRef.current : tableRef.current;
    if (!element) return;

    // Use a small timeout to ensure DOM is fully rendered
    setTimeout(() => {
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `${result.type.toUpperCase()}_${lessonPlanInput.subject || eduPlanInput.subject}_Lop${lessonPlanInput.grade || eduPlanInput.grade}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          letterRendering: true
        },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: (result.type === "kh-tcm" ? 'landscape' : 'portrait') as 'landscape' | 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      html2pdf().from(element).set(opt).save().catch((err: any) => {
        console.error("PDF generation error:", err);
        alert("Có lỗi xảy ra khi tạo PDF. Vui lòng thử lại hoặc sử dụng tính năng In (Tới PDF).");
      });
    }, 100);
  };

  const downloadWord = async () => {
    if (!result || !result.data) return;

    const currentSubject = lessonPlanInput.subject || eduPlanInput.subject;
    const isEnglish = currentSubject === "Tiếng Anh" || currentSubject.toLowerCase().includes("english");

    const t = (text: string) => {
      if (!isEnglish) return text;
      const dict: Record<string, string> = {
        "KẾ HOẠCH BÀI DẠY (KHBD)": "LESSON PLAN",
        "Tên bài dạy:": "Lesson topic:",
        "I. MỤC TIÊU": "I. OBJECTIVES",
        "1. Kiến thức:": "1. Knowledge:",
        "2. Năng lực môn học:": "2. Subject-Specific Competencies:",
        "3. Năng lực số:": "3. Digital Competencies:",
        "4. Năng lực AI:": "4. AI Competencies:",
        "5. Năng lực chung:": "5. General Competencies:",
        "6. Phẩm chất:": "6. Core Qualities:",
        "II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU": "II. TEACHING AIDS & MATERIALS",
        "1. Thiết bị truyền thống:": "1. Traditional Aids:",
        "2. CÔNG CỤ SỐ AI:": "2. DIGITAL & AI TOOLS:",
        "Phương án triển khai:": "Implementation Method:",
        "Học liệu/công cụ cụ thể:": "Specific Tools:",
        "III. TIẾN TRÌNH DẠY HỌC": "III. TEACHING PROCEDURE",
        "a) Mục tiêu:": "a) Objectives:",
        "b) Nội dung:": "b) Content:",
        "c) Sản phẩm:": "c) Product:",
        "d) Tổ chức thực hiện:": "d) Execution Organization:",
        "IV. KẾ HOẠCH ĐÁNH GIÁ": "IV. ASSESSMENT PLAN",
        "V. PHỤ LỤC": "V. APPENDIX",
        "Hoạt động của GV và HS:": "Teacher & Student Activities:",
        "Dự kiến sản phẩm:": "Expected Product:",
        "Mẫu Prompt:": "Prompt Template:",
        "Bảng kiểm:": "Checklist:",
        "Thứ tự tiết": "Period",
        "Bài học": "Topic",
        "Số tiết": "Duration",
        "Thời điểm": "Timing",
        "Thiết bị": "Equipment",
        "Địa điểm": "Location",
        "Định hướng năng lực số": "Digital Competency",
        "KẾ HOẠCH GIÁO DỤC CỦA GIÁO VIÊN": "TEACHER'S EDUCATIONAL PLAN",
        "Môn:": "Subject:",
        "Lớp:": "Grade:",
        "TRUYỀN THỐNG:": "TRADITIONAL:",
        "CÔNG CỤ SỐ AI:": "DIGITAL & AI TOOLS:",
        "STT": "No.",
        "Tên bài học/Chủ đề": "Topic/Theme",
        "Mục tiêu bài học": "Lesson Goal",
        "Tiết": "Period",
        "Năng lực AI": "AI Competency",
        "Mục tiêu GD AI": "AI Edu Goal",
        "Hình thức triển khai": "Implementation Form",
        "KẾ HOẠCH GIÁO DỤC TỔ CHUYÊN MÔN TÍCH HỢP AI": "DEPARTMENTAL EDUCATIONAL PLAN WITH AI",
        "Căn cứ QĐ 3439/QĐ-BGDĐT": "Based on Decision 3439/QĐ-BGDĐT"
      };
      return dict[text] || text;
    };

    const parseMarkdownToTextRunsDocx = (text: string): any[] => {
      if (!text) return [new TextRun({ text: "" })];
      const parts = text.split(/(\[Công thức:\s*.*?\]|\\\(.*?\\\)|\$[^$\n]+\$|<bold>.*?<\/bold>|<ai>.*?<\/ai>|\*\*.*?\*\*)/g);
      return parts.filter(p => p).map(part => {
        if (/^\[Công thức:\s*.*?\]$/i.test(part) || /^\\\(.*\\\)$/.test(part) || /^\$[^$\n]+\$$/.test(part)) {
          return new DocxMath({ children: formulaToMathComponents(part) });
        } else if (part.startsWith('<bold>') && part.endsWith('</bold>')) {
          return new TextRun({ text: part.slice(6, -7), bold: true });
        } else if (part.startsWith('<ai>') && part.endsWith('</ai>')) {
          return new TextRun({ text: part.slice(4, -5), color: "FF0000", bold: true });
        } else if (part.startsWith('**') && part.endsWith('**')) {
          return new TextRun({ text: part.slice(2, -2), bold: true });
        }
        return new TextRun({ text: part });
      });
    };

    const createMarkdownDocxTable = (tableLines: string[]) => {
      const headers = splitMarkdownTableRow(tableLines[0]);
      const rows = tableLines.slice(2).map(splitMarkdownTableRow);
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: headers.map((header: string) => new TableCell({
              children: [new Paragraph({ children: parseMarkdownToTextRunsDocx(header), alignment: AlignmentType.CENTER })],
              shading: { fill: "ECFEFF" },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 100, right: 100 }
            }))
          }),
          ...rows.map((row: string[]) => new TableRow({
            children: headers.map((_: string, idx: number) => new TableCell({
              children: [new Paragraph({ children: parseMarkdownToTextRunsDocx(row[idx] || "") })],
              verticalAlign: VerticalAlign.TOP,
              margins: { top: 100, bottom: 100, left: 100, right: 100 }
            }))
          }))
        ]
      });
    };

    const parseContentAndInsertDocx = (text: string): any[] => {
      if (!text) return [new Paragraph({ children: [new TextRun({ text: "" })] })];
      const lines = text.split('\n');
      const paragraphs: any[] = [];

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const trimmed = line.trim();
        // Check for specific drawing brackets
        const formulaMatch = trimmed.match(/^\[Công thức:\s*(.*?)\]$/i);
        const mapMatch = trimmed.match(/^\[Bản đồ:\s*(.*?)\]/i);
        const chartMatch = trimmed.match(/^\[Biểu đồ:\s*(.*?)\]/i);
        const mindmapMatch = trimmed.match(/^\[Sơ đồ:\s*(.*?)\]/i);
        const schematicMatch = trimmed.match(/^\[Hình vẽ:\s*(.*?)\]/i);

        if (isMarkdownTableLine(line)) {
          const tableLines: string[] = [];
          while (lineIndex < lines.length && isMarkdownTableLine(lines[lineIndex])) {
            tableLines.push(lines[lineIndex]);
            lineIndex++;
          }
          lineIndex--;

          if (tableLines.length >= 2 && isMarkdownSeparatorLine(tableLines[1])) {
            paragraphs.push(createMarkdownDocxTable(tableLines));
          } else {
            tableLines.forEach(tableLine => paragraphs.push(
              new Paragraph({
                children: parseMarkdownToTextRunsDocx(tableLine),
                spacing: { before: 40, after: 40 }
              })
            ));
          }
        } else if (formulaMatch) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: "Công thức: ", bold: true, color: "0369A1" }),
                new DocxMath({ children: formulaToMathComponents(formulaMatch[1]) })
              ],
              spacing: { before: 80, after: 80 },
              indent: { left: 360 }
            })
          );
        } else if (mapMatch) {
          const title = mapMatch[1];
          const imgBytes = drawGeographicalMap(title);
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: `📍 BẢN ĐỒ MINH HỌA: ${title}`, bold: true, color: "0369A1" })
              ],
              spacing: { before: 100, after: 60 }
            }),
            new Paragraph({
              children: [
                new ImageRun({
                  data: imgBytes as any,
                  transformation: { width: 500, height: 266 }
                } as any)
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 150 }
            })
          );
        } else if (chartMatch) {
          const title = chartMatch[1];
          const imgBytes = drawChart(title);
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: `📊 BIỂU ĐỒ SỐ LIỆU: ${title}`, bold: true, color: "4F46E5" })
              ],
              spacing: { before: 100, after: 60 }
            }),
            new Paragraph({
              children: [
                new ImageRun({
                  data: imgBytes as any,
                  transformation: { width: 500, height: 266 }
                } as any)
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 150 }
            })
          );
        } else if (mindmapMatch) {
          const title = mindmapMatch[1];
          const imgBytes = drawMindmap(title);
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: `🌿 SƠ ĐỒ TƯ DUY: ${title}`, bold: true, color: "10B981" })
              ],
              spacing: { before: 100, after: 60 }
            }),
            new Paragraph({
              children: [
                new ImageRun({
                  data: imgBytes as any,
                  transformation: { width: 500, height: 266 }
                } as any)
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 150 }
            })
          );
        } else if (schematicMatch) {
          const title = schematicMatch[1];
          const imgBytes = drawSchematic(title);
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: `⚙️ SƠ ĐỒ MÔ HÌNH THỰC NGHIỆM: ${title}`, bold: true, color: "38BDF8" })
              ],
              spacing: { before: 100, after: 60 }
            }),
            new Paragraph({
              children: [
                new ImageRun({
                  data: imgBytes as any,
                  transformation: { width: 500, height: 266 }
                } as any)
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 150 }
            })
          );
        } else {
          paragraphs.push(
            new Paragraph({
              children: parseMarkdownToTextRunsDocx(line),
              spacing: { before: 40, after: 40 }
            })
          );
        }
      }
      return paragraphs;
    };

    const fileName = `${result.type.toUpperCase()}_${currentSubject}_Lop${lessonPlanInput.grade || eduPlanInput.grade}.docx`;

    let doc;

    if (result.type === "khbd") {
      const d = normalizeKhbdToCv5512(result.data);

      // School & Department details (Standard format for VN school documents)
      const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE }
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({ children: [new TextRun({ text: "SỞ GD&ĐT TỈNH/THÀNH PHỐ: .................", size: 22 })] }),
                  new Paragraph({ children: [new TextRun({ text: "TRƯỜNG THPT: .............................", bold: true, size: 22 })] }),
                  new Paragraph({ children: [new TextRun({ text: "Tổ chuyên môn: ...........................", size: 22 })] })
                ]
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({ children: [new TextRun({ text: `Môn học: ${currentSubject}`, bold: true, size: 22 })] }),
                  new Paragraph({ children: [new TextRun({ text: `Khối lớp: ${lessonPlanInput.grade || eduPlanInput.grade}`, size: 22 })] }),
                  new Paragraph({ children: [new TextRun({ text: "Người thực hiện: .........................", size: 22 })] })
                ]
              })
            ]
          })
        ]
      });

      doc = new Document({
        styles: {
          default: {
            document: {
              run: {
                font: "Times New Roman",
                size: 26 // 13pt
              },
              paragraph: {
                spacing: { line: 276 } // 1.15 line spacing
              }
            }
          }
        },
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1134,   // 2cm
                bottom: 1134,// 2cm
                left: 1701,  // 3cm
                right: 1134  // 2cm
              }
            }
          },
          children: [
            headerTable,
            new Paragraph({ children: [new TextRun({ text: "" })], spacing: { before: 200 } }),
            new Paragraph({
              children: [new TextRun({ text: t("KẾ HOẠCH BÀI DẠY (KHBD)"), bold: true, size: 28 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `${t("Tên bài học:")} ${d.title}`, bold: true, size: 26 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),

            new Paragraph({ children: [new TextRun({ text: t("I. MỤC TIÊU"), bold: true, size: 24 })], spacing: { before: 200, after: 100 } }),
            new Paragraph({ children: [new TextRun({ text: t("1. Kiến thức:"), bold: true })] }),
            ...d.objectives.knowledge.flatMap((c: string) => parseContentAndInsertDocx(`- ${c}`)),

            new Paragraph({ children: [new TextRun({ text: t("2. Năng lực môn học:"), bold: true })], spacing: { before: 100 } }),
            ...(d.objectives.subjectSpecific || []).flatMap((c: string) => parseContentAndInsertDocx(`- ${c}`)),

            ...(d.objectives.digitalSpecific && d.objectives.digitalSpecific.length > 0 ? [
              new Paragraph({ children: [new TextRun({ text: t("3. Năng lực số:"), bold: true, color: "0000FF" })], spacing: { before: 100 } }),
              ...d.objectives.digitalSpecific.flatMap((c: string) => parseContentAndInsertDocx(`- ${c}`))
            ] : []),

            new Paragraph({ children: [new TextRun({ text: t("4. Năng lực AI:"), bold: true, color: "FF0000" })], spacing: { before: 100 } }),
            ...(d.objectives.aiSpecific || []).flatMap((c: string) => parseContentAndInsertDocx(`- ${c}`)),

            new Paragraph({ children: [new TextRun({ text: t("5. Năng lực chung:"), bold: true })], spacing: { before: 100 } }),
            ...(d.objectives.general || []).flatMap((c: string) => parseContentAndInsertDocx(`- ${c}`)),

            new Paragraph({ children: [new TextRun({ text: t("6. Phẩm chất:"), bold: true })], spacing: { before: 100 } }),
            ...(d.objectives.qualities || []).flatMap((q: string) => parseContentAndInsertDocx(`- ${q}`)),

            new Paragraph({ children: [new TextRun({ text: t("II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU"), bold: true, size: 24 })], spacing: { before: 200, after: 100 } }),
            new Paragraph({ children: [new TextRun({ text: t("1. Thiết bị truyền thống:"), bold: true })] }),
            new Paragraph({ children: [new TextRun({ text: d.materials.traditional.join(", ") })], indent: { left: 720 } }),

            new Paragraph({ children: [new TextRun({ text: t("2. CÔNG CỤ SỐ AI:"), bold: true, color: "FF0000" })], spacing: { before: 100 } }),
            new Paragraph({ children: [new TextRun({ text: `${t("Phương án triển khai:")} ${d.materials.digitalAndAI.implementationMethod}`, color: "FF0000", italics: true })], indent: { left: 720 } }),
            new Paragraph({ children: [new TextRun({ text: `${t("Học liệu/công cụ cụ thể:")} ${d.materials.digitalAndAI.specificTools.join(", ")}`, color: "FF0000" })], indent: { left: 720 } }),

            new Paragraph({ children: [new TextRun({ text: t("III. TIẾN TRÌNH DẠY HỌC"), bold: true, size: 24 })], spacing: { before: 200, after: 100 } }),
            ...(d.activities || []).flatMap((a: any) => [
              new Paragraph({ children: [new TextRun({ text: a.name, bold: true })], spacing: { before: 200 } }),
              new Paragraph({ children: [new TextRun({ text: `${t("a) Mục tiêu:")} ${a.objective}` })], indent: { left: 360 } }),
              new Paragraph({ children: [new TextRun({ text: `${t("b) Nội dung:")} ${a.content}` })], indent: { left: 360 } }),
              new Paragraph({ children: [new TextRun({ text: `${t("c) Sản phẩm:")} ${a.product}` })], indent: { left: 360 } }),
              new Paragraph({ children: [new TextRun({ text: `${t("d) Tổ chức thực hiện:")} 4 bước: Chuyển giao - Thực hiện - Báo cáo, thảo luận - Kết luận, nhận định` })], indent: { left: 360 }, spacing: { after: 100 } }),
              ...(a.procedure || []).flatMap((p: any) => {
                // Return step name as normal bold title, then insert side-by-side Table for standard layout
                return [
                  new Paragraph({ children: [new TextRun({ text: p.stepName, bold: true })], indent: { left: 540 }, spacing: { before: 150, after: 100 } }),
                  new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                      // Header Row
                      new TableRow({
                        children: [
                          new TableCell({
                            width: { size: 55, type: WidthType.PERCENTAGE },
                            children: [new Paragraph({ children: [new TextRun({ text: t("Hoạt động của GV và HS:"), bold: true })], alignment: AlignmentType.CENTER })],
                            shading: { fill: "F1F5F9" },
                            verticalAlign: VerticalAlign.CENTER
                          }),
                          new TableCell({
                            width: { size: 45, type: WidthType.PERCENTAGE },
                            children: [new Paragraph({ children: [new TextRun({ text: t("Dự kiến sản phẩm:"), bold: true })], alignment: AlignmentType.CENTER })],
                            shading: { fill: "F1F5F9" },
                            verticalAlign: VerticalAlign.CENTER
                          })
                        ]
                      }),
                      // Content Row
                      new TableRow({
                        children: [
                          new TableCell({
                            width: { size: 55, type: WidthType.PERCENTAGE },
                            children: parseContentAndInsertDocx(p.teacherStudentActivities),
                            verticalAlign: VerticalAlign.TOP
                          }),
                          new TableCell({
                            width: { size: 45, type: WidthType.PERCENTAGE },
                            children: parseContentAndInsertDocx(p.expectedProduct),
                            verticalAlign: VerticalAlign.TOP
                          })
                        ]
                      })
                    ]
                  }),
                  new Paragraph({ children: [new TextRun({ text: "" })], spacing: { before: 100 } })
                ];
              })
            ]),

            new Paragraph({ children: [new TextRun({ text: t("IV. KẾ HOẠCH ĐÁNH GIÁ"), bold: true, size: 24 })], spacing: { before: 200, after: 100 } }),
            ...(d.assessment || []).flatMap((a: string) => a.split('\n').filter((l: string) => l.trim()).map((line: string) => new Paragraph({ children: parseMarkdownToTextRunsDocx(`- ${line.trim()}`), indent: { left: 720 } }))),

            new Paragraph({ children: [new TextRun({ text: t("V. PHỤ LỤC"), bold: true, size: 24 })], spacing: { before: 200, after: 100 } }),
            new Paragraph({ children: [new TextRun({ text: t("Mẫu Prompt:"), bold: true })], spacing: { before: 100, after: 60 } }),
            ...(d.appendix?.prompts || []).flatMap((prompt: string, idx: number) => {
              // Try to split "Prompt X (Tên): Nội dung"
              const match = prompt.match(/^(Prompt\s*\d+[^:]*:?)\s*(.*)$/is);
              if (match) {
                return [
                  new Paragraph({
                    children: [
                      new TextRun({ text: `${idx + 1}. ${match[1].trim()}`, bold: true }),
                    ],
                    indent: { left: 360 },
                    spacing: { before: 100 }
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: match[2].trim(), italics: true, color: "1E3A5F" })],
                    indent: { left: 720 },
                    spacing: { after: 80 }
                  })
                ];
              }
              // Fallback: render as plain indented paragraph
              return [new Paragraph({ children: parseMarkdownToTextRunsDocx(`${idx + 1}. ${prompt}`), indent: { left: 360 }, spacing: { before: 80 } })];
            }),
            new Paragraph({ children: [new TextRun({ text: t("Bảng kiểm:"), bold: true })], spacing: { before: 200, after: 60 } }),
            ...(d.appendix?.checklist || []).flatMap((c: string) => c.split('\n').filter((l: string) => l.trim()).map((line: string) => new Paragraph({ children: parseMarkdownToTextRunsDocx(`- ${line.trim()}`), indent: { left: 720 } }))),

            // VI. PHIẾU SỬ DỤNG AI (Mục 7 — dành cho Học sinh)
            ...(d.aiUsageLog && d.aiUsageLog.length > 0 ? [
              new Paragraph({ children: [new TextRun({ text: "VI. PHIẾU SỬ DỤNG AI", bold: true, size: 26, color: "5B21B6" })], spacing: { before: 400, after: 60 } }),
              new Paragraph({ children: [new TextRun({ text: "(Dành cho Học sinh — Chuẩn Mục 7/CV 3439/QĐ-BGDĐT)", italics: true, color: "5B21B6" })], spacing: { after: 80 } }),
              new Paragraph({ children: [new TextRun({ text: "Hướng dẫn: ① ② do Giáo viên cung cấp sẵn. Học sinh tự hoàn thiện ③ ④ sau khi sử dụng AI. Giáo viên điền ⑤ và lưu làm minh chứng năng lực số. KHÔNG dùng cụm từ \"bản nháp AI\" trong sản phẩm học tập.", italics: true, size: 18, color: "6B7280" })], spacing: { after: 200 } }),
              ...(d.aiUsageLog || []).flatMap((log: any) => [
                new Paragraph({ children: [new TextRun({ text: `Họ và tên học sinh: ____________________________________________    Lớp: _______`, italics: true })], spacing: { before: 200, after: 60 } }),
                new Paragraph({ children: [new TextRun({ text: `Hoạt động: ${log.activityName}`, bold: true, color: "5B21B6", size: 22 })], spacing: { before: 60, after: 100 } }),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    // Header row
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Nội dung", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "5B21B6" }, width: { size: 30, type: WidthType.PERCENTAGE }, margins: { top: 100, bottom: 100, left: 120, right: 120 } }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Chi tiết", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "5B21B6" }, margins: { top: 100, bottom: 100, left: 120, right: 120 } }),
                      ]
                    }),
                    // ① Prompt — pre-filled by AI/teacher
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "① Câu lệnh Prompt\n(GV cung cấp)", bold: true, color: "5B21B6" })] })], shading: { fill: "EDE9FE" }, margins: { top: 100, bottom: 100, left: 120, right: 120 } }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: log.aiPromptUsed || "", italics: true })], spacing: { before: 60, after: 60 } })], margins: { top: 100, bottom: 100, left: 120, right: 120 } }),
                      ]
                    }),
                    // ② Verification source — pre-filled by AI/teacher
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "② Nguồn kiểm chứng\n(GV cung cấp)", bold: true, color: "5B21B6" })] })], shading: { fill: "EDE9FE" }, margins: { top: 100, bottom: 100, left: 120, right: 120 } }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: log.verificationSource || "" })], spacing: { before: 60, after: 60 } })], margins: { top: 100, bottom: 100, left: 120, right: 120 } }),
                      ]
                    }),
                    // ③ Student fills — BLANK
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "③ Kết quả AI:\nĐúng / Chưa đủ / Cần sửa\n(Học sinh tự điền)", bold: true, color: "92400E" })] })], shading: { fill: "FEF3C7" }, margins: { top: 100, bottom: 100, left: 120, right: 120 } }),
                        new TableCell({ children: [new Paragraph({ text: "", spacing: { before: 1200, after: 1200 } })], margins: { top: 100, bottom: 100, left: 120, right: 120 } }),
                      ]
                    }),
                    // ④ Student fills — BLANK
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "④ Bản chỉnh sửa /\nSản phẩm hoàn thiện\n(Học sinh tự điền)", bold: true, color: "065F46" })] })], shading: { fill: "D1FAE5" }, margins: { top: 100, bottom: 100, left: 120, right: 120 } }),
                        new TableCell({ children: [new Paragraph({ text: "", spacing: { before: 1800, after: 1800 } })], margins: { top: 100, bottom: 100, left: 120, right: 120 } }),
                      ]
                    }),
                    // ⑤ Teacher fills — BLANK
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "⑤ Nhận xét của\nGiáo viên\n(GV điền)", bold: true, color: "1E3A8A" })] })], shading: { fill: "DBEAFE" }, margins: { top: 100, bottom: 100, left: 120, right: 120 } }),
                        new TableCell({ children: [new Paragraph({ text: "", spacing: { before: 1200, after: 1200 } })], margins: { top: 100, bottom: 100, left: 120, right: 120 } }),
                      ]
                    }),
                  ]
                })
              ])
            ] : []),


            ...(evaluationResult ? [
              new Paragraph({ children: [new TextRun({ text: "VII. HỆ THỐNG ĐÁNH GIÁ NĂNG LỰC (CHUẨN CV 3439/BGDĐT & CT GDPT 2018)", bold: true, size: 24 })], spacing: { before: 400, after: 100 } }),

              
              new Paragraph({ children: [new TextRun({ text: "1. TIÊU CHÍ ĐÁNH GIÁ (RUBRICS)", bold: true })], spacing: { before: 100, after: 60 } }),
              ...(evaluationResult.rubrics || []).flatMap((rubric: any) => [
                new Paragraph({ children: [new TextRun({ text: `Năng lực: ${rubric.competencyName}`, bold: true, italics: true, color: "1E3A8A" })], spacing: { before: 200, after: 100 } }),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    new TableRow({
                      children: [
                        "Tiêu chí", "Mức 1: Chưa đạt", "Mức 2: Đạt", "Mức 3: Khá", "Mức 4: Tốt"
                      ].map(h => new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })], alignment: AlignmentType.CENTER })],
                        shading: { fill: "F1F5F9" },
                        verticalAlign: VerticalAlign.CENTER,
                        margins: { top: 100, bottom: 100, left: 100, right: 100 }
                      }))
                    }),
                    new TableRow({
                      children: [
                        new TableCell({ children: (rubric.criteria || []).map((c: string) => new Paragraph({ children: parseMarkdownToTextRunsDocx(`- ${c}`) })), margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                        new TableCell({ children: [new Paragraph({ children: parseMarkdownToTextRunsDocx(rubric.levels?.level1 || '') })], margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                        new TableCell({ children: [new Paragraph({ children: parseMarkdownToTextRunsDocx(rubric.levels?.level2 || '') })], margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                        new TableCell({ children: [new Paragraph({ children: parseMarkdownToTextRunsDocx(rubric.levels?.level3 || '') })], margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                        new TableCell({ children: [new Paragraph({ children: parseMarkdownToTextRunsDocx(rubric.levels?.level4 || '') })], margins: { top: 100, bottom: 100, left: 100, right: 100 } })
                      ]
                    })
                  ]
                })
              ]),

              new Paragraph({ children: [new TextRun({ text: "2. ĐÁNH GIÁ THƯỜNG XUYÊN", bold: true })], spacing: { before: 200, after: 60 } }),
              ...(evaluationResult.formativeAssessment?.quizzes || []).flatMap((q: any, qi: number) => [
                new Paragraph({ children: [new TextRun({ text: `Câu ${qi + 1}: ${q.question}`, bold: true })], spacing: { before: 100 } }),
                ...(q.options || []).map((opt: string, oi: number) => new Paragraph({ children: [new TextRun({ text: `${String.fromCharCode(65 + oi)}. ${opt}` })], indent: { left: 360 } })),
                new Paragraph({ children: [new TextRun({ text: `Đáp án: ${q.answer}`, bold: true, color: "008000" })], indent: { left: 360 }, spacing: { after: 60 } })
              ]),
              ...(evaluationResult.formativeAssessment?.part1_multipleChoice || []).flatMap((q: any, qi: number) => [
                new Paragraph({ children: [new TextRun({ text: `Phần I. Câu ${qi + 1}: ${q.question}`, bold: true })], spacing: { before: 100 } }),
                ...(q.imagePlaceholder ? [new Paragraph({ children: [new TextRun({ text: `[Khung chèn ảnh: ${q.imagePlaceholder}]`, color: "8B5CF6", italics: true })], indent: { left: 360 }, spacing: { before: 60, after: 60 } })] : []),
                ...(q.tableData?.headers ? [
                  new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                      new TableRow({
                        children: q.tableData.headers.map((h: string) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "F1F5F9" }, margins: { top: 100, bottom: 100, left: 100, right: 100 } }))
                      }),
                      ...(q.tableData.rows || []).map((row: string[]) => new TableRow({
                        children: row.map((cell: string) => new TableCell({ children: [new Paragraph({ children: parseMarkdownToTextRunsDocx(cell) })], margins: { top: 100, bottom: 100, left: 100, right: 100 } }))
                      }))
                    ]
                  })
                ] : []),
                ...(q.tableData?.source ? [new Paragraph({ children: [new TextRun({ text: `Nguồn: ${q.tableData.source}`, italics: true, size: 18 })], indent: { left: 360 }, spacing: { before: 60, after: 60 } })] : []),
                ...(q.options || []).map((opt: string, oi: number) => new Paragraph({ children: [new TextRun({ text: `${String.fromCharCode(65 + oi)}. ${opt}` })], indent: { left: 360 } })),
                new Paragraph({ children: [new TextRun({ text: `Đáp án: ${q.answer}`, bold: true, color: "008000" })], indent: { left: 360 }, spacing: { after: 60 } })
              ]),
              ...(evaluationResult.formativeAssessment?.part2_trueFalse || []).flatMap((q: any, qi: number) => [
                new Paragraph({ children: [new TextRun({ text: `Phần II. Câu ${qi + 1}: ${q.question}`, bold: true })], spacing: { before: 100 } }),
                ...(q.imagePlaceholder ? [new Paragraph({ children: [new TextRun({ text: `[Khung chèn ảnh: ${q.imagePlaceholder}]`, color: "8B5CF6", italics: true })], indent: { left: 360 }, spacing: { before: 60, after: 60 } })] : []),
                ...(q.tableData?.headers ? [
                  new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                      new TableRow({
                        children: q.tableData.headers.map((h: string) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "F1F5F9" }, margins: { top: 100, bottom: 100, left: 100, right: 100 } }))
                      }),
                      ...(q.tableData.rows || []).map((row: string[]) => new TableRow({
                        children: row.map((cell: string) => new TableCell({ children: [new Paragraph({ children: parseMarkdownToTextRunsDocx(cell) })], margins: { top: 100, bottom: 100, left: 100, right: 100 } }))
                      }))
                    ]
                  })
                ] : []),
                ...(q.tableData?.source ? [new Paragraph({ children: [new TextRun({ text: `Nguồn: ${q.tableData.source}`, italics: true, size: 18 })], indent: { left: 360 }, spacing: { before: 60, after: 60 } })] : []),
                ...(q.statements || []).map((stmt: string, oi: number) => new Paragraph({ children: [new TextRun({ text: `${String.fromCharCode(65 + oi)}. ${stmt} - [${q.answers?.[oi]}]` })], indent: { left: 360 } })),
                new Paragraph({ children: [], spacing: { after: 60 } })
              ]),
              ...(evaluationResult.formativeAssessment?.part3_shortAnswer || []).flatMap((q: any, qi: number) => [
                new Paragraph({ children: [new TextRun({ text: `Phần III. Câu ${qi + 1}: ${q.question}`, bold: true })], spacing: { before: 100 } }),
                ...(q.imagePlaceholder ? [new Paragraph({ children: [new TextRun({ text: `[Khung chèn ảnh: ${q.imagePlaceholder}]`, color: "8B5CF6", italics: true })], indent: { left: 360 }, spacing: { before: 60, after: 60 } })] : []),
                ...(q.tableData?.headers ? [
                  new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                      new TableRow({
                        children: q.tableData.headers.map((h: string) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "F1F5F9" }, margins: { top: 100, bottom: 100, left: 100, right: 100 } }))
                      }),
                      ...(q.tableData.rows || []).map((row: string[]) => new TableRow({
                        children: row.map((cell: string) => new TableCell({ children: [new Paragraph({ children: parseMarkdownToTextRunsDocx(cell) })], margins: { top: 100, bottom: 100, left: 100, right: 100 } }))
                      }))
                    ]
                  })
                ] : []),
                ...(q.tableData?.source ? [new Paragraph({ children: [new TextRun({ text: `Nguồn: ${q.tableData.source}`, italics: true, size: 18 })], indent: { left: 360 }, spacing: { before: 60, after: 60 } })] : []),
                new Paragraph({ children: [new TextRun({ text: `Đáp án: ${q.answer}`, bold: true, color: "008000" })], indent: { left: 360 }, spacing: { after: 60 } })
              ]),
              new Paragraph({ children: [new TextRun({ text: "Bảng kiểm (Checklist) tiến trình:", bold: true })], spacing: { before: 100 } }),
              ...(evaluationResult.formativeAssessment?.checklists || []).map((c: string) => new Paragraph({ children: parseMarkdownToTextRunsDocx(`- ${c}`), indent: { left: 360 } })),

              new Paragraph({ children: [new TextRun({ text: "3. ĐÁNH GIÁ ĐỊNH KỲ", bold: true })], spacing: { before: 200, after: 60 } }),
              new Paragraph({ children: [new TextRun({ text: `Nội dung yêu cầu: ${evaluationResult.summativeAssessment?.projectOrTest || ''}` })], indent: { left: 360 } }),
              new Paragraph({ children: [new TextRun({ text: "Tiêu chí bồi hoàn:" })], indent: { left: 360 }, spacing: { before: 60 } }),
              ...(evaluationResult.summativeAssessment?.requirements || []).map((r: string) => new Paragraph({ children: parseMarkdownToTextRunsDocx(`- ${r}`), indent: { left: 720 } })),

              new Paragraph({ children: [new TextRun({ text: "4. MẪU NHẬN XÉT CHI TIẾT", bold: true })], spacing: { before: 200, after: 60 } }),
              ...(evaluationResult.feedbackSamples || []).flatMap((fb: any) => [
                new Paragraph({ children: [new TextRun({ text: fb.level, bold: true })], indent: { left: 360 }, spacing: { before: 100 } }),
                new Paragraph({ children: [new TextRun({ text: `"${fb.sampleText}"`, italics: true })], indent: { left: 720 } })
              ])
            ] : [])

          ]
        }]
      });
    } else if (result.type === "khgd") {
      const rows = [
        new TableRow({
          children: [
            t("Thứ tự tiết"), t("Bài học"), t("Số tiết"), t("Thời điểm"), t("Thiết bị"), t("Địa điểm"), t("Định hướng năng lực số")
          ].map(h => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })], alignment: AlignmentType.CENTER })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: "F1F5F9" }
          }))
        }),
        ...(Array.isArray(result.data) ? result.data : []).map((item: any) => new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: String(item.order), alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.lesson, bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ text: String(item.periods), alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph({ text: String(item.timing) })] }),
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: t("TRUYỀN THỐNG:"), bold: true, size: 16 })] }),
                new Paragraph({ children: [new TextRun({ text: item.equipment || "", italics: true, size: 16 })] }),
                new Paragraph({ children: [new TextRun({ text: "" })], spacing: { before: 100 } }),
                new Paragraph({ children: [new TextRun({ text: t("CÔNG CỤ SỐ AI:"), bold: true, color: "FF0000", size: 16 })] }),
                new Paragraph({ children: [new TextRun({ text: `- Phương án: ${item.digitalToolsAndAI?.method || ""}`, color: "FF0000", italics: true, size: 16 })] }),
                new Paragraph({ children: [new TextRun({ text: `- Công cụ: ${item.digitalToolsAndAI?.tools || ""}`, color: "FF0000", size: 16 })] }),
              ]
            }),
            new TableCell({ children: [new Paragraph({ text: String(item.location) })] }),
            new TableCell({ children: [new Paragraph({ text: String(item.digitalCompetency) })] }),
          ]
        }))
      ];

      doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [new TextRun({ text: t("KẾ HOẠCH GIÁO DỤC CỦA GIÁO VIÊN"), bold: true, size: 28 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `${t("Môn:")} ${eduPlanInput.subject} - ${t("Lớp:")} ${eduPlanInput.grade}`, size: 24 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: rows
            })
          ]
        }]
      });
    } else if (result.type === "kh-tcm") {
      const planRows = completeDepartmentPlanRows(
        Array.isArray(result.data) ? result.data : [],
        getKhtcmExpectedLessons(eduPlanInput.subject, eduPlanInput.grade, customCurriculumData)
      );
      const supplement = buildKhtcmSupplement(eduPlanInput.subject, eduPlanInput.grade, planRows);
      const simpleCell = (value: any, bold = false, fill?: string) => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: String(value || ""), bold })] })],
        margins: { top: 100, bottom: 100, left: 100, right: 100 },
        verticalAlign: VerticalAlign.TOP,
        ...(fill ? { shading: { fill } } : {})
      });
      const simpleTable = (headers: string[], bodyRows: any[][]) => new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: headers.map(h => simpleCell(h, true, "F1F5F9"))
          }),
          ...bodyRows.map(row => new TableRow({ children: row.map(cell => simpleCell(cell)) }))
        ]
      });
      const rows = [
        new TableRow({
          children: [
            t("STT"), t("Thời gian"), t("Nội dung"), t("Số tiết"), t("Yêu cầu cần đạt"), t("Năng lực số"), t("Mục tiêu & YCCĐ 3439 Tích hợp GD AI")
          ].map(h => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })], alignment: AlignmentType.CENTER })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: "F1F5F9" }
          }))
        }),
        ...planRows.map((item: any, i: number) => {
          const isNotIntegrated = !item.aiCompetency3439Integrated || item.aiCompetency3439Integrated.toLowerCase().includes("không");
          const aiText = item.aiCompetency3439Integrated || "Không tích hợp - chưa có căn cứ YCCĐ đủ rõ để gán mã NL AI.";
          return new TableRow({
            children: [
              i + 1, item.time || item.topic || item.lessonName, item.lessonContent || item.lessonName, item.periods, item.lessonGoal, item.digitalCompetencyTT02 || "Không", isNotIntegrated ? aiText : item.aiCompetency3439Integrated
            ].map(v => new TableCell({ children: [new Paragraph({ text: String(v) })] }))
          });
        })
      ];

      doc = new Document({
        sections: [{
          properties: { page: { size: { orientation: "landscape" as any } } },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "TRƯỜNG: .................................", bold: true }),
                new TextRun({ text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true, break: 1 }),
              ],
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "TỔ: .................................", bold: true }),
                new TextRun({ text: "Độc lập - Tự do - Hạnh phúc", bold: true, break: 1 }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "KẾ HOẠCH DẠY HỌC CỦA TỔ CHUYÊN MÔN", bold: true, size: 28 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `Môn học/Hoạt động giáo dục: ${eduPlanInput.subject}, khối lớp ${eduPlanInput.grade}`, size: 24 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({ children: [new TextRun({ text: "I. Đặc điểm tình hình", bold: true })], spacing: { after: 200 } }),
            ...supplement.situation.map((line, idx) => new Paragraph({ children: [new TextRun({ text: `${idx + 1}. ${line}` })], spacing: { after: 100 } })),
            new Paragraph({ children: [new TextRun({ text: "3. Thiết bị dạy học", bold: true })], spacing: { before: 100, after: 100 } }),
            simpleTable(["Thiết bị dạy học", "Bài/Chủ đề áp dụng", "Ghi chú"], supplement.equipmentRows.map(row => [row.name, row.lessons, row.note])),
            new Paragraph({ children: [new TextRun({ text: "4. Phòng học bộ môn/phòng chức năng", bold: true })], spacing: { before: 200, after: 100 } }),
            simpleTable(["Phòng học", "Bài/Chủ đề áp dụng", "Ghi chú"], supplement.rooms.map(row => [row.room, row.lessons, row.note])),
            new Paragraph({ children: [new TextRun({ text: "II. Kế hoạch dạy học", bold: true })], spacing: { after: 200 } }),
            new Paragraph({ children: [new TextRun({ text: "1. Phân phối chương trình", bold: true })], spacing: { after: 200 } }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: rows
            }),
            new Paragraph({ children: [new TextRun({ text: "2. Chuyên đề lựa chọn (đối với cấp trung học phổ thông)", bold: true })], spacing: { before: 400, after: 200 } }),
            ...(supplement.selectedTopics.length > 0
              ? [simpleTable(["Chuyên đề", "Số tiết", "Thời điểm", "Yêu cầu cần đạt"], supplement.selectedTopics.map(row => [row.topic, row.periods, row.time, row.requirement]))]
              : [new Paragraph({ children: [new TextRun({ text: "Không áp dụng hoặc tổ chuyên môn bổ sung theo kế hoạch nhà trường." })], spacing: { after: 200 } })]),
            new Paragraph({ children: [new TextRun({ text: "III. Kiểm tra, đánh giá định kỳ", bold: true })], spacing: { after: 200 } }),
            simpleTable(["Thời gian", "Bài kiểm tra/đánh giá", "Hình thức", "Số tiết"], supplement.assessmentRows.map(row => [row.time, row.content, row.form, row.duration])),
            new Paragraph({ children: [new TextRun({ text: "IV. Các nội dung khác (nếu có)", bold: true })], spacing: { after: 200 } }),
            ...supplement.professionalActivities.map((line) => new Paragraph({ children: [new TextRun({ text: `- ${line}` })], spacing: { after: 80 } })),
          ]
        }]
      });
    } else if (result.type === "kh-hdgd") {
      const rows = [
        new TableRow({
          children: [
            t("STT"), t("Chủ đề/Hoạt động"), t("Yêu cầu cần đạt"), t("Số tiết"), t("Thời điểm"), t("Địa điểm"), t("Người chủ trì"), t("Phối hợp"), t("Điều kiện thực hiện"), t("Tích hợp NLS/AI")
          ].map(h => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })], alignment: AlignmentType.CENTER })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: "F1F5F9" }
          }))
        }),
        ...(Array.isArray(result.data) ? result.data : []).map((item: any, i: number) => {
          return new TableRow({
            children: [
              i + 1, item.theme, item.requirements, item.periods, item.timing, item.location, item.host, item.collaborator, item.conditions, item.aiIntegration
            ].map(v => new TableCell({ children: [new Paragraph({ text: String(v) })] }))
          });
        })
      ];

      doc = new Document({
        sections: [{
          properties: { page: { size: { orientation: "landscape" as any } } },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "TRƯỜNG: .................................", bold: true }),
                new TextRun({ text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true, break: 1 }),
              ],
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "TỔ: .................................", bold: true }),
                new TextRun({ text: "Độc lập - Tự do - Hạnh phúc", bold: true, break: 1 }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "KẾ HOẠCH TỔ CHỨC CÁC HOẠT ĐỘNG GIÁO DỤC CỦA TỔ CHUYÊN MÔN", bold: true, size: 28 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `Môn học/Hoạt động giáo dục: ${eduPlanInput.subject}, khối lớp ${eduPlanInput.grade}`, size: 24 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: rows
            })
          ]
        }]
      });
    }

    if (doc) {
      const blob = await Packer.toBlob(doc);
      saveAs(blob, fileName);
    }
  };

  const downloadText = () => {
    let content = "";

    const currentSubject = lessonPlanInput.subject || eduPlanInput.subject;
    const isEnglish = currentSubject === "Tiếng Anh" || currentSubject.toLowerCase().includes("english");

    const t = (text: string) => {
      if (!isEnglish) return text;
      const dict: Record<string, string> = {
        "KẾ HOẠCH BÀI DẠY (KHBD)": "LESSON PLAN",
        "Tên bài dạy:": "Lesson topic:",
        "I. MỤC TIÊU": "I. OBJECTIVES",
        "1. Kiến thức:": "1. Knowledge:",
        "2. Năng lực môn học:": "2. Subject-Specific Competencies:",
        "3. Năng lực số:": "3. Digital Competencies:",
        "4. Năng lực AI:": "4. AI Competencies:",
        "5. Năng lực chung:": "5. General Competencies:",
        "6. Phẩm chất:": "6. Core Qualities:",
        "II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU": "II. TEACHING AIDS & MATERIALS",
        "1. Thiết bị truyền thống:": "1. Traditional Aids:",
        "2. Công cụ số và AI:": "2. Digital & AI Tools:",
        "Phương án triển khai:": "Implementation Method:",
        "Học liệu/công cụ cụ thể:": "Specific Tools:",
        "III. TIẾN TRÌNH DẠY HỌC": "III. TEACHING PROCEDURE",
        "a) Mục tiêu:": "a) Objectives:",
        "b) Nội dung:": "b) Content:",
        "c) Sản phẩm:": "c) Product:",
        "d) Tổ chức thực hiện:": "d) Execution Organization:",
        "IV. KẾ HOẠCH ĐÁNH GIÁ": "IV. ASSESSMENT PLAN",
        "V. PHỤ LỤC": "V. APPENDIX",
        "Hoạt động của GV và HS:": "Teacher & Student Activities:",
        "Dự kiến sản phẩm:": "Expected Product:",
        "Mẫu Prompt:": "Prompt Template:",
        "Bảng kiểm:": "Checklist:",
        "Thứ tự tiết": "Period",
        "Bài học": "Topic",
        "Số tiết": "Duration",
        "Thời điểm": "Timing",
        "Thiết bị": "Equipment",
        "Địa điểm": "Location",
        "Định hướng năng lực số": "Digital Competency",
        "KẾ HOẠCH GIÁO DỤC CỦA GIÁO VIÊN": "TEACHER'S EDUCATIONAL PLAN",
        "Môn:": "Subject:",
        "Lớp:": "Grade:",
        "STT": "No.",
        "Tên bài học/Chủ đề": "Topic/Theme",
        "Mục tiêu bài học": "Lesson Goal",
        "Tiết": "Period",
        "Năng lực AI": "AI Competency",
        "Mục tiêu GD AI": "AI Edu Goal",
        "Hình thức triển khai": "Implementation Form",
        "KẾ HOẠCH GIÁO DỤC TỔ CHUYÊN MÔN TÍCH HỢP AI": "DEPARTMENTAL EDUCATIONAL PLAN WITH AI",
        "Căn cứ QĐ 3439/QĐ-BGDĐT": "Based on Decision 3439/QĐ-BGDĐT"
      };
      return dict[text] || text;
    };

    const strip = (text: string) => text ? text.replace(/<bold>|<\/bold>|<ai>|<\/ai>|\*\*|#/gi, '') : '';

    if (result.type === "khbd") {
      const d = normalizeKhbdToCv5512(result.data);
      content = `${t("KẾ HOẠCH BÀI DẠY (KHBD)")}\n\n${t("Tên bài dạy:")} ${d.title}\n\n${t("I. MỤC TIÊU")}\n${t("1. Kiến thức:")}\n${(d.objectives.knowledge || []).map((c: string) => `- ${c}`).join("\n")}\n\n${t("2. Năng lực môn học:")}\n${(d.objectives.subjectSpecific || []).map((c: string) => `- ${c}`).join("\n")}\n\n${t("3. Năng lực số:")}\n${(d.objectives.digitalSpecific || []).map((c: string) => `- ${c}`).join("\n")}\n\n${t("4. Năng lực AI:")}\n${(d.objectives.aiSpecific || []).map((c: string) => `- ${c}`).join("\n")}\n\n${t("5. Năng lực chung:")}\n${(d.objectives.general || []).map((c: string) => `- ${c}`).join("\n")}\n\n${t("6. Phẩm chất:")}\n${(d.objectives.qualities || []).map((q: string) => `- ${q}`).join("\n")}\n\n${t("II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU")}\n${t("1. Thiết bị truyền thống:")} ${(d.materials?.traditional || []).join(", ")}\n${t("2. Công cụ số và AI:")}\n- ${t("Phương án triển khai:")} ${d.materials?.digitalAndAI?.implementationMethod || ""}\n- ${t("Học liệu/công cụ cụ thể:")} ${(d.materials?.digitalAndAI?.specificTools || []).join(", ")}\n\n${t("III. TIẾN TRÌNH DẠY HỌC")}\n${(d.activities || []).map((a: any) => `${a.name}\n${t("a) Mục tiêu:")} ${a.objective}\n${t("b) Nội dung:")} ${a.content}\n${t("c) Sản phẩm:")} ${a.product}\n${t("d) Tổ chức thực hiện:")}\n${(a.procedure || []).map((p: any) => `${p.stepName}\n  - ${t("Hoạt động của GV và HS:")} ${strip(p.teacherStudentActivities)}\n  - ${t("Dự kiến sản phẩm:")} ${strip(p.expectedProduct)}`).join("\n")}`).join("\n\n")}\n\n${t("IV. KẾ HOẠCH ĐÁNH GIÁ")}\n${(d.assessment || []).map((a: string) => `- ${strip(a)}`).join("\n")}\n\n${t("V. PHỤ LỤC")}\n- ${t("Mẫu Prompt:")} ${(d.appendix?.prompts || []).join(", ")}\n- ${t("Bảng kiểm:")}\n${(d.appendix?.checklist || []).map((c: string) => `- ${strip(c)}`).join("\n")}`;

      if (evaluationResult) {
        content += `\n\nVI. HỆ THỐNG ĐÁNH GIÁ NĂNG LỤC (CHUẨN CV 3439/BGDĐT & CT GDPT 2018)\n\n`;
        content += `1. TIÊU CHÍ ĐÁNH GIÁ (RUBRICS)\n`;
        (evaluationResult.rubrics || []).forEach((rubric: any) => {
          content += `Năng lực: ${rubric.competencyName}\n`;
          content += `Tiêu chí:\n`;
          (rubric.criteria || []).forEach((c: string) => content += `- ${c}\n`);
          content += `Mức 1 (Chưa đạt): ${rubric.levels?.level1 || ''}\n`;
          content += `Mức 2 (Đạt): ${rubric.levels?.level2 || ''}\n`;
          content += `Mức 3 (Khá): ${rubric.levels?.level3 || ''}\n`;
          content += `Mức 4 (Tốt): ${rubric.levels?.level4 || ''}\n\n`;
        });
        
        content += `2. ĐÁNH GIÁ THƯỜNG XUYÊN\n`;
        (evaluationResult.formativeAssessment?.quizzes || []).forEach((q: any, qi: number) => {
          content += `Câu ${qi + 1}: ${q.question}\n`;
          (q.options || []).forEach((opt: string, oi: number) => {
            content += `${String.fromCharCode(65 + oi)}. ${opt}\n`;
          });
          content += `Đáp án: ${q.answer}\n\n`;
        });
        
        content += `Bảng kiểm (Checklist) tiến trình:\n`;
        (evaluationResult.formativeAssessment?.checklists || []).forEach((c: string) => content += `- ${c}\n`);
        
        content += `\n3. ĐÁNH GIÁ ĐỊNH KỲ\n`;
        content += `Nội dung yêu cầu: ${evaluationResult.summativeAssessment?.projectOrTest || ''}\n`;
        content += `Tiêu chí bồi hoàn:\n`;
        (evaluationResult.summativeAssessment?.requirements || []).forEach((r: string) => content += `- ${r}\n`);
        
        content += `\n4. MẪU NHẬN XÉT CHI TIẾT\n`;
        (evaluationResult.feedbackSamples || []).forEach((fb: any) => {
          content += `${fb.level}:\n"${fb.sampleText}"\n\n`;
        });
      }
    } else if (result.type === "khgd") {
      content = `${t("KẾ HOẠCH GIÁO DỤC CỦA GIÁO VIÊN")}\n${t("Môn:")} ${eduPlanInput.subject} - ${t("Lớp:")} ${eduPlanInput.grade}\n\n${t("Thứ tự tiết")} | ${t("Bài học")} | ${t("Số tiết")} | ${t("Thời điểm")} | ${t("Thiết bị")} | ${t("Địa điểm")} | ${t("Định hướng năng lực số")}\n${(Array.isArray(result.data) ? result.data : []).map((item: any) => `${item.order} | ${item.lesson} | ${item.periods} | ${item.timing} | ${item.equipment} | ${item.location} | ${item.digitalCompetency}`).join("\n")}`;
    } else if (result.type === "kh-tcm") {
      const planRows = completeDepartmentPlanRows(
        Array.isArray(result.data) ? result.data : [],
        getKhtcmExpectedLessons(eduPlanInput.subject, eduPlanInput.grade, customCurriculumData)
      );
      const supplement = buildKhtcmSupplement(eduPlanInput.subject, eduPlanInput.grade, planRows);
      content = `TRƯỜNG: .................................\nCỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nTỔ: .................................\nĐộc lập - Tự do - Hạnh phúc\n\nKẾ HOẠCH DẠY HỌC CỦA TỔ CHUYÊN MÔN\nMôn học/Hoạt động giáo dục: ${eduPlanInput.subject}, khối lớp ${eduPlanInput.grade}\n\nI. Đặc điểm tình hình\n${supplement.situation.map((line, i) => `${i + 1}. ${line}`).join("\n")}\n\n3. Thiết bị dạy học\nThiết bị | Bài/Chủ đề áp dụng | Ghi chú\n${supplement.equipmentRows.map(row => `${row.name} | ${row.lessons} | ${row.note}`).join("\n")}\n\n4. Phòng học bộ môn/phòng chức năng\nPhòng học | Bài/Chủ đề áp dụng | Ghi chú\n${supplement.rooms.map(row => `${row.room} | ${row.lessons} | ${row.note}`).join("\n")}\n\nII. Kế hoạch dạy học\n1. Phân phối chương trình\nSTT | Thời gian | Nội dung | Số tiết | Yêu cầu cần đạt | Năng lực số | Mục tiêu & YCCĐ 3439 Tích hợp GD AI\n${planRows.map((item: any, i: number) => {
        const isNotIntegrated = !item.aiCompetency3439Integrated || item.aiCompetency3439Integrated.toLowerCase().includes("không");
        const aiText = item.aiCompetency3439Integrated || "Không tích hợp - chưa có căn cứ YCCĐ đủ rõ để gán mã NL AI.";
        return `${i + 1} | ${item.time || item.topic || item.lessonName} | ${item.lessonContent || item.lessonName} | ${item.periods} | ${item.lessonGoal} | ${item.digitalCompetencyTT02 || "Không"} | ${isNotIntegrated ? aiText : item.aiCompetency3439Integrated}`;
      }).join("\n")}\n\n2. Chuyên đề lựa chọn (đối với cấp trung học phổ thông)\n${supplement.selectedTopics.length > 0 ? supplement.selectedTopics.map(row => `${row.topic} | ${row.periods} | ${row.time} | ${row.requirement}`).join("\n") : "Không áp dụng hoặc tổ chuyên môn bổ sung theo kế hoạch nhà trường."}\n\nIII. Kiểm tra, đánh giá định kỳ\nThời gian | Bài kiểm tra/đánh giá | Hình thức | Số tiết\n${supplement.assessmentRows.map(row => `${row.time} | ${row.content} | ${row.form} | ${row.duration}`).join("\n")}\n\nIV. Các nội dung khác (nếu có)\n${supplement.professionalActivities.map(line => `- ${line}`).join("\n")}`;
    } else if (result.type === "kh-hdgd") {
      content = `TRƯỜNG: .................................\nCỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nTỔ: .................................\nĐộc lập - Tự do - Hạnh phúc\n\nKẾ HOẠCH TỔ CHỨC CÁC HOẠT ĐỘNG GIÁO DỤC CỦA TỔ CHUYÊN MÔN\nMôn học/Hoạt động giáo dục: ${eduPlanInput.subject}, khối lớp ${eduPlanInput.grade}\n\nSTT | Chủ đề/Hoạt động | Yêu cầu cần đạt | Số tiết | Thời điểm | Địa điểm | Người chủ trì | Phối hợp | Điều kiện thực hiện | Tích hợp NLS/AI\n${(Array.isArray(result.data) ? result.data : []).map((item: any, i: number) => `${i + 1} | ${item.theme} | ${item.requirements} | ${item.periods} | ${item.timing} | ${item.location} | ${item.host} | ${item.collaborator} | ${item.conditions} | ${item.aiIntegration}`).join("\n")}`;
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.type.toUpperCase()}_${currentSubject}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
        <div className="min-h-screen text-slate-900 font-sans selection:bg-indigo-200">
          {/* Sidebar Navigation */}
          <aside className="fixed left-0 top-0 h-full w-[280px] glass-dark text-white hidden lg:flex flex-col z-30 border-r border-white/10 shadow-2xl">
            <div className="p-8 border-b border-white/10 cursor-pointer hover:bg-white/5 transition-all group" onClick={() => { setMode("dashboard"); setResult(null); }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <BrainCircuit className="w-6 h-6 text-white" />
                </div>
                <h1 className="font-black text-xl tracking-normal break-words leading-tight">khgdkhbdcothaibpbd</h1>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-blue-300/80 font-black uppercase tracking-[0.3em]">Hệ thống thông minh</span>
                <div className="h-px bg-white/10 flex-1"></div>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-1">
              <div className="pt-2 pb-2 px-3">
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Quản lý kế hoạch</span>
              </div>
              <NavItem
                sidebar
                active={mode === "dashboard"}
                onClick={() => { setMode("dashboard"); setResult(null); }}
                icon={<BookOpen className="w-4 h-4" />}
                label="Tổng quan"
              />
              <div className="pt-6 pb-2 px-3">
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Quy trình chuẩn hóa</span>
              </div>
              <NavItem
                sidebar
                active={mode === "kh-tcm-gen"}
                onClick={() => { setMode("kh-tcm-gen"); setResult(null); }}
                icon={<LayoutGrid className="w-4 h-4" />}
                label="1. Kế hoạch Tổ chuyên môn (PL1)"
              />
              <NavItem
                sidebar
                active={mode === "kh-hdgd-gen"}
                onClick={() => { setMode("kh-hdgd-gen"); setResult(null); }}
                icon={<Calendar className="w-4 h-4" />}
                label="2. Kế hoạch tổ chức các HĐGD (PL2)"
              />
              <NavItem
                sidebar
                active={mode === "khgd-gen"}
                onClick={() => { setMode("khgd-gen"); setResult(null); }}
                icon={<Calendar className="w-4 h-4" />}
                label="3. Kế hoạch giáo viên (PL3)"
              />
              <NavItem
                sidebar
                active={mode === "khbd-gen"}
                onClick={() => { setMode("khbd-gen"); setResult(null); }}
                icon={<FileText className="w-4 h-4" />}
                label="4. Kế hoạch bài dạy (PL4)"
              />
              <NavItem
                sidebar
                active={mode === "upgrade-plan"}
                onClick={() => { setMode("upgrade-plan"); setResult(null); }}
                icon={<Zap className="w-4 h-4" />}
                label="5. Nâng cấp Giáo án (AI)"
              />
              <NavItem
                sidebar
                active={mode === "ai-framework-gen"}
                onClick={() => { setMode("ai-framework-gen"); setResult(null); }}
                icon={<BrainCircuit className="w-4 h-4" />}
                label="6. Khung Năng lực AI"
              />
              <NavItem
                sidebar
                active={mode === "su-dia-skills"}
                onClick={() => { setMode("su-dia-skills"); setResult(null); }}
                icon={<Map className="w-4 h-4" />}
                label="7. Sử-Địa Skills"
              />
              <li className="my-2 border-t border-slate-700/50"></li>
                <li>
                  <button
                    onClick={() => setMode("nls-lookup")}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 ${
                      mode === "nls-lookup"
                        ? "bg-brand-accent/20 text-brand-accent shadow-[inset_2px_0_0_0_#14b8a6]"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg ${mode === "nls-lookup" ? "bg-brand-accent/20" : "bg-transparent"}`}>
                        <Search className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-sm tracking-wide">6. Tra cứu mã Năng lực số</span>
                    </div>
                  </button>
                </li>
              <div className="pt-6 pb-2 px-3">
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Tài khoản & Lịch sử</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 text-slate-300">
                <UserCircle className="w-6 h-6" /> <span className="text-sm font-bold text-white/80">Khách</span>
              </div>
              <NavItem
                sidebar
                active={mode === "history"}
                onClick={() => setMode("history")}
                icon={<Clock className="w-4 h-4" />}
                label="Lịch sử tạo (Đã lưu)"
              />
              <div className="pt-4 pb-2 px-3">
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Hệ thống</span>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all text-white/60 hover:bg-white/5 hover:text-white"
              >
                <Settings className="w-4 h-4" /> Cài đặt API
              </button>
            </nav>

            <div className="p-4 mt-auto">
              <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] rounded-2xl p-4 border border-white/5 relative overflow-hidden">
                <div className="absolute -top-5 -right-5 w-20 h-20 bg-brand-accent/10 rounded-full blur-2xl"></div>
                <div className="flex items-center gap-2 mb-2 relative z-10">
                  <BrainCircuit className="w-4 h-4 text-brand-accent" />
                  <span className="text-xs font-bold text-white">Sẵn sàng trợ lý</span>
                </div>
                <p className="text-[10px] text-white/60 leading-relaxed relative z-10">
                  Dựa trên Công văn 3439/BGDĐT và chương trình 2018.
                </p>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="lg:ml-[280px] min-h-screen flex flex-col pt-4 lg:pt-0">
            {/* Mobile Header */}
            <header className="lg:hidden flex items-center justify-between p-4 border-b border-white/10 sticky top-0 bg-indigo-900/80 backdrop-blur-md z-40 text-white">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setMode("dashboard"); setResult(null); }}>
                <span className="font-black text-base sm:text-xl tracking-normal truncate max-w-[180px]">khgdkhbdcothaibpbd</span>
              </div>
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${isOnline ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100" : "border-amber-300/40 bg-amber-400/10 text-amber-100"}`}>
                  {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                  {isOnline ? "Online" : "Offline"}
                </div>
                <UserCircle className="w-6 h-6 text-white/80" />
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 border border-white/20 rounded-lg text-white/60 hover:text-white transition-colors"
                >
                  <Settings className="w-5 h-5" />
                </button>
                <button
                  onClick={() => { setMode("dashboard"); setResult(null); }}
                  className="p-2 border border-white/20 rounded-lg text-white/60 hover:text-white transition-colors"
                >
                  <BookOpen className="w-5 h-5" />
                </button>
              </div>
            </header>

            <div className="lg:hidden sticky top-[65px] z-30 bg-indigo-950/90 backdrop-blur-xl border-b border-white/10 px-3 py-2">
              <div className="edu-mobile-nav flex gap-2 overflow-x-auto pb-1">
                <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 border border-white/10 text-white/70">
                  <Menu className="w-4 h-4" />
                </div>
                {mobileNavItems.map(item => (
                  <button
                    key={item.mode}
                    onClick={() => { setMode(item.mode); setResult(null); }}
                    className={`shrink-0 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold border transition-colors touch-manipulation ${mode === item.mode ? "bg-white text-indigo-950 border-white shadow-sm" : "bg-white/10 text-white/75 border-white/10 hover:bg-white/15"}`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <section className="flex-1 p-4 md:p-6 lg:p-10 max-w-7xl mx-auto w-full pb-40 lg:pb-40">
              {!isOnline && (
                <div className="mb-6 mx-auto w-full max-w-4xl glass p-4 rounded-xl border border-amber-300/50 bg-amber-50/90 flex flex-col sm:flex-row sm:items-center gap-3 text-amber-900">
                  <div className="flex items-center gap-2">
                    <WifiOff className="w-5 h-5 shrink-0" />
                    <span className="text-sm font-black">Đang ngoại tuyến</span>
                  </div>
                  <p className="text-sm font-medium leading-relaxed">
                    App vẫn mở được để xem lịch sử, tải lại file đã tạo và chỉnh nội dung trên máy. Các thao tác tạo mới bằng AI cần Internet.
                  </p>
                </div>
              )}

              {!apiKey.trim() && isOnline && (
                <div className="mb-6 mx-auto w-full max-w-3xl glass p-4 rounded-xl border border-red-500/20 bg-red-50/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-red-500">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span className="text-sm font-bold">Lấy API key để sử dụng app</span>
                  </div>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white text-xs font-bold rounded-lg transition-colors border border-red-500/30"
                  >
                    Cài đặt ngay
                  </button>
                </div>
              )}
              <AnimatePresence mode="wait">
                {mode === "upgrade-plan" && (
                  <motion.div
                    key="upgrade-plan"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                      <div>
                        <h2 className="text-3xl font-bold text-slate-900">Nâng cấp Kế hoạch bài dạy</h2>
                      </div>
                      <button onClick={() => { setMode("dashboard"); setResult(null); }} className="text-sm font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1">
                        Quay lại tổng quan <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <UpgradePlan
                      apiKey={apiKey}
                      isOnline={isOnline}
                      onUpgradeReady={(data) => {
                        const newInput = {
                          subject: data.subject,
                          grade: data.grade,
                          topic: data.topic,
                          duration: data.duration,
                          contextStudents: data.contextStudents,
                          contextSchool: data.contextSchool,
                          objectivesKnowledge: data.objectivesKnowledge,
                          objectivesCompetency: data.objectivesCompetency,
                          objectivesQuality: data.objectivesQuality,
                          useLaTeX: false,
                          detailDrawings: false,
                          additionalNotes: data.additionalNotes || "",
                          existingRawText: data.existingRawText,
                          existingPdfBase64: data.existingPdfBase64,
                          aiIntegrationOptions: data.aiIntegrationOptions,
                          socialIntegrations: data.socialIntegrations || [],
                          indicatorCode: data.indicatorCode,
                          selectedNlsIndicators: data.selectedNlsIndicators || [],
                        };
                        setLessonPlanInput(newInput);
                        setMode("khbd-gen");
                        // Tự động tạo giáo án ngay với input trực tiếp (tránh vấn đề state chưa update kịp)
                        handleGenerateKHBDWithInput(newInput);
                      }}
                    />
                  </motion.div>
                )}

                {mode === "su-dia-skills" && (
                  <motion.div
                    key="su-dia-skills"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <SuDiaSkills
                      apiKey={apiKey}
                      aiModel={aiModel}
                      isOnline={isOnline}
                      onRequestSettings={() => setShowSettings(true)}
                      onOpenUpgradePlan={() => {
                        setResult(null);
                        setMode("upgrade-plan");
                      }}
                    />
                  </motion.div>
                )}

                {mode === "history" && (
                  <motion.div
                    key="history"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200/50 border border-slate-100">
                        <Clock className="w-6 h-6 text-brand-accent" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-brand-dark tracking-tight">Lịch sử tạo gần đây</h2>
                        <p className="text-sm font-medium text-brand-muted">Các kế hoạch đã được lưu lại tự động (15 bản gần nhất)</p>
                      </div>
                    </div>
                    
                    {history.length === 0 ? (
                      <div className="text-center p-12 bg-white rounded-[32px] border border-slate-100 shadow-sm">
                        <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">Chưa có lịch sử tạo nào.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {history.map((item, idx) => (
                          <div key={item.id} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group" onClick={() => {
                            setResult({ type: item.type, data: item.type === "khbd" ? normalizeKhbdToCv5512(item.data) : item.data, loadedFromHistory: true });
                            if (item.evaluationResult) {
                              setEvaluationResult(item.evaluationResult);
                            }
                            setMode((item.type + "-gen") as AppMode);
                          }}>
                            <div className="flex justify-between items-start mb-4">
                              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold uppercase tracking-wider">{item.type.toUpperCase()}</span>
                              <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-2 py-1 rounded-md">{new Date(item.timestamp).toLocaleString("vi-VN")}</span>
                            </div>
                            <h3 className="font-bold text-slate-800 text-lg line-clamp-2 mb-2 group-hover:text-brand-accent transition-colors">{item.title}</h3>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {mode === "dashboard" && (
                  <motion.div
                    key="dashboard"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    className="space-y-10"
                  >
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                      <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 glass rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-indigo-700 border border-indigo-200/50 shadow-sm">
                          <Sparkles className="w-3 h-3 animate-pulse" /> Trợ lý giáo dục 4.0
                        </div>
                        <div>
                          <h2 className="text-4xl md:text-6xl font-black text-white tracking-normal leading-[1.05] mb-4 break-all">
                            khgdkhbdcothaibpbd
                          </h2>
                          <p className="text-indigo-100/70 font-medium max-w-xl text-lg">
                            Nền tảng số hóa giáo án chuyên nghiệp, bám sát các tiêu chuẩn giáo dục Việt Nam.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 glass p-3 pr-8 rounded-[24px] border border-white/20 shadow-2xl self-end md:self-auto backdrop-blur-3xl group hover:bg-white/90 transition-all">
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                          <CheckCircle2 className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest leading-none mb-1">Hợp quy</p>
                          <p className="text-base font-black text-slate-900 leading-none">BGDĐT Compliance</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      {/* Hero / Main Card */}
                      <div className="md:col-span-4 lg:col-span-2 glass p-10 rounded-[24px] relative overflow-hidden flex flex-col justify-between min-h-[360px] group transition-all hover:bg-white/80 border border-white/50 shadow-2xl">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[80px] -mr-20 -mt-20 group-hover:bg-blue-500/20 transition-all"></div>
                        <div className="relative z-10">
                          <div className="p-5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl w-fit shadow-xl mb-8 transform group-hover:-rotate-6 transition-transform">
                            <School className="w-10 h-10 text-white" />
                          </div>
                          <h3 className="text-4xl font-black text-indigo-950 mb-4 leading-tight tracking-tighter">Số hóa Kế hoạch <br /> Giáo dục Chuyên nghiệp</h3>
                          <p className="text-indigo-900/70 text-base font-semibold leading-relaxed max-w-md italic border-l-4 border-indigo-400 pl-4">
                            "Khoa học - Trực quan - Thông minh - Hiện đại"
                          </p>
                        </div>
                        <div className="relative z-10 flex items-center gap-4 mt-8 pt-8 border-t border-indigo-100/30">
                          <div className="flex -space-x-3">
                            {["GV", "AI", "NLS", "10", "12"].map((label, i) => (
                              <div key={label} className={`w-10 h-10 rounded-full border-2 border-white flex items-center justify-center overflow-hidden shadow-md text-[10px] font-black text-white ${["bg-blue-600", "bg-indigo-600", "bg-emerald-600", "bg-amber-600", "bg-rose-600"][i]}`}>
                                {label}
                              </div>
                            ))}
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-indigo-800 tracking-wider uppercase">Chuẩn dữ liệu GDPT 2018</p>
                            <p className="text-[9px] text-indigo-400 font-bold uppercase">Cập nhật mới nhất 2025</p>
                          </div>
                        </div>
                      </div>

                      {/* KHTCM Card */}
                      <div className="md:col-span-2 lg:col-span-1 h-full">
                        <FeatureCard
                          icon={<LayoutGrid className="w-8 h-8 text-white" />}
                          iconBg="bg-blue-600"
                          title="Kế hoạch Tổ (KHTCM)"
                          desc="Xây dựng khung kế hoạch dạy học cấp Tổ chuyên môn tích hợp AI chuẩn CV 3439."
                          onClick={() => setMode("kh-tcm-gen")}
                        />
                      </div>

                      {/* KHGD Card */}
                      <div className="md:col-span-2 lg:col-span-1 h-full">
                        <FeatureCard
                          icon={<Calendar className="w-8 h-8 text-white" />}
                          iconBg="bg-indigo-600"
                          title="Kế hoạch GV (KHGD)"
                          desc="Lập phân phối chương trình và dự kiến kế hoạch dạy học cá nhân chi tiết."
                          onClick={() => setMode("khgd-gen")}
                        />
                      </div>

                      <div className="md:col-span-2 lg:col-span-1 h-full">
                        <FeatureCard
                          icon={<Map className="w-8 h-8 text-white" />}
                          iconBg="bg-emerald-600"
                          title="Sử-Địa Skills"
                          desc="Tạo quiz, slide PPTX, phân tích bản đồ/GIS và đề kiểm tra cho bài học Sử-Địa."
                          onClick={() => setMode("su-dia-skills")}
                        />
                      </div>

                      {/* KHBD Large Card */}
                      <div className="md:col-span-4 glass p-10 rounded-[24px] flex flex-col lg:flex-row items-center gap-10 relative overflow-hidden group hover:bg-white/80 transition-all border border-white/50 shadow-2xl">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600 opacity-50"></div>
                        <div className="flex-shrink-0 p-8 bg-gradient-to-br from-indigo-600 to-blue-800 rounded-[32px] shadow-2xl transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                          <FileText className="w-16 h-16 text-white" />
                        </div>
                        <div className="flex-1 space-y-6">
                          <div className="space-y-2 text-center lg:text-left">
                            <h3 className="text-3xl font-black text-indigo-950 tracking-tighter">Soạn Kế hoạch bài dạy (KHBD)</h3>
                            <p className="text-indigo-900/60 font-semibold text-lg">Tạo giáo án chi tiết với kịch bản tương tác AI chuyên sâu.</p>
                          </div>
                          <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                            {["Chuẩn 5512", "Tích hợp AI 3439", "Công thức Word", "Đa định dạng"].map(tag => (
                              <span key={tag} className="px-4 py-1.5 bg-white/50 backdrop-blur-sm text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-indigo-100 shadow-sm">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => setMode("khbd-gen")}
                          className="w-full lg:w-auto bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-10 py-5 rounded-[24px] font-black uppercase tracking-[0.2em] text-sm shadow-indigo-600/30 shadow-2xl hover:scale-105 transition-all active:scale-95 flex items-center justify-center gap-3 group/btn"
                        >
                          Bắt đầu ngay <ChevronRight className="w-6 h-6 group-hover/btn:translate-x-2 transition-transform" />
                        </button>
                      </div>

                      {/* Analytics / Integration Card */}
                      <div className="md:col-span-2 glass p-8 rounded-[24px] border border-white/50 flex items-center gap-6 group hover:bg-white/80 transition-all">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-50 transition-colors">
                          <Sparkles className="w-8 h-8 text-indigo-500" />
                        </div>
                        <div>
                          <h4 className="font-black text-indigo-950">Phát triển Năng lực AI</h4>
                          <p className="text-xs font-medium text-indigo-900/50 leading-relaxed italic">Nạp khung năng lực 3439 vào từng hoạt động dạy học.</p>
                        </div>
                      </div>

                      <div className="md:col-span-2 glass p-8 rounded-[24px] border border-white/50 flex items-center gap-6 group hover:bg-white/80 transition-all">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 transition-colors">
                          <BrainCircuit className="w-8 h-8 text-blue-500" />
                        </div>
                        <div>
                          <h4 className="font-black text-indigo-950">Xử lý Ngôn ngữ Tự nhiên</h4>
                          <p className="text-xs font-medium text-indigo-900/50 leading-relaxed italic">Phân tích yêu cầu cần đạt (YCCĐ) một cách khoa học.</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {mode === "khbd-gen" && (
                  <motion.div
                    key="khbd"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                      <div>
                        <h2 className="text-3xl font-bold text-slate-900">Khung Kế hoạch bài dạy</h2>
                        <p className="text-slate-500 mt-1">Chuẩn Công văn 3439/BGDĐT</p>
                      </div>
                      <button
                        onClick={() => { setMode("dashboard"); setResult(null); }}
                        className="text-sm font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1"
                      >
                        Quay lại tổng quan <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {!result && !loading && (
                      <div className="glass rounded-[24px] p-8 max-w-2xl mx-auto backdrop-blur-3xl border-indigo-200/30">
                        <div className="grid grid-cols-1 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Địa phương / Tỉnh thành</label>
                            <select
                              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent outline-none text-sm appearance-none bg-white font-medium"
                              value={province}
                              onChange={(e) => {
                                setProvince(e.target.value);
                                if (lessonPlanInput.subject) {
                                  handleSubjectOrGradeChange(lessonPlanInput.subject, lessonPlanInput.grade);
                                }
                              }}
                            >
                              {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <p className="text-[10px] text-slate-400 mt-1 italic leading-relaxed">
                              * Lưu ý: Hiện tại danh sách bao gồm 6 thành phố và 28 tỉnh (theo cập nhật đơn vị hành chính 1/7/2025).
                            </p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Môn học</label>
                            <div className="relative group">
                              <select
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition-all outline-none text-sm appearance-none bg-white font-medium scrollbar-thin scrollbar-thumb-slate-200"
                                value={lessonPlanInput.subject}
                                onChange={(e) => handleSubjectOrGradeChange(e.target.value, lessonPlanInput.grade)}
                              >
                                <option value="">-- Chọn môn học --</option>
                                {(["6", "7", "8", "9"].includes(lessonPlanInput.grade) ? SUBJECTS_THCS : SUBJECTS_THPT).map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-brand-accent transition-colors">
                                <ChevronRight className="w-4 h-4 rotate-90" />
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Khối lớp</label>
                              <div className="relative group">
                                <select
                                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent outline-none text-sm appearance-none bg-white font-medium"
                                  value={lessonPlanInput.grade}
                                  onChange={(e) => handleSubjectOrGradeChange(lessonPlanInput.subject, e.target.value)}
                                >
                                  {GRADES.map(g => <option key={g} value={g}>Lớp {g}</option>)}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-brand-accent transition-colors">
                                  <ChevronRight className="w-4 h-4 rotate-90" />
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Thời lượng</label>
                              <input
                                type="text"
                                placeholder="VD: 2 tiết"
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent outline-none text-sm"
                                value={lessonPlanInput.duration}
                                onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, duration: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Chọn bài dạy trong chương trình 2018</label>
                              <div className="relative group">
                                <select
                                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent outline-none text-sm appearance-none bg-white font-medium italic"
                                  value={lessonPlanInput.topic}
                                  onChange={(e) => handleLessonSelect(e.target.value)}
                                >
                                  <option value="">-- Chọn bài dạy có sẵn --</option>
                                  {availableLessons.map((l, idx) => (
                                    <option key={idx} value={l.topic}>{l.topic}</option>
                                  ))}
                                  <option value="custom">-- Nhập tên bài bài dạy khác --</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                  <ChevronRight className="w-4 h-4 rotate-90" />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Tên bài học cụ thể (hoặc Tải ảnh/PDF SGK)</label>
                                <div>
                                  <input type="file" id="upload-source-1" className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} />
                                  <label htmlFor="upload-source-1" className="cursor-pointer flex items-center gap-1 text-[10px] font-bold text-brand-accent hover:text-blue-700 bg-brand-accent/10 px-2 py-1 rounded transition-colors uppercase tracking-[0.1em]">
                                    {uploadingSource ? <Sparkles className="w-3 h-3 animate-spin" /> : <UploadCloud className="w-3 h-3" />}
                                    {uploadingSource ? "Đang đọc..." : "AI Đọc Ảnh / PDF"}
                                  </label>
                                </div>
                              </div>
                              <textarea
                                placeholder="Nhập tên bài học hoặc nội dung trọng tâm..."
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent min-h-[60px] transition-all outline-none text-sm"
                                value={lessonPlanInput.topic}
                                onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, topic: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="pt-4 border-t border-slate-100 mt-2">
                            <h4 className="text-[11px] font-extrabold text-brand-sidebar uppercase tracking-widest mb-4 flex items-center gap-2">
                              <BrainCircuit className="w-3 h-3 text-brand-accent" /> Bối cảnh giảng dạy
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Đặc điểm học sinh</label>
                                <textarea
                                  placeholder="VD: Học sinh có ý thức học tập tốt, đã biết cơ bản về..."
                                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent min-h-[60px] text-xs outline-none"
                                  value={lessonPlanInput.contextStudents}
                                  onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, contextStudents: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Điều kiện trường/lớp</label>
                                <textarea
                                  placeholder="VD: Phòng có máy chiếu, mạng internet ổn định..."
                                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent min-h-[60px] text-xs outline-none"
                                  value={lessonPlanInput.contextSchool}
                                  onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, contextSchool: e.target.value })}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-slate-100">
                            <h4 className="text-[11px] font-extrabold text-brand-sidebar uppercase tracking-widest mb-4 flex items-center gap-2">
                              <Sparkles className="w-3 h-3 text-brand-accent" /> Mục tiêu cụ thể (Tùy chọn)
                            </h4>
                            <div className="grid grid-cols-1 gap-3">
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Mục tiêu kiến thức</label>
                                <textarea
                                  placeholder="Nhập kiến thức trọng tâm cần đạt..."
                                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent min-h-[50px] text-xs outline-none"
                                  value={lessonPlanInput.objectivesKnowledge}
                                  onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, objectivesKnowledge: e.target.value })}
                                />
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Mục tiêu năng lực</label>
                                  <textarea
                                    placeholder="VD: Năng lực tự học, giải quyết vấn đề..."
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent min-h-[50px] text-xs outline-none"
                                    value={lessonPlanInput.objectivesCompetency}
                                    onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, objectivesCompetency: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Mục tiêu phẩm chất</label>
                                  <textarea
                                    placeholder="VD: Trung thực, trách nhiệm..."
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent min-h-[50px] text-xs outline-none"
                                    value={lessonPlanInput.objectivesQuality}
                                    onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, objectivesQuality: e.target.value })}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-2">
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-brand-accent focus:ring-brand-accent cursor-pointer"
                                checked={lessonPlanInput.useLaTeX}
                                onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, useLaTeX: e.target.checked })}
                              />
                              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.05em] group-hover:text-brand-accent transition-colors">Chuẩn công thức Word</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-brand-accent focus:ring-brand-accent cursor-pointer"
                                checked={lessonPlanInput.detailDrawings}
                                onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, detailDrawings: e.target.checked })}
                              />
                              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.05em] group-hover:text-brand-accent transition-colors">Mô tả chi tiết hình vẽ</span>
                            </label>
                          </div>

                          <div className="space-y-2 pt-2">
                            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Ghi chú khác</label>
                            <textarea
                              placeholder="Các yêu cầu bổ sung khác cho AI..."
                              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent min-h-[50px] text-xs outline-none"
                              value={lessonPlanInput.additionalNotes}
                              onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, additionalNotes: e.target.value })}
                            />
                          </div>

                          <div className="space-y-3 pt-2">
                            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em] flex items-center gap-2">
                              Tích hợp nội dung xã hội (TT 02/2025)
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: "Heritage", label: "Di sản" },
                                { id: "DrugPrevention", label: "Ma túy" },
                                { id: "Population", label: "Dân số" },
                                { id: "Inclusive", label: "Hòa nhập" }
                              ].map((item) => (
                                <label key={item.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-all">
                                  <input
                                    type="checkbox"
                                    checked={lessonPlanInput.socialIntegrations?.includes(item.id)}
                                    onChange={(e) => {
                                      const current = lessonPlanInput.socialIntegrations || [];
                                      if (e.target.checked) {
                                        setLessonPlanInput({ ...lessonPlanInput, socialIntegrations: [...current, item.id] });
                                      } else {
                                        setLessonPlanInput({ ...lessonPlanInput, socialIntegrations: current.filter(id => id !== item.id) });
                                      }
                                    }}
                                    className="w-3 h-3 rounded text-brand-accent focus:ring-brand-accent"
                                  />
                                  <span className="text-[10px] font-medium text-slate-600">{item.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Giao diện Đề xuất Chỉ báo NLS */}
                          <div className="space-y-3 pt-4 border-t border-slate-100">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-brand-accent uppercase tracking-[0.14em] flex items-center gap-2">
                                <BrainCircuit className="w-3.5 h-3.5" />
                                Đề xuất Chỉ báo NLS/AI
                              </label>
                              <button
                                onClick={handleSuggestNls}
                                disabled={isSuggestingNls}
                                className="text-xs font-semibold bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-accent px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                              >
                                {isSuggestingNls ? (
                                  <>
                                    <div className="w-3 h-3 border-2 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
                                    Đang phân tích...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5" />
                                    AI Đề xuất
                                  </>
                                )}
                              </button>
                            </div>
                            
                            {suggestedNlsIndicators.length > 0 && (
                              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                {suggestedNlsIndicators.map((item, idx) => (
                                  <label
                                    key={idx}
                                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                                      lessonPlanInput.selectedNlsIndicators?.find(i => i.code === item.code)
                                        ? "border-brand-accent bg-brand-accent/5"
                                        : "border-slate-200 hover:border-slate-300 bg-white"
                                    }`}
                                  >
                                    <div className="pt-0.5">
                                      <input
                                        type="checkbox"
                                        checked={!!lessonPlanInput.selectedNlsIndicators?.find(i => i.code === item.code)}
                                        onChange={(e) => {
                                          const current = lessonPlanInput.selectedNlsIndicators || [];
                                          if (e.target.checked) {
                                            setLessonPlanInput({
                                              ...lessonPlanInput,
                                              selectedNlsIndicators: [...current, { code: item.code, description: item.name }]
                                            });
                                          } else {
                                            setLessonPlanInput({
                                              ...lessonPlanInput,
                                              selectedNlsIndicators: current.filter(i => i.code !== item.code)
                                            });
                                          }
                                        }}
                                        className="w-4 h-4 rounded text-brand-accent focus:ring-brand-accent"
                                      />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                                          {item.code}
                                        </span>
                                      </div>
                                      <p className="text-sm font-medium text-slate-700 line-clamp-2" title={item.name}>
                                        {item.name}
                                      </p>
                                      <div className="text-xs text-brand-accent/80 bg-brand-accent/10 px-2 py-1.5 rounded-lg flex items-start gap-1.5">
                                        <BrainCircuit className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                        <span className="italic leading-snug">{item.rationale}</span>
                                      </div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* CONTENT INTEGRITY WARNING - Nguyên tắc 3.1 */}
                          {!lessonPlanInput.existingRawText && !lessonPlanInput.existingPdfBase64 && (
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-sm font-bold text-amber-800">Lưu ý về nguồn nội dung (Nguyên tắc 3.1)</p>
                                <p className="text-xs text-amber-700 mt-1">
                                  Bạn chưa tải lên file giáo án/chương trình môn học. AI sẽ sử dụng dữ liệu chương trình chuẩn từ hệ thống. Để đảm bảo chính xác tuyệt đối về tên bài, số tiết và YCCĐ, vui lòng tải lên file chương trình hoặc giáo án gốc của bạn.
                                </p>
                              </div>
                            </div>
                          )}
                          <button
                            onClick={handleGenerateKHBD}
                            disabled={!lessonPlanInput.subject || !lessonPlanInput.topic}
                            className="w-full bg-brand-accent hover:bg-sky-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg shadow-lg shadow-brand-accent/20 transition-all flex items-center justify-center gap-2"
                          >
                            <Sparkles className="w-5 h-5 fill-white/20" />
                            Tạo Kế hoạch Bài dạy ngay
                          </button>
                        </div>
                      </div>
                    )}

                    {loading && (
                      <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                        <p className="text-slate-500 font-medium animate-pulse">AI đang soạn thảo kế hoạch bài dạy cho bạn...</p>
                        <p className="text-xs text-slate-400">Việc này có thể mất vài giây bám sát CV 3439.</p>
                      </div>
                    )}

                    {result && result.type === "khbd" && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between gap-4 sticky top-6 z-10 bg-brand-bg/80 backdrop-blur-md py-2 px-1">
                          <div className="flex flex-col">
                            <h3 className="text-xl font-extrabold text-brand-sidebar line-clamp-1">{result.data.title}</h3>
                            <div className="text-[10px] text-brand-muted font-bold uppercase flex items-center gap-2 mt-1">
                              Chuẩn CV 5512/BGDĐT + AI <span className="w-1 h-1 bg-brand-muted rounded-full"></span> Môn: {lessonPlanInput.subject} <span className="w-1 h-1 bg-brand-muted rounded-full"></span> {province}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={downloadWord} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống Word">
                              <FileDown className="w-4 h-4 text-blue-600" />
                            </button>
                            <button onClick={downloadPDF} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống PDF">
                              <FileDown className="w-4 h-4 text-red-500" />
                            </button>
                            <button onClick={downloadText} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống Text (.txt)">
                              <FileText className="w-4 h-4 text-brand-muted" />
                            </button>
                            <button onClick={downloadHTML} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống HTML (mở trình duyệt)">
                              <FileCode className="w-4 h-4 text-orange-500" />
                            </button>
                            <button onClick={downloadPPTX} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống PowerPoint (.pptx)">
                              <Presentation className="w-4 h-4 text-orange-600" />
                            </button>
                            <button onClick={handleCopy} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Sao chép JSON">
                              <FileJson className="w-4 h-4 text-brand-accent" />
                            </button>
                            <button onClick={() => window.print()} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="In">
                              <Printer className="w-4 h-4 text-brand-muted" />
                            </button>
                            <button
                              onClick={() => setResult(null)}
                              className="px-4 py-2 bg-brand-sidebar text-white rounded-lg text-xs font-bold shadow-md hover:bg-slate-900 transition-colors"
                            >
                              Tạo mới
                            </button>
                            <button
                              onClick={() => {
                                setEduPlanInput({
                                  ...eduPlanInput,
                                  subject: lessonPlanInput.subject,
                                  grade: lessonPlanInput.grade
                                });
                                setMode("khgd-gen");
                                setResult(null);
                              }}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
                            >
                              <Calendar className="w-3 h-3" /> Lập KH Giáo dục GV
                            </button>
                            {!evaluationResult && (
                              <button
                                onClick={handleGenerateEvaluation}
                                disabled={evaluationLoading}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                              >
                                {evaluationLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ClipboardCheck className="w-3 h-3" />}
                                {evaluationLoading ? "Đang thiết kế..." : "Thiết kế đánh giá"}
                              </button>
                            )}
                            <button
                              onClick={handleEvaluateCouncil}
                              disabled={evaluatingCouncil}
                              className="px-4 py-2 bg-brand-accent text-white rounded-lg text-xs font-bold shadow-md hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                              {evaluatingCouncil ? <Sparkles className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3 h-3" />}
                              {evaluatingCouncil ? "Đang Phản Biện..." : "Đánh giá Hội đồng AI"}
                            </button>
                          </div>
                        </div>

                        {councilEvaluation && (
                          <div className="glass rounded-[24px] p-6 shadow-xl border-l-4 border-l-brand-accent animate-in fade-in slide-in-from-top-4">
                            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                              <BrainCircuit className="w-6 h-6 text-brand-accent" />
                              Báo Cáo Đánh Giá Từ Hội Đồng Chuyên Gia AI
                              <span className="ml-auto text-brand-accent text-2xl font-black">{councilEvaluation.overallScore}/10</span>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <h4 className="font-bold text-sm text-brand-sidebar uppercase flex items-center gap-2 border-b border-slate-200 pb-2"><BookOpen className="w-4 h-4 text-emerald-600" /> Chuyên gia Giáo dục</h4>
                                <div><span className="text-xs font-bold text-emerald-600">Ưu điểm:</span><p className="text-xs text-slate-700 mt-1">{councilEvaluation.educationalExpert.strengths}</p></div>
                                <div><span className="text-xs font-bold text-amber-600">Hạn chế:</span><p className="text-xs text-slate-700 mt-1">{councilEvaluation.educationalExpert.weaknesses}</p></div>
                                <div><span className="text-xs font-bold text-brand-accent">Đề xuất:</span><p className="text-xs text-slate-700 mt-1">{councilEvaluation.educationalExpert.suggestions}</p></div>
                              </div>
                              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <h4 className="font-bold text-sm text-brand-sidebar uppercase flex items-center gap-2 border-b border-slate-200 pb-2"><Laptop className="w-4 h-4 text-blue-600" /> Chuyên gia Công nghệ</h4>
                                <div><span className="text-xs font-bold text-emerald-600">Ưu điểm:</span><p className="text-xs text-slate-700 mt-1">{councilEvaluation.digitalExpert.strengths}</p></div>
                                <div><span className="text-xs font-bold text-amber-600">Hạn chế:</span><p className="text-xs text-slate-700 mt-1">{councilEvaluation.digitalExpert.weaknesses}</p></div>
                                <div><span className="text-xs font-bold text-brand-accent">Đề xuất:</span><p className="text-xs text-slate-700 mt-1">{councilEvaluation.digitalExpert.suggestions}</p></div>
                              </div>
                              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <h4 className="font-bold text-sm text-brand-sidebar uppercase flex items-center gap-2 border-b border-slate-200 pb-2"><Sparkles className="w-4 h-4 text-brand-accent" /> Chuyên gia Phản biện AI</h4>
                                <div><span className="text-xs font-bold text-emerald-600">Ưu điểm:</span><p className="text-xs text-slate-700 mt-1">{councilEvaluation.aiExpert.strengths}</p></div>
                                <div><span className="text-xs font-bold text-amber-600">Hạn chế:</span><p className="text-xs text-slate-700 mt-1">{councilEvaluation.aiExpert.weaknesses}</p></div>
                                <div><span className="text-xs font-bold text-brand-accent">Đề xuất:</span><p className="text-xs text-slate-700 mt-1">{councilEvaluation.aiExpert.suggestions}</p></div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div ref={contentRef} className="glass rounded-[24px] p-8 shadow-2xl space-y-10 print:border-0 print:shadow-none print:bg-white paper">
                          {/* Section I */}
                          <section className="space-y-6">
                            <h4 className="text-base font-extrabold text-brand-sidebar border-t border-slate-100 pt-4 uppercase tracking-tight flex items-center gap-3">
                              <span className="w-1 h-6 bg-brand-accent rounded-full"></span>
                              I. MỤC TIÊU
                            </h4>
                            <div className="space-y-6 pl-4">
                              <div className="mb-6">
                                <span className="inline-block px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-brand-muted uppercase mb-3 border border-slate-200">1. Kiến thức</span>
                                <ul className="list-disc list-inside space-y-2 text-brand-dark text-[12px] leading-relaxed">
                                  {(result.data.objectives.knowledge || []).map((c: string, i: number) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
                                <div className="space-y-4">
                                  <div>
                                    <span className="inline-block px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-brand-muted uppercase mb-3 text-emerald-700">2. Năng lực đặc thù môn học</span>
                                    <ul className="list-disc list-inside space-y-2 text-brand-dark text-[12px] leading-relaxed">
                                      {(result.data.objectives.subjectSpecific || []).map((c: string, i: number) => (
                                        <li key={i}>{c}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <span className="inline-block px-2 py-1 bg-blue-50 rounded text-[10px] font-bold text-blue-600 uppercase mb-3 border border-blue-100">3. Năng lực số</span>
                                    <ul className="list-disc list-inside space-y-2 text-blue-600 text-[12px] leading-relaxed font-medium">
                                      {(result.data.objectives.digitalSpecific || []).map((c: string, i: number) => (
                                        <li key={i}>{c}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <span className="inline-block px-2 py-1 bg-red-50 rounded text-[10px] font-bold text-red-600 uppercase mb-3 border border-red-100">4. Năng lực AI đặc thù (3439)</span>
                                    <ul className="list-disc list-inside space-y-2 text-red-600 text-[12px] leading-relaxed italic font-medium">
                                      {(result.data.objectives.aiSpecific || []).map((c: string, i: number) => (
                                        <li key={i}>{c}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <div>
                                    <span className="inline-block px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-brand-muted uppercase mb-3">5. Năng lực chung</span>
                                    <ul className="list-disc list-inside space-y-2 text-brand-dark text-[12px] leading-relaxed">
                                      {(result.data.objectives.general || []).map((c: string, i: number) => (
                                        <li key={i}>{c}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <span className="inline-block px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-brand-muted uppercase mb-3">6. Phẩm chất</span>
                                    <ul className="list-disc list-inside space-y-2 text-brand-dark text-[12px] leading-relaxed">
                                      {(result.data.objectives.qualities || []).map((q: string, i: number) => (
                                        <li key={i}>{q}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </section>

                          {/* Section II */}
                          <section className="space-y-4">
                            <h4 className="text-base font-extrabold text-brand-sidebar border-t border-slate-100 pt-4 uppercase tracking-tight flex items-center gap-3">
                              <span className="w-1 h-6 bg-brand-accent rounded-full"></span>
                              II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pl-4">
                              <div className="space-y-2">
                                <p className="text-[10px] font-extrabold text-brand-muted uppercase tracking-wider">1. Thiết bị truyền thống</p>
                                <ul className="list-disc list-inside space-y-1 text-brand-dark text-[12px]">
                                  {(result.data.materials?.traditional || []).map((m: string, i: number) => <li key={i}>{m}</li>)}
                                </ul>
                              </div>
                              <div className="space-y-4">
                                <p className="text-[10px] font-extrabold text-red-600 uppercase tracking-wider underline decoration-red-200 underline-offset-4">2. CÔNG CỤ SỐ AI</p>
                                <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 space-y-3 shadow-sm shadow-red-50">
                                  <div>
                                    <p className="text-[9px] font-bold text-red-600 uppercase mb-1">Phương án triển khai</p>
                                    <p className="text-[11px] text-red-600 leading-relaxed font-semibold italic">
                                      {result.data.materials?.digitalAndAI?.implementationMethod}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-bold text-red-600 uppercase mb-1">Học liệu / Công cụ cụ thể</p>
                                    <ul className="list-disc list-inside text-[11px] text-red-600 space-y-1 font-medium">
                                      {(result.data.materials?.digitalAndAI?.specificTools || []).map((m: string, i: number) => <li key={i}>{m}</li>)}
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </section>

                          {/* Section III */}
                          <section className="space-y-6">
                            <h4 className="text-base font-extrabold text-brand-sidebar border-t border-slate-100 pt-4 uppercase tracking-tight flex items-center gap-3">
                              <span className="w-1 h-6 bg-brand-accent rounded-full"></span>
                              III. TIẾN TRÌNH DẠY HỌC
                            </h4>
                            <div className="space-y-8 pl-4">
                              {(result.data.activities || []).map((act: any, i: number) => (
                                <div key={i} className="space-y-4 border-l-2 border-slate-100 pl-6 relative">
                                  <div className="absolute -left-[9px] top-1 w-4 h-4 bg-white border-2 border-brand-accent rounded-full"></div>
                                  <h5 className="font-extrabold text-brand-accent text-sm uppercase">{highlightAI(act.name)}</h5>
                                  <div className="grid grid-cols-1 gap-4 text-[13px] leading-relaxed">
                                    <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                      <p className="font-bold text-brand-sidebar mb-1 uppercase text-[10px] tracking-wider text-opacity-70">a) Mục tiêu</p>
                                      <div className="text-brand-muted">{renderRichTextBlock(act.objective)}</div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                        <p className="font-bold text-brand-sidebar mb-1 uppercase text-[10px] tracking-wider text-opacity-70">b) Nội dung</p>
                                        <div className="text-brand-muted">{renderRichTextBlock(act.content)}</div>
                                      </div>
                                      <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                        <p className="font-bold text-brand-sidebar mb-1 uppercase text-[10px] tracking-wider text-opacity-70">c) Sản phẩm</p>
                                        <div className="text-brand-muted">{renderRichTextBlock(act.product)}</div>
                                      </div>
                                    </div>
                                    <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                      <p className="font-bold text-brand-sidebar mb-3 uppercase text-[10px] tracking-wider text-opacity-70">d) Tổ chức thực hiện - 4 bước CV 5512</p>
                                      <div className="space-y-6">
                                        {(act.procedure || []).map((step: any, idx: number) => (
                                          <div key={idx} className="space-y-3">
                                            <p className="font-bold text-brand-sidebar text-[11px] bg-slate-200/50 px-2 py-1 rounded inline-block">{highlightAI(step.stepName)}</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-2">
                                              <div className="space-y-1">
                                                <p className="text-[9px] font-bold text-brand-muted uppercase">Hoạt động của GV và HS</p>
                                                <div className="text-brand-dark text-[12px] leading-relaxed pl-3 border-l-2 border-brand-accent/20">{renderRichTextBlock(step.teacherStudentActivities)}</div>
                                              </div>
                                              <div className="space-y-1">
                                                <p className="text-[9px] font-bold text-brand-muted uppercase">Dự kiến sản phẩm</p>
                                                <div className="text-brand-dark text-[12px] leading-relaxed pl-3 border-l-2 border-emerald-500/20 font-medium italic">{renderRichTextBlock(step.expectedProduct)}</div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </section>

                          {/* Section IV */}
                          <section className="space-y-4">
                            <h4 className="text-base font-extrabold text-brand-sidebar border-t border-slate-100 pt-4 uppercase tracking-tight flex items-center gap-3">
                              <span className="w-1 h-6 bg-brand-accent rounded-full"></span>
                              IV. KẾ HOẠCH ĐÁNH GIÁ
                            </h4>
                            <ul className="list-disc list-inside space-y-2 text-brand-dark text-[13px] pl-4 leading-relaxed">
                              {(result.data.assessment || []).map((a: string, i: number) => (
                                <li key={i}>{renderRichTextBlock(a)}</li>
                              ))}
                            </ul>
                          </section>

                          {/* Section V */}
                          <section className="space-y-4">
                            <h4 className="text-base font-extrabold text-brand-sidebar border-t border-slate-100 pt-4 uppercase tracking-tight flex items-center gap-3">
                              <span className="w-1 h-6 bg-brand-accent rounded-full"></span>
                              V. PHỤ LỤC
                            </h4>
                            <div className="space-y-6 pl-4">
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <p className="text-[10px] font-extrabold text-brand-sidebar uppercase mb-2 tracking-wider">Gợi ý mẫu Prompt cho HS</p>
                                <div className="space-y-2">
                                  {(result.data.appendix?.prompts || []).map((p: string, i: number) => (
                                    <div key={i} className="p-3 bg-white border border-slate-200 rounded-lg text-[12px] font-mono text-brand-accent shadow-sm italic">
                                      "{p}"
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <p className="text-[10px] font-extrabold text-brand-sidebar uppercase mb-2 tracking-wider">Bảng kiểm đánh giá thái độ sử dụng AI</p>
                                <ul className="list-disc list-inside space-y-1 text-brand-dark text-[12px]">
                                  {(result.data.appendix?.checklist || []).map((c: string, i: number) => <li key={i}>{c}</li>)}
                                </ul>
                              </div>
                            </div>
                          </section>

                          <div className="bg-gradient-to-br from-brand-sidebar to-[#0F172A] rounded-2xl p-6 text-white relative overflow-hidden mt-12">
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-accent/20 rounded-full blur-3xl"></div>
                            <div className="relative z-10">
                              <div className="flex items-center gap-1 mb-3">
                                <Sparkles className="w-4 h-4 text-brand-accent" />
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-accent">Nhân văn & An toàn dữ liệu</span>
                              </div>
                              <p className="text-[12px] opacity-90 leading-relaxed font-light italic">
                                "Công nghệ phục vụ con người, không thay thế tư duy. Luôn bảo vệ thông tin cá nhân và trích dẫn nguồn AI trung thực."
                              </p>
                            </div>
                          </div>

                          {/* Section VI: Phiếu Sử dụng AI - Mục 7 (Phiếu dành cho Học sinh) */}
                          {result.data.aiUsageLog && result.data.aiUsageLog.length > 0 && (
                            <section className="space-y-4 mt-6 pt-6 border-t border-slate-100">
                              <h4 className="text-base font-extrabold text-brand-sidebar uppercase tracking-tight flex items-center gap-3">
                                <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
                                VI. PHIẾU SỬ DỤNG AI (Dành cho Học sinh — Chuẩn Mục 7/CV 3439)
                              </h4>
                              <div className="pl-4 bg-purple-50 border border-purple-200 rounded-xl p-4">
                                <p className="text-xs font-bold text-purple-700 mb-1">📋 Hướng dẫn sử dụng phiếu:</p>
                                <ul className="text-[11px] text-purple-600 space-y-0.5 list-disc list-inside">
                                  <li>Giáo viên in phiếu và phát cho học sinh trước hoạt động.</li>
                                  <li><b>① ②</b> Giáo viên đã gợi ý sẵn. Học sinh đọc và thực hiện theo.</li>
                                  <li><b>③ ④</b> Học sinh tự điền sau khi sử dụng AI.</li>
                                  <li><b>⑤</b> Giáo viên điền nhận xét và lưu làm minh chứng năng lực số.</li>
                                  <li><b>Lưu ý:</b> Không dùng cụm từ "bản nháp AI" trong sản phẩm học tập.</li>
                                </ul>
                              </div>
                              <div className="space-y-6 pl-4">
                                {result.data.aiUsageLog.map((log: any, li: number) => (
                                  <div key={li} className="border-2 border-purple-200 rounded-xl overflow-hidden">
                                    {/* Header */}
                                    <div className="bg-purple-600 px-4 py-2 flex items-center justify-between">
                                      <p className="text-[11px] font-black text-white uppercase tracking-wider">Phiếu sử dụng AI — {log.activityName}</p>
                                      <p className="text-[10px] text-purple-200">Họ tên HS: ______________________</p>
                                    </div>
                                    {/* Pre-filled by teacher */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-purple-100">
                                      <div className="p-4 bg-purple-50">
                                        <p className="text-[9px] font-black text-purple-600 uppercase mb-2 flex items-center gap-1">
                                          <span className="bg-purple-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px]">①</span>
                                          Câu lệnh Prompt gợi ý <span className="text-purple-400 font-normal">(GV cung cấp)</span>
                                        </p>
                                        <p className="text-[12px] text-slate-700 font-mono bg-white p-2 rounded-lg border border-purple-100 italic leading-relaxed">"{log.aiPromptUsed}"</p>
                                      </div>
                                      <div className="p-4 bg-purple-50">
                                        <p className="text-[9px] font-black text-purple-600 uppercase mb-2 flex items-center gap-1">
                                          <span className="bg-purple-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px]">②</span>
                                          Nguồn kiểm chứng <span className="text-purple-400 font-normal">(GV cung cấp)</span>
                                        </p>
                                        <p className="text-[12px] text-slate-700 bg-white p-2 rounded-lg border border-purple-100 leading-relaxed">{log.verificationSource}</p>
                                      </div>
                                    </div>
                                    {/* Student fills these */}

                                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-amber-100 border-t-2 border-amber-200">
                                      <div className="p-4 bg-amber-50">
                                        <p className="text-[9px] font-black text-amber-700 uppercase mb-2 flex items-center gap-1">
                                          <span className="bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px]">③</span>
                                          Kết quả AI: Đúng / Chưa đủ / Cần sửa <span className="text-amber-500 font-normal">(HS tự điền)</span>
                                        </p>
                                        <div className="min-h-[60px] bg-white rounded-lg border-2 border-dashed border-amber-200 p-2">
                                          <p className="text-[10px] text-amber-300 italic">Học sinh ghi nhận xét về độ chính xác của kết quả AI so với nguồn kiểm chứng...</p>
                                        </div>
                                      </div>
                                      <div className="p-4 bg-emerald-50">
                                        <p className="text-[9px] font-black text-emerald-700 uppercase mb-2 flex items-center gap-1">
                                          <span className="bg-emerald-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px]">④</span>
                                          Bản chỉnh sửa / Sản phẩm hoàn thiện của HS <span className="text-emerald-500 font-normal">(HS tự điền)</span>
                                        </p>
                                        <div className="min-h-[60px] bg-white rounded-lg border-2 border-dashed border-emerald-200 p-2">
                                          <p className="text-[10px] text-emerald-300 italic">Học sinh ghi / dán sản phẩm đã chỉnh sửa sau khi kiểm chứng...</p>
                                        </div>
                                      </div>
                                    </div>
                                    {/* Teacher fills */}
                                    <div className="p-4 bg-blue-50 border-t-2 border-blue-200">
                                      <p className="text-[9px] font-black text-blue-700 uppercase mb-2 flex items-center gap-1">
                                        <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px]">⑤</span>
                                        Nhận xét của Giáo viên <span className="text-blue-400 font-normal">(GV điền)</span>
                                      </p>
                                      <div className="min-h-[50px] bg-white rounded-lg border-2 border-dashed border-blue-200 p-2">
                                        <p className="text-[10px] text-blue-300 italic">Giáo viên ghi nhận xét về quá trình và sản phẩm sử dụng AI của học sinh...</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </section>
                          )}

                          {evaluationResult && (
                            <div className="mt-12 space-y-8 pt-8 border-t-4 border-emerald-100">
                              <header className="flex items-center gap-3">
                                <div className="p-3 bg-emerald-100 rounded-2xl">
                                  <ClipboardCheck className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                  <h4 className="text-xl font-black text-brand-sidebar uppercase tracking-tight">Hệ thống đánh giá năng lực</h4>
                                  <p className="text-xs text-brand-muted font-bold uppercase tracking-widest mt-1">Chuẩn CV 3439/BGDĐT & Chương trình GDPT 2018</p>
                                </div>
                              </header>

                              {/* Rubrics */}
                              <div className="space-y-6">
                                <h5 className="text-sm font-extrabold text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg inline-flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4" /> 1. TIÊU CHÍ ĐÁNH GIÁ (RUBRICS)
                                </h5>
                                <div className="grid grid-cols-1 gap-6">
                                  {(evaluationResult.rubrics || []).map((rubric: any, idx: number) => (
                                    <div key={idx} className="overflow-x-auto rounded-xl border border-slate-200">
                                      <table className="w-full text-left border-collapse min-w-[600px]">
                                        <thead>
                                          <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="p-4 text-[10px] font-black text-brand-sidebar uppercase tracking-wider w-1/4">Năng lực: {rubric.competencyName}</th>
                                            <th className="p-4 text-[10px] font-black text-red-500 uppercase tracking-wider w-[18.75%]">Mức 1: Chưa đạt</th>
                                            <th className="p-4 text-[10px] font-black text-orange-500 uppercase tracking-wider w-[18.75%]">Mức 2: Đạt</th>
                                            <th className="p-4 text-[10px] font-black text-blue-500 uppercase tracking-wider w-[18.75%]">Mức 3: Khá</th>
                                            <th className="p-4 text-[10px] font-black text-emerald-600 uppercase tracking-wider w-[18.75%]">Mức 4: Tốt</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          <tr>
                                            <td className="p-4 align-top">
                                              <ul className="list-disc list-inside space-y-1 text-[11px] text-brand-muted italic">
                                                {rubric.criteria.map((c: string, ci: number) => <li key={ci}>{c}</li>)}
                                              </ul>
                                            </td>
                                            <td className="p-4 text-[11px] text-brand-dark align-top leading-relaxed">{rubric.levels.level1}</td>
                                            <td className="p-4 text-[11px] text-brand-dark align-top leading-relaxed">{rubric.levels.level2}</td>
                                            <td className="p-4 text-[11px] text-brand-dark align-top leading-relaxed">{rubric.levels.level3}</td>
                                            <td className="p-4 text-[11px] text-brand-dark align-top leading-relaxed">{rubric.levels.level4}</td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Assessment Components */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                  <h5 className="text-sm font-extrabold text-blue-700 bg-blue-50 px-4 py-2 rounded-lg inline-flex items-center gap-2">
                                    <Search className="w-4 h-4" /> 2. ĐÁNH GIÁ THƯỜNG XUYÊN
                                  </h5>
                                  <div className="space-y-4">
                                    {/* Fallback for old cached data */}
                                    {evaluationResult.formativeAssessment?.quizzes && evaluationResult.formativeAssessment.quizzes.length > 0 && evaluationResult.formativeAssessment.quizzes.map((q: any, qi: number) => (
                                      <div key={qi} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                                        <p className="text-[12px] font-bold text-brand-sidebar">Câu {qi + 1}: {q.question}</p>
                                        <div className="grid grid-cols-1 gap-2">
                                          {q.options.map((opt: string, oi: number) => (
                                            <div key={oi} className="flex items-center gap-2 text-[11px] text-brand-muted bg-white p-2 rounded-lg border border-slate-200">
                                              <span className="w-5 h-5 flex items-center justify-center bg-slate-100 rounded-full text-[9px] font-bold">{String.fromCharCode(65 + oi)}</span>
                                              {opt}
                                            </div>
                                          ))}
                                        </div>
                                        <p className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded inline-block">Đáp án: {q.answer}</p>
                                      </div>
                                    ))}

                                    {/* Part I: Multiple Choice */}
                                    {evaluationResult.formativeAssessment?.part1_multipleChoice && evaluationResult.formativeAssessment.part1_multipleChoice.length > 0 && (
                                      <div className="space-y-3">
                                        <h6 className="text-[11px] font-bold text-slate-500 uppercase">Phần I: Trắc nghiệm khách quan nhiều lựa chọn</h6>
                                        {evaluationResult.formativeAssessment.part1_multipleChoice.map((q: any, qi: number) => (
                                          <div key={qi} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                                            <p className="text-[12px] font-bold text-brand-sidebar">Câu {qi + 1}: {q.question}</p>
                                            <div className="grid grid-cols-1 gap-2">
                                              {q.options?.map((opt: string, oi: number) => (
                                                <div key={oi} className="flex items-center gap-2 text-[11px] text-brand-muted bg-white p-2 rounded-lg border border-slate-200">
                                                  <span className="w-5 h-5 flex items-center justify-center bg-slate-100 rounded-full text-[9px] font-bold">{String.fromCharCode(65 + oi)}</span>
                                                  {opt}
                                                </div>
                                              ))}
                                            </div>
                                            <p className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded inline-block">Đáp án: {q.answer}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Part II: True/False */}
                                    {evaluationResult.formativeAssessment.part2_trueFalse && evaluationResult.formativeAssessment.part2_trueFalse.length > 0 && (
                                      <div className="space-y-3 mt-4">
                                        <h6 className="text-[11px] font-bold text-slate-500 uppercase">Phần II: Trắc nghiệm Đúng/Sai</h6>
                                        {evaluationResult.formativeAssessment.part2_trueFalse.map((q: any, qi: number) => (
                                          <div key={qi} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                                            <p className="text-[12px] font-bold text-brand-sidebar">Câu {qi + 1}: {q.question}</p>
                                            <div className="grid grid-cols-1 gap-2">
                                              {q.statements?.map((stmt: string, oi: number) => (
                                                <div key={oi} className="flex flex-col gap-1 text-[11px] text-brand-muted bg-white p-2 rounded-lg border border-slate-200">
                                                  <div className="flex items-start gap-2">
                                                    <span className="w-5 h-5 flex items-center justify-center bg-slate-100 rounded-full text-[9px] font-bold shrink-0">{String.fromCharCode(65 + oi)}</span>
                                                    <span>{stmt}</span>
                                                  </div>
                                                  <p className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded self-start mt-1">Đáp án: {q.answers?.[oi]}</p>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Part III: Short Answer */}
                                    {evaluationResult.formativeAssessment.part3_shortAnswer && evaluationResult.formativeAssessment.part3_shortAnswer.length > 0 && (
                                      <div className="space-y-3 mt-4">
                                        <h6 className="text-[11px] font-bold text-slate-500 uppercase">Phần III: Trả lời ngắn / Tính toán</h6>
                                        {evaluationResult.formativeAssessment.part3_shortAnswer.map((q: any, qi: number) => (
                                          <div key={qi} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                                            <p className="text-[12px] font-bold text-brand-sidebar">Câu {qi + 1}: {q.question}</p>
                                            <p className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-2 rounded-lg border border-emerald-100">Đáp án: {q.answer}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl">
                                      <p className="text-[10px] font-black text-brand-sidebar uppercase mb-3 opacity-70">Bảng kiểm (Checklist) tiến trình</p>
                                      <ul className="space-y-2">
                                        {evaluationResult.formativeAssessment.checklists.map((c: string, ci: number) => (
                                          <li key={ci} className="flex items-start gap-2 text-[11px] text-brand-muted">
                                            <div className="w-4 h-4 border border-slate-300 rounded mt-0.5 shrink-0"></div>
                                            {c}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <h5 className="text-sm font-extrabold text-indigo-700 bg-indigo-50 px-4 py-2 rounded-lg inline-flex items-center gap-2">
                                    <LayoutGrid className="w-4 h-4" /> 3. ĐÁNH GIÁ ĐỊNH KỲ
                                  </h5>
                                  <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-2xl text-white space-y-4 shadow-lg shadow-indigo-100 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                      <Sparkles className="w-12 h-12" />
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-[9px] font-black uppercase opacity-70 tracking-widest">Nội dung yêu cầu</p>
                                      <h6 className="text-base font-bold leading-tight">{evaluationResult.summativeAssessment.projectOrTest}</h6>
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-[9px] font-black uppercase opacity-70 tracking-widest">Tiêu chí bồi hoàn</p>
                                      <ul className="list-disc list-inside space-y-1 text-[11px] opacity-90 leading-relaxed font-medium">
                                        {evaluationResult.summativeAssessment.requirements.map((r: string, ri: number) => <li key={ri}>{r}</li>)}
                                      </ul>
                                    </div>
                                  </div>

                                  <div className="space-y-4 pt-4">
                                    <h5 className="text-sm font-extrabold text-brand-muted flex items-center gap-2">
                                      <AlertCircle className="w-4 h-4 text-emerald-500" /> 4. MẪU NHẬN XÉT CHI TIẾT
                                    </h5>
                                    <div className="grid grid-cols-1 gap-3">
                                      {evaluationResult.feedbackSamples.map((fb: any, fi: number) => (
                                        <div key={fi} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm space-y-1">
                                          <p className="text-[9px] font-black uppercase tracking-wider text-brand-muted">{fb.level}</p>
                                          <p className="text-[11px] text-brand-dark italic leading-relaxed">"{fb.sampleText}"</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {mode === "khgd-gen" && (
                  <motion.div
                    key="khgd"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => { setMode("dashboard"); setResult(null); }}
                        className="flex items-center gap-2 text-[11px] font-extrabold text-brand-muted uppercase tracking-[0.2em] hover:text-brand-accent transition-colors"
                      >
                        Quay lại tổng quan <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {!result && !loading && (
                      <div className="glass rounded-[24px] p-8 max-w-2xl mx-auto backdrop-blur-3xl border-indigo-200/30">
                        <h3 className="text-xl font-extrabold text-brand-sidebar mb-6 flex items-center gap-2">
                          <Calendar className="w-6 h-6 text-indigo-500" /> Kế hoạch Giáo dục của giáo viên
                        </h3>
                        <div className="grid grid-cols-1 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Môn học</label>
                            <div className="relative group">
                              <select
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent outline-none text-sm appearance-none bg-white font-medium"
                                value={eduPlanInput.subject}
                                onChange={(e) => setEduPlanInput({ ...eduPlanInput, subject: e.target.value })}
                              >
                                <option value="">-- Chọn môn học --</option>
                                {(["6", "7", "8", "9"].includes(eduPlanInput.grade) ? SUBJECTS_THCS : SUBJECTS_THPT).map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-brand-accent transition-colors">
                                <ChevronRight className="w-4 h-4 rotate-90" />
                              </div>
                            </div>
                          </div>

                          {eduPlanInput.subject === "Giáo dục địa phương" && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Địa phương / Tỉnh thành</label>
                              <select
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm appearance-none bg-white font-medium"
                                value={province}
                                onChange={(e) => setProvince(e.target.value)}
                              >
                                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                              </select>
                              <p className="text-[10px] text-slate-400 mt-1 italic leading-relaxed">
                                * Lưu ý: Hiện tại danh sách bao gồm 6 thành phố và 28 tỉnh (theo cập nhật đơn vị hành chính 1/7/2025).
                              </p>
                            </div>
                          )}
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Khối lớp</label>
                            <select
                              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent outline-none text-sm appearance-none bg-white font-medium"
                              value={eduPlanInput.grade}
                              onChange={(e) => setEduPlanInput({ ...eduPlanInput, grade: e.target.value })}
                            >
                              {GRADES.map(g => <option key={g} value={g}>Lớp {g}</option>)}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-4 pt-2">
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={eduPlanInput.useLaTeX}
                                onChange={(e) => setEduPlanInput({ ...eduPlanInput, useLaTeX: e.target.checked })}
                              />
                              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.05em] group-hover:text-indigo-600 transition-colors">Chuẩn công thức Word</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={eduPlanInput.detailDrawings}
                                onChange={(e) => setEduPlanInput({ ...eduPlanInput, detailDrawings: e.target.checked })}
                              />
                              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.05em] group-hover:text-indigo-600 transition-colors">Mô tả chi tiết hình vẽ</span>
                            </label>
                          </div>

                          <div className="space-y-3 pt-2">
                            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em] flex items-center gap-2">
                              Tích hợp nội dung xã hội (TT 02/2025)
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: "Heritage", label: "Di sản" },
                                { id: "DrugPrevention", label: "Ma túy" },
                                { id: "Population", label: "Dân số" },
                                { id: "Inclusive", label: "Hòa nhập" }
                              ].map((item) => (
                                <label key={item.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-all">
                                  <input
                                    type="checkbox"
                                    checked={eduPlanInput.socialIntegrations?.includes(item.id)}
                                    onChange={(e) => {
                                      const current = eduPlanInput.socialIntegrations || [];
                                      if (e.target.checked) {
                                        setEduPlanInput({ ...eduPlanInput, socialIntegrations: [...current, item.id] });
                                      } else {
                                        setEduPlanInput({ ...eduPlanInput, socialIntegrations: current.filter(id => id !== item.id) });
                                      }
                                    }}
                                    className="w-3 h-3 rounded text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className="text-[10px] font-medium text-slate-600">{item.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <button
                            onClick={handleGenerateKHGD}
                            disabled={!eduPlanInput.subject}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                          >
                            <Sparkles className="w-5 h-5 fill-white/20" />
                            Tạo Kế hoạch Giáo dục
                          </button>
                        </div>
                      </div>
                    )}

                    {loading && (
                      <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                        <p className="text-brand-muted font-bold text-sm tracking-widest animate-pulse">AI ĐANG XÂY DỰNG PHÂN PHỐI CHƯƠNG TRÌNH...</p>
                      </div>
                    )}

                    {result && result.type === "khgd" && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between sticky top-6 z-10 bg-brand-bg/80 backdrop-blur-md py-2 px-1">
                          <div className="flex flex-col">
                            <h3 className="text-xl font-extrabold text-brand-sidebar">Kế hoạch Giáo dục của giáo viên</h3>
                            <div className="text-[10px] text-brand-muted font-bold uppercase flex items-center gap-2 mt-1">
                              Môn: {eduPlanInput.subject} <span className="w-1 h-1 bg-brand-muted rounded-full"></span> Khối {eduPlanInput.grade} {eduPlanInput.subject === "Giáo dục địa phương" && <><span className="w-1 h-1 bg-brand-muted rounded-full"></span> {province}</>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={downloadWord} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống Word">
                              <FileDown className="w-4 h-4 text-blue-600" />
                            </button>
                            <button onClick={downloadPDF} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống PDF">
                              <FileDown className="w-4 h-4 text-red-500" />
                            </button>
                            <button onClick={downloadText} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống Text (.txt)">
                              <FileText className="w-4 h-4 text-brand-muted" />
                            </button>
                            <button onClick={downloadHTML} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống HTML">
                              <FileCode className="w-4 h-4 text-orange-500" />
                            </button>
                            <button onClick={downloadPPTX} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống PowerPoint (.pptx)">
                              <Presentation className="w-4 h-4 text-orange-600" />
                            </button>
                            <button onClick={handleCopy} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Sao chép JSON">
                              <FileJson className="w-4 h-4 text-brand-accent" />
                            </button>
                            <button onClick={() => window.print()} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                              <Printer className="w-4 h-4 text-brand-muted" />
                            </button>
                            <button
                              onClick={() => setResult(null)}
                              className="px-4 py-2 bg-brand-sidebar text-white rounded-lg text-xs font-bold shadow-md hover:bg-slate-900 transition-colors"
                            >
                              Tạo mới
                            </button>
                          </div>
                        </div>

                        <div ref={tableRef} className="glass rounded-[24px] p-6 shadow-2xl overflow-x-auto print:border-0 print:shadow-none print:bg-white paper">
                          <table className="w-full text-left text-[10px] border-collapse min-w-[1200px]">
                            <thead>
                              <tr className="border-b-2 border-slate-100 bg-slate-50/50">
                                <th className="p-3 font-extrabold text-brand-sidebar uppercase tracking-widest w-16 text-center">Thứ tự tiết</th>
                                <th className="p-3 font-extrabold text-brand-sidebar uppercase tracking-widest w-64">Bài học</th>
                                <th className="p-3 font-extrabold text-brand-sidebar uppercase tracking-widest w-20 text-center">Số tiết</th>
                                <th className="p-3 font-extrabold text-brand-sidebar uppercase tracking-widest w-32">Thời điểm</th>
                                <th className="p-3 font-extrabold text-brand-sidebar uppercase tracking-widest w-64">Thiết bị dạy học & Học liệu AI</th>
                                <th className="p-3 font-extrabold text-brand-sidebar uppercase tracking-widest w-40">Địa điểm dạy học</th>
                                <th className="p-3 font-extrabold text-red-600 uppercase tracking-widest">Định hướng năng lực số (AI)</th>
                                <th className="p-3 font-extrabold text-brand-sidebar uppercase tracking-widest w-20 print:hidden text-center">Thao tác</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.data.map((item: any, i: number) => (
                                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors align-top">
                                  <td className="p-3 text-center font-bold text-slate-500">{item.order}</td>
                                  <td className="p-3 font-bold text-brand-sidebar">{item.lesson}</td>
                                  <td className="p-3 text-center">{item.periods}</td>
                                  <td className="p-3 font-medium text-slate-600">{item.timing}</td>
                                  <td className="p-3 text-brand-muted leading-relaxed text-[9px] space-y-2">
                                    <div>
                                      <p className="font-bold text-slate-500 uppercase">Truyền thống:</p>
                                      <p className="italic">{item.equipment}</p>
                                    </div>
                                    <div className="bg-red-50 p-2 rounded border border-red-200 shadow-sm">
                                      <p className="font-extrabold text-red-600 uppercase text-[9px] mb-1">CÔNG CỤ SỐ AI:</p>
                                      <p className="text-red-600 font-medium italic border-b border-red-100 pb-1 mb-1">
                                        - {item.digitalToolsAndAI?.method}
                                      </p>
                                      <p className="text-red-600 font-medium">
                                        - {item.digitalToolsAndAI?.tools}
                                      </p>
                                    </div>
                                  </td>
                                  <td className="p-3 text-brand-muted">{item.location}</td>
                                  <td className="p-3 text-red-700 font-bold leading-relaxed whitespace-pre-line bg-red-50/20 border-l border-red-100">
                                    {item.digitalCompetency}
                                  </td>
                                  <td className="p-3 print:hidden text-center">
                                    <button
                                      onClick={() => {
                                        setLessonPlanInput({
                                          ...lessonPlanInput,
                                          subject: eduPlanInput.subject,
                                          grade: eduPlanInput.grade,
                                          topic: item.lesson,
                                          objectivesKnowledge: "",
                                          additionalNotes: `KHÔNG GIAN TÍCH HỢP AI:
                                      - Năng lực số: ${item.digitalCompetency}
                                      - Phương án triển khai: ${item.digitalToolsAndAI?.method}
                                      - Học liệu/Công cụ: ${item.digitalToolsAndAI?.tools}`
                                        });
                                        setMode("khbd-gen");
                                        setResult(null);
                                      }}
                                      className="mx-auto p-2 bg-brand-accent text-white rounded-lg hover:bg-sky-500 transition-colors shadow-sm flex items-center justify-center"
                                      title="Soạn KHBD"
                                    >
                                      <Sparkles className="w-3 h-3" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {mode === "kh-tcm-gen" && (
                  <motion.div
                    key="kh-tcm"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => { setMode("dashboard"); setResult(null); }}
                        className="flex items-center gap-2 text-[11px] font-extrabold text-brand-muted uppercase tracking-[0.2em] hover:text-brand-accent transition-colors"
                      >
                        Quay lại tổng quan <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {!result && !loading && (
                      <div className="glass rounded-[24px] p-8 max-w-2xl mx-auto backdrop-blur-3xl border-indigo-200/30">
                        <h3 className="text-xl font-extrabold text-brand-sidebar mb-6 flex items-center gap-2">
                          <LayoutGrid className="w-6 h-6 text-emerald-500" /> Kế hoạch Dạy học Tổ chuyên môn
                        </h3>
                        <div className="grid grid-cols-1 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Môn học</label>
                            <div className="relative group">
                              <select
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm appearance-none bg-white font-medium"
                                value={eduPlanInput.subject}
                                onChange={(e) => setEduPlanInput({ ...eduPlanInput, subject: e.target.value })}
                              >
                                <option value="">-- Chọn môn học --</option>
                                {(["6", "7", "8", "9"].includes(eduPlanInput.grade) ? SUBJECTS_THCS : SUBJECTS_THPT).map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-emerald-500 transition-colors">
                                <ChevronRight className="w-4 h-4 rotate-90" />
                              </div>
                            </div>
                          </div>

                          {eduPlanInput.subject === "Giáo dục địa phương" && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Địa phương / Tỉnh thành</label>
                              <select
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm appearance-none bg-white font-medium"
                                value={province}
                                onChange={(e) => setProvince(e.target.value)}
                              >
                                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                              </select>
                              <p className="text-[10px] text-slate-400 mt-1 italic leading-relaxed">
                                * Lưu ý: Hiện tại danh sách bao gồm 6 thành phố và 28 tỉnh (theo cập nhật đơn vị hành chính 1/7/2025).
                              </p>
                            </div>
                          )}
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Khối lớp</label>
                            <div className="relative group">
                              <select
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm appearance-none bg-white font-medium"
                                value={eduPlanInput.grade}
                                onChange={(e) => setEduPlanInput({ ...eduPlanInput, grade: e.target.value })}
                              >
                                {GRADES.map(g => <option key={g} value={g}>Lớp {g}</option>)}
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-emerald-500 transition-colors">
                                <ChevronRight className="w-4 h-4 rotate-90" />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-2">
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                checked={eduPlanInput.useLaTeX}
                                onChange={(e) => setEduPlanInput({ ...eduPlanInput, useLaTeX: e.target.checked })}
                              />
                              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.05em] group-hover:text-emerald-600 transition-colors">Chuẩn công thức Word</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                checked={eduPlanInput.detailDrawings}
                                onChange={(e) => setEduPlanInput({ ...eduPlanInput, detailDrawings: e.target.checked })}
                              />
                              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.05em] group-hover:text-emerald-600 transition-colors">Mô tả chi tiết hình vẽ</span>
                            </label>
                          </div>

                          <div className="pt-4 border-t border-slate-100 mt-4 space-y-4">
                            <div className="space-y-1">
                              <h4 className="text-[11px] font-extrabold text-brand-sidebar uppercase tracking-widest flex items-center gap-2">
                                <UploadCloud className="w-4 h-4 text-emerald-500" /> Tải lên Phụ lục Chương trình (Tùy chọn)
                              </h4>
                              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Bỏ qua dữ liệu mặc định 2018 và sử dụng danh sách bài học của bạn. Hệ thống sẽ tự động dùng AI để phân tích và chuẩn hóa phân phối nội dung của bạn thành Khung KHTCM.</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed ${customCurriculumData ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-600"} cursor-pointer transition-all`}>
                                {isParsingCurriculum ? <Loader2 className="w-4 h-4 animate-spin" /> : (customCurriculumData ? <CheckCircle2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />)}
                                <span className="text-xs font-bold">{isParsingCurriculum ? "Đang rà soát và bóc tách..." : (customCurriculumData ? `Đã nạp ${customCurriculumData.length} bài học. Chọn file khác?` : "Chọn file DOCX / PDF từ máy tính")}</span>
                                <input type="file" className="hidden" accept=".docx, .pdf" onChange={handleCurriculumUpload} disabled={isParsingCurriculum} />
                              </label>
                              {customCurriculumData && (
                                <button onClick={() => setCustomCurriculumData(null)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors border border-red-200" title="Xóa phụ lục lập tức lấy lại mặc định">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={handleGenerateKHTCM}
                            disabled={!eduPlanInput.subject}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
                          >
                            <Sparkles className="w-5 h-5 fill-white/20" />
                            Tạo Kế hoạch Tổ chuyên môn
                          </button>
                        </div>
                      </div>
                    )}

                    {loading && (
                      <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
                        <p className="text-brand-muted font-bold text-sm tracking-widest animate-pulse">AI ĐANG XÂY DỰNG KHUNG KẾ HOẠCH DẠY HỌC TỔ CHUYÊN MÔN...</p>
                      </div>
                    )}

                    {result && result.type === "kh-tcm" && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between sticky top-6 z-10 bg-brand-bg/80 backdrop-blur-md py-2 px-1">
                          <div className="flex flex-col">
                            <h3 className="text-xl font-extrabold text-brand-sidebar">Kế hoạch Dạy học Tổ chuyên môn</h3>
                            <div className="text-[10px] text-brand-muted font-bold uppercase flex items-center gap-2 mt-1">
                              Môn: {eduPlanInput.subject} <span className="w-1 h-1 bg-brand-muted rounded-full"></span> Khối {eduPlanInput.grade} {eduPlanInput.subject === "Giáo dục địa phương" && <><span className="w-1 h-1 bg-brand-muted rounded-full"></span> {province}</>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={downloadWord} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống Word">
                              <FileDown className="w-4 h-4 text-blue-600" />
                            </button>
                            <button onClick={downloadPDF} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống PDF">
                              <FileDown className="w-4 h-4 text-red-500" />
                            </button>
                            <button onClick={downloadText} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống Text (.txt)">
                              <FileText className="w-4 h-4 text-brand-muted" />
                            </button>
                            <button onClick={downloadHTML} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống HTML">
                              <FileCode className="w-4 h-4 text-orange-500" />
                            </button>
                            <button onClick={downloadPPTX} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống PowerPoint (.pptx)">
                              <Presentation className="w-4 h-4 text-orange-600" />
                            </button>
                            <button onClick={handleCopy} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Sao chép JSON">
                              <FileJson className="w-4 h-4 text-brand-accent" />
                            </button>
                            <button onClick={() => window.print()} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                              <Printer className="w-4 h-4 text-brand-muted" />
                            </button>
                            <button
                              onClick={() => setResult(null)}
                              className="px-4 py-2 bg-brand-sidebar text-white rounded-lg text-xs font-bold shadow-md hover:bg-slate-900 transition-colors"
                            >
                              Tạo mới
                            </button>
                          </div>
                        </div>

                        <div ref={tableRef} className="glass rounded-[24px] p-6 shadow-2xl overflow-x-auto print:border-0 print:shadow-none print:bg-white paper">
                          <KhtcmSupplementSections subject={eduPlanInput.subject} grade={eduPlanInput.grade} rows={result.data} />
                          <div className="mb-6">
                            <h4 className="text-lg font-extrabold text-brand-sidebar mt-8">II. Kế hoạch dạy học - 1. Phân phối chương trình</h4>
                            <p className="text-xs text-slate-500 font-semibold mt-1">
                              Đã rà soát {Array.isArray(result.data) ? result.data.length : 0} dòng. Các ô trống được tự động bù từ danh mục chương trình/PL tải lên để tránh thiếu nội dung.
                            </p>
                          </div>
                          <table className="w-full text-left text-[11px] border-collapse min-w-[1000px]">
                            <thead>
                              <tr className="border-b-2 border-slate-100">
                                <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-12 text-center">STT</th>
                                <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-40">Thời gian</th>
                                <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-48">Nội dung</th>
                                <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-20 text-center">Số tiết</th>
                                <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest">Yêu cầu cần đạt</th>
                                <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-40">Năng lực số</th>
                                <th className="p-4 font-extrabold text-red-600 uppercase tracking-widest">Mục tiêu & YCCĐ 3439 Tích hợp GD AI</th>
                                <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-24 print:hidden text-center">Thao tác</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.data.map((item: any, i: number) => {
                                const isNotIntegrated = !item.aiCompetency3439Integrated || item.aiCompetency3439Integrated.toLowerCase().includes("không");
                                const aiText = item.aiCompetency3439Integrated || "Không tích hợp - chưa có căn cứ YCCĐ đủ rõ để gán mã NL AI.";
                                return (
                                  <tr key={i} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors align-top ${isNotIntegrated ? "opacity-60" : ""}`}>
                                    <td className="p-4 text-center font-bold text-slate-400">{i + 1}</td>
                                    <td className="p-4 font-bold text-brand-sidebar">{item.time || item.topic || item.lessonName}</td>
                                    <td className="p-4 text-brand-sidebar leading-relaxed whitespace-pre-line text-[11px]">{item.lessonContent || item.lessonName}</td>
                                    <td className="p-4 text-center font-bold text-slate-600">{item.periods}</td>
                                    <td className="p-4 text-brand-muted leading-relaxed whitespace-pre-line text-[10px]">{item.lessonGoal}</td>
                                    <td className="p-4 text-brand-sidebar leading-relaxed whitespace-pre-line text-[10px]">{item.digitalCompetencyTT02 || "Không"}</td>
                                    <td className={`p-4 font-bold ${isNotIntegrated ? "text-slate-400" : "text-red-700 bg-red-50/20"} whitespace-pre-line text-[11px]`}>
                                      {aiText}
                                    </td>
                                    <td className="p-4 print:hidden text-center">
                                      <button
                                        onClick={() => {
                                          setEduPlanInput({
                                            ...eduPlanInput,
                                            subject: eduPlanInput.subject,
                                            grade: eduPlanInput.grade
                                          });
                                          setMode("khgd-gen");
                                          handleGenerateKHGD(result.data);
                                        }}
                                        className="mx-auto p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2 px-4"
                                        title="Lập KH Giáo dục cá nhân"
                                      >
                                        <Calendar className="w-3 h-3" />
                                        <span className="text-[10px] uppercase font-bold">Hợp nhất sang KHGD Cá nhân</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {mode === "kh-hdgd-gen" && (
                  <motion.div
                    key="kh-hdgd"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => { setMode("dashboard"); setResult(null); }}
                        className="flex items-center gap-2 text-[11px] font-extrabold text-brand-muted uppercase tracking-[0.2em] hover:text-brand-accent transition-colors"
                      >
                        Quay lại tổng quan <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {!result && !loading && (
                      <div className="glass rounded-[24px] p-8 max-w-2xl mx-auto backdrop-blur-3xl border-indigo-200/30">
                        <h3 className="text-xl font-extrabold text-brand-sidebar mb-6 flex items-center gap-2">
                          <Calendar className="w-6 h-6 text-blue-500" /> Kế hoạch tổ chức các HĐGD (PL2)
                        </h3>
                        <div className="grid grid-cols-1 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Môn học/Khối lớp</label>
                            <div className="flex gap-4">
                              <select
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm appearance-none bg-white font-medium"
                                value={eduPlanInput.subject}
                                onChange={(e) => setEduPlanInput({ ...eduPlanInput, subject: e.target.value })}
                              >
                                <option value="">-- Chọn môn học --</option>
                                {(["6", "7", "8", "9"].includes(eduPlanInput.grade) ? SUBJECTS_THCS : SUBJECTS_THPT).map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <select
                                className="w-32 px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm appearance-none bg-white font-medium"
                                value={eduPlanInput.grade}
                                onChange={(e) => setEduPlanInput({ ...eduPlanInput, grade: e.target.value })}
                              >
                                {["6", "7", "8", "9", "10", "11", "12"].map(g => <option key={g} value={g}>Lớp {g}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="mt-8 flex justify-end">
                          <button
                            onClick={handleGenerateKHHDGD}
                            disabled={!eduPlanInput.subject || loading}
                            className="bg-brand-accent hover:bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 group"
                          >
                            <Sparkles className="w-5 h-5 fill-white/20" />
                            Tạo Kế hoạch HĐGD
                          </button>
                        </div>
                      </div>
                    )}

                    {loading && (
                      <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                        <p className="text-brand-muted font-bold text-sm tracking-widest animate-pulse">AI ĐANG LÊN Ý TƯỞNG HOẠT ĐỘNG GIÁO DỤC...</p>
                      </div>
                    )}

                    {result && result.type === "kh-hdgd" && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between sticky top-6 z-10 bg-brand-bg/80 backdrop-blur-md py-2 px-1">
                          <div className="flex flex-col">
                            <h3 className="text-xl font-extrabold text-brand-sidebar">Kế hoạch tổ chức các HĐGD (Phụ lục 2)</h3>
                            <div className="text-[10px] text-brand-muted font-bold uppercase flex items-center gap-2 mt-1">
                              Môn: {eduPlanInput.subject} <span className="w-1 h-1 bg-brand-muted rounded-full"></span> Khối {eduPlanInput.grade}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={downloadWord} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống Word">
                              <FileDown className="w-4 h-4 text-blue-600" />
                            </button>
                            <button onClick={downloadPDF} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống PDF">
                              <FileDown className="w-4 h-4 text-red-500" />
                            </button>
                            <button onClick={downloadText} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống Text (.txt)">
                              <FileText className="w-4 h-4 text-brand-muted" />
                            </button>
                            <button onClick={downloadHTML} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống HTML">
                              <FileCode className="w-4 h-4 text-orange-500" />
                            </button>
                            <button onClick={downloadPPTX} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống PowerPoint (.pptx)">
                              <Presentation className="w-4 h-4 text-orange-600" />
                            </button>
                            <button onClick={handleCopy} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Sao chép JSON">
                              <FileJson className="w-4 h-4 text-brand-accent" />
                            </button>
                            <button onClick={() => window.print()} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                              <Printer className="w-4 h-4 text-brand-muted" />
                            </button>
                            <button
                              onClick={() => setResult(null)}
                              className="px-4 py-2 bg-brand-sidebar text-white rounded-lg text-xs font-bold shadow-md hover:bg-slate-900 transition-colors"
                            >
                              Tạo mới
                            </button>
                          </div>
                        </div>

                        <div ref={tableRef} className="glass rounded-[24px] p-6 shadow-2xl overflow-x-auto print:border-0 print:shadow-none print:bg-white paper">
                          <div className="mb-6">
                            <h4 className="text-lg font-extrabold text-brand-sidebar">Kế hoạch tổ chức các hoạt động giáo dục</h4>
                          </div>
                          <table className="w-full text-left text-[11px] border-collapse min-w-[1200px]">
                            <thead>
                              <tr className="border-b-2 border-slate-100">
                                <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-12 text-center">STT</th>
                                <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-40">Chủ đề/Hoạt động</th>
                                <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest">Yêu cầu cần đạt</th>
                                <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-16 text-center">Số tiết</th>
                                <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-24">Thời điểm</th>
                                <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-32">Địa điểm</th>
                                <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-32">Người chủ trì</th>
                                <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-32">Phối hợp</th>
                                <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-40">Điều kiện thực hiện</th>
                                <th className="p-4 font-extrabold text-red-600 uppercase tracking-widest">Tích hợp NLS/AI</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.data.map((item: any, i: number) => (
                                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors align-top">
                                  <td className="p-4 text-center font-bold text-slate-400">{i + 1}</td>
                                  <td className="p-4 font-bold text-brand-sidebar">{item.theme}</td>
                                  <td className="p-4 text-brand-muted leading-relaxed whitespace-pre-line text-[10px]">{item.requirements}</td>
                                  <td className="p-4 text-center font-bold text-slate-600">{item.periods}</td>
                                  <td className="p-4 text-brand-sidebar">{item.timing}</td>
                                  <td className="p-4 text-brand-sidebar">{item.location}</td>
                                  <td className="p-4 text-brand-sidebar font-medium">{item.host}</td>
                                  <td className="p-4 text-slate-500">{item.collaborator}</td>
                                  <td className="p-4 text-slate-500 leading-relaxed text-[10px] whitespace-pre-line">{item.conditions}</td>
                                  <td className="p-4 font-bold text-red-700 bg-red-50/20 whitespace-pre-line text-[10px]">{item.aiIntegration}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
                {mode === "ai-framework-gen" && (
                  <motion.div
                    key="ai-framework"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                      <div>
                        <h2 className="text-3xl font-bold text-slate-900">Tạo Khung Năng lực AI</h2>
                        <p className="text-slate-500 mt-1">Trích xuất chỉ báo năng lực AI từ YCCĐ theo chuẩn QĐ 3439/QĐ-BGDĐT</p>
                      </div>
                      <button
                        onClick={() => { setMode("dashboard"); setResult(null); }}
                        className="text-sm font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1"
                      >
                        Quay lại tổng quan <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {!result && !loading && (
                      <div className="glass rounded-[24px] p-8 max-w-2xl mx-auto backdrop-blur-3xl border-indigo-200/30">
                        <div className="grid grid-cols-1 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Môn học</label>
                            <input
                              type="text"
                              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent outline-none text-sm bg-white font-medium"
                              value={lessonPlanInput.subject}
                              onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, subject: e.target.value })}
                              placeholder="VD: Vật lý"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Khối lớp (10, 11, 12...)</label>
                            <input
                              type="text"
                              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent outline-none text-sm bg-white font-medium"
                              value={lessonPlanInput.grade}
                              onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, grade: e.target.value })}
                              placeholder="VD: 10"
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Chủ đề / Bài dạy (hoặc Tải ảnh/PDF SGK)</label>
                              <div>
                                <input type="file" id="upload-source-2" className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} />
                                <label htmlFor="upload-source-2" className="cursor-pointer flex items-center gap-1 text-[10px] font-bold text-brand-accent hover:text-blue-700 bg-brand-accent/10 px-2 py-1 rounded transition-colors uppercase tracking-[0.1em]">
                                  {uploadingSource ? <Sparkles className="w-3 h-3 animate-spin" /> : <UploadCloud className="w-3 h-3" />}
                                  {uploadingSource ? "Đang đọc..." : "AI Đọc Ảnh / PDF"}
                                </label>
                              </div>
                            </div>
                            <input
                              type="text"
                              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent outline-none text-sm bg-white font-medium"
                              value={lessonPlanInput.topic}
                              onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, topic: e.target.value })}
                              placeholder="VD: Động học (Chuyển động biến đổi đều)"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Yêu cầu cần đạt</label>
                            <textarea
                              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent outline-none text-sm min-h-[160px] bg-white leading-relaxed resize-y"
                              value={lessonPlanInput.objectivesKnowledge}
                              onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, objectivesKnowledge: e.target.value })}
                              placeholder="Dán toàn bộ Yêu cầu cần đạt của bài học vào đây để hệ thống bóc tách thành Khung chỉ báo AI..."
                            />
                          </div>

                          <button
                            onClick={handleGenerateAiFramework}
                            disabled={loading || !lessonPlanInput.subject || !lessonPlanInput.grade || !lessonPlanInput.objectivesKnowledge}
                            className="w-full relative group overflow-hidden rounded-xl p-[1px] mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span className="absolute inset-0 bg-gradient-to-r from-brand-accent via-blue-500 to-brand-accent rounded-xl opacity-70 group-hover:opacity-100 blur-sm transition-opacity duration-500"></span>
                            <span className="absolute inset-0 bg-gradient-to-r from-brand-accent to-blue-600 rounded-xl"></span>
                            <div className="relative bg-gradient-to-r from-brand-accent to-blue-600 px-6 py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300">
                              <BrainCircuit className="w-5 h-5 text-white" />
                              <span className="text-sm font-bold text-white tracking-wide">Tạo Khung Năng lực AI ngay</span>
                              <ChevronRight className="w-5 h-5 text-white/70 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </button>
                        </div>
                      </div>
                    )}

                    {loading && (
                      <div className="flex flex-col items-center justify-center py-20">
                        <div className="relative">
                          <div className="w-20 h-20 border-4 border-brand-accent/20 border-t-brand-accent rounded-full animate-spin"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Sparkles className="w-6 h-6 text-brand-accent animate-pulse" />
                          </div>
                        </div>
                        <h3 className="mt-6 text-xl font-bold text-slate-800">Đang phân tích YCCĐ và xây dựng Khung...</h3>
                        <p className="text-slate-500 mt-2 text-sm text-center max-w-md">
                          Hệ thống đang trích xuất các hành vi và đánh mã chỉ báo tương ứng theo chuẩn 3439/QĐ-BGDĐT. Quá trình này có thể mất 15-30 giây.
                        </p>
                      </div>
                    )}

                    {result && result.type === "ai-framework" && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="glass rounded-2xl p-6 border-brand-accent/20 bg-white">
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                              <BrainCircuit className="w-5 h-5 text-brand-accent" />
                              Khung Năng lực AI: {lessonPlanInput.topic}
                            </h3>
                            <div className="flex gap-2">
                              <button onClick={() => {
                                const tableText = (result.data as any[]).map(row => `${row.code}\t${row.content}\t${row.component}\t${row.level}\t${row.evidence}\t${row.activities}\t${row.tools}\t${row.rubric}`).join('\n');
                                const header = "Mã chỉ báo\tNội dung chỉ báo\tThành phần năng lực\tMức độ nhận thức\tMinh chứng đánh giá\tHoạt động học tập gợi ý\tCông cụ AI phù hợp\tTiêu chí đánh giá (Rubric)\n";
                                navigator.clipboard.writeText(header + tableText);
                                alert("Đã sao chép Khung năng lực vào Clipboard. Bạn có thể dán vào Excel/Word.");
                              }} className="p-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors shadow-sm" title="Sao chép (Dán vào Excel/Word)">
                                <Copy className="w-4 h-4 text-slate-600" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                <tr>
                                  <th className="px-4 py-3 border border-slate-200 whitespace-nowrap">Mã chỉ báo</th>
                                  <th className="px-4 py-3 border border-slate-200 min-w-[200px]">Nội dung chỉ báo</th>
                                  <th className="px-4 py-3 border border-slate-200 whitespace-nowrap">Thành phần</th>
                                  <th className="px-4 py-3 border border-slate-200 whitespace-nowrap">Mức độ</th>
                                  <th className="px-4 py-3 border border-slate-200 min-w-[150px]">Minh chứng</th>
                                  <th className="px-4 py-3 border border-slate-200 min-w-[200px]">Hoạt động học tập</th>
                                  <th className="px-4 py-3 border border-slate-200 min-w-[120px]">Công cụ AI</th>
                                  <th className="px-4 py-3 border border-slate-200 min-w-[200px]">Rubric</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(result.data as any[]).map((row, index) => (
                                  <tr key={index} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 border border-slate-200 font-semibold text-brand-accent">{row.code}</td>
                                    <td className="px-4 py-3 border border-slate-200">{row.content}</td>
                                    <td className="px-4 py-3 border border-slate-200">
                                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">{row.component}</span>
                                    </td>
                                    <td className="px-4 py-3 border border-slate-200">
                                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">{row.level}</span>
                                    </td>
                                    <td className="px-4 py-3 border border-slate-200">{row.evidence}</td>
                                    <td className="px-4 py-3 border border-slate-200">{row.activities}</td>
                                    <td className="px-4 py-3 border border-slate-200">{row.tools}</td>
                                    <td className="px-4 py-3 border border-slate-200">{row.rubric}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
                {mode === "nls-lookup" && (
                  <motion.div
                    key="nls-lookup"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="h-full"
                  >
                    <NlsLookup />
                  </motion.div>
                )}

              </AnimatePresence>
            </section>
          </main>

          <AnimatePresence>
            {showSettings && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-[24px] shadow-2xl p-8 max-w-md w-full relative"
                >
                  <div className="mb-6">
                    <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                      <Settings className="w-6 h-6 text-indigo-500" /> Cài đặt Hệ thống
                    </h3>
                    <p className="text-sm text-slate-500 mt-2">
                      Cấu hình AI cho khgdkhbdcothaibpbd. Chìa khóa API (API Key) được lưu trữ an toàn trên trình duyệt của bạn.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Google Gemini API Key
                      </label>
                      <input
                        type="password"
                        placeholder="Nhập API Key (AIzaSy... hoặc AQ...)"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-700 bg-slate-50"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                      />
                      <p className="text-xs text-slate-500 italic mt-1">
                        Bạn có thể lấy API Key miễn phí từ <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-indigo-500 font-bold hover:underline">Google AI Studio</a>.
                        API Key dạng <code className="bg-slate-100 px-1 rounded">AIzaSy...</code> hoặc <code className="bg-slate-100 px-1 rounded">AQ...</code> đều được hỗ trợ.
                      </p>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-100">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Chọn Model AI Ưu tiên
                      </label>
                      <div className="grid grid-cols-1 gap-3">
                        {[
                          { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", desc: "⚡ Mới nhất, nhanh nhất (Mặc định - Khuyến dùng)" },
                          { id: "gemini-3-flash-preview", name: "Gemini 3 Flash Preview", desc: "🛡️ Gemini 3 ổn định, dự phòng tốt" }
                        ].map(model => (
                          <div
                            key={model.id}
                            onClick={() => setAiModel(model.id)}
                            className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${aiModel === model.id ? "border-indigo-500 bg-indigo-50" : "border-slate-100 hover:border-slate-300 bg-white"}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${aiModel === model.id ? "border-indigo-500 bg-indigo-500" : "border-slate-300"}`}>
                                {aiModel === model.id && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                              </div>
                              <div>
                                <p className={`text-sm font-bold ${aiModel === model.id ? "text-indigo-900" : "text-slate-700"}`}>{model.name}</p>
                                <p className={`text-[10px] font-medium mt-0.5 ${aiModel === model.id ? "text-indigo-600" : "text-slate-500"}`}>{model.desc}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Test API Connection */}
                  <div className="pt-3">
                    <button
                      onClick={async () => {
                        const key = apiKey.trim();
                        if (!key) { setApiTestResult('❌ Chưa nhập API key'); return; }
                        if (!isOnline) { setApiTestResult('⚠️ Đang ngoại tuyến. Vui lòng kết nối Internet để kiểm tra API.'); return; }
                        setApiTesting(true); setApiTestResult(null);
                        try {
                          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=10`);
                          const json = await res.json();
                          if (!res.ok) { setApiTestResult(`❌ Lỗi: ${json?.error?.message || res.status}`); return; }
                          const names = (json.models || []).map((m: any) => m.name.replace('models/', ''));
                          setApiTestResult(`✅ Kết nối thành công! Models: ${names.slice(0, 5).join(', ')}`);
                        } catch (e: any) { setApiTestResult(`❌ Lỗi mạng: ${e.message}`); }
                        finally { setApiTesting(false); }
                      }}
                      className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                    >
                      {apiTesting ? '⏳ Đang kiểm tra...' : '🔍 Kiểm tra kết nối API'}
                    </button>
                    {apiTestResult && <p className="mt-2 text-xs px-1 text-slate-600 break-all">{apiTestResult}</p>}
                  </div>

                  <div className="flex gap-3 mt-8">
                    <button
                      onClick={() => setShowSettings(false)}
                      className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      Đóng
                    </button>
                    <button
                      onClick={saveApiKey}
                      className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
                    >
                      Lưu cài đặt
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Sticky Footer */}
          <footer className="fixed bottom-0 left-0 w-full glass-dark py-2.5 px-6 z-50 border-t border-white/10 hidden lg:block">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.9)]"></div>
                <span className="text-[10px] text-white/50 font-black uppercase tracking-[0.2em]">Bảo mật & Pháp lý BGDĐT</span>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 border-r border-white/10 pr-6">
                  <span className="text-[10px] text-white/20 uppercase tracking-[0.1em] font-black">Tác giả</span>
                  <p className="text-xs font-black text-blue-300 tracking-tight">Lê Thị Thái - THPT Bình Phú (Bình Dương)</p>
                </div>
                <a
                  href="https://zalo.me/0916791779"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-[12px] text-[10px] font-black uppercase tracking-[0.1em] text-white hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-xl shadow-blue-500/20 group"
                >
                  <span className="bg-white/20 p-1 rounded group-hover:bg-white/30 transition-colors">Zalo</span> 0916791779
                </a>
              </div>
            </div>
          </footer>

          <style>{`
        @media print {
          .lg\\:ml-\\[280px\\] { margin-left: 0 !important; }
          aside, header, nav, button, label, select, input, .no-print { display: none !important; }
          .min-h-screen { min-height: auto !important; }
          .p-4, .p-8, .p-12 { padding: 0 !important; }
          .max-w-5xl { max-width: 100% !important; }
          .paper { padding: 20px !important; }
          body { background: white !important; }
        }
      `}</style>
        </div >
    </>
  );
}

function NavItem({ active, icon, label, onClick, sidebar }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void, sidebar?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${active
        ? sidebar
          ? "bg-brand-accent/15 text-brand-accent font-extrabold"
          : "bg-brand-accent/10 text-brand-accent font-extrabold"
        : sidebar
          ? "text-white/60 hover:bg-white/5 hover:text-white"
          : "text-brand-muted hover:bg-white hover:text-brand-dark"
        }`}
    >
      <span className={active ? "text-brand-accent" : sidebar ? "text-white/30" : "text-brand-muted"}>{icon}</span>
      {label}
    </button>
  );
}

function FeatureCard({ icon, iconBg, title, desc, onClick }: { icon: React.ReactNode, iconBg: string, title: string, desc: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group glass p-8 rounded-[24px] text-left hover:bg-white/80 transition-all outline-none border border-white/40 shadow-xl overflow-hidden relative flex flex-col h-full"
    >
      <div className={`absolute top-0 right-0 w-32 h-32 ${iconBg}/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700`}></div>
      <div className={`mb-6 ${iconBg} w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:rotate-12 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-xl font-black text-indigo-950 mb-3 leading-tight">{title}</h3>
      <p className="text-indigo-900/60 text-[13px] font-medium leading-relaxed mb-6 group-hover:text-indigo-950 transition-colors flex-1">{desc}</p>
      <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-auto">
        Khởi tạo ngay <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </button>
  );
}
