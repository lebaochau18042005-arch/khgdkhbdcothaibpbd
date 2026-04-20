/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
// @ts-ignore
import html2pdf from "html2pdf.js";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, HeadingLevel, VerticalAlign } from "docx";
import { saveAs } from "file-saver";
import {
  BookOpen,
  Calendar,
  Plus,
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
  Zap
} from "lucide-react";
import { generateLessonPlan, generateEducationalPlan, generateDepartmentPlan, generateCompetencyEvaluation, LessonPlanInput } from "./services/geminiService";
import UpgradePlan from "./components/UpgradePlan";

type AppMode = "dashboard" | "khbd-gen" | "khgd-gen" | "kh-tcm-gen" | "upgrade-plan";

const SUBJECTS = [
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

const GRADES = ["10", "11", "12"];

const PROVINCES = [
  "Hà Nội (Thành phố)", "TP. Hồ Chí Minh (Thành phố)", "Hải Phòng (Thành phố)", "Đà Nẵng (Thành phố)", "Cần Thơ (Thành phố)", "Thừa Thiên Huế (Thành phố)",
  "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Ninh", "Bình Định", "Bình Dương", "Bình Phước", "Bình Thuận",
  "Cà Mau", "Đắk Lắk", "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Tĩnh", "Hải Dương", "Hòa Bình", "Khánh Hòa",
  "Kiên Giang", "Lâm Đồng", "Lạng Sơn", "Long An", "Nam Định", "Nghệ An", "Ninh Bình", "Phú Thọ", "Quảng Ninh",
  "Thái Bình", "Thanh Hóa"
];

import { CURRICULUM_DB } from "./data/curriculumDb";

export default function App() {
  const [mode, setMode] = useState<AppMode>("dashboard");
  const [loading, setLoading] = useState(false);
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const [departmentPlanRef, setDepartmentPlanRef] = useState<any[] | null>(null);
  const [province, setProvince] = useState("TP. Hồ Chí Minh (Thành phố)");
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("GEMINI_API_KEY") || "");
  const [aiModel, setAiModel] = useState(() => localStorage.getItem("GEMINI_MODEL") || "gemini-3-flash-preview");
  const contentRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const [availableLessons, setAvailableLessons] = useState<any[]>([]);

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
        topic: lessonTitle
      }));
    }
  };

  // Lesson Plan Form State
  const [lessonPlanInput, setLessonPlanInput] = useState<LessonPlanInput>({
    subject: "",
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
    detailDrawings: false
  });

  // Edu Plan Form State
  const [eduPlanInput, setEduPlanInput] = useState({
    subject: "",
    grade: "10",
    useLaTeX: false,
    detailDrawings: false
  });

  const highlightAI = (text: string) => {
    if (!text) return text;
    const parts = text.split(/(<bold>.*?<\/bold>|<ai>.*?<\/ai>|\*\*.*?\*\*|AI|Trí tuệ nhân tạo|Prompt|ChatGPT|Gemini)/gi);
    return parts.map((part, i) => {
      if (/^<bold>(.*)<\/bold>$/i.test(part)) return <span key={i} className="font-extrabold">{part.replace(/<bold>|<\/bold>/gi, '')}</span>;
      if (/^<ai>(.*)<\/ai>$/i.test(part)) return <span key={i} className="text-red-600 font-bold">{part.replace(/<ai>|<\/ai>/gi, '')}</span>;
      if (/^\*\*(.*?)\*\*$/i.test(part)) return <span key={i} className="font-bold">{part.replace(/\*\*/g, '')}</span>;
      if (/^(AI|Trí tuệ nhân tạo|Prompt|ChatGPT|Gemini)$/i.test(part)) return <span key={i} className="text-red-500 font-bold">{part}</span>;
      return part;
    });
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
      setResult({ type: "khbd", data });
    } catch (err) {
      alert("Có lỗi xảy ra khi tạo kế hoạch bài dạy. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateEvaluation = async () => {
    if (!apiKey.trim()) {
      setShowSettings(true);
      return;
    }
    if (!result || result.type !== "khbd") return;
    setEvaluationLoading(true);
    try {
      const data = await generateCompetencyEvaluation(result.data);
      setEvaluationResult(data);
    } catch (err) {
      alert("Có lỗi xảy ra khi tạo hệ thống đánh giá. Vui lòng thử lại.");
    } finally {
      setEvaluationLoading(false);
    }
  };

  const handleGenerateKHGD = async (customRef?: any[]) => {
    if (!apiKey.trim()) {
      setShowSettings(true);
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const activeRef = customRef || (departmentPlanRef && departmentPlanRef[0]?.subject === eduPlanInput.subject && departmentPlanRef[0]?.grade === eduPlanInput.grade ? departmentPlanRef : null);
      const data = await generateEducationalPlan(eduPlanInput.subject, eduPlanInput.grade, province, activeRef || undefined, { useLaTeX: eduPlanInput.useLaTeX, detailDrawings: eduPlanInput.detailDrawings });
      setResult({ type: "khgd", data });
    } catch (err) {
      alert("Có lỗi xảy ra khi tạo kế hoạch giáo dục. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKHTCM = async () => {
    if (!apiKey.trim()) {
      setShowSettings(true);
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await generateDepartmentPlan(eduPlanInput.subject, eduPlanInput.grade, province, { useLaTeX: eduPlanInput.useLaTeX, detailDrawings: eduPlanInput.detailDrawings });
      setResult({ type: "kh-tcm", data });
      setDepartmentPlanRef(data);
    } catch (err) {
      alert("Có lỗi xảy ra khi tạo kế hoạch tổ chuyên môn. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
    alert("Đã sao chép vào bộ nhớ tạm!");
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
        "3. Năng lực AI:": "3. AI Competencies:",
        "4. Năng lực chung:": "4. General Competencies:",
        "5. Phẩm chất:": "5. Core Qualities:",
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

    const parseMarkdownToTextRunsDocx = (text: string) => {
      if (!text) return [new TextRun({ text: "" })];
      const parts = text.split(/(<bold>.*?<\/bold>|<ai>.*?<\/ai>|\*\*.*?\*\*)/g);
      return parts.filter(p => p).map(part => {
        if (part.startsWith('<bold>') && part.endsWith('</bold>')) {
          return new TextRun({ text: part.slice(6, -7), bold: true });
        } else if (part.startsWith('<ai>') && part.endsWith('</ai>')) {
          return new TextRun({ text: part.slice(4, -5), color: "FF0000", bold: true });
        } else if (part.startsWith('**') && part.endsWith('**')) {
          return new TextRun({ text: part.slice(2, -2), bold: true });
        }
        return new TextRun({ text: part });
      });
    };

    const fileName = `${result.type.toUpperCase()}_${currentSubject}_Lop${lessonPlanInput.grade || eduPlanInput.grade}.docx`;

    let doc;

    if (result.type === "khbd") {
      const d = result.data;
      doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [new TextRun({ text: t("KẾ HOẠCH BÀI DẠY (KHBD)"), bold: true, size: 28 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `${t("Tên bài dạy:")} ${d.title}`, bold: true, size: 24 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),

            new Paragraph({ children: [new TextRun({ text: t("I. MỤC TIÊU"), bold: true, size: 24 })], spacing: { before: 200, after: 100 } }),
            new Paragraph({ children: [new TextRun({ text: t("1. Kiến thức:"), bold: true })] }),
            ...d.objectives.knowledge.map((c: string) => new Paragraph({ children: [new TextRun({ text: `- ${c}` })], indent: { left: 720 } })),

            new Paragraph({ children: [new TextRun({ text: t("2. Năng lực môn học:"), bold: true })], spacing: { before: 100 } }),
            ...d.objectives.subjectSpecific.map((c: string) => new Paragraph({ children: [new TextRun({ text: `- ${c}` })], indent: { left: 720 } })),

            new Paragraph({ children: [new TextRun({ text: t("3. Năng lực AI:"), bold: true, color: "FF0000" })], spacing: { before: 100 } }),
            ...d.objectives.aiSpecific.map((c: string) => new Paragraph({ children: [new TextRun({ text: `- ${c}`, color: "FF0000" })], indent: { left: 720 } })),

            new Paragraph({ children: [new TextRun({ text: t("4. Năng lực chung:"), bold: true })], spacing: { before: 100 } }),
            ...d.objectives.general.map((c: string) => new Paragraph({ children: [new TextRun({ text: `- ${c}` })], indent: { left: 720 } })),

            new Paragraph({ children: [new TextRun({ text: t("5. Phẩm chất:"), bold: true })], spacing: { before: 100 } }),
            ...d.objectives.qualities.map((q: string) => new Paragraph({ children: [new TextRun({ text: `- ${q}` })], indent: { left: 720 } })),

            new Paragraph({ children: [new TextRun({ text: t("II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU"), bold: true, size: 24 })], spacing: { before: 200, after: 100 } }),
            new Paragraph({ children: [new TextRun({ text: t("1. Thiết bị truyền thống:"), bold: true })] }),
            new Paragraph({ children: [new TextRun({ text: d.materials.traditional.join(", ") })], indent: { left: 720 } }),

            new Paragraph({ children: [new TextRun({ text: t("2. CÔNG CỤ SỐ AI:"), bold: true, color: "FF0000" })], spacing: { before: 100 } }),
            new Paragraph({ children: [new TextRun({ text: `${t("Phương án triển khai:")} ${d.materials.digitalAndAI.implementationMethod}`, color: "FF0000", italics: true })], indent: { left: 720 } }),
            new Paragraph({ children: [new TextRun({ text: `${t("Học liệu/công cụ cụ thể:")} ${d.materials.digitalAndAI.specificTools.join(", ")}`, color: "FF0000" })], indent: { left: 720 } }),

            new Paragraph({ children: [new TextRun({ text: t("III. TIẾN TRÌNH DẠY HỌC"), bold: true, size: 24 })], spacing: { before: 200, after: 100 } }),
            ...d.activities.flatMap((a: any) => [
              new Paragraph({ children: [new TextRun({ text: a.name, bold: true })], spacing: { before: 200 } }),
              new Paragraph({ children: [new TextRun({ text: `${t("a) Mục tiêu:")} ${a.objective}` })], indent: { left: 360 } }),
              new Paragraph({ children: [new TextRun({ text: `${t("b) Nội dung:")} ${a.content}` })], indent: { left: 360 } }),
              new Paragraph({ children: [new TextRun({ text: `${t("c) Sản phẩm:")} ${a.product}` })], indent: { left: 360 } }),
              new Paragraph({ children: [new TextRun({ text: t("d) Tổ chức thực hiện:") })], indent: { left: 360 } }),
              ...a.procedure.flatMap((p: any) => [
                new Paragraph({ children: [new TextRun({ text: p.stepName, bold: true })], indent: { left: 720 }, spacing: { before: 100 } }),
                new Paragraph({ children: [new TextRun({ text: t("Hoạt động của GV và HS:"), bold: true })], indent: { left: 1080 } }),
                new Paragraph({ children: parseMarkdownToTextRunsDocx(p.teacherStudentActivities), indent: { left: 1080 } }),
                new Paragraph({ children: [new TextRun({ text: t("Dự kiến sản phẩm:"), bold: true })], indent: { left: 1080 } }),
                new Paragraph({ children: parseMarkdownToTextRunsDocx(p.expectedProduct), indent: { left: 1080 } })
              ])
            ]),

            new Paragraph({ children: [new TextRun({ text: t("IV. KẾ HOẠCH ĐÁNH GIÁ"), bold: true, size: 24 })], spacing: { before: 200, after: 100 } }),
            ...d.assessment.flatMap((a: string) => a.split('\n').filter((l: string) => l.trim()).map((line: string) => new Paragraph({ children: parseMarkdownToTextRunsDocx(`- ${line.trim()}`), indent: { left: 720 } }))),

            new Paragraph({ children: [new TextRun({ text: t("V. PHỤ LỤC"), bold: true, size: 24 })], spacing: { before: 200, after: 100 } }),
            new Paragraph({ children: [new TextRun({ text: `${t("Mẫu Prompt:")} ${d.appendix.prompts.join(", ")}` })] }),
            new Paragraph({ children: [new TextRun({ text: t("Bảng kiểm:"), bold: true })] }),
            ...d.appendix.checklist.flatMap((c: string) => c.split('\n').filter((l: string) => l.trim()).map((line: string) => new Paragraph({ children: parseMarkdownToTextRunsDocx(`- ${line.trim()}`), indent: { left: 720 } })))
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
        ...result.data.map((item: any) => new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: String(item.order), alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.lesson, bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ text: String(item.periods), alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph({ text: String(item.timing) })] }),
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: t("TRUYỀN THỐNG:"), bold: true, size: 16 })] }),
                new Paragraph({ children: [new TextRun({ text: item.equipment, italics: true, size: 16 })] }),
                new Paragraph({ children: [new TextRun({ text: "" })], spacing: { before: 100 } }),
                new Paragraph({ children: [new TextRun({ text: t("CÔNG CỤ SỐ AI:"), bold: true, color: "FF0000", size: 16 })] }),
                new Paragraph({ children: [new TextRun({ text: `- Phương án: ${item.digitalToolsAndAI?.method}`, color: "FF0000", italics: true, size: 16 })] }),
                new Paragraph({ children: [new TextRun({ text: `- Công cụ: ${item.digitalToolsAndAI?.tools}`, color: "FF0000", size: 16 })] }),
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
      const rows = [
        new TableRow({
          children: [
            t("STT"), t("Tên bài học/Chủ đề"), t("Mục tiêu bài học"), t("Tiết"), t("Năng lực AI"), t("Mục tiêu GD AI"), t("Hình thức triển khai")
          ].map(h => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })], alignment: AlignmentType.CENTER })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: "F1F5F9" }
          }))
        }),
        ...result.data.map((item: any, i: number) => new TableRow({
          children: [
            i + 1, item.lessonName, item.lessonGoal, item.periods, item.aiCompetency, item.aiObjective, item.implementationForm
          ].map(v => new TableCell({ children: [new Paragraph({ text: String(v) })] }))
        }))
      ];

      doc = new Document({
        sections: [{
          properties: { page: { size: { orientation: "landscape" as any } } },
          children: [
            new Paragraph({
              children: [new TextRun({ text: t("KẾ HOẠCH GIÁO DỤC TỔ CHUYÊN MÔN TÍCH HỢP AI"), bold: true, size: 28 })],
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
        "3. Năng lực AI:": "3. AI Competencies:",
        "4. Năng lực chung:": "4. General Competencies:",
        "5. Phẩm chất:": "5. Core Qualities:",
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
      const d = result.data;
      content = `${t("KẾ HOẠCH BÀI DẠY (KHBD)")}\n\n${t("Tên bài dạy:")} ${d.title}\n\n${t("I. MỤC TIÊU")}\n${t("1. Kiến thức:")}\n${d.objectives.knowledge.map((c: string) => `- ${c}`).join("\n")}\n\n${t("2. Năng lực môn học:")}\n${d.objectives.subjectSpecific.map((c: string) => `- ${c}`).join("\n")}\n\n${t("3. Năng lực AI:")}\n${d.objectives.aiSpecific.map((c: string) => `- ${c}`).join("\n")}\n\n${t("4. Năng lực chung:")}\n${d.objectives.general.map((c: string) => `- ${c}`).join("\n")}\n\n${t("5. Phẩm chất:")}\n${d.objectives.qualities.map((q: string) => `- ${q}`).join("\n")}\n\n${t("II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU")}\n${t("1. Thiết bị truyền thống:")} ${d.materials.traditional.join(", ")}\n${t("2. Công cụ số và AI:")}\n- ${t("Phương án triển khai:")} ${d.materials.digitalAndAI.implementationMethod}\n- ${t("Học liệu/công cụ cụ thể:")} ${d.materials.digitalAndAI.specificTools.join(", ")}\n\n${t("III. TIẾN TRÌNH DẠY HỌC")}\n${d.activities.map((a: any) => `${a.name}\n${t("a) Mục tiêu:")} ${a.objective}\n${t("b) Nội dung:")} ${a.content}\n${t("c) Sản phẩm:")} ${a.product}\n${t("d) Tổ chức thực hiện:")}\n${a.procedure.map((p: any) => `${p.stepName}\n  - ${t("Hoạt động của GV và HS:")} ${strip(p.teacherStudentActivities)}\n  - ${t("Dự kiến sản phẩm:")} ${strip(p.expectedProduct)}`).join("\n")}`).join("\n\n")}\n\n${t("IV. KẾ HOẠCH ĐÁNH GIÁ")}\n${d.assessment.map((a: string) => `- ${strip(a)}`).join("\n")}\n\n${t("V. PHỤ LỤC")}\n- ${t("Mẫu Prompt:")} ${d.appendix.prompts.join(", ")}\n- ${t("Bảng kiểm:")}\n${d.appendix.checklist.map((c: string) => `- ${strip(c)}`).join("\n")}`;
    } else if (result.type === "khgd") {
      content = `${t("KẾ HOẠCH GIÁO DỤC CỦA GIÁO VIÊN")}\n${t("Môn:")} ${eduPlanInput.subject} - ${t("Lớp:")} ${eduPlanInput.grade}\n\n${t("Thứ tự tiết")} | ${t("Bài học")} | ${t("Số tiết")} | ${t("Thời điểm")} | ${t("Thiết bị")} | ${t("Địa điểm")} | ${t("Định hướng năng lực số")}\n${result.data.map((item: any) => `${item.order} | ${item.lesson} | ${item.periods} | ${item.timing} | ${item.equipment} | ${item.location} | ${item.digitalCompetency}`).join("\n")}`;
    } else if (result.type === "kh-tcm") {
      content = `${t("KẾ HOẠCH GIÁO DỤC TỔ CHUYÊN MÔN TÍCH HỢP AI")}\n${t("Môn:")} ${eduPlanInput.subject} - ${t("Lớp:")} ${eduPlanInput.grade}\n${t("Căn cứ QĐ 3439/QĐ-BGDĐT")}\n\n${t("STT")} | ${t("Tên bài học/Chủ đề")} | ${t("Mục tiêu bài học")} | ${t("Tiết")} | ${t("Năng lực AI")} | ${t("Mục tiêu GD AI")} | ${t("Hình thức triển khai")}\n${result.data.map((item: any, i: number) => `${i + 1} | ${item.lessonName} | ${item.lessonGoal} | ${item.periods} | ${item.aiCompetency} | ${item.aiObjective} | ${item.implementationForm}`).join("\n")}`;
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
    <div className="min-h-screen text-slate-900 font-sans selection:bg-indigo-200">
      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 h-full w-[280px] glass-dark text-white hidden lg:flex flex-col z-30 border-r border-white/10 shadow-2xl">
        <div className="p-8 border-b border-white/10 cursor-pointer hover:bg-white/5 transition-all group" onClick={() => { setMode("dashboard"); setResult(null); }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <BrainCircuit className="w-6 h-6 text-white" />
            </div>
            <h1 className="font-black text-2xl tracking-tighter">EduPlan <span className="text-blue-400">AI</span></h1>
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
            label="1. Kế hoạch Tổ chuyên môn"
          />
          <NavItem
            sidebar
            active={mode === "khgd-gen"}
            onClick={() => { setMode("khgd-gen"); setResult(null); }}
            icon={<Calendar className="w-4 h-4" />}
            label="2. Kế hoạch giáo dục của giáo viên"
          />
          <NavItem
            sidebar
            active={mode === "khbd-gen"}
            onClick={() => { setMode("khbd-gen"); setResult(null); }}
            icon={<FileText className="w-4 h-4" />}
            label="3. Kế hoạch bài dạy (KHBD)"
          />
          <NavItem
            sidebar
            active={mode === "upgrade-plan"}
            onClick={() => { setMode("upgrade-plan"); setResult(null); }}
            icon={<Zap className="w-4 h-4" />}
            label="4. Nâng cấp Giáo án (AI)"
          />
          <div className="pt-6 pb-2 px-3">
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
            <span className="font-black text-xl">EduPlan <span className="text-blue-400">AI</span></span>
          </div>
          <div className="flex items-center gap-2">
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

        <section className="flex-1 p-4 md:p-6 lg:p-10 max-w-7xl mx-auto w-full pb-40 lg:pb-40">
          <div className="mb-6 mx-auto w-full max-w-3xl glass p-4 rounded-xl border border-red-500/20 bg-red-50/10 flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-bold">Lấy API key để sử dụng app</span>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white text-xs font-bold rounded-lg transition-colors border border-red-500/30"
            >
              Cài đặt ngay
            </button>
          </div>
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
                  onUpgradeReady={(data) => {
                    setLessonPlanInput({
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
                      additionalNotes: "",
                      existingRawText: data.existingRawText,
                      aiIntegrationOptions: data.aiIntegrationOptions
                    });
                    setMode("khbd-gen");
                  }}
                />
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
                      <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-[0.9] mb-4">
                        EduPlan <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">AI</span>
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
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden shadow-md">
                            <img src={`https://picsum.photos/seed/edu_user_${i}/40/40`} referrerPolicy="no-referrer" alt="User" />
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
                        {["Chuẩn 5512", "Tích hợp AI 3439", "LaTeX support", "Đa định dạng"].map(tag => (
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
                            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
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
                          <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Tên bài học cụ thể</label>
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
                          <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.05em] group-hover:text-brand-accent transition-colors">Ưu tiên LaTeX / MathType</span>
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
                        <button onClick={downloadText} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống Text">
                          <FileText className="w-4 h-4 text-brand-muted" />
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
                      </div>
                    </div>

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
                              {result.data.objectives.knowledge.map((c: string, i: number) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
                            <div className="space-y-4">
                              <div>
                                <span className="inline-block px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-brand-muted uppercase mb-3 text-emerald-700">2. Năng lực đặc thù môn học</span>
                                <ul className="list-disc list-inside space-y-2 text-brand-dark text-[12px] leading-relaxed">
                                  {result.data.objectives.subjectSpecific.map((c: string, i: number) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <span className="inline-block px-2 py-1 bg-red-50 rounded text-[10px] font-bold text-red-600 uppercase mb-3 border border-red-100">3. Năng lực AI đặc thù (3439)</span>
                                <ul className="list-disc list-inside space-y-2 text-red-600 text-[12px] leading-relaxed italic font-medium">
                                  {result.data.objectives.aiSpecific.map((c: string, i: number) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                            <div className="space-y-4">
                              <div>
                                <span className="inline-block px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-brand-muted uppercase mb-3">4. Năng lực chung</span>
                                <ul className="list-disc list-inside space-y-2 text-brand-dark text-[12px] leading-relaxed">
                                  {result.data.objectives.general.map((c: string, i: number) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <span className="inline-block px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-brand-muted uppercase mb-3">5. Phẩm chất</span>
                                <ul className="list-disc list-inside space-y-2 text-brand-dark text-[12px] leading-relaxed">
                                  {result.data.objectives.qualities.map((q: string, i: number) => (
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
                              {result.data.materials.traditional.map((m: string, i: number) => <li key={i}>{m}</li>)}
                            </ul>
                          </div>
                          <div className="space-y-4">
                            <p className="text-[10px] font-extrabold text-red-600 uppercase tracking-wider underline decoration-red-200 underline-offset-4">2. CÔNG CỤ SỐ AI</p>
                            <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 space-y-3 shadow-sm shadow-red-50">
                              <div>
                                <p className="text-[9px] font-bold text-red-600 uppercase mb-1">Phương án triển khai</p>
                                <p className="text-[11px] text-red-600 leading-relaxed font-semibold italic">
                                  {result.data.materials.digitalAndAI.implementationMethod}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] font-bold text-red-600 uppercase mb-1">Học liệu / Công cụ cụ thể</p>
                                <ul className="list-disc list-inside text-[11px] text-red-600 space-y-1 font-medium">
                                  {result.data.materials.digitalAndAI.specificTools.map((m: string, i: number) => <li key={i}>{m}</li>)}
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
                          {result.data.activities.map((act: any, i: number) => (
                            <div key={i} className="space-y-4 border-l-2 border-slate-100 pl-6 relative">
                              <div className="absolute -left-[9px] top-1 w-4 h-4 bg-white border-2 border-brand-accent rounded-full"></div>
                              <h5 className="font-extrabold text-brand-accent text-sm uppercase">{highlightAI(act.name)}</h5>
                              <div className="grid grid-cols-1 gap-4 text-[13px] leading-relaxed">
                                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                  <p className="font-bold text-brand-sidebar mb-1 uppercase text-[10px] tracking-wider text-opacity-70">a) Mục tiêu</p>
                                  <p className="text-brand-muted">{highlightAI(act.objective)}</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                    <p className="font-bold text-brand-sidebar mb-1 uppercase text-[10px] tracking-wider text-opacity-70">b) Nội dung</p>
                                    <div className="text-brand-muted whitespace-pre-line">{highlightAI(act.content)}</div>
                                  </div>
                                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                    <p className="font-bold text-brand-sidebar mb-1 uppercase text-[10px] tracking-wider text-opacity-70">c) Sản phẩm</p>
                                    <div className="text-brand-muted whitespace-pre-line">{highlightAI(act.product)}</div>
                                  </div>
                                </div>
                                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                  <p className="font-bold text-brand-sidebar mb-3 uppercase text-[10px] tracking-wider text-opacity-70">d) Tổ chức thực hiện</p>
                                  <div className="space-y-6">
                                    {act.procedure.map((step: any, idx: number) => (
                                      <div key={idx} className="space-y-3">
                                        <p className="font-bold text-brand-sidebar text-[11px] bg-slate-200/50 px-2 py-1 rounded inline-block">{highlightAI(step.stepName)}</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-2">
                                          <div className="space-y-1">
                                            <p className="text-[9px] font-bold text-brand-muted uppercase">Hoạt động của GV và HS</p>
                                            <div className="text-brand-dark text-[12px] leading-relaxed pl-3 border-l-2 border-brand-accent/20 whitespace-pre-line">{highlightAI(step.teacherStudentActivities)}</div>
                                          </div>
                                          <div className="space-y-1">
                                            <p className="text-[9px] font-bold text-brand-muted uppercase">Dự kiến sản phẩm</p>
                                            <div className="text-brand-dark text-[12px] leading-relaxed pl-3 border-l-2 border-emerald-500/20 whitespace-pre-line font-medium italic">{highlightAI(step.expectedProduct)}</div>
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
                          {result.data.assessment.map((a: string, i: number) => (
                            <li key={i}>{highlightAI(a)}</li>
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
                              {result.data.appendix.prompts.map((p: string, i: number) => (
                                <div key={i} className="p-3 bg-white border border-slate-200 rounded-lg text-[12px] font-mono text-brand-accent shadow-sm italic">
                                  "{p}"
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <p className="text-[10px] font-extrabold text-brand-sidebar uppercase mb-2 tracking-wider">Bảng kiểm đánh giá thái độ sử dụng AI</p>
                            <ul className="list-disc list-inside space-y-1 text-brand-dark text-[12px]">
                              {result.data.appendix.checklist.map((c: string, i: number) => <li key={i}>{c}</li>)}
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
                              {evaluationResult.rubrics.map((rubric: any, idx: number) => (
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
                                {evaluationResult.formativeAssessment.quizzes.map((q: any, qi: number) => (
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
                            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
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
                          <option value="10">Lớp 10</option>
                          <option value="11">Lớp 11</option>
                          <option value="12">Lớp 12</option>
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
                          <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.05em] group-hover:text-indigo-600 transition-colors">Ưu tiên LaTeX / MathType</span>
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
                        <button onClick={downloadText} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống Text">
                          <FileText className="w-4 h-4 text-brand-muted" />
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
                            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
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
                          <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.05em] group-hover:text-emerald-600 transition-colors">Ưu tiên LaTeX / MathType</span>
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
                        <button onClick={downloadText} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống Text">
                          <FileText className="w-4 h-4 text-brand-muted" />
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
                        <h4 className="text-lg font-extrabold text-brand-sidebar">1. Phân phối chương trình</h4>
                      </div>
                      <table className="w-full text-left text-[11px] border-collapse min-w-[1000px]">
                        <thead>
                          <tr className="border-b-2 border-slate-100">
                            <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-12 text-center">STT</th>
                            <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-48">Tên bài học/Chủ đề</th>
                            <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest">Mục tiêu bài học (CT 2018)</th>
                            <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-20 text-center">Tiết</th>
                            <th className="p-4 font-extrabold text-red-600 uppercase tracking-widest w-40">Năng lực AI tích hợp</th>
                            <th className="p-4 font-extrabold text-red-600 uppercase tracking-widest">Mục tiêu GD AI cụ thể (3439)</th>
                            <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-32">Hình thức triển khai</th>
                            <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-24 print:hidden text-center">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.data.map((item: any, i: number) => (
                            <tr key={i} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors align-top ${item.aiCompetency.includes("Không tích hợp") ? "opacity-60" : ""}`}>
                              <td className="p-4 text-center font-bold text-slate-400">{i + 1}</td>
                              <td className="p-4 font-bold text-brand-sidebar">{item.lessonName}</td>
                              <td className="p-4 text-brand-muted leading-relaxed whitespace-pre-line text-[10px]">{item.lessonGoal}</td>
                              <td className="p-4 text-center font-bold text-slate-600">{item.periods}</td>
                              <td className={`p-4 font-bold ${item.aiCompetency.includes("Không tích hợp") ? "text-slate-400" : "text-red-600 bg-red-50/20"}`}>{item.aiCompetency}</td>
                              <td className="p-4 text-red-700 font-bold leading-relaxed whitespace-pre-line text-[10px] bg-red-50/10 border-l border-red-100">{item.aiObjective}</td>
                              <td className="p-4">
                                <span className="inline-block px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-[9px] uppercase">
                                  {item.implementationForm}
                                </span>
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
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
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
                  Cấu hình AI cho EduPlan. Chìa khóa API (API Key) được lưu trữ an toàn trên trình duyệt của bạn.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Google Gemini API Key
                  </label>
                  <input
                    type="password"
                    placeholder="Nhập API Key hợp lệ..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-700 bg-slate-50"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <p className="text-xs text-slate-500 italic mt-1">
                    Bạn có thể lấy API Key miễn phí từ <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-500 font-bold hover:underline">Google AI Studio</a>.
                  </p>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Chọn Model AI Ưu tiên
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: "gemini-3-flash-preview", name: "Gemini 3.0 Flash", desc: "Tốc độ cực cao, thông minh (Khuyên dùng)" },
                      { id: "gemini-3-pro-preview", name: "Gemini 3.0 Pro", desc: "Siêu trí tuệ, lý luận sâu sắc nhất" },
                      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", desc: "Model tính ổn định cao nhất" }
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
    </div>
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
