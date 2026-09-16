/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NguVanMasterStudio.tsx
 * Giao diện chuyên sâu PROMPT MASTER NGỮ VĂN V4.0 (NGU_VAN_NLS_AI_MASTER_V4)
 * Dành riêng cho giáo viên Ngữ văn THPT (Lớp 10, 11, 12) - Năm học 2026 - 2027
 * Tuân thủ:
 * - TT 02/2025/TT-BGDĐT (Mức NC) & CV 3456/BGDĐT-GDPT
 * - QĐ 2422/QĐ-BGDĐT & CV 5588/BGDĐT-GDPT
 * - CV 5512/BGDĐT-GDTrH (4 hoạt động x 4 bước)
 * - TT 22/2021/TT-BGDĐT (Đánh giá học sinh)
 * - Màu chữ tích hợp: ĐỎ (#FF0000)
 */

import React, { useState, useMemo } from "react";
import {
  BookOpen,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Copy,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Zap,
  Bookmark,
  ChevronRight,
  ExternalLink,
  Table as TableIcon,
  FileSpreadsheet,
  Check,
  ArrowRight,
  Info,
  X
} from "lucide-react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from "docx";
import { saveAs } from "file-saver";
import {
  NguVanTaskMode,
  NguVanLessonType,
  NGU_VAN_LESSON_TYPES_META,
  NguVanMasterV4Result,
  NguVan8Components
} from "../data/nguVanMasterV4";
import { executeNguVanMasterV4, NguVanMasterV4Input } from "../services/geminiService";
import { getCurriculumBySubjectAndGrade } from "../data/curriculumDb";
import { NLS_INDICATORS_DB } from "../data/nlsIndicatorsDb";
import { AI_REQUIREMENTS_2422_DB } from "../data/aiRequirements2422Db";

interface Props {
  apiKey: string;
  onRequestSettings: () => void;
  onClose?: () => void;
  initialGrade?: "10" | "11" | "12";
  initialTopic?: string;
}

const TASK_MODES_CONFIG: { id: NguVanTaskMode; title: string; subtitle: string; icon: React.ReactNode; color: string }[] = [
  {
    id: "UPGRADE_KHBD",
    title: "Chế độ 3: Nâng cấp KHBD",
    subtitle: "Tích hợp 4 hoạt động x 4 bước (CV 5512), 8 thành phần M-H-C-L-S-K-T-Đ, chữ màu đỏ",
    icon: <Zap className="w-4 h-4" />,
    color: "from-amber-600 to-red-600"
  },
  {
    id: "CREATE_PL1",
    title: "Chế độ 1: Tạo Phụ lục 1",
    subtitle: "Lập bảng Kế hoạch dạy học môn học tích hợp NLS và AI theo PPCT nhà trường",
    icon: <FileSpreadsheet className="w-4 h-4" />,
    color: "from-blue-600 to-indigo-600"
  },
  {
    id: "SYNC_APPENDICES",
    title: "Chế độ 2: Đồng bộ Phụ lục",
    subtitle: "Đồng bộ đa chiều PL1 - PL3 - KHBD theo: lớp, bài, tuần, tiết, YCCĐ",
    icon: <Layers className="w-4 h-4" />,
    color: "from-purple-600 to-indigo-600"
  },
  {
    id: "AUDIT_ONLY",
    title: "Chế độ 4: Rà soát nghiêm ngặt",
    subtitle: "Kiểm định độc lập 17 tiêu chí, phát hiện Blocker/Warning mà không sửa bản gốc",
    icon: <ShieldCheck className="w-4 h-4" />,
    color: "from-emerald-600 to-teal-600"
  }
];

const TEXTBOOK_OPTIONS = [
  "Kết nối tri thức với cuộc sống (NXB Giáo dục Việt Nam)",
  "Cánh Diều (NXB Đại học Sư phạm)",
  "Chân trời sáng tạo (NXB Giáo dục Việt Nam)"
];

export const NguVanMasterStudio: React.FC<Props> = ({
  apiKey,
  onRequestSettings,
  onClose,
  initialGrade = "10",
  initialTopic = ""
}) => {
  const [taskMode, setTaskMode] = useState<NguVanTaskMode>("UPGRADE_KHBD");
  const [lessonType, setLessonType] = useState<NguVanLessonType>("READ_LITERARY");
  const [grade, setGrade] = useState<"10" | "11" | "12">(initialGrade);
  const [topic, setTopic] = useState<string>(initialTopic);
  const [period, setPeriod] = useState<string>("Tiết 1, 2");
  const [yccd, setYccd] = useState<string>("");
  const [textbook, setTextbook] = useState<string>(TEXTBOOK_OPTIONS[0]);
  const [existingContent, setExistingContent] = useState<string>("");
  const [selectedNlsCode, setSelectedNlsCode] = useState<string>("1.2.NCa");
  const [selectedAiCode, setSelectedAiCode] = useState<string>("10.A1.1");

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<NguVanMasterV4Result | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [activeOutputTab, setActiveOutputTab] = useState<"OUTPUT_1" | "OUTPUT_2" | "OUTPUT_3" | "OUTPUT_4" | "OUTPUT_5">("OUTPUT_1");
  const [copied, setCopied] = useState<boolean>(false);

  // Danh mục bài học Ngữ văn từ DB
  const nguVanLessons = useMemo(() => {
    return getCurriculumBySubjectAndGrade("Ngữ văn", grade);
  }, [grade]);

  // Cập nhật khi đổi bài hoặc khối lớp
  React.useEffect(() => {
    if (nguVanLessons.length > 0 && !topic) {
      const first = nguVanLessons[0];
      setTopic(first.lesson || first.topic || "");
      setPeriod(first.order || first.periodRange || "Tiết 1, 2");
      setYccd(first.yccd || first.lessonGoal || "");
      if (first.nlsCode) setSelectedNlsCode(first.nlsCode);
      if (first.aiCode) setSelectedAiCode(first.aiCode);
    }
  }, [nguVanLessons, topic]);

  // Danh mục mã NLS mức NC
  const nlsNcIndicators = useMemo(() => {
    return NLS_INDICATORS_DB.filter(i => i.level === "NC" && i.isActive);
  }, []);

  // Danh mục mã AI theo khối lớp
  const aiRequirements = useMemo(() => {
    return AI_REQUIREMENTS_2422_DB.filter(i => i.grade === grade && i.isActive);
  }, [grade]);

  const currentLessonMeta = NGU_VAN_LESSON_TYPES_META[lessonType];

  const handleSelectLessonFromDb = (item: any) => {
    setTopic(item.lesson || item.topic || "");
    setPeriod(item.order || item.periodRange || "Tiết 1, 2");
    setYccd(item.yccd || item.lessonGoal || "");
    if (item.nlsCode) setSelectedNlsCode(item.nlsCode);
    if (item.aiCode) setSelectedAiCode(item.aiCode);
  };

  const handleExecute = async () => {
    if (!apiKey) {
      onRequestSettings();
      return;
    }
    if (!topic.trim()) {
      setErrorText("Vui lòng nhập hoặc chọn Tên bài học / Chủ đề Ngữ văn.");
      return;
    }
    if (!yccd.trim()) {
      setErrorText("Vui lòng nhập Yêu cầu cần đạt (YCCĐ) của bài học.");
      return;
    }

    setIsProcessing(true);
    setErrorText(null);
    setResult(null);

    try {
      const input: NguVanMasterV4Input = {
        taskMode,
        lessonType,
        grade,
        topic,
        period,
        yccd,
        textbook,
        existingContent: existingContent.trim() || undefined,
        nlsCode: selectedNlsCode,
        aiCode: selectedAiCode
      };

      const res = await executeNguVanMasterV4(input);
      setResult(res);
      setActiveOutputTab("OUTPUT_1");
    } catch (err: any) {
      console.error("Lỗi thực thi Ngữ Văn Master V4.0", err);
      setErrorText(err.message || "Đã xảy ra lỗi khi gọi AI. Vui lòng kiểm tra API key.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyDocument = () => {
    if (!result) return;
    const docText = `${result.output1_document.title}\n\n${result.output1_document.overview}\n\n` +
      result.output1_document.sections.map(s => `${s.heading}\n- Nội dung gốc:\n${s.originalContent}\n\n- Tích hợp NLS/AI (Màu đỏ):\n${s.integratedContentRed}`).join("\n\n");
    navigator.clipboard.writeText(docText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Xuất file Word (.docx) chuẩn BGDĐT với phần tích hợp chữ đỏ (#FF0000)
  const handleExportDocx = async () => {
    if (!result) return;

    try {
      const docChildren: any[] = [
        new Paragraph({
          text: "BỘ GIÁO DỤC VÀ ĐÀO TẠO - CHƯƠNG TRÌNH GDPT 2018",
          alignment: "center",
          spacing: { after: 100 }
        }),
        new Paragraph({
          text: `KẾ HOẠCH BÀI DẠY NGỮ VĂN LỚP ${result.grade} (CHUẨN CV 5512)`,
          heading: HeadingLevel.HEADING_1,
          alignment: "center",
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Tên bài dạy: ", bold: true }),
            new TextRun({ text: result.topic, bold: true, color: "1E3A8A" })
          ],
          spacing: { after: 100 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Thể loại bài học: ", bold: true }),
            new TextRun({ text: `${currentLessonMeta.vietnameseTitle} | Bộ sách: ${result.textbook}` })
          ],
          spacing: { after: 100 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Thời lượng: ", bold: true }),
            new TextRun({ text: `${result.period} | Tích hợp: TT 02/2025/TT-BGDĐT & QĐ 2422/QĐ-BGDĐT` })
          ],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Yêu cầu cần đạt (YCCĐ): ", bold: true }),
            new TextRun({ text: result.yccd })
          ],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "GHI CHÚ ĐỊNH DẠNG: ", bold: true, color: "FF0000" }),
            new TextRun({ text: "Toàn bộ nội dung tích hợp Năng lực số và Trí tuệ nhân tạo bổ sung được hiển thị bằng CHỮ MÀU ĐỎ theo đúng quy định kiểm định PROMPT MASTER V4.0.", color: "FF0000", italics: true })
          ],
          spacing: { after: 300 }
        })
      ];

      // Các mục nội dung bài học
      result.output1_document.sections.forEach((sec, idx) => {
        docChildren.push(
          new Paragraph({
            text: sec.heading,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "a. Nội dung chuyên môn gốc: ", bold: true }),
              new TextRun({ text: sec.originalContent })
            ],
            spacing: { after: 120 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "b. Tích hợp Năng lực số & AI (Bổ sung mới): ", bold: true, color: "FF0000" }),
              new TextRun({ text: sec.integratedContentRed, bold: true, color: "FF0000" })
            ],
            spacing: { after: 200 }
          })
        );

        if (sec.eightComponents) {
          const comp = sec.eightComponents;
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "* Chi tiết chuẩn tích hợp 8 thành phần (M-H-C-L-S-K-T-Đ):",
                  italics: true,
                  color: "1E40AF"
                })
              ],
              spacing: { after: 80 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "• [M - Mã]: ", bold: true }), new TextRun({ text: `${comp.codeM} ` }),
                new TextRun({ text: "• [H - Hành vi]: ", bold: true }), new TextRun({ text: `${comp.actionH} ` }),
                new TextRun({ text: "• [C - Công cụ]: ", bold: true }), new TextRun({ text: `${comp.toolC} ` })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "• [L - Lệnh AI]: ", bold: true }), new TextRun({ text: `${comp.promptL} ` }),
                new TextRun({ text: "• [S - Sản phẩm]: ", bold: true }), new TextRun({ text: `${comp.productS} ` })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "• [K - Kiểm chứng]: ", bold: true }), new TextRun({ text: `${comp.verificationK} ` }),
                new TextRun({ text: "• [T - Tiêu chí]: ", bold: true }), new TextRun({ text: `${comp.criteriaT} ` }),
                new TextRun({ text: "• [Đ - Đánh giá]: ", bold: true }), new TextRun({ text: `${comp.evaluationD}` })
              ],
              spacing: { after: 200 }
            })
          );
        }
      });

      // Bảng đối chiếu mã OUTPUT_2
      if (result.output2_alignmentTable.length > 0) {
        docChildren.push(
          new Paragraph({
            text: "BẢNG ĐỐI CHIẾU MÃ NĂNG LỰC SỐ & AI (OUTPUT_2)",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 }
          })
        );

        const tableRows: TableRow[] = [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Hoạt động", bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Mã NLS", bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Mã AI", bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Hành vi học sinh", bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Sản phẩm", bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Trạng thái", bold: true })] })] })
            ]
          })
        ];

        result.output2_alignmentTable.forEach(row => {
          tableRows.push(
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(row.activity)] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.nlsCode, color: "0284C7", bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.aiCode, color: "7C3AED", bold: true })] })] }),
                new TableCell({ children: [new Paragraph(row.studentAction)] }),
                new TableCell({ children: [new Paragraph(row.product)] }),
                new TableCell({ children: [new Paragraph(row.status)] })
              ]
            })
          );
        });

        docChildren.push(new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
      }

      // Báo cáo kiểm định OUTPUT_3
      docChildren.push(
        new Paragraph({
          text: `BÁO CÁO KIỂM ĐỊNH ĐỘC LẬP: ${result.output3_auditReport.overallStatus}`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 120 }
        }),
        new Paragraph({
          text: `Tỷ lệ đạt: ${result.output3_auditReport.passRatioText} | Lỗi nghiêm trọng (Blocker): ${result.output3_auditReport.blockerErrors.length} | Cảnh báo: ${result.output3_auditReport.warnings.length}`
        })
      );

      const doc = new Document({
        sections: [{ children: docChildren }]
      });

      const blob = await Packer.toBlob(doc);
      const fileName = `NGU_VAN_${result.grade}_${taskMode}_${result.topic.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "_")}.docx`;
      saveAs(blob, fileName);
    } catch (exportErr) {
      console.error("Lỗi xuất DOCX", exportErr);
      alert("Đã xảy ra lỗi khi tạo tệp Word (.docx). Vui lòng thử lại.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* HEADER BANNER */}
      <div className="relative rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 p-6 md:p-8 text-white shadow-2xl overflow-hidden border border-indigo-500/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-3 border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5" /> PROMPT MASTER NGỮ VĂN V4.0 (2026 - 2027)
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Studio Ngữ Văn THPT Chuyên Sâu
            </h1>
            <p className="text-slate-300 text-sm mt-2 max-w-2xl leading-relaxed">
              Tích hợp Năng lực số mức Nâng cao (<strong className="text-sky-300">TT 02/2025 NC</strong>) & Giáo dục AI (<strong className="text-purple-300">QĐ 2422</strong>) vào Kế hoạch bài dạy chuẩn <strong className="text-amber-300">CV 5512</strong>. Kiểm định độc lập bằng quy tắc mã nguồn không suy diễn ảo giác.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
              >
                <X className="w-4 h-4" /> Đóng Studio
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4 CHẾ ĐỘ TÁC VỤ (TASK_MODE) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-600" /> 1. Chọn Chế độ tác vụ chuyên môn (TASK_MODE)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TASK_MODES_CONFIG.map(cfg => {
            const isActive = taskMode === cfg.id;
            return (
              <div
                key={cfg.id}
                onClick={() => setTaskMode(cfg.id)}
                className={`p-4 rounded-xl cursor-pointer border-2 transition-all text-left flex flex-col justify-between ${
                  isActive
                    ? "border-indigo-600 bg-indigo-50/50 shadow-md ring-2 ring-indigo-600/20"
                    : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50"
                }`}
              >
                <div>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white bg-gradient-to-br ${cfg.color} mb-3 shadow`}>
                    {cfg.icon}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{cfg.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{cfg.subtitle}</p>
                </div>
                {isActive && (
                  <div className="mt-3 pt-2 border-t border-indigo-100 flex items-center gap-1 text-xs font-semibold text-indigo-700">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đang chọn
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 9 THỂ LOẠI BÀI HỌC NGỮ VĂN (LESSON_TYPE) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-600" /> 2. Phân loại Thể loại bài học (Mục VI - Master Matrix)
          </h2>
          <span className="text-xs text-slate-500 italic">Bắt buộc theo đặc thù phương pháp giảng dạy môn Văn</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(NGU_VAN_LESSON_TYPES_META) as NguVanLessonType[]).map(key => {
            const meta = NGU_VAN_LESSON_TYPES_META[key];
            const isSelected = lessonType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setLessonType(key);
                  setSelectedNlsCode(meta.defaultNlsCode);
                  setSelectedAiCode(meta.defaultAiCode);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-purple-700 text-white shadow-md shadow-purple-600/20"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                }`}
              >
                <span>{meta.title}</span>
                {isSelected && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>

        {/* HƯỚNG DẪN SƯ PHẠM RIÊNG CỦA THỂ LOẠI ĐÃ CHỌN */}
        <div className="mt-4 p-4 rounded-xl bg-purple-50/70 border border-purple-200/80 text-xs space-y-2 text-purple-950">
          <div className="font-bold text-purple-900 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-purple-700" />
            Đặc trưng thể loại: {currentLessonMeta.vietnameseTitle}
          </div>
          <p className="text-slate-700 leading-relaxed">{currentLessonMeta.description}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-purple-200/60 text-slate-600">
            <div>
              <strong className="text-purple-900">• Nhiệm vụ số phù hợp:</strong> {currentLessonMeta.suitableTasks[0]}
            </div>
            <div>
              <strong className="text-purple-900">• Sản phẩm bắt buộc:</strong> {currentLessonMeta.expectedProducts[0]}
            </div>
          </div>
          <div className="text-red-700 font-semibold pt-1">
            ⚠️ Lưu ý sư phạm & đạo đức: {currentLessonMeta.caution}
          </div>
        </div>
      </div>

      {/* FORM NHẬP THÔNG TIN BÀI HỌC */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-indigo-600" /> 3. Thông tin bài học & Nguồn đối chiếu (Source-First)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Khối lớp (THPT)</label>
            <div className="flex gap-2">
              {(["10", "11", "12"] as const).map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrade(g)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    grade === g
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                  }`}
                >
                  Lớp {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Bộ sách giáo khoa</label>
            <select
              value={textbook}
              onChange={e => setTextbook(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
            >
              {TEXTBOOK_OPTIONS.map(tb => (
                <option key={tb} value={tb}>{tb}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Số tiết / Phân phối tiết</label>
            <input
              type="text"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              placeholder="VD: Tiết 1, 2 (2 tiết)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* CHỌN BÀI HỌC CÓ SẴN TRONG CHƯƠNG TRÌNH */}
        {nguVanLessons.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Gợi ý bài học từ Chương trình Ngữ văn Lớp {grade} (Bấm chọn nhanh)
            </label>
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
              {nguVanLessons.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectLessonFromDb(item)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all text-left ${
                    topic === item.lesson
                      ? "bg-indigo-600 text-white border-indigo-600 font-semibold shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50"
                  }`}
                >
                  {item.order ? `[${item.order}] ` : ""}{item.lesson}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Tên bài học / Văn bản Ngữ văn <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="VD: Bài 1. Thần thoại và Sử thi: Héc-to từ biệt Ăng-đrô-mác"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Yêu cầu cần đạt (YCCĐ) chuyên môn <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              value={yccd}
              onChange={e => setYccd(e.target.value)}
              placeholder="VD: Nhận biết và phân tích được đặc trưng của truyện thần thoại và sử thi: không gian, thời gian, nhân vật anh hùng..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* CHỌN MÃ NLS VÀ NL AI */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-sky-800 uppercase mb-1">
              Mã Năng lực số đề xuất (TT 02/2025 Mức NC)
            </label>
            <select
              value={selectedNlsCode}
              onChange={e => setSelectedNlsCode(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-sky-300 bg-sky-50/50 text-xs font-semibold text-sky-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              {nlsNcIndicators.map(i => (
                <option key={i.code} value={i.code}>
                  [{i.code}] - {i.competencyName}: {i.description.slice(0, 65)}...
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-purple-800 uppercase mb-1">
              Mã Giáo dục AI đề xuất (QĐ 2422/QĐ-BGDĐT Lớp {grade})
            </label>
            <select
              value={selectedAiCode}
              onChange={e => setSelectedAiCode(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-purple-300 bg-purple-50/50 text-xs font-semibold text-purple-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              {aiRequirements.map(i => (
                <option key={i.code} value={i.code}>
                  [{i.code}] ({i.requirementType}) - {i.requirementText.slice(0, 70)}...
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* NỘI DUNG GỐC ĐỂ NÂNG CẤP / ĐỒNG BỘ */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center justify-between">
            <span>Dán nội dung Giáo án gốc / Phụ lục gốc (Tùy chọn nếu muốn nâng cấp từ bản cũ)</span>
            <span className="text-slate-400 font-normal lowercase">Hệ thống sẽ giữ nguyên chuyên môn và chèn phần tích hợp chữ đỏ</span>
          </label>
          <textarea
            rows={3}
            value={existingContent}
            onChange={e => setExistingContent(e.target.value)}
            placeholder="Dán nội dung KHBD hoặc bảng phụ lục hiện có của nhà trường tại đây..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {/* BẢNG CHUẨN TÍCH HỢP 8 THÀNH PHẦN (PREVIEW) */}
        <div className="p-4 rounded-xl bg-slate-900 text-white text-xs space-y-2">
          <div className="font-bold text-amber-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Chuẩn tích hợp 8 thành phần (M - H - C - L - S - K - T - Đ) bắt buộc trong kết quả:
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-slate-300">
            <div><strong className="text-white">M (Mã):</strong> Mã NLS & AI hợp lệ</div>
            <div><strong className="text-white">H (Hành vi):</strong> Thao tác số của HS</div>
            <div><strong className="text-white">C (Công cụ):</strong> Ứng dụng số / AI</div>
            <div><strong className="text-white">L (Lệnh prompt):</strong> Câu lệnh AI cụ thể</div>
            <div><strong className="text-white">S (Sản phẩm):</strong> Kết quả học tập số</div>
            <div><strong className="text-white">K (Kiểm chứng):</strong> Đối chiếu với SGK gốc</div>
            <div><strong className="text-white">T (Tiêu chí):</strong> Rubric đánh giá GV</div>
            <div><strong className="text-white">Đ (Đánh giá):</strong> Nhận xét & phản hồi</div>
          </div>
        </div>

        {errorText && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{errorText}</span>
          </div>
        )}

        {/* NÚT THỰC THI */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            Hệ thống áp dụng chính sách <strong>Source-First</strong> và kiểm định nghiêm ngặt <strong>Fail-Closed</strong>.
          </div>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleExecute}
            className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
              isProcessing
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-95 shadow-indigo-500/25 active:scale-95"
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Đang thực thi Master Prompt V4.0...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Thực thi {TASK_MODES_CONFIG.find(m => m.id === taskMode)?.title}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KẾT QUẢ VÀ 5 TAB ĐẦU RA CHUẨN */}
      {result && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          {/* THANH ĐIỀU HƯỚNG 5 TAB OUTPUT */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Kết quả hoàn tất</div>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                {result.output1_document.title}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyDocument}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? "Đã chép" : "Sao chép"}</span>
              </button>
              <button
                type="button"
                onClick={handleExportDocx}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Tải Word (.docx) chữ đỏ</span>
              </button>
            </div>
          </div>

          {/* TAB BUTTONS */}
          <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveOutputTab("OUTPUT_1")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeOutputTab === "OUTPUT_1"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              OUTPUT_1: Tài liệu hoàn chỉnh (Chữ đỏ)
            </button>
            <button
              type="button"
              onClick={() => setActiveOutputTab("OUTPUT_2")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeOutputTab === "OUTPUT_2"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              OUTPUT_2: Bảng đối chiếu mã ({result.output2_alignmentTable.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveOutputTab("OUTPUT_3")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeOutputTab === "OUTPUT_3"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>OUTPUT_3: Báo cáo kiểm định</span>
              <span className={`w-2 h-2 rounded-full ${
                result.output3_auditReport.overallStatus === "VALIDATED"
                  ? "bg-emerald-500"
                  : result.output3_auditReport.overallStatus === "NEEDS_REVIEW"
                  ? "bg-amber-500"
                  : "bg-red-500"
              }`} />
            </button>
            <button
              type="button"
              onClick={() => setActiveOutputTab("OUTPUT_4")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeOutputTab === "OUTPUT_4"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              OUTPUT_4: Nhật ký chỉnh sửa ({result.output4_editLog.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveOutputTab("OUTPUT_5")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeOutputTab === "OUTPUT_5"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              OUTPUT_5: Chờ duyệt ({result.output5_pendingItems.length})
            </button>
          </div>

          {/* TAB 1: OUTPUT_1 - TÀI LIỆU HOÀN CHỈNH */}
          {activeOutputTab === "OUTPUT_1" && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs font-bold text-slate-500 uppercase">Tổng quan sư phạm</div>
                <p className="text-sm text-slate-700 mt-1 leading-relaxed">{result.output1_document.overview}</p>
              </div>

              <div className="space-y-4">
                {result.output1_document.sections.map((sec, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                    <div className="bg-slate-100 px-4 py-2.5 font-bold text-sm text-slate-900 border-b border-slate-200 flex items-center justify-between">
                      <span>{sec.heading}</span>
                      <span className="text-xs font-normal text-slate-500">Chuẩn 5512</span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <div className="text-xs font-bold text-slate-600 uppercase mb-1">Nội dung chuyên môn:</div>
                        <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">{sec.originalContent}</p>
                      </div>

                      {/* PHẦN TÍCH HỢP CHỮ ĐỎ BẮT BUỘC */}
                      <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200">
                        <div className="text-xs font-bold text-red-700 uppercase mb-1 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" /> Tích hợp Năng lực số & AI (Bổ sung mới - Chữ màu đỏ):
                        </div>
                        <p className="text-sm font-semibold text-red-600 whitespace-pre-line leading-relaxed">
                          {sec.integratedContentRed}
                        </p>
                      </div>

                      {/* 8 THÀNH PHẦN CHI TIẾT */}
                      {sec.eightComponents && (
                        <div className="mt-3 pt-3 border-t border-slate-100 bg-indigo-50/40 p-3 rounded-lg text-xs space-y-1.5 text-indigo-950">
                          <div className="font-bold text-indigo-900">Chi tiết 8 thành phần M-H-C-L-S-K-T-Đ:</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div><strong>[Mã - M]:</strong> {sec.eightComponents.codeM}</div>
                            <div><strong>[Hành vi - H]:</strong> {sec.eightComponents.actionH}</div>
                            <div><strong>[Công cụ - C]:</strong> {sec.eightComponents.toolC}</div>
                            <div><strong>[Lệnh Prompt - L]:</strong> {sec.eightComponents.promptL}</div>
                            <div><strong>[Sản phẩm - S]:</strong> {sec.eightComponents.productS}</div>
                            <div><strong>[Kiểm chứng - K]:</strong> {sec.eightComponents.verificationK}</div>
                            <div><strong>[Tiêu chí - T]:</strong> {sec.eightComponents.criteriaT}</div>
                            <div><strong>[Đánh giá - Đ]:</strong> {sec.eightComponents.evaluationD}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: OUTPUT_2 - BẢNG ĐỐI CHIẾU MÃ */}
          {activeOutputTab === "OUTPUT_2" && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Hoạt động</th>
                    <th className="p-2.5">Mã NLS (TT 02)</th>
                    <th className="p-2.5">Mã AI (QĐ 2422)</th>
                    <th className="p-2.5">Hành vi số HS</th>
                    <th className="p-2.5">Sản phẩm yêu cầu</th>
                    <th className="p-2.5">Minh chứng</th>
                    <th className="p-2.5">Nguồn</th>
                    <th className="p-2.5">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {result.output2_alignmentTable.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 font-semibold text-slate-900">{row.activity}</td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-bold font-mono">
                          {row.nlsCode}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold font-mono">
                          {row.aiCode}
                        </span>
                      </td>
                      <td className="p-2.5 leading-relaxed">{row.studentAction}</td>
                      <td className="p-2.5 leading-relaxed">{row.product}</td>
                      <td className="p-2.5 text-slate-500">{row.evidence}</td>
                      <td className="p-2.5 text-slate-500">{row.source}</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.status === "MATCHED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: OUTPUT_3 - BÁO CÁO KIỂM ĐỊNH ĐỘC LẬP */}
          {activeOutputTab === "OUTPUT_3" && (
            <div className="space-y-6">
              {/* THẺ TỔNG QUAN TRẠNG THÁI */}
              <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                result.output3_auditReport.overallStatus === "VALIDATED"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : result.output3_auditReport.overallStatus === "NEEDS_REVIEW"
                  ? "bg-amber-50 border-amber-200 text-amber-900"
                  : "bg-red-50 border-red-200 text-red-900"
              }`}>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-8 h-8 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider">Trạng thái kiểm định độc lập</div>
                    <div className="text-lg font-bold">
                      {result.output3_auditReport.overallStatus === "VALIDATED" && "VALIDATED - ĐÃ KIỂM ĐỊNH ĐẠT CHUẨN"}
                      {result.output3_auditReport.overallStatus === "NEEDS_REVIEW" && "NEEDS_REVIEW - CẦN GIÁO VIÊN DUYỆT LẠI"}
                      {result.output3_auditReport.overallStatus === "BLOCKER_DETECTED" && "BLOCKER_DETECTED - PHÁT HIỆN LỖI CHẶN"}
                    </div>
                  </div>
                </div>
                <div className="text-xs font-semibold bg-white/70 px-3 py-1.5 rounded-lg border border-current">
                  Tỷ lệ hợp lệ: {result.output3_auditReport.passRatioText}
                </div>
              </div>

              {/* LỖI BLOCKER */}
              {result.output3_auditReport.blockerErrors.length > 0 && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-2">
                  <h4 className="text-xs font-bold uppercase text-red-800 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    Lỗi nghiêm trọng (BLOCKER - Không đủ điều kiện xuất bản chính thức):
                  </h4>
                  <ul className="space-y-1 text-xs text-red-700">
                    {result.output3_auditReport.blockerErrors.map((err, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="font-bold">• [{err.rule}]:</span> {err.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* CẢNH BÁO WARNING */}
              {result.output3_auditReport.warnings.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                  <h4 className="text-xs font-bold uppercase text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Cảnh báo (WARNING - Cần bổ sung minh chứng):
                  </h4>
                  <ul className="space-y-1 text-xs text-amber-700">
                    {result.output3_auditReport.warnings.map((warn, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="font-bold">• [{warn.rule}]:</span> {warn.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* KHUYẾN NGHỊ SƯ PHẠM */}
              {result.output3_auditReport.recommendations.length > 0 && (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
                  <h4 className="text-xs font-bold uppercase text-blue-800 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-blue-600" />
                    Khuyến nghị chuyên môn (RECOMMENDATION):
                  </h4>
                  <ul className="space-y-1 text-xs text-blue-700">
                    {result.output3_auditReport.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="font-bold">• [{rec.rule}]:</span> {rec.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: OUTPUT_4 - NHẬT KÝ CHỈNH SỬA */}
          {activeOutputTab === "OUTPUT_4" && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Vị trí</th>
                    <th className="p-2.5">Nội dung gốc</th>
                    <th className="p-2.5">Nội dung mới bổ sung</th>
                    <th className="p-2.5">Căn cứ pháp lý</th>
                    <th className="p-2.5">Lý do điều chỉnh</th>
                    <th className="p-2.5">Duyệt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {result.output4_editLog.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 font-semibold text-slate-900">{log.location}</td>
                      <td className="p-2.5 text-slate-500">{log.originalContent}</td>
                      <td className="p-2.5 font-medium text-red-600">{log.newContent}</td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-600">{log.legalBasis}</td>
                      <td className="p-2.5">{log.reason}</td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          {log.approvalStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 5: OUTPUT_5 - DANH MỤC CHỜ DUYỆT */}
          {activeOutputTab === "OUTPUT_5" && (
            <div className="space-y-4">
              {result.output5_pendingItems.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm bg-slate-50 rounded-xl border border-slate-200">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  Không có nội dung nào bị tồn đọng. Toàn bộ kế hoạch bài dạy đã đầy đủ căn cứ và minh chứng!
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Hạng mục còn thiếu</th>
                        <th className="p-2.5">Lý do</th>
                        <th className="p-2.5">Tài liệu cần bổ sung</th>
                        <th className="p-2.5">Người có thẩm quyền xác nhận</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {result.output5_pendingItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-semibold text-amber-900">{item.missingItem}</td>
                          <td className="p-2.5">{item.reason}</td>
                          <td className="p-2.5 text-slate-600">{item.neededDocument}</td>
                          <td className="p-2.5 font-bold text-slate-700">{item.approver}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default NguVanMasterStudio;
