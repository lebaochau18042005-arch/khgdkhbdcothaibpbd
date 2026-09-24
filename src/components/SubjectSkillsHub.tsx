import React, { useMemo, useState } from "react";
import {
  BrainCircuit,
  BookOpen,
  Sparkles,
  FileQuestion,
  FileText,
  Presentation,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  UploadCloud,
  Layers,
  Search,
  ExternalLink,
  ShieldCheck,
  Zap,
  HelpCircle,
  Laptop,
  Check,
  RefreshCw,
  FolderPlus,
  ArrowRight
} from "lucide-react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from "docx";
import { saveAs } from "file-saver";
import { 
  generateUniversalSubjectSkill, 
  UniversalSubjectSkillKind, 
  UniversalSubjectSkillInput 
} from "../services/geminiService";
import { getCurriculumBySubjectAndGrade } from "../data/curriculumDb";
import { NLS_INDICATORS_DB } from "../data/nlsIndicatorsDb";
import { AI_REQUIREMENTS_2422_DB } from "../data/aiRequirements2422Db";
import { SUBJECT_PROMPT_TEMPLATES, getPromptTemplatesBySubject } from "../data/subjectPromptTemplates";
import { CurriculumIngestionModal } from "./CurriculumIngestionModal";
import { NguVanMasterStudio } from "./NguVanMasterStudio";

interface Props {
  apiKey: string;
  aiModel: string;
  isOnline?: boolean;
  onOpenUpgradePlan: () => void;
  onRequestSettings: () => void;
}

const SUBJECTS_LIST = [
  "Toán học", "Tin học", "Vật lí", "Hóa học", "Sinh học", 
  "Ngữ văn", "Lịch sử", "Địa lí", "Giáo dục kinh tế và pháp luật", 
  "Tiếng Anh", "Công nghệ"
];

const GRADES = ["10", "11", "12"] as const;

type CategoryFilter = "all" | "stem" | "humanities" | "languages";

interface SkillCardItem {
  id: UniversalSubjectSkillKind;
  title: string;
  desc: string;
  icon: React.ReactNode;
  badge: string;
  color: string;
}

const SKILL_CARDS: SkillCardItem[] = [
  {
    id: "nls-ai-prompt",
    title: "Câu lệnh Prompt Tích hợp NLS - NL AI",
    desc: "Sinh prompt chuẩn cho học sinh thực hiện nhiệm vụ số trong Bước 2 (CV 5512), kèm rubric và checklist kiểm chứng.",
    icon: <BrainCircuit className="w-5 h-5" />,
    badge: "Trọng tâm 2026",
    color: "from-indigo-600 to-blue-600"
  },
  {
    id: "subject-quiz",
    title: "Quiz Tương tác Đa môn",
    desc: "Bộ câu hỏi trắc nghiệm khách quan 4 lựa chọn, có đáp án chi tiết, giải thích bản chất và gợi ý nguồn SGK.",
    icon: <FileQuestion className="w-5 h-5" />,
    badge: "Kiểm tra nhanh",
    color: "from-blue-600 to-cyan-600"
  },
  {
    id: "subject-slides",
    title: "Dàn Slide Trình chiếu PPTX",
    desc: "Dàn bài giảng điện tử từng slide: đề mục, gạch đầu dòng, ghi chú người thuyết trình và hoạt động tương tác lớp học.",
    icon: <Presentation className="w-5 h-5" />,
    badge: "Bài giảng số",
    color: "from-purple-600 to-indigo-600"
  },
  {
    id: "subject-exam",
    title: "Đề Kiểm tra Ma trận Phân hóa",
    desc: "Ma trận đề chuẩn 4 mức độ (Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao), câu hỏi trắc nghiệm, đúng/sai và tự luận.",
    icon: <FileText className="w-5 h-5" />,
    badge: "Chuẩn BGDĐT",
    color: "from-emerald-600 to-teal-600"
  },
  {
    id: "stem-simulation",
    title: "Mô phỏng & Thí nghiệm ảo",
    desc: "Kịch bản mô hình hóa toán học, phần mềm thí nghiệm ảo (PhET), GeoGebra, Python hoặc mô phỏng kỹ thuật.",
    icon: <Laptop className="w-5 h-5" />,
    badge: "STEM / Lab",
    color: "from-amber-600 to-orange-600"
  },
  {
    id: "fact-check-rubric",
    title: "Kiểm chứng Sự thật & Chống Ảo giác AI",
    desc: "Bộ tiêu chí và bảng kiểm tra (Checklist) phát hiện lỗi sai logic, sai số liệu hoặc thiên kiến của trí tuệ nhân tạo.",
    icon: <ShieldCheck className="w-5 h-5" />,
    badge: "Fact-Check Gate",
    color: "from-rose-600 to-pink-600"
  }
];

export default function SubjectSkillsHub({
  apiKey,
  aiModel,
  isOnline = true,
  onOpenUpgradePlan,
  onRequestSettings
}: Props) {
  const [selectedSubject, setSelectedSubject] = useState<string>("Toán học");
  const [selectedGrade, setSelectedGrade] = useState<"10" | "11" | "12">("10");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [selectedSkill, setSelectedSkill] = useState<UniversalSubjectSkillKind>("nls-ai-prompt");
  const [topic, setTopic] = useState<string>("");
  const [lessonGoal, setLessonGoal] = useState<string>("");
  const [selectedNlsCode, setSelectedNlsCode] = useState<string>("1.2.NCa");
  const [selectedAiCode, setSelectedAiCode] = useState<string>("10.C3.2");
  const [questionCount, setQuestionCount] = useState<number>(8);
  const [sourceText, setSourceText] = useState<string>("");

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedResult, setGeneratedResult] = useState<any | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [showIngestionModal, setShowIngestionModal] = useState<boolean>(false);
  const [showNguVanStudio, setShowNguVanStudio] = useState<boolean>(false);

  // Lấy danh sách bài học có sẵn theo môn và khối lớp
  const lessonsFromDb = useMemo(() => {
    return getCurriculumBySubjectAndGrade(selectedSubject, selectedGrade);
  }, [selectedSubject, selectedGrade]);

  // Tự động gán bài học đầu tiên nếu chưa chọn
  React.useEffect(() => {
    if (lessonsFromDb.length > 0) {
      const first = lessonsFromDb[0];
      setTopic(first.lesson || first.topic || "");
      setLessonGoal(first.yccd || first.lessonGoal || "");
      if (first.nlsCode) setSelectedNlsCode(first.nlsCode);
      if (first.aiCode) setSelectedAiCode(first.aiCode);
    }
  }, [lessonsFromDb]);

  // Mẫu câu lệnh tham khảo theo môn học
  const matchingTemplates = useMemo(() => {
    return getPromptTemplatesBySubject(selectedSubject);
  }, [selectedSubject]);

  // Danh mục mã NLS mức NC
  const nlsNcIndicators = useMemo(() => {
    return NLS_INDICATORS_DB.filter(i => i.level === "NC" && i.isActive);
  }, []);

  // Danh mục mã AI theo lớp đã chọn
  const aiRequirementsForGrade = useMemo(() => {
    return AI_REQUIREMENTS_2422_DB.filter(i => i.grade === selectedGrade && i.isActive);
  }, [selectedGrade]);

  const handleSelectLesson = (lessonItem: any) => {
    setTopic(lessonItem.lesson || lessonItem.topic || "");
    setLessonGoal(lessonItem.yccd || lessonItem.lessonGoal || "");
    if (lessonItem.nlsCode) setSelectedNlsCode(lessonItem.nlsCode);
    if (lessonItem.aiCode) setSelectedAiCode(lessonItem.aiCode);
  };

  const handleApplyTemplate = (tmpl: any) => {
    setTopic(tmpl.title);
    setLessonGoal(tmpl.description);
    setSelectedNlsCode(tmpl.nlsCode);
    setSelectedAiCode(tmpl.aiCode);
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      onRequestSettings();
      return;
    }
    if (!topic.trim()) {
      setErrorText("Vui lòng nhập hoặc chọn Tên bài học / Chủ đề.");
      return;
    }

    setIsGenerating(true);
    setErrorText(null);
    setGeneratedResult(null);

    try {
      const input: UniversalSubjectSkillInput = {
        kind: selectedSkill,
        subject: selectedSubject,
        grade: selectedGrade,
        topic,
        lessonGoal,
        nlsCode: selectedNlsCode,
        aiCode: selectedAiCode,
        questionCount,
        sourceText
      };

      const result = await generateUniversalSubjectSkill(input);
      setGeneratedResult(result);
    } catch (err: any) {
      console.error("Lỗi sinh kỹ năng sư phạm", err);
      setErrorText(err.message || "Đã xảy ra lỗi khi gọi AI. Vui lòng thử lại.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleExportDocx = async () => {
    if (!generatedResult) return;
    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: generatedResult.title || `KẾT QUẢ KỸ NĂNG SƯ PHẠM MÔN ${selectedSubject.toUpperCase()}`,
              heading: HeadingLevel.HEADING_1
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `Môn học: ${selectedSubject} | Lớp: ${selectedGrade} | Bài: ${topic}\n`, bold: true }),
                new TextRun({ text: `Khung NLS: ${selectedNlsCode} | Khung AI (QĐ 2422): ${selectedAiCode}\n\n` })
              ]
            }),
            new Paragraph({
              text: "I. TỔNG QUAN VÀ MỤC TIÊU SƯ PHẠM",
              heading: HeadingLevel.HEADING_2
            }),
            new Paragraph({ text: generatedResult.overview || "" }),
            
            ...(generatedResult.studentPromptScaffold ? [
              new Paragraph({
                text: "II. CÂU LỆNH PROMPT TÍCH HỢP NLS & NL AI DÀNH CHO HỌC SINH (BƯỚC 2 CV 5512)",
                heading: HeadingLevel.HEADING_2
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Vai trò/Ngữ cảnh: ", bold: true }),
                  new TextRun({ text: generatedResult.studentPromptScaffold.rolePersona + "\n" }),
                  new TextRun({ text: "Nhiệm vụ học sinh: ", bold: true }),
                  new TextRun({ text: generatedResult.studentPromptScaffold.studentTaskStep + "\n\n" }),
                  new TextRun({ text: "CÂU LỆNH PROMPT MẪU (TÔ MÀU ĐỎ):\n", bold: true, color: "FF0000" }),
                  new TextRun({ text: generatedResult.studentPromptScaffold.exactPromptText + "\n\n", color: "FF0000" }),
                  new TextRun({ text: "Sản phẩm kỳ vọng: ", bold: true }),
                  new TextRun({ text: generatedResult.studentPromptScaffold.expectedOutput + "\n" }),
                  new TextRun({ text: "Phương án ngoại tuyến (Offline fallback): ", bold: true }),
                  new TextRun({ text: generatedResult.studentPromptScaffold.offlineFallback + "\n" })
                ]
              })
            ] : []),

            ...(generatedResult.quiz?.questions?.length ? [
              new Paragraph({
                text: "III. BỘ CÂU HỎI QUIZ TƯƠNG TÁC",
                heading: HeadingLevel.HEADING_2
              }),
              ...generatedResult.quiz.questions.map((q: any, i: number) => 
                new Paragraph({
                  children: [
                    new TextRun({ text: `Câu ${i + 1} (${q.level}): ${q.question}\n`, bold: true }),
                    ...(q.options || []).map((opt: string) => new TextRun({ text: `   ${opt}\n` })),
                    new TextRun({ text: `-> Đáp án: ${q.answer}\n`, bold: true, color: "008000" }),
                    new TextRun({ text: `Giải thích: ${q.explanation}\n\n` })
                  ]
                })
              )
            ] : [])
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `KyNang_${selectedSubject}_Lop${selectedGrade}_${topic.slice(0, 20)}.docx`);
    } catch (err) {
      console.error("Lỗi xuất Word", err);
      alert("Lỗi khi tạo file Word.");
    }
  };

  if (showNguVanStudio) {
    return (
      <NguVanMasterStudio
        apiKey={apiKey}
        onRequestSettings={onRequestSettings}
        onClose={() => setShowNguVanStudio(false)}
        initialGrade={selectedGrade}
        initialTopic={selectedSubject === "Ngữ văn" ? topic : undefined}
      />
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-500/20">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-xs font-bold text-indigo-300 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            BỘ CÔNG CỤ KỸ NĂNG SƯ PHẠM ĐA MÔN HỌC (UNIVERSAL SUBJECT SKILLS HUB)
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
            Thiết Kế Học Liệu & Câu Lệnh Prompt Tích Hợp NLS - NL AI
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Chuẩn hóa theo Chương trình GDPT 2018 (SGK Kết nối tri thức), Thông tư 02/2025/TT-BGDĐT (NLS mức NC) 
            và Quyết định 2422/QĐ-BGDĐT (NL AI). Tạo câu lệnh prompt có kiểm chứng chống ảo giác, quiz, slide và đề thi cho mọi môn học THPT.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button
              onClick={() => {
                setSelectedSubject("Ngữ văn");
                setShowNguVanStudio(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-lg transition-all"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              Studio Ngữ Văn Master V4.0
            </button>
            <button
              onClick={() => setShowIngestionModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all"
            >
              <FolderPlus className="w-4 h-4" />
              Nạp Thêm PPCT Môn Học (Excel)
            </button>
            <button
              onClick={onOpenUpgradePlan}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 transition-all"
            >
              <FileText className="w-4 h-4" />
              Nâng Cấp Giáo Án Word (CV 5512)
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Card: Chọn Môn và Khối Lớp */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                1. Thông số Bài học & Bộ môn
              </h3>
              <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                {lessonsFromDb.length} bài có sẵn
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Môn học</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {SUBJECTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Khối lớp (THPT)</label>
                <div className="flex gap-1.5">
                  {GRADES.map(gr => (
                    <button
                      key={gr}
                      type="button"
                      onClick={() => setSelectedGrade(gr)}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        selectedGrade === gr
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      Lớp {gr}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Callout chuyên biệt cho Ngữ văn */}
            {selectedSubject === "Ngữ văn" && (
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-purple-50 via-pink-50 to-amber-50 border border-purple-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div className="text-xs text-purple-950">
                  <strong className="text-purple-900 block font-bold text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    PROMPT MASTER NGỮ VĂN V4.0 ĐÃ SẴN SÀNG
                  </strong>
                  <span className="text-slate-600 text-[11px] mt-0.5 block">
                    Tích hợp 4 Chế độ tác vụ (PL1, Đồng bộ, KHBD 5512, Rà soát 17 tiêu chí), 9 thể loại & xuất Word chữ đỏ.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNguVanStudio(true)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:opacity-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm flex-shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Mở Studio V4.0 <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Quick Pick Lesson */}
            {lessonsFromDb.length > 0 && (
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Chọn nhanh bài học từ chương trình chuẩn:
                </label>
                <select
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    if (!isNaN(idx) && lessonsFromDb[idx]) {
                      handleSelectLesson(lessonsFromDb[idx]);
                    }
                  }}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  defaultValue=""
                >
                  <option value="" disabled>-- Chọn bài học mẫu trong CSDL ({lessonsFromDb.length} bài) --</option>
                  {lessonsFromDb.map((it, idx) => (
                    <option key={idx} value={idx}>
                      {it.lesson || it.topic} ({it.periods || 1} tiết)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Tên bài học / Chủ đề cụ thể</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="VD: Bài 10. Sự rơi tự do..."
                className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Yêu cầu cần đạt (YCCĐ) hoặc Ghi chú</label>
              <textarea
                value={lessonGoal}
                onChange={(e) => setLessonGoal(e.target.value)}
                rows={3}
                placeholder="Trích dẫn YCCĐ nguyên văn từ CT 2018 / SGK Kết nối tri thức..."
                className="w-full text-xs border border-slate-300 rounded-xl p-3 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Card: Thiết lập Tích hợp NLS & NL AI */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-indigo-600" />
              2. Chuẩn Tích Hợp NLS (TT 02) & NL AI (QĐ 2422)
            </h3>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Mã Năng lực số TT 02/2025 (Mức NC cho THPT)
              </label>
              <select
                value={selectedNlsCode}
                onChange={(e) => setSelectedNlsCode(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {nlsNcIndicators.map(ind => (
                  <option key={ind.code} value={ind.code}>
                    [{ind.code}] {ind.competencyName} - {ind.indicatorText.slice(0, 50)}...
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Mã Năng lực AI theo QĐ 2422/QĐ-BGDĐT
              </label>
              <select
                value={selectedAiCode}
                onChange={(e) => setSelectedAiCode(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {aiRequirementsForGrade.map(req => (
                  <option key={req.code} value={req.code}>
                    [{req.code} - {req.component}] {req.topicName}: {req.requirementText.slice(0, 60)}...
                  </option>
                ))}
              </select>
            </div>

            {/* Template Reference */}
            {matchingTemplates.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-indigo-600 block mb-1.5">
                  Gợi ý kịch bản mẫu cho môn {selectedSubject}:
                </span>
                <div className="space-y-1.5">
                  {matchingTemplates.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => handleApplyTemplate(tmpl)}
                      className="w-full text-left p-2 rounded-lg bg-indigo-50/50 hover:bg-indigo-100/70 border border-indigo-100 transition-colors text-[11px]"
                    >
                      <div className="font-bold text-slate-800">{tmpl.title}</div>
                      <div className="text-slate-500 text-[10px] mt-0.5 line-clamp-1">{tmpl.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Skill Selection & Action (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Skill Selector Grid */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              3. Chọn Kỹ Năng Sư Phạm Cần Tạo
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SKILL_CARDS.map((sk) => (
                <button
                  key={sk.id}
                  type="button"
                  onClick={() => setSelectedSkill(sk.id)}
                  className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                    selectedSkill === sk.id
                      ? "border-indigo-600 bg-indigo-50/30 ring-2 ring-indigo-500/20 shadow-md"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className={`p-2 rounded-xl text-white bg-gradient-to-br ${sk.color}`}>
                      {sk.icon}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                      {sk.badge}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-1">{sk.title}</h4>
                    <p className="text-[11px] text-slate-500 leading-snug">{sk.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Mô hình AI: <span className="font-semibold text-indigo-600">{aiModel || "gemini-3.5-flash"}</span>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-700 hover:to-blue-800 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isGenerating ? "Đang xử lý sư phạm..." : "Tạo Kỹ Năng Sư Phạm Ngay"}
              </button>
            </div>

            {errorText && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold">
                {errorText}
              </div>
            )}
          </div>

          {/* Results Display */}
          {generatedResult && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-300">
              
              {/* Result Header */}
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">
                    KẾT QUẢ KỸ NĂNG ({selectedSubject} - LỚP {selectedGrade})
                  </span>
                  <h4 className="text-sm font-bold text-white mt-0.5">{generatedResult.title}</h4>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportDocx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Xuất file Word (.docx)
                  </button>
                </div>
              </div>

              {/* Result Body */}
              <div className="p-5 space-y-5">
                
                {/* Overview */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
                  <span className="font-bold text-slate-900 block mb-1">Mục tiêu & Định hướng triển khai:</span>
                  {generatedResult.overview}
                </div>

                {/* Student Prompt Scaffold (Trọng tâm) */}
                {generatedResult.studentPromptScaffold && (
                  <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-900 uppercase flex items-center gap-1.5">
                        <BrainCircuit className="w-4 h-4 text-indigo-600" />
                        Câu lệnh Prompt Mẫu cho Học sinh (Tô màu đỏ theo chuẩn):
                      </span>
                      <button
                        onClick={() => handleCopyPrompt(generatedResult.studentPromptScaffold.exactPromptText)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-200 shadow-sm"
                      >
                        {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedPrompt ? "Đã chép" : "Sao chép Prompt"}
                      </button>
                    </div>

                    {/* Exact Prompt Box with red font */}
                    <div className="p-4 bg-white rounded-xl border border-red-200 font-mono text-xs text-red-600 whitespace-pre-wrap leading-relaxed shadow-inner">
                      {generatedResult.studentPromptScaffold.exactPromptText}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <span className="font-bold text-slate-800 block mb-1">Nhiệm vụ học sinh thực hiện:</span>
                        <p className="text-slate-600 text-[11px]">{generatedResult.studentPromptScaffold.studentTaskStep}</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <span className="font-bold text-slate-800 block mb-1">Sản phẩm kỳ vọng:</span>
                        <p className="text-slate-600 text-[11px]">{generatedResult.studentPromptScaffold.expectedOutput}</p>
                      </div>
                    </div>

                    {/* Fact Check & Rubric */}
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs">
                      <span className="font-bold text-emerald-900 block mb-1">Checklist Kiểm chứng Fact-Check (Chống ảo giác AI):</span>
                      <ul className="list-disc list-inside space-y-0.5 text-emerald-800 text-[11px]">
                        {(generatedResult.studentPromptScaffold.verificationChecklist || []).map((chk: string, i: number) => (
                          <li key={i}>{chk}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Offline Fallback */}
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs">
                      <span className="font-bold text-amber-900 block mb-1">Phương án ngoại tuyến (Offline Fallback):</span>
                      <p className="text-amber-800 text-[11px]">{generatedResult.studentPromptScaffold.offlineFallback}</p>
                    </div>
                  </div>
                )}

                {/* Quiz Result Preview */}
                {generatedResult.quiz?.questions?.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-800 uppercase block">
                      Bộ câu hỏi Quiz ({generatedResult.quiz.questions.length} câu):
                    </span>
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {generatedResult.quiz.questions.map((q: any, i: number) => (
                        <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                          <div className="font-bold text-slate-800">
                            Câu {i + 1} ({q.level}): {q.question}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                            {(q.options || []).map((opt: string, oi: number) => (
                              <div key={oi} className="text-slate-600 bg-white p-1.5 rounded border border-slate-100">
                                {opt}
                              </div>
                            ))}
                          </div>
                          <div className="text-[11px] font-bold text-emerald-700">
                            Đáp án: {q.answer}
                          </div>
                          <p className="text-[10px] text-slate-500 italic">Giải thích: {q.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

            </div>
          )}

        </div>

      </div>

      {/* Curriculum Ingestion Modal */}
      <CurriculumIngestionModal
        isOpen={showIngestionModal}
        onClose={() => setShowIngestionModal(false)}
        onCurriculumUpdated={() => {
          // Force refresh
          setSelectedSubject((prev) => prev);
        }}
      />

    </div>
  );
}
