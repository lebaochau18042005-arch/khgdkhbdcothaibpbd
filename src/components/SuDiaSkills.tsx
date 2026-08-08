import React, { useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Calculator,
  CheckCircle2,
  Download,
  FileQuestion,
  FileText,
  Layers,
  Loader2,
  Map,
  Presentation,
  Table2,
  UploadCloud,
  Wand2
} from "lucide-react";
import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import { generateSuDiaSkill, SuDiaSkillDomain, SuDiaSkillKind } from "../services/geminiService";

type SkillCard = {
  id: SuDiaSkillKind | "upgrade-docx";
  domain: SuDiaSkillDomain | "shared";
  title: string;
  desc: string;
  icon: React.ReactNode;
  accent: string;
};

type Props = {
  apiKey: string;
  aiModel: string;
  onOpenUpgradePlan: () => void;
  onRequestSettings: () => void;
};

const GRADES = ["6", "7", "8", "9", "10", "11", "12"];
const HISTORY_SUBJECTS = ["Lịch sử", "Lịch sử và Địa lí", "Giáo dục địa phương"];
const GEOGRAPHY_SUBJECTS = ["Địa lí", "Lịch sử và Địa lí", "Giáo dục địa phương"];

const skillCards: SkillCard[] = [
  {
    id: "history-quiz",
    domain: "history",
    title: "Quiz Lịch sử",
    desc: "Câu hỏi nhanh theo sự kiện, nhân vật, nguyên nhân - kết quả.",
    icon: <FileQuestion className="w-5 h-5" />,
    accent: "bg-blue-600"
  },
  {
    id: "history-timeline",
    domain: "history",
    title: "Dòng thời gian",
    desc: "Mốc sự kiện, ý nghĩa, phân tích tư liệu và câu hỏi lịch sử.",
    icon: <BookOpen className="w-5 h-5" />,
    accent: "bg-amber-600"
  },
  {
    id: "history-slides",
    domain: "history",
    title: "Slide Lịch sử",
    desc: "Dàn slide, ghi chú thuyết trình và hoạt động phân tích tư liệu.",
    icon: <Presentation className="w-5 h-5" />,
    accent: "bg-indigo-600"
  },
  {
    id: "history-exam",
    domain: "history",
    title: "Đề kiểm tra Lịch sử",
    desc: "Ma trận, trắc nghiệm, đúng/sai, tự luận và đáp án.",
    icon: <FileText className="w-5 h-5" />,
    accent: "bg-violet-600"
  },
  {
    id: "geo-map",
    domain: "geography",
    title: "Bản đồ/GIS",
    desc: "Lớp dữ liệu, quy trình khai thác bản đồ, nguồn dữ liệu.",
    icon: <Map className="w-5 h-5" />,
    accent: "bg-emerald-600"
  },
  {
    id: "geo-chart",
    domain: "geography",
    title: "Biểu đồ Địa lí",
    desc: "Chọn loại biểu đồ, bảng dữ liệu mẫu, bước vẽ và nhận xét.",
    icon: <BarChart3 className="w-5 h-5" />,
    accent: "bg-sky-600"
  },
  {
    id: "geo-table",
    domain: "geography",
    title: "Bảng số liệu",
    desc: "Xử lí số liệu, tính toán, nhận xét xu hướng và câu hỏi khai thác.",
    icon: <Table2 className="w-5 h-5" />,
    accent: "bg-teal-600"
  },
  {
    id: "geo-formula",
    domain: "geography",
    title: "Công thức Địa lí",
    desc: "Công thức, biến số, ví dụ tính mẫu và bài luyện tập.",
    icon: <Calculator className="w-5 h-5" />,
    accent: "bg-orange-600"
  },
  {
    id: "geo-slides",
    domain: "geography",
    title: "Slide Địa lí",
    desc: "Slide có bản đồ, biểu đồ, bảng số liệu và câu hỏi khai thác.",
    icon: <Presentation className="w-5 h-5" />,
    accent: "bg-indigo-600"
  },
  {
    id: "geo-exam",
    domain: "geography",
    title: "Đề kiểm tra Địa lí",
    desc: "Ma trận đề có bản đồ, biểu đồ, bảng số liệu, công thức.",
    icon: <FileText className="w-5 h-5" />,
    accent: "bg-violet-600"
  },
  {
    id: "upgrade-docx",
    domain: "shared",
    title: "Nâng cấp DOCX giáo án",
    desc: "Mở luồng chèn AI/NLS vào file DOCX giáo án đang có.",
    icon: <FileText className="w-5 h-5" />,
    accent: "bg-rose-600"
  }
];

const strip = (text?: string) => (text || "").replace(/<bold>|<\/bold>|<ai>|<\/ai>|\*\*/gi, "");
const asList = (value: any): any[] => Array.isArray(value) ? value : [];
const isQuizKind = (kind: SuDiaSkillKind) => kind.endsWith("quiz");
const isSlidesKind = (kind: SuDiaSkillKind) => kind.endsWith("slides");
const isExamKind = (kind: SuDiaSkillKind) => kind.endsWith("exam");

export default function SuDiaSkills({ apiKey, aiModel, onOpenUpgradePlan, onRequestSettings }: Props) {
  const [domain, setDomain] = useState<SuDiaSkillDomain>("history");
  const [kind, setKind] = useState<SuDiaSkillKind>("history-quiz");
  const [subject, setSubject] = useState("Lịch sử");
  const [grade, setGrade] = useState("10");
  const [topic, setTopic] = useState("");
  const [province, setProvince] = useState("TP. Hồ Chí Minh");
  const [lessonGoal, setLessonGoal] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [questionCount, setQuestionCount] = useState(8);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const visibleCards = useMemo(
    () => skillCards.filter(card => card.domain === domain || card.domain === "shared"),
    [domain]
  );
  const activeCard = useMemo(() => skillCards.find(card => card.id === kind), [kind]);
  const subjectOptions = domain === "history" ? HISTORY_SUBJECTS : GEOGRAPHY_SUBJECTS;

  const chooseDomain = (nextDomain: SuDiaSkillDomain) => {
    setDomain(nextDomain);
    setKind(nextDomain === "history" ? "history-quiz" : "geo-map");
    setSubject(nextDomain === "history" ? "Lịch sử" : "Địa lí");
    setResult(null);
  };

  const handleSourceUpload = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    setSourceText(text.slice(0, 30000));
  };

  const handleGenerate = async () => {
    if (!apiKey.trim()) {
      alert("Vui lòng nhập Gemini API key trước khi dùng tính năng này.");
      onRequestSettings();
      return;
    }
    if (!topic.trim()) {
      alert("Vui lòng nhập tên bài học hoặc chủ đề.");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      localStorage.setItem("GEMINI_API_KEY", apiKey.trim());
      localStorage.setItem("GEMINI_MODEL", aiModel);
      const data = await generateSuDiaSkill({
        kind,
        domain,
        subject,
        grade,
        topic,
        province,
        lessonGoal,
        sourceText,
        questionCount
      });
      setResult(data);
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("QUOTA_EXHAUSTED")) {
        alert("API key đã hết quota hôm nay. Vui lòng đổi key hoặc thử lại sau.");
        onRequestSettings();
      } else if (msg.includes("API_KEY") || msg.includes("401") || msg.includes("403")) {
        alert("API key không hợp lệ. Vui lòng kiểm tra lại.");
        onRequestSettings();
      } else {
        alert(`Có lỗi khi tạo học liệu: ${msg || "Lỗi không xác định."}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const addCommonText = (lines: string[]) => {
    lines.push(
      result?.title || "Học liệu",
      "",
      `Nhánh môn: ${domain === "history" ? "Lịch sử" : "Địa lí"}`,
      `Môn: ${subject}`,
      `Lớp: ${grade}`,
      `Chủ đề: ${topic}`,
      "",
      "Tổng quan:",
      strip(result?.overview),
      "",
      "Kết nối NLS/AI:",
      ...asList(result?.nlsAiConnections).map((item: any) => `- ${item.code}: ${item.description}. ${item.classroomUse}`),
      ""
    );
  };

  const buildPlainText = () => {
    if (!result) return "";
    const lines: string[] = [];
    addCommonText(lines);

    if (isQuizKind(kind)) appendQuizText(lines, result);
    if (isSlidesKind(kind)) appendSlidesText(lines, result);
    if (isExamKind(kind)) appendExamText(lines, result);
    if (kind === "history-timeline") appendHistoryText(lines, result);
    if (kind === "geo-map") appendGeoMapText(lines, result);
    if (kind === "geo-chart") appendGeoChartText(lines, result);
    if (kind === "geo-table") appendGeoTableText(lines, result);
    if (kind === "geo-formula") appendGeoFormulaText(lines, result);

    lines.push("", "Ghi chú giáo viên:", ...asList(result.teacherNotes).map((note: string) => `- ${strip(note)}`));
    return lines.join("\n");
  };

  const downloadText = () => {
    const blob = new Blob([buildPlainText()], { type: "text/plain;charset=utf-8" });
    saveAs(blob, `${domain}_${kind}_lop${grade}.txt`);
  };

  const downloadDocx = async () => {
    if (!result) return;
    const children = buildPlainText().split("\n").map((line, index) => new Paragraph({
      children: [new TextRun({ text: line, bold: index === 0 || /^[A-ZÀ-Ỹ].*:$/.test(line), size: index === 0 ? 30 : 24 })],
      alignment: index === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: line ? 80 : 40 }
    }));
    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${domain}_${kind}_lop${grade}.docx`);
  };

  const buildSlides = () => {
    if (!result) return [];
    if (asList(result.slides?.slides).length > 0) {
      return asList(result.slides.slides).map((slide: any) => ({
        title: slide.title,
        bullets: [...asList(slide.bullets), slide.classroomActivity ? `Hoạt động: ${slide.classroomActivity}` : ""].filter(Boolean)
      }));
    }
    if (isQuizKind(kind)) {
      return [
        { title: result.title, bullets: [result.overview] },
        ...asList(result.quiz?.questions).slice(0, 10).map((q: any, index: number) => ({
          title: `Câu ${index + 1}`,
          bullets: [q.question, ...asList(q.options).map((option: string, optionIndex: number) => `${String.fromCharCode(65 + optionIndex)}. ${option}`), `Đáp án: ${q.answer}`]
        }))
      ];
    }
    if (kind === "history-timeline") {
      return [
        { title: result.title, bullets: [result.overview] },
        { title: "Dòng thời gian", bullets: asList(result.historyAnalysis?.timeline).map((item: any) => `${item.time}: ${item.event}`) },
        { title: "Phân tích tư liệu", bullets: asList(result.historyAnalysis?.sourceAnalysisSteps) },
        { title: "Câu hỏi lịch sử", bullets: asList(result.historyAnalysis?.historicalQuestions) }
      ];
    }
    if (kind === "geo-map") {
      return [
        { title: result.title, bullets: [result.gisAnalysis?.mapBrief || result.overview] },
        { title: "Lớp dữ liệu GIS", bullets: asList(result.gisAnalysis?.layers) },
        { title: "Quy trình phân tích", bullets: asList(result.gisAnalysis?.workflow) },
        { title: "Câu hỏi khai thác bản đồ", bullets: asList(result.gisAnalysis?.inquiryQuestions) }
      ];
    }
    if (kind === "geo-chart") {
      const chart = result.geographyAnalysis?.chartGuide || {};
      return [
        { title: result.title, bullets: [result.overview] },
        { title: `Biểu đồ: ${chart.chartType || ""}`, bullets: asList(chart.drawingSteps) },
        { title: "Câu hỏi nhận xét", bullets: asList(chart.interpretationQuestions) },
        { title: "Lỗi thường gặp", bullets: asList(chart.commonMistakes) }
      ];
    }
    if (kind === "geo-table") {
      const table = result.geographyAnalysis?.dataTableGuide || {};
      return [
        { title: result.title, bullets: [result.overview] },
        { title: table.tableTitle || "Bảng số liệu", bullets: asList(table.processingSteps) },
        { title: "Phép tính chính", bullets: asList(table.keyCalculations) },
        { title: "Nhận xét", bullets: asList(table.comments) }
      ];
    }
    if (kind === "geo-formula") {
      const formulas = asList(result.geographyAnalysis?.formulaGuide?.formulas);
      return [
        { title: result.title, bullets: [result.overview] },
        ...formulas.slice(0, 5).map((formula: any) => ({
          title: formula.name,
          bullets: [formula.expression, formula.variables, formula.whenToUse, formula.example].filter(Boolean)
        }))
      ];
    }
    return [
      { title: result.title, bullets: [result.overview] },
      { title: "Ma trận đề", bullets: asList(result.exam?.matrix).map((row: any) => `${row.competency} - ${row.level} - ${row.score} điểm`) },
      { title: "Câu hỏi trọng tâm", bullets: asList(result.exam?.multipleChoice).slice(0, 6).map((q: any, index: number) => `${index + 1}. ${q.question}`) },
      { title: "Đáp án", bullets: asList(result.exam?.answerKey).slice(0, 8) }
    ];
  };

  const downloadPptx = async () => {
    const slides = buildSlides();
    if (!slides.length) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const esc = (text: string) => strip(String(text || "")).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const slideWidth = 9144000;
    const slideHeight = 5143500;

    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  ${slides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("\n  ")}
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);
    zip.folder("_rels")!.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);
    const ppt = zip.folder("ppt")!;
    ppt.file("presentation.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldSz cx="${slideWidth}" cy="${slideHeight}"/>
  <p:notesSz cx="${slideHeight}" cy="${slideWidth}"/>
  <p:sldIdLst>${slides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join("")}</p:sldIdLst>
</p:presentation>`);
    ppt.folder("_rels")!.file("presentation.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${slides.map((_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("\n  ")}
</Relationships>`);
    const masterFolder = ppt.folder("slideMasters")!;
    masterFolder.file("slideMaster1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`);
    masterFolder.folder("_rels")!.file("slideMaster1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`);
    const layoutFolder = ppt.folder("slideLayouts")!;
    layoutFolder.file("slideLayout1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" type="blank" preserve="1"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld></p:sldLayout>`);
    layoutFolder.folder("_rels")!.file("slideLayout1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`);
    const slideFolder = ppt.folder("slides")!;
    const slideRels = slideFolder.folder("_rels")!;
    slides.forEach((slide, index) => {
      const bullets = asList(slide.bullets).slice(0, 8).map((bullet: string) => `<a:p><a:r><a:rPr lang="vi-VN" sz="1650"/><a:t>${esc(`- ${bullet}`)}</a:t></a:r></a:p>`).join("");
      slideFolder.file(`slide${index + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="F8FAFC"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${slideWidth}" cy="${slideHeight}"/><a:chOff x="0" y="0"/><a:chExt cx="${slideWidth}" cy="${slideHeight}"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="300000"/><a:ext cx="8229600" cy="820000"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="1E40AF"/></a:solidFill></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="vi-VN" sz="2450" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>${esc(slide.title)}</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="650000" y="1350000"/><a:ext cx="7800000" cy="3300000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>${bullets}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
      slideRels.file(`slide${index + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`);
    });
    zip.folder("docProps")!.file("app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>EduPlan AI</Application><Slides>${slides.length}</Slides></Properties>`);
    const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
    saveAs(blob, `${domain}_${kind}_lop${grade}.pptx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-black uppercase tracking-[0.2em] mb-3">
            <Layers className="w-3 h-3" /> Sử - Địa Skills
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Trung tâm học liệu Lịch sử & Địa lí</h2>
          <p className="text-sm font-medium text-slate-500 mt-2">Hai nhánh riêng: Lịch sử tập trung tư liệu - dòng thời gian; Địa lí có bản đồ, biểu đồ, bảng số liệu và công thức.</p>
        </div>
        {result && (
          <div className="flex flex-wrap gap-2">
            <button onClick={downloadDocx} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><FileText className="w-4 h-4" /> DOCX</button>
            <button onClick={downloadPptx} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Presentation className="w-4 h-4" /> PPTX</button>
            <button onClick={downloadText} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Download className="w-4 h-4" /> TXT</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button onClick={() => chooseDomain("history")} className={`text-left rounded-xl border p-5 bg-white transition-all ${domain === "history" ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300"}`}>
          <p className="text-sm font-black text-slate-900">Lịch sử Skills</p>
          <p className="text-xs text-slate-500 mt-1">Quiz, dòng thời gian, phân tích tư liệu, slide, đề kiểm tra.</p>
        </button>
        <button onClick={() => chooseDomain("geography")} className={`text-left rounded-xl border p-5 bg-white transition-all ${domain === "geography" ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-200 hover:border-slate-300"}`}>
          <p className="text-sm font-black text-slate-900">Địa lí Skills</p>
          <p className="text-xs text-slate-500 mt-1">Bản đồ/GIS, biểu đồ, bảng số liệu, công thức, slide, đề kiểm tra.</p>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {visibleCards.map(card => {
          const active = card.id === kind;
          return (
            <button key={card.id} onClick={() => card.id === "upgrade-docx" ? onOpenUpgradePlan() : setKind(card.id)} className={`text-left bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all ${active ? "border-indigo-500 ring-2 ring-indigo-100" : "border-slate-200"}`}>
              <div className={`w-9 h-9 rounded-lg ${card.accent} text-white flex items-center justify-center mb-3`}>{card.icon}</div>
              <p className="text-sm font-black text-slate-900 leading-tight">{card.title}</p>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm h-fit">
          <div className="flex items-center gap-3 mb-5">
            <div className={`w-10 h-10 rounded-lg ${activeCard?.accent || "bg-indigo-600"} text-white flex items-center justify-center`}>{activeCard?.icon || <Wand2 className="w-5 h-5" />}</div>
            <div>
              <h3 className="font-black text-slate-900">{activeCard?.title}</h3>
              <p className="text-xs text-slate-500 font-medium">Nhập dữ liệu, AI sẽ dựng bản nháp có cấu trúc.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Môn</span>
                <select value={subject} onChange={event => setSubject(event.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold bg-slate-50">
                  {subjectOptions.map(item => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lớp</span>
                <select value={grade} onChange={event => setGrade(event.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold bg-slate-50">
                  {GRADES.map(item => <option key={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <label className="space-y-1 block">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bài học/chủ đề</span>
              <input value={topic} onChange={event => setTopic(event.target.value)} placeholder={domain === "history" ? "Ví dụ: Cách mạng tháng Tám năm 1945" : "Ví dụ: Cơ cấu dân số Việt Nam"} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold bg-slate-50" />
            </label>
            <label className="space-y-1 block">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Khu vực/địa phương</span>
              <input value={province} onChange={event => setProvince(event.target.value)} placeholder="Ví dụ: TP. Hồ Chí Minh, Đồng bằng sông Cửu Long" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold bg-slate-50" />
            </label>
            <label className="space-y-1 block">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">YCCĐ/ghi chú</span>
              <textarea value={lessonGoal} onChange={event => setLessonGoal(event.target.value)} rows={3} placeholder="Dán yêu cầu cần đạt, mục tiêu bài học hoặc yêu cầu riêng..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 resize-none" />
            </label>
            {(isQuizKind(kind) || isExamKind(kind)) && (
              <label className="space-y-1 block">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Số câu gợi ý</span>
                <input type="number" min={4} max={40} value={questionCount} onChange={event => setQuestionCount(Number(event.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold bg-slate-50" />
              </label>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dữ liệu/tư liệu bổ sung</span>
                <label className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1">
                  <UploadCloud className="w-3 h-3" /> Tải TXT/CSV/JSON
                  <input type="file" accept=".txt,.csv,.json,.geojson" className="hidden" onChange={event => handleSourceUpload(event.target.files?.[0])} />
                </label>
              </div>
              <textarea value={sourceText} onChange={event => setSourceText(event.target.value)} rows={5} placeholder={domain === "history" ? "Dán tư liệu lịch sử, trích đoạn văn bản, mốc sự kiện..." : "Dán bảng số liệu, mô tả bản đồ, dữ liệu CSV/GeoJSON, yêu cầu công thức..."} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 resize-none" />
            </div>
            <button onClick={handleGenerate} disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl py-3 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 disabled:opacity-60">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {loading ? "Đang tạo học liệu..." : "Tạo học liệu"}
            </button>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm min-h-[520px]">
          {!result ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4"><Wand2 className="w-8 h-8" /></div>
              <h3 className="text-lg font-black text-slate-800">Chưa có học liệu</h3>
              <p className="text-sm text-slate-500 max-w-md mt-2">Chọn nhánh môn, chọn skill, nhập chủ đề và bấm tạo. Kết quả sẽ xuất hiện ở đây để tải DOCX/PPTX/TXT.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-5">
                <div className="flex flex-wrap gap-2 mb-3">
                  {asList(result.tags).map((tag: string) => <span key={tag} className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider">{tag}</span>)}
                </div>
                <h3 className="text-2xl font-black text-slate-900">{result.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">{result.overview}</p>
              </div>

              <div>
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Kết nối NLS/AI</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {asList(result.nlsAiConnections).map((item: any, index: number) => (
                    <div key={index} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                      <p className="font-black text-indigo-700 text-sm">{item.code}</p>
                      <p className="text-xs text-slate-700 font-semibold mt-1">{item.description}</p>
                      <p className="text-[11px] text-slate-500 mt-1">{item.classroomUse}</p>
                    </div>
                  ))}
                </div>
              </div>

              {isQuizKind(kind) && <QuizResult result={result} />}
              {isSlidesKind(kind) && <SlidesResult result={result} />}
              {isExamKind(kind) && <ExamResult result={result} />}
              {kind === "history-timeline" && <HistoryResult result={result} />}
              {kind === "geo-map" && <GisResult result={result} />}
              {kind === "geo-chart" && <GeoChartResult result={result} />}
              {kind === "geo-table" && <GeoTableResult result={result} />}
              {kind === "geo-formula" && <GeoFormulaResult result={result} />}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function appendQuizText(lines: string[], result: any) {
  lines.push("Quiz:");
  asList(result.quiz?.questions).forEach((q: any, index: number) => {
    lines.push(`${index + 1}. ${q.question}`);
    asList(q.options).forEach((option: string, optionIndex: number) => lines.push(`   ${String.fromCharCode(65 + optionIndex)}. ${option}`));
    lines.push(`   Đáp án: ${q.answer}`);
    lines.push(`   Giải thích: ${q.explanation}`);
  });
}

function appendSlidesText(lines: string[], result: any) {
  lines.push("Dàn slide:");
  asList(result.slides?.slides).forEach((slide: any, index: number) => {
    lines.push(`Slide ${index + 1}: ${slide.title}`);
    asList(slide.bullets).forEach((bullet: string) => lines.push(`- ${bullet}`));
    lines.push(`Ghi chú: ${slide.speakerNotes}`);
  });
}

function appendExamText(lines: string[], result: any) {
  lines.push("Ma trận đề:");
  asList(result.exam?.matrix).forEach((row: any) => lines.push(`- ${row.competency} | ${row.level} | ${row.questionCount} câu | ${row.score} điểm`));
  appendQuizText(lines, { quiz: { questions: asList(result.exam?.multipleChoice).map((q: any) => ({ ...q, level: "Trắc nghiệm" })) } });
  lines.push("Tự luận:", ...asList(result.exam?.essay).map((q: any, index: number) => `${index + 1}. ${q.question}`));
  lines.push("Đáp án:", ...asList(result.exam?.answerKey).map((item: string) => `- ${item}`));
}

function appendHistoryText(lines: string[], result: any) {
  const history = result.historyAnalysis || {};
  lines.push("Dòng thời gian:");
  asList(history.timeline).forEach((item: any) => lines.push(`- ${item.time}: ${item.event} (${item.significance})`));
  lines.push("Phân tích tư liệu:", ...asList(history.sourceAnalysisSteps).map((item: string) => `- ${item}`));
  lines.push("Nguyên nhân - kết quả:", ...asList(history.causeEffect).map((item: string) => `- ${item}`));
  lines.push("Câu hỏi lịch sử:", ...asList(history.historicalQuestions).map((item: string) => `- ${item}`));
}

function appendGeoMapText(lines: string[], result: any) {
  const gis = result.gisAnalysis || {};
  lines.push("Bản đồ/GIS:", strip(gis.mapBrief));
  lines.push("Lớp dữ liệu:", ...asList(gis.layers).map((item: string) => `- ${item}`));
  lines.push("Quy trình:", ...asList(gis.workflow).map((item: string, index: number) => `${index + 1}. ${item}`));
  lines.push("Câu hỏi khai thác:", ...asList(gis.inquiryQuestions).map((item: string) => `- ${item}`));
}

function appendGeoChartText(lines: string[], result: any) {
  const chart = result.geographyAnalysis?.chartGuide || {};
  lines.push(`Biểu đồ phù hợp: ${chart.chartType || ""}`);
  lines.push("Các bước vẽ/đọc biểu đồ:", ...asList(chart.drawingSteps).map((item: string, index: number) => `${index + 1}. ${item}`));
  lines.push("Câu hỏi nhận xét:", ...asList(chart.interpretationQuestions).map((item: string) => `- ${item}`));
  lines.push("Lỗi thường gặp:", ...asList(chart.commonMistakes).map((item: string) => `- ${item}`));
}

function appendGeoTableText(lines: string[], result: any) {
  const table = result.geographyAnalysis?.dataTableGuide || {};
  lines.push(`Bảng số liệu: ${table.tableTitle || ""}`);
  lines.push("Bước xử lí:", ...asList(table.processingSteps).map((item: string, index: number) => `${index + 1}. ${item}`));
  lines.push("Phép tính:", ...asList(table.keyCalculations).map((item: string) => `- ${item}`));
  lines.push("Nhận xét:", ...asList(table.comments).map((item: string) => `- ${item}`));
}

function appendGeoFormulaText(lines: string[], result: any) {
  const formulaGuide = result.geographyAnalysis?.formulaGuide || {};
  lines.push("Công thức Địa lí:");
  asList(formulaGuide.formulas).forEach((formula: any) => {
    lines.push(`- ${formula.name}: ${formula.expression}`);
    lines.push(`  Biến số: ${formula.variables}`);
    lines.push(`  Khi dùng: ${formula.whenToUse}`);
    lines.push(`  Ví dụ: ${formula.example}`);
  });
  lines.push("Bài tập luyện tập:", ...asList(formulaGuide.practiceTasks).map((item: string) => `- ${item}`));
}

function QuizResult({ result }: { result: any }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Quiz</h4>
      {asList(result.quiz?.questions).map((q: any, index: number) => (
        <div key={index} className="border border-slate-200 rounded-lg p-4">
          <p className="text-[11px] font-black text-blue-600 uppercase mb-1">{q.level}</p>
          <p className="font-bold text-slate-900">{index + 1}. {q.question}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
            {asList(q.options).map((option: string, optionIndex: number) => <p key={optionIndex} className="text-sm bg-slate-50 rounded-lg p-2">{String.fromCharCode(65 + optionIndex)}. {option}</p>)}
          </div>
          <p className="text-sm text-emerald-700 font-bold mt-3">Đáp án: {q.answer}</p>
          <p className="text-xs text-slate-500 mt-1">{q.explanation}</p>
        </div>
      ))}
    </div>
  );
}

function SlidesResult({ result }: { result: any }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Dàn slide</h4>
      {asList(result.slides?.slides).map((slide: any, index: number) => (
        <div key={index} className="border border-slate-200 rounded-lg p-4">
          <p className="text-[11px] font-black text-indigo-600 uppercase mb-1">Slide {index + 1}</p>
          <p className="font-black text-slate-900">{slide.title}</p>
          <p className="text-xs text-slate-500 mb-2">{slide.subtitle}</p>
          <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">{asList(slide.bullets).map((bullet: string, bulletIndex: number) => <li key={bulletIndex}>{bullet}</li>)}</ul>
          <p className="text-xs text-slate-500 mt-3"><span className="font-bold">Ghi chú:</span> {slide.speakerNotes}</p>
        </div>
      ))}
    </div>
  );
}

function HistoryResult({ result }: { result: any }) {
  const history = result.historyAnalysis || {};
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Lịch sử</h4>
      <div className="space-y-2">
        {asList(history.timeline).map((item: any, index: number) => (
          <div key={index} className="border-l-4 border-amber-500 bg-amber-50 rounded-r-lg p-3">
            <p className="font-black text-amber-800">{item.time}</p>
            <p className="text-sm font-bold text-slate-900">{item.event}</p>
            <p className="text-xs text-slate-600">{item.significance}</p>
          </div>
        ))}
      </div>
      <ResultList title="Phân tích tư liệu" items={history.sourceAnalysisSteps} ordered />
      <ResultList title="Nguyên nhân - kết quả" items={history.causeEffect} />
      <ResultList title="Câu hỏi lịch sử" items={history.historicalQuestions} />
      <ResultList title="Nguồn kiểm chứng" items={history.verificationSources} />
    </div>
  );
}

function GisResult({ result }: { result: any }) {
  const gis = result.gisAnalysis || {};
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Bản đồ/GIS</h4>
      <p className="text-sm text-slate-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3">{gis.mapBrief}</p>
      <ResultList title="Lớp dữ liệu" items={gis.layers} />
      <ResultList title="Quy trình thao tác" items={gis.workflow} ordered />
      <ResultList title="Câu hỏi khai thác bản đồ" items={gis.inquiryQuestions} />
      <ResultList title="Nguồn dữ liệu gợi ý" items={gis.dataSources} />
      <ResultList title="Lưu ý kiểm chứng" items={gis.cautions} />
    </div>
  );
}

function GeoChartResult({ result }: { result: any }) {
  const chart = result.geographyAnalysis?.chartGuide || {};
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Biểu đồ Địa lí</h4>
      <p className="text-sm font-bold text-sky-700 bg-sky-50 border border-sky-100 rounded-lg p-3">Loại biểu đồ phù hợp: {chart.chartType}</p>
      <DataTable table={chart.dataTable} />
      <ResultList title="Bước vẽ/đọc biểu đồ" items={chart.drawingSteps} ordered />
      <ResultList title="Câu hỏi nhận xét" items={chart.interpretationQuestions} />
      <ResultList title="Lỗi thường gặp" items={chart.commonMistakes} />
    </div>
  );
}

function GeoTableResult({ result }: { result: any }) {
  const table = result.geographyAnalysis?.dataTableGuide || {};
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Bảng số liệu Địa lí</h4>
      <DataTable table={{ headers: table.headers, rows: table.rows, caption: table.tableTitle }} />
      <ResultList title="Bước xử lí số liệu" items={table.processingSteps} ordered />
      <ResultList title="Phép tính chính" items={table.keyCalculations} />
      <ResultList title="Nhận xét xu hướng" items={table.comments} />
      <ResultList title="Câu hỏi khai thác" items={table.questions} />
    </div>
  );
}

function GeoFormulaResult({ result }: { result: any }) {
  const formulaGuide = result.geographyAnalysis?.formulaGuide || {};
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Công thức Địa lí</h4>
      {asList(formulaGuide.formulas).map((formula: any, index: number) => (
        <div key={index} className="border border-orange-100 bg-orange-50 rounded-lg p-4">
          <p className="font-black text-orange-800">{formula.name}</p>
          <p className="text-lg font-black text-slate-900 mt-1">{formula.expression}</p>
          <p className="text-xs text-slate-600 mt-2"><span className="font-bold">Biến số:</span> {formula.variables}</p>
          <p className="text-xs text-slate-600"><span className="font-bold">Khi dùng:</span> {formula.whenToUse}</p>
          <p className="text-xs text-slate-600"><span className="font-bold">Ví dụ:</span> {formula.example}</p>
        </div>
      ))}
      <ResultList title="Bài tập luyện tập" items={formulaGuide.practiceTasks} />
    </div>
  );
}

function ExamResult({ result }: { result: any }) {
  const exam = result.exam || {};
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Đề kiểm tra</h4>
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700"><tr><th className="p-3 text-left">Năng lực/chủ đề</th><th className="p-3 text-left">Mức độ</th><th className="p-3 text-left">Số câu</th><th className="p-3 text-left">Điểm</th></tr></thead>
          <tbody>{asList(exam.matrix).map((row: any, index: number) => <tr key={index} className="border-t border-slate-100"><td className="p-3 font-semibold">{row.competency}</td><td className="p-3">{row.level}</td><td className="p-3">{row.questionCount}</td><td className="p-3">{row.score}</td></tr>)}</tbody>
        </table>
      </div>
      <QuizResult result={{ quiz: { questions: asList(exam.multipleChoice).map((q: any) => ({ ...q, level: "Trắc nghiệm", sourceHint: "" })) } }} />
      <ResultList title="Đáp án tổng hợp" items={exam.answerKey} />
    </div>
  );
}

function DataTable({ table }: { table: any }) {
  const headers = asList(table?.headers);
  const rows = asList(table?.rows);
  if (!headers.length || !rows.length) return null;
  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      {table?.caption && <p className="p-3 text-sm font-black text-slate-700 bg-slate-50 border-b border-slate-200">{table.caption}</p>}
      <table className="w-full text-sm">
        <thead className="bg-slate-100">{<tr>{headers.map((header: string, index: number) => <th key={index} className="p-3 text-left font-bold text-slate-700">{header}</th>)}</tr>}</thead>
        <tbody>{rows.map((row: string[], index: number) => <tr key={index} className="border-t border-slate-100">{asList(row).map((cell: string, cellIndex: number) => <td key={cellIndex} className="p-3 text-slate-700">{cell}</td>)}</tr>)}</tbody>
      </table>
      {table?.source && <p className="p-2 text-xs italic text-slate-500 bg-slate-50 border-t border-slate-200">Nguồn: {table.source}</p>}
    </div>
  );
}

function ResultList({ title, items, ordered }: { title: string; items: any[]; ordered?: boolean }) {
  const values = asList(items);
  const ListTag = ordered ? "ol" : "ul";
  return (
    <div>
      <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2">{title}</p>
      <ListTag className={`${ordered ? "list-decimal" : "list-disc"} pl-5 text-sm text-slate-700 space-y-1`}>
        {values.map((item: string, index: number) => <li key={index}>{item}</li>)}
      </ListTag>
    </div>
  );
}
