import React, { useState } from "react";
// @ts-ignore
import * as mammoth from "mammoth";
// @ts-ignore
import html2pdf from "html2pdf.js";
import { UploadCloud, CheckCircle2, Bot, Zap, Loader2, Sparkles, FileText, ImagePlus, X, BookOpen, AlertTriangle, Users, Download, Eye, FileDown, FileCode, Printer, ClipboardCheck, Calendar, BrainCircuit, Search, LayoutGrid, AlertCircle } from "lucide-react";
import { analyzeExistingPlan, generateDirectSnippets } from "../services/geminiService";
import { appendAssessmentDesignToDocx, injectSnippetsIntoDocx, InjectionResult, Snippet } from "../utils/docxInjector";
import { IntermediateAlignmentTable, AlignmentRow } from "./IntermediateAlignmentTable";
import { VisualAlignmentMatrix } from "./VisualAlignmentMatrix";
import { ExportGatekeeperModal } from "./ExportGatekeeperModal";
import { validateGatekeeper } from "../utils/gatekeeperValidator";
import { parseExcelFile } from "../utils/excelParser";
import { saveAs } from "file-saver";
import { formatAiCode2422, isAiCodeValid2422 } from "../data/aiRequirements2422Db";
import { isNlsCodeValid } from "../data/nlsIndicatorsDb";

interface TextbookImage {
    mimeType: string;
    data: string;
    previewUrl: string;
    name: string;
}

type UpgradeNextAction = "khbd" | "teacher-plan" | "assessment" | "council";

const sanitizePreviewHtml = (html: string) => {
    if (!html || typeof DOMParser === "undefined") return "";
    const parsed = new DOMParser().parseFromString(html, "text/html");
    parsed.querySelectorAll("script, style, iframe, object, embed, form, input, button, meta, link, base")
        .forEach((element) => element.remove());

    parsed.querySelectorAll("*").forEach((element) => {
        const inlineStyle = element.getAttribute("style") || "";
        if (/color\s*:\s*(?:#?ff0000|red|rgb\(\s*255\s*,\s*0\s*,\s*0\s*\))/i.test(inlineStyle)) {
            element.classList.add("docx-ai-red");
        }
        for (const attribute of Array.from(element.attributes)) {
            const name = attribute.name.toLowerCase();
            const value = attribute.value.trim();
            if (name.startsWith("on") || ["srcdoc", "formaction", "style"].includes(name)) {
                element.removeAttribute(attribute.name);
                continue;
            }
            if (name === "href" && !/^(https?:|mailto:|#|[/])/i.test(value)) {
                element.removeAttribute(attribute.name);
                continue;
            }
            if (name === "src" && !/^data:image[/](?:png|jpe?g|gif|webp);base64,/i.test(value)) {
                element.removeAttribute(attribute.name);
            }
        }
        if (element instanceof HTMLAnchorElement && element.target === "_blank") {
            element.rel = "noopener noreferrer";
        }
    });

    return parsed.body.innerHTML;
};
const normalizePreviewText = (value: string) =>
    (value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const markIntegratedPreviewHtml = (
    html: string,
    previewItems: InjectionResult["previewItems"] = []
) => {
    if (!html || typeof DOMParser === "undefined") return html || "";
    const redLines = previewItems
        .filter(item => item.found)
        .flatMap(item => String(item.injectedText || "").split(/\r?\n/))
        .map(normalizePreviewText)
        .filter(line => line.length >= 6 && /[a-z0-9]/.test(line));
    if (!redLines.length) return html;

    const parsed = new DOMParser().parseFromString(html, "text/html");
    parsed.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, td, th").forEach(element => {
        if ((element.matches("td, th")) && element.querySelector("p, li")) return;
        const text = normalizePreviewText(element.textContent || "");
        if (!text) return;
        const isIntegrationLabel = text.includes("tich hop nls nl ai");
        const matchesInjectedLine = redLines.some(line =>
            text === line || (text.length >= 12 && line.includes(text)) || (line.length >= 12 && text.includes(line))
        );
        if (isIntegrationLabel || matchesInjectedLine) element.classList.add("docx-ai-red");
    });
    return parsed.body.innerHTML;
};


export default function UpgradePlan({
    onUpgradeReady,
    onCreateTeacherPlan,
    onEvaluatePreservedLesson,
    onDesignPreservedAssessment,
    apiKey,
    isOnline = true
}: {
    onUpgradeReady: (data: any, nextAction?: UpgradeNextAction) => void | Promise<void>,
    onCreateTeacherPlan?: (data: any) => void,
    onEvaluatePreservedLesson?: (data: any) => Promise<any>,
    onDesignPreservedAssessment?: (data: any) => Promise<any>,
    apiKey: string,
    isOnline?: boolean
}) {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [rawText, setRawText] = useState("");
    const [pdfBase64, setPdfBase64] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [selectedIntegrations, setSelectedIntegrations] = useState<any[]>([]);
    const [selectedSocialIntegrations, setSelectedSocialIntegrations] = useState<string[]>([]);
    const [textbookImages, setTextbookImages] = useState<TextbookImage[]>([]);
    const [pl1Text, setPl1Text] = useState("");
    const [pl1FileName, setPl1FileName] = useState("");
    const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
    const [injectionResult, setInjectionResult] = useState<InjectionResult | null>(null);
    const [readyBlob, setReadyBlob] = useState<Blob | null>(null);
    const [fullPreviewText, setFullPreviewText] = useState("");
    const [fullPreviewHtml, setFullPreviewHtml] = useState("");
    const [previewHtmlWarning, setPreviewHtmlWarning] = useState("");
    const [assessmentPreview, setAssessmentPreview] = useState<string[]>([]);
    const [showAssessmentDesign, setShowAssessmentDesign] = useState(false);
    const [preservedAssessmentResult, setPreservedAssessmentResult] = useState<any>(null);
    const [isDesigningAssessment, setIsDesigningAssessment] = useState(false);
    const [assessmentEmbeddedInDocx, setAssessmentEmbeddedInDocx] = useState(false);
    const [isUpdatingDocxWithAssessment, setIsUpdatingDocxWithAssessment] = useState(false);
    const [preservedCouncilEvaluation, setPreservedCouncilEvaluation] = useState<any>(null);
    const [isEvaluatingPreservedCouncil, setIsEvaluatingPreservedCouncil] = useState(false);
    const [activeStep2View, setActiveStep2View] = useState<"cards" | "alignmentTable" | "matrix">("cards");
    const [alignmentRows, setAlignmentRows] = useState<AlignmentRow[]>([]);
    const [isGatekeeperOpen, setIsGatekeeperOpen] = useState(false);
    const [exportTargetFormat, setExportTargetFormat] = useState<"docx" | "xlsx" | "pdf">("docx");

    const handleTextbookImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newImages: TextbookImage[] = await Promise.all(
            files.map((f: File) => new Promise<TextbookImage>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const dataUrl = reader.result as string;
                    const [header, data] = dataUrl.split(",");
                    const mimeType = header.match(/data:([^;]+)/)?.[1] || f.type;
                    resolve({ mimeType, data, previewUrl: dataUrl, name: f.name });
                };
                reader.onerror = reject;
                reader.readAsDataURL(f);
            }))
        );

        setTextbookImages(prev => [...prev, ...newImages].slice(0, 1)); // Max 1 image
        e.target.value = "";
    };

    const removeTextbookImage = (idx: number) => {
        setTextbookImages(prev => prev.filter((_, i) => i !== idx));
    };

    const handlePl1Upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (!uploadedFile) return;

        const isDocx = uploadedFile.name.toLowerCase().endsWith(".docx");
        if (!isDocx) {
            alert("❌ Vui lòng tải lên file KHTCM (PL1) định dạng DOCX.");
            e.target.value = "";
            return;
        }

        try {
            const buffer = await uploadedFile.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer: buffer });
            const text = result.value;
            if (!text || text.trim().length < 50) {
                alert("❌ Không bóc tách được nội dung từ file KHTCM này.");
                return;
            }
            setPl1Text(text);
            setPl1FileName(uploadedFile.name);
        } catch (err) {
            console.error("Lỗi đọc file KHTCM", err);
            alert("❌ Đã có lỗi xảy ra khi đọc file KHTCM.");
        }
        e.target.value = "";
    };

    
    const buildAlignmentRowsFromAnalysis = (analysis: any): AlignmentRow[] => {
        if (!analysis?.aiSuggestions) return [];
        return (analysis.aiSuggestions || []).map((sug: any, idx: number) => {
            const rawNls = sug.suggestedNLS || "";
            const rawAi = sug.suggestedAI || "";
            const grade = (analysis.grade === "11" ? "11" : analysis.grade === "12" ? "12" : "10") as "10" | "11" | "12";
            
            let aiComp: "NLa" | "NLb" | "NLc" | "NLd" | "Không" = "Không";
            if (/NLa/i.test(sug.aiComponentName || sug.aiCompetencyName || rawAi)) aiComp = "NLa";
            else if (/NLb/i.test(sug.aiComponentName || sug.aiCompetencyName || rawAi)) aiComp = "NLb";
            else if (/NLc/i.test(sug.aiComponentName || sug.aiCompetencyName || rawAi)) aiComp = "NLc";
            else if (/NLd/i.test(sug.aiComponentName || sug.aiCompetencyName || rawAi)) aiComp = "NLd";

            return {
                id: "align-" + (idx + 1),
                stt: idx + 1,
                subject: analysis.subject || "Khác",
                grade,
                topicOrLesson: analysis.topic || sug.activityName || "Bài học",
                yccdSubjectRaw: analysis.objective || "Yêu cầu cần đạt môn học theo CT 2018",
                actionVerb: sug.actionVerb || "Thực hiện",
                knowledgeContent: sug.knowledgeContent || analysis.topic || "",
                activityName: sug.activityName || ("Hoạt động " + (idx + 1)),
                learningTask: sug.learningTask || sug.targetContent || "Thực hiện nhiệm vụ học tập",
                studentBehavior: sug.aiStudentBehavior || sug.nlsStudentBehavior || "Học sinh thao tác trực tiếp trên dữ liệu/công cụ",
                product: sug.aiProduct || sug.nlsProduct || "Sản phẩm học tập hoàn chỉnh",
                evidence: sug.aiEvidence || sug.nlsEvidence || "Minh chứng đối chiếu hoặc bài làm học sinh",
                nlsCode: rawNls || "Không",
                nlsIndicatorText: sug.nlsIndicatorText || "",
                aiComponent: aiComp,
                aiRequirementText: sug.aiRequirement || "",
                aiCode: rawAi || "Không",
                tool: sug.tool || "Công cụ số / AI hỗ trợ",
                verificationMethod: sug.verificationMethod || "Đối chiếu nguồn chính thống (SGK Kết nối tri thức)",
                assessmentCriteria: sug.aiCriteria || sug.nlsCriteria || "Đúng kiến thức môn học; bảo đảm an toàn dữ liệu và bản quyền",
                sourceRef: "SGK Kết nối tri thức - NXBGD",
                status: "Đã xác minh" as any,
                offlineAlternative: sug.offlineFallback || "Phương án dự phòng ngoại tuyến: phiếu học tập in sẵn và bản đồ giấy"
            };
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (!uploadedFile) return;

        if (!apiKey) {
            alert("⚠️ Vui lòng nhập API Key ở phần Cài đặt trước khi rà soát.");
            e.target.value = "";
            return;
        }
        if (!isOnline) {
            alert("Bạn đang ngoại tuyến. Rà soát giáo án bằng AI cần Internet. Bạn vẫn có thể mở lại các kết quả đã lưu trước đó trong Lịch sử.");
            e.target.value = "";
            return;
        }

        const isPdf = uploadedFile.type === "application/pdf" || uploadedFile.name.toLowerCase().endsWith(".pdf");
        const maxSizeMB = isPdf ? 10 : 20;
        if (uploadedFile.size > maxSizeMB * 1024 * 1024) {
            alert(`❌ File quá lớn (tối đa ${maxSizeMB}MB). Vui lòng nén file hoặc thử file DOCX thay thế.`);
            e.target.value = "";
            return;
        }

        setFile(uploadedFile);
        setRawText("");
        setPdfBase64("");
        setAnalysisResult(null);
        setInjectionResult(null);
        setReadyBlob(null);
        setFullPreviewText("");
        setFullPreviewHtml("");
        setPreviewHtmlWarning("");
        setAssessmentPreview([]);
        setShowAssessmentDesign(false);
        setPreservedAssessmentResult(null);
        setIsDesigningAssessment(false);
        setAssessmentEmbeddedInDocx(false);
        setIsUpdatingDocxWithAssessment(false);
        setPreservedCouncilEvaluation(null);
        setIsEvaluatingPreservedCouncil(false);
        setIsAnalyzing(true);

        try {
            let analysis;
            const imagePayload = textbookImages.length > 0 ? textbookImages.map(img => ({ mimeType: img.mimeType, data: img.data })) : undefined;

            if (isPdf) {
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64String = (reader.result as string).split(',')[1];
                        resolve(base64String);
                    };
                    reader.onerror = () => reject(new Error("Không đọc được file PDF."));
                    reader.readAsDataURL(uploadedFile);
                });

                setPdfBase64(base64);
                setRawText("");
                analysis = await analyzeExistingPlan("", base64, imagePayload, pl1Text || undefined);
            } else {
                const buffer = await uploadedFile.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer: buffer });
                const text = result.value;
                if (!text || text.trim().length < 50) {
                    throw new Error("Không bóc tách được nội dung từ file này. Hãy thử file DOCX khác.");
                }
                setRawText(text);
                setPdfBase64("");

                analysis = await analyzeExistingPlan(text, undefined, imagePayload, pl1Text || undefined);
            }

            setAnalysisResult(analysis);
            setAlignmentRows(buildAlignmentRowsFromAnalysis(analysis));
            setSelectedIntegrations(analysis.aiSuggestions || []);
            setStep(2);
        } catch (err: any) {
            console.error("[UpgradePlan Error]", err);
            const msg = err?.message || "";
            if (msg.includes("QUOTA_EXHAUSTED")) {
                alert("❌ API Key đã hết quota hôm nay.\n💡 Vào https://aistudio.google.com/api-keys lấy key khác hoặc chờ ngày mai.");
            } else if (msg.includes("API_KEY") || msg.includes("401") || msg.includes("403")) {
                alert("❌ API Key không hợp lệ. Vui lòng kiểm tra lại Cài đặt.");
            } else {
                alert(`❌ Lỗi khi xử lý file: ${msg || "File không được hỗ trợ hoặc bị hỏng. Thử lại với file DOCX."}`);
            }
            e.target.value = "";
        } finally {
            setIsAnalyzing(false);
        }
    };

    const toggleIntegration = (suggestion: any) => {
        if (selectedIntegrations.includes(suggestion)) {
            setSelectedIntegrations(selectedIntegrations.filter(s => s !== suggestion));
        } else {
            setSelectedIntegrations([...selectedIntegrations, suggestion]);
        }
    };

    const handleApply = async () => {
        if (!isOnline) {
            alert("Bạn đang ngoại tuyến. Chèn nội dung AI vào DOCX cần Internet để tạo đoạn lồng ghép mới.");
            return;
        }
        if (!file || !file.name.toLowerCase().endsWith(".docx")) {
            alert("Để giữ nguyên toàn bộ giáo án gốc, vui lòng tải lên file DOCX. PDF chỉ dùng để AI đọc/rà soát, không thể chèn NLS/NL AI mà vẫn bảo toàn đầy đủ hình ảnh, bảng, biểu đồ, hình vẽ và công thức như file Word gốc.");
            return;
        }

        setIsGeneratingDocx(true);
        try {
            // 1. Generate AI Snippets
            const generatedSnippets = await generateDirectSnippets(
                analysisResult.subject || "Khác",
                analysisResult.grade || "10",
                analysisResult.topic || "Bài học nâng cấp",
                selectedIntegrations
            );
            const snippets = ensureGeoDataInSnippets(generatedSnippets);
            const objectiveText = buildObjectiveText();
            const assessmentText = buildAssessmentText();

            // 2. Inject into DOCX and get preview data
            const result = await injectSnippetsIntoDocx(file, snippets, {
                objectivesText: objectiveText
            });
            const preview = await buildDocxHtmlPreview(result.blob, result.previewItems);

            // 3. Go to preview step (step 3) instead of downloading directly
            setInjectionResult(result);
            setReadyBlob(result.blob);
            setAssessmentPreview(assessmentText.split("\n").filter(line => line.trim()));
            setFullPreviewText(preview.text || buildFullPreview(snippets, objectiveText, assessmentText));
            setFullPreviewHtml(preview.html);
            setPreviewHtmlWarning(preview.warning);
            setShowAssessmentDesign(false);
            setPreservedAssessmentResult(null);
            setIsDesigningAssessment(false);
            setAssessmentEmbeddedInDocx(false);
            setIsUpdatingDocxWithAssessment(false);
            setPreservedCouncilEvaluation(null);
            setStep(3);

            // DOCX là nguồn đầy đủ nhất: giữ nguyên giáo án gốc và chỉ chèn phần AI vào file.
            // Không tự tạo lại giáo án ở màn KHBD vì mô hình có thể rút gọn nội dung gốc.
        } catch (err) {
            console.error(err);
            alert("❌ Đã có lỗi xảy ra khi chèn vào DOCX: " + (err as Error).message);
        } finally {
            setIsGeneratingDocx(false);
        }
    };

    const handleDirectDocxDownload = async () => {
        if (!readyBlob || !file) return;
        try {
            const blobToSave = await ensureAssessmentResultInDocx();
            if (!blobToSave) return;
            saveAs(blobToSave, buildUpgradeFileName("AI_NangCap", ".docx"));
        } catch (err) {
            console.error("Không chèn được thiết kế đánh giá vào DOCX trước khi tải", err);
            alert("❌ Chưa thể chèn nội dung thiết kế đánh giá vào file DOCX.");
        }
    };

    const handleConfirmDownload = async () => {
        setExportTargetFormat("docx");
        setIsGatekeeperOpen(true);
    };

    const safeFileSegment = (value?: string) =>
        String(value || "")
            .replace(/\.[^.]+$/g, "")
            .replace(/[\\/:*?"<>|]+/g, "")
            .replace(/\s+/g, "_")
            .trim();

    const buildUpgradeFileName = (suffix: string, extension: string) => {
        const baseTopic = safeFileSegment(analysisResult?.topic || file?.name || "Giao_an") || "Giao_an";
        const subject = safeFileSegment(analysisResult?.subject || "Mon_hoc") || "Mon_hoc";
        const grade = safeFileSegment(analysisResult?.grade || "");
        return [baseTopic, subject, grade ? `Lop${grade}` : "", suffix].filter(Boolean).join("_") + extension;
    };


    const socialThemeColors: Record<string, string> = {
        "Di sản": "bg-amber-50 border-amber-300 text-amber-800",
        "Dân số": "bg-cyan-50 border-cyan-300 text-cyan-800",
        "Ma túy": "bg-red-50 border-red-300 text-red-800",
        "Thuốc lá": "bg-orange-50 border-orange-300 text-orange-800",
        "Hòa nhập": "bg-purple-50 border-purple-300 text-purple-800",
    };

    const getSocialThemeColor = (theme: string) => {
        for (const key of Object.keys(socialThemeColors)) {
            if (theme.includes(key)) return socialThemeColors[key];
        }
        return "bg-green-50 border-green-300 text-green-800";
    };

    const getGradeNumber = (grade?: string) => String(grade || "").match(/\b(10|11|12|[1-9])\b/)?.[1] || "";
    const expectedNlsLevelByGrade: Record<string, string> = {
        "1": "CB1", "2": "CB1", "3": "CB1", "4": "CB2", "5": "CB2",
        "6": "TC1", "7": "TC1", "8": "TC2", "9": "TC2",
        "10": "NC1", "11": "NC1", "12": "NC1",
    };
    const hasValidNlsCode = (code?: string, grade = analysisResult?.grade) => {
        if (!code) return false;
        const clean = String(code).trim();
        if (/^[1-6]\.\d+\.NC[a-z]$/i.test(clean)) return true;
        if (/^[1-6]\.\d+\.(CB1|CB2|TC1|TC2|NC1|NC2)[a-z]$/i.test(clean)) return true;
        return isNlsCodeValid(clean) || isNlsCodeValid(clean.replace(/\.NC1([a-z])/i, ".NC$1"));
    };

    const hasValidAiCode = (code?: string, grade = analysisResult?.grade) => {
        if (!code) return false;
        const clean = String(code).trim();
        const expectedGrade = getGradeNumber(grade);
        return isAiCodeValid2422(clean, expectedGrade || undefined)
            || isAiCodeValid2422(clean.replace(/^NL[abcd]-/i, ""), expectedGrade || undefined)
            || /^NL[abcd]-(?:10|11|12)\.[A-D]\d+\.(?:MR\d+|\d+)$/i.test(clean)
            || /^(?:10|11|12)\.[A-D]\d+\.(?:MR\d+|\d+)$/i.test(clean);
    };
    const getIntegrationDecision = (suggestion: any) => {
        const explicit = String(suggestion?.integrationDecision || "").trim();
        if (explicit) return explicit;
        const hasNls = hasValidNlsCode(suggestion?.suggestedNLS);
        const hasAi = hasValidAiCode(suggestion?.suggestedAI)
            || /NL[abcd]/i.test(String(suggestion?.aiCompetencyName || suggestion?.aiComponentName || ""));
        if (hasNls && hasAi) return "NLS và NL AI";
        if (hasNls) return "Chỉ NLS";
        if (hasAi) return "Chỉ NL AI";
        return "NLS và NL AI";
    };
    const suggestionUsesNls = (suggestion: any) => /NLS/i.test(getIntegrationDecision(suggestion)) || Boolean(suggestion?.suggestedNLS);
    const suggestionUsesAi = (suggestion: any) => /AI/i.test(getIntegrationDecision(suggestion)) || Boolean(suggestion?.suggestedAI);
    const hasUsableIntegration = (suggestion: any, grade = analysisResult?.grade) => {
        if (!suggestion) return false;
        const hasNls = hasValidNlsCode(suggestion?.suggestedNLS, grade);
        const hasAi = hasValidAiCode(suggestion?.suggestedAI, grade);
        return hasNls || hasAi || Boolean(suggestion?.activityName);
    };

    const plain = (value?: string) => (value || "").replace(/<bold>|<\/bold>|<ai>|<\/ai>|\*\*/gi, "").trim();

    const compactSentence = (value?: string, maxLength = 220) => {
        const normalized = plain(value).replace(/\s+/g, " ").trim();
        if (normalized.length <= maxLength) return normalized;
        const shortened = normalized.slice(0, maxLength + 1).replace(/\s+\S*$/, "").replace(/[,:;\-–—]+$/, "").trim();
        return `${shortened || normalized.slice(0, maxLength).trim()}…`;
    };


    const getAiCompetencyNameFromCode = (code?: string) => {
        const normalized = (code || "").toUpperCase();
        if (/\bNLA\b/.test(normalized)) return "NLa - Tư duy lấy con người làm trung tâm";
        if (/\bNLB\b/.test(normalized)) return "NLb - Đạo đức và trách nhiệm xã hội";
        if (/\bNLC\b/.test(normalized)) return "NLc - Kỹ thuật và ứng dụng";
        if (/\bNLD\b/.test(normalized)) return "NLd - Giải quyết vấn đề và thiết kế hệ thống";
        return "Thành phần năng lực AI cần đối chiếu theo QĐ 2422/QĐ-BGDĐT";
    };

    const getAiCompetencyDisplayName = (value?: string, code?: string) => {
        const rawValue = plain(value);
        const standardized = getAiCompetencyNameFromCode(`${rawValue} ${code || ""}`);
        return standardized.startsWith("Thành phần năng lực AI cần đối chiếu")
            ? rawValue || standardized
            : standardized;
    };

    const buildAiOrderedFields = (sug: any) => {
        const code = plain(sug?.suggestedAI || sug?.aiIndicatorCode || "");
        const canonicalCode = formatAiCode2422(code);
        const codeMatch = canonicalCode?.match(/^NL([abcd])-(\d{1,2})\.([ABCD]\d+)\.(MR\d+|\d+)$/i);
        const isValidCode = hasValidAiCode(canonicalCode);
        const topicMatch = String(sug?.aiTopic || "").match(/\b([ABCD]\d+)\b/i);
        const indicatorCode = codeMatch && isValidCode
            ? canonicalCode!
            : "Mã NL AI không hợp lệ — không thể chèn";
        const grade = plain(sug?.aiGrade || codeMatch?.[2] || analysisResult?.grade || "");
        const topic = plain(codeMatch?.[3]?.toUpperCase() || topicMatch?.[1]?.toUpperCase() || "");
        const competencyName = getAiCompetencyDisplayName(sug?.aiCompetencyName || sug?.aiComponentName, code);
        const componentCode = codeMatch && isValidCode ? `NL${codeMatch[1].toLowerCase()}` : "";
        const behavior = plain(sug?.aiStudentBehavior || sug?.action || "Học sinh thực hiện nhiệm vụ học tập có sử dụng AI dưới sự hướng dẫn của giáo viên.");
        const yccd = plain(sug?.aiYccd || sug?.yccdEvidence || sug?.reason || "Căn cứ YCCĐ cần được giáo viên đối chiếu trước khi sử dụng.");
        return {
            competencyName,
            componentCode,
            grade,
            topic,
            indicatorCode,
            behavior,
            yccd,
            code: indicatorCode,
            product: plain(sug?.aiProduct || sug?.product || "Sản phẩm học tập có sử dụng AI và được học sinh chỉnh sửa/kiểm chứng."),
            criteria: plain(sug?.aiCriteria || sug?.criteria || "Đúng kiến thức môn học; dùng AI đúng mục đích; biết kiểm chứng nguồn và giải thích cách điều chỉnh kết quả AI."),
            evidence: plain(sug?.aiEvidence || sug?.evidence || "Prompt đã dùng, nguồn kiểm chứng, bản chỉnh sửa của học sinh và sản phẩm cuối.")
        };
    };

    const buildAiIdentityText = (fields: ReturnType<typeof buildAiOrderedFields>) =>
        `Thành phần NL AI: ${fields.competencyName}; Khối lớp: ${fields.grade}; Chủ đề: ${fields.topic}; Mã chỉ báo NL AI: ${fields.indicatorCode}`;

    const buildAiOrderedText = (sug: any) => {
        const fields = buildAiOrderedFields(sug);
        return [
            buildAiIdentityText(fields),
            `Hành vi học sinh: ${fields.behavior}`,
            `Yêu cầu cần đạt AI: ${fields.yccd}`,
            `Sản phẩm: ${fields.product}`,
            `Tiêu chí: ${fields.criteria}`,
            `Minh chứng: ${fields.evidence}`
        ].join("; ");
    };

    const buildGeoDataBlockForSuggestion = (sug: any) => {
        const geo = sug?.geoDataRequirement;
        if (!geo) return "";
        return [
            "Bảng số liệu và biểu đồ bắt buộc trong hoạt động Địa lí:",
            geo.dataTable ? `- Bảng số liệu: ${plain(geo.dataTable)}` : "",
            geo.sampleTableMarkdown ? geo.sampleTableMarkdown : "",
            geo.chart ? geo.chart : "",
            geo.dataSource ? `- Nguồn kiểm chứng: ${plain(geo.dataSource)}` : "",
            geo.studentTask ? `- Nhiệm vụ của HS: ${plain(geo.studentTask)}` : ""
        ].filter(Boolean).join("\n");
    };

    const buildGeoDataText = (suggestions = selectedIntegrations) => {
        const blocks = suggestions
            .map((sug: any, idx: number) => {
                const block = buildGeoDataBlockForSuggestion(sug);
                return block ? `${idx + 1}. ${sug.activityName}\n${block}` : "";
            })
            .filter(Boolean);
        return blocks.length ? `Bổ sung bảng số liệu, biểu đồ/bản đồ Địa lí:\n${blocks.join("\n\n")}` : "";
    };

    const ensureGeoDataInSnippets = (snippets: Snippet[]) =>
        snippets.map((snippet, idx) => {
            const suggestion = selectedIntegrations.find((sug: any) => sug.activityName === snippet.activityName) || selectedIntegrations[idx];
            const geoBlock = buildGeoDataBlockForSuggestion(suggestion);
            if (!geoBlock) return snippet;
            const normalized = plain(snippet.text).toLowerCase();
            if (normalized.includes("bảng số liệu") && normalized.includes("biểu đồ")) return snippet;
            return { ...snippet, text: `${snippet.text}\n\n${geoBlock}` };
        });

    const buildNlsObjectiveLines = (suggestions = selectedIntegrations) =>
        suggestions.filter((suggestion: any) => suggestionUsesNls(suggestion) && hasValidNlsCode(suggestion?.suggestedNLS)).map((sug: any, idx: number) => {
            const code = sug.suggestedNLS;
            const competencyName = plain(sug.nlsCompetencyName || `Năng lực số theo chỉ báo ${code}`);
            const action = compactSentence(sug.nlsStudentBehavior || sug.action, 180);
            return `${idx + 1}. Mã chỉ báo NLS: ${compactSentence(code, 80)}; Thành phần NLS: ${compactSentence(competencyName, 120)}; Hành vi học sinh: ${action}`;
        });

    const buildAiObjectiveLines = (suggestions = selectedIntegrations) =>
        suggestions.filter(suggestionUsesAi).map((sug: any, idx: number) => {
            const fields = buildAiOrderedFields(sug);
            return `${idx + 1}. ${buildAiIdentityText(fields)}; Yêu cầu cần đạt AI: ${compactSentence(fields.yccd, 190)}`;
        });

    const buildObjectiveText = (suggestions = selectedIntegrations) => {
        const nlsLines = buildNlsObjectiveLines(suggestions);
        const aiLines = buildAiObjectiveLines(suggestions);
        const sections: string[] = [];
        if (nlsLines.length) sections.push("a) Năng lực số (NLS) bám sát YCCĐ môn học:", ...nlsLines);
        if (aiLines.length) sections.push(`${nlsLines.length ? "b" : "a"}) Năng lực AI (NL AI) bám sát YCCĐ môn học:`, ...aiLines);
        return sections.join("\n");
    };

    const buildAssessmentText = (suggestions = selectedIntegrations) => {
        if (!suggestions.length) return "Chưa có hoạt động tích hợp được chọn để đề xuất đánh giá.";
        const headers = ["Hoạt động tích hợp", "NLS", "NL AI", "Tiêu chí đánh giá", "Minh chứng"];
        const rows = suggestions.map((sug: any) => {
            const usesNls = suggestionUsesNls(sug);
            const usesAi = suggestionUsesAi(sug);
            const nls = usesNls && hasValidNlsCode(sug.suggestedNLS) ? sug.suggestedNLS : "Không tích hợp";
            const aiFields = usesAi ? buildAiOrderedFields(sug) : null;
            const criteria = [
                usesNls ? sug.nlsCriteria : "",
                aiFields?.criteria,
                sug.geoDataRequirement ? "Nhiệm vụ Địa lí có bảng số liệu đúng nguồn, biểu đồ phù hợp, nhận xét xu hướng và giải thích nguyên nhân." : ""
            ].filter(Boolean).join(" ");
            const evidence = [
                usesNls ? sug.nlsProduct || sug.product : "",
                aiFields?.evidence
            ].filter(Boolean).join("; ");
            return markdownTableRow([
                compactSentence(sug.activityName, 110),
                compactSentence(nls, 70),
                compactSentence(aiFields ? buildAiIdentityText(aiFields) : "Không tích hợp", 230),
                compactSentence(criteria, 210),
                compactSentence(evidence, 170)
            ]);
        });
        return [
            "Bảng tóm tắt gợi ý đánh giá theo từng hoạt động tích hợp:",
            markdownTableRow(headers),
            markdownTableSeparator(headers.length),
            ...rows
        ].join("\n");
    };

    const buildFullPreview = (snippets: { activityName: string; text: string }[], objectiveText: string, assessmentText: string) => {
        const original = rawText.trim()
            ? rawText.trim()
            : "Không có toàn văn bóc tách từ DOCX/PDF để hiển thị. File DOCX đã được chèn trực tiếp và có thể tải xuống.";
        const inserted = snippets.map((snippet, idx) => `${idx + 1}. ${snippet.activityName}\n${snippet.text}`).join("\n\n");
        return [
            `KẾ HOẠCH BÀI DẠY SAU TÍCH HỢP NLS/NL AI`,
            `Môn: ${analysisResult?.subject || "..."}`,
            `Lớp: ${analysisResult?.grade || "..."}`,
            `Bài: ${analysisResult?.topic || "..."}`,
            "",
            objectiveText,
            "",
            "II. TOÀN VĂN GIÁO ÁN GỐC / NỘI DUNG ĐÃ BÓC TÁCH",
            original,
            "",
            "III. CÁC ĐOẠN TÍCH HỢP NLS/NL AI ĐÃ CHÈN",
            inserted || "Chưa có đoạn tích hợp.",
            "",
            buildGeoDataText(),
            "",
            "IV. GỢI Ý NỘI DUNG ĐÁNH GIÁ",
            assessmentText
        ].join("\n");
    };

    const buildDocxHtmlPreview = async (blob: Blob, redItems: InjectionResult["previewItems"] = []): Promise<{ html: string; text: string; warning: string }> => {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const htmlBuffer = arrayBuffer.slice(0);
            const textBuffer = arrayBuffer.slice(0);
            const [result, raw] = await Promise.all([
                mammoth.convertToHtml(
                    { arrayBuffer: htmlBuffer },
                    {
                        convertImage: mammoth.images.imgElement(async (image: any) => ({
                            src: `data:${image.contentType};base64,${await image.read("base64")}`
                        }))
                    }
                ),
                mammoth.extractRawText({ arrayBuffer: textBuffer })
            ]);
            const warning = (result.messages || []).length
                ? "Một số thành phần Word phức tạp có thể không hiển thị hoàn hảo trong bản xem nhanh HTML, nhưng vẫn được giữ trong DOCX tải xuống."
                : "";
            const safeHtml = sanitizePreviewHtml(result.value || "");
            return { html: markIntegratedPreviewHtml(safeHtml, redItems), text: raw.value || "", warning };
        } catch (err) {
            console.warn("Không tạo được bản xem trước HTML từ DOCX", err);
            return {
                html: "",
                text: "",
                warning: "Không tạo được bản xem trước HTML. File DOCX đã tích hợp vẫn là bản giữ nguyên cấu trúc gốc để tải xuống."
            };
        }
    };

    const downloadTextFile = (filename: string, content: string, type = "text/plain;charset=utf-8") => {
        const blob = new Blob([content], { type });
        saveAs(blob, filename);
    };

    const list = (value: any) => Array.isArray(value) ? value : [];

    const textValue = (value: any) => value === undefined || value === null ? "" : String(value);

    const stripChoicePrefix = (value: any) => textValue(value)
        .replace(/^\s*(?:(?:[A-Da-d])\s*[\.\)\-:]\s*)+/, "")
        .replace(/\s+/g, " ")
        .trim();

    const stripQuestionPrefix = (value: any) => textValue(value)
        .replace(/^\s*(?:(?:phần|phan)\s*[ivxlcdm0-9]+\s*[-–—.]?\s*)?(?:câu|cau)\s*\d+\s*[:\.\-\)]\s*/i, "")
        .replace(/\s+/g, " ")
        .trim();

    const uniqueByText = <T,>(items: T[], mapper: (item: T) => string = (item) => textValue(item)) => {
        const seen = new Set<string>();
        return list(items).filter((item: T) => {
            const key = mapper(item)
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/\s+/g, " ")
                .trim();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    const optionLabel = (idx: number) => String.fromCharCode(65 + idx);

    const formatChoiceLine = (value: any, idx: number) => `${optionLabel(idx)}. ${stripChoicePrefix(value)}`;

    const tableCellText = (value: any) => textValue(value)
        .replace(/\|/g, "/")
        .replace(/\s+/g, " ")
        .trim();

    const markdownTableRow = (cells: any[]) => `| ${cells.map(tableCellText).join(" | ")} |`;

    const markdownTableSeparator = (count: number) => `| ${Array.from({ length: count }, () => "---").join(" | ")} |`;

    const splitPreviewTableRow = (line: string) => line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map(cell => cell.trim());

    const isPreviewTableLine = (line: string) => line.includes("|") && splitPreviewTableRow(line).length >= 2;

    const isPreviewTableSeparator = (line: string) =>
        splitPreviewTableRow(line).every(cell => /^:?-{3,}:?$/.test(cell));

    const renderAssessmentPreviewLines = () => {
        const nodes: React.ReactNode[] = [];
        for (let i = 0; i < assessmentPreview.length; i++) {
            if (isPreviewTableLine(assessmentPreview[i])) {
                const tableRows: string[][] = [];
                let cursor = i;
                while (cursor < assessmentPreview.length && isPreviewTableLine(assessmentPreview[cursor])) {
                    if (!isPreviewTableSeparator(assessmentPreview[cursor])) {
                        tableRows.push(splitPreviewTableRow(assessmentPreview[cursor]));
                    }
                    cursor++;
                }

                if (tableRows.length >= 2) {
                    nodes.push(
                        <div key={`assessment-table-${i}`} className="overflow-x-auto rounded-lg border border-emerald-200 bg-white">
                            <table className="w-full min-w-[760px] border-collapse text-xs">
                                <thead>
                                    <tr className="bg-emerald-50">
                                        {tableRows[0].map((cell, ci) => (
                                            <th key={ci} className="border border-emerald-200 px-2 py-2 text-left font-bold text-emerald-900">{cell}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableRows.slice(1).map((row, ri) => (
                                        <tr key={ri}>
                                            {row.map((cell, ci) => (
                                                <td key={ci} className="border border-emerald-100 px-2 py-2 align-top text-emerald-950">{cell}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                    i = cursor - 1;
                    continue;
                }
            }

            nodes.push(<p key={`assessment-line-${i}`} className="text-sm text-emerald-950 leading-relaxed">{assessmentPreview[i]}</p>);
        }
        return nodes;
    };

    const hasAssessmentTable = (tableData: any) =>
        Array.isArray(tableData?.headers) &&
        tableData.headers.length > 0 &&
        Array.isArray(tableData?.rows) &&
        tableData.rows.length > 0;

    const renderAssessmentDataTable = (tableData: any) => {
        if (!hasAssessmentTable(tableData)) return null;
        return (
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                {tableData.caption && (
                    <p className="px-3 pt-3 text-[11px] font-bold text-slate-700">{tableData.caption}</p>
                )}
                <table className="w-full min-w-[420px] border-collapse text-[11px]">
                    <thead>
                        <tr className="bg-slate-50">
                            {list(tableData.headers).map((header: any, hi: number) => (
                                <th key={hi} className="border border-slate-200 px-2 py-1.5 text-left font-bold text-slate-700">{textValue(header)}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {list(tableData.rows).map((row: any, ri: number) => (
                            <tr key={ri}>
                                {list(row).map((cell: any, ci: number) => (
                                    <td key={ci} className="border border-slate-200 px-2 py-1.5 text-slate-700">{textValue(cell)}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {tableData.source && (
                    <p className="px-3 pb-3 pt-2 text-[10px] italic text-slate-500">Nguồn: {tableData.source}</p>
                )}
            </div>
        );
    };

    const renderAssessmentQuestionSupport = (question: any) => (
        <>
            {renderAssessmentDataTable(question?.tableData)}
            {question?.imagePlaceholder && (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-semibold text-blue-800">
                    {question.imagePlaceholder}
                </div>
            )}
        </>
    );

    const appendAssessmentQuestionSupportText = (lines: string[], question: any) => {
        const tableData = question?.tableData;
        if (hasAssessmentTable(tableData)) {
            const headers = list(tableData.headers);
            if (tableData.caption) lines.push(`Bảng số liệu: ${tableData.caption}`);
            lines.push(markdownTableRow(headers));
            lines.push(markdownTableSeparator(headers.length));
            list(tableData.rows).forEach((row: any) => lines.push(markdownTableRow(list(row))));
            if (tableData.source) lines.push(`Nguồn: ${tableData.source}`);
        }
        if (question?.imagePlaceholder) lines.push(`Hình/Bản đồ/Biểu đồ: ${question.imagePlaceholder}`);
    };

    const formatPreservedAssessmentText = (evaluation: any) => {
        const lines: string[] = [
            "HỆ THỐNG ĐÁNH GIÁ NĂNG LỰC",
            "Chuẩn QĐ 2422/QĐ-BGDĐT & Chương trình GDPT 2018",
            "Ghi chú: Bộ đánh giá này được thiết kế từ giáo án DOCX gốc đã bảo toàn; không thay thế hoặc rút gọn nội dung giáo án gốc.",
            ""
        ];

        lines.push("1. TIÊU CHÍ ĐÁNH GIÁ (RUBRICS)");
        list(evaluation?.rubrics).forEach((rubric: any, idx: number) => {
            lines.push(`${idx + 1}. Năng lực: ${rubric?.competencyName || "Năng lực cần đánh giá"}`);
            const rubricHeaders = ["Tiêu chí", "Mức 1: Chưa đạt", "Mức 2: Đạt", "Mức 3: Khá", "Mức 4: Tốt"];
            lines.push(markdownTableRow(rubricHeaders));
            lines.push(markdownTableSeparator(rubricHeaders.length));
            lines.push(markdownTableRow([
                list(rubric?.criteria).map((criteria: any) => `- ${tableCellText(criteria)}`).join("; "),
                rubric?.levels?.level1 || "",
                rubric?.levels?.level2 || "",
                rubric?.levels?.level3 || "",
                rubric?.levels?.level4 || ""
            ]));
        });

        const formative = evaluation?.formativeAssessment || {};
        lines.push("", "2. ĐÁNH GIÁ THƯỜNG XUYÊN");
        list(formative?.quizzes).forEach((question: any, idx: number) => {
            lines.push(`Câu ${idx + 1}: ${stripQuestionPrefix(question?.question)}`);
            uniqueByText(list(question?.options), stripChoicePrefix).forEach((option: any, oi: number) => lines.push(formatChoiceLine(option, oi)));
            appendAssessmentQuestionSupportText(lines, question);
            lines.push(`Đáp án: ${question?.answer || ""}`);
        });
        list(formative?.part1_multipleChoice).forEach((question: any, idx: number) => {
            lines.push(`Phần I - Câu ${idx + 1}: ${stripQuestionPrefix(question?.question)}`);
            uniqueByText(list(question?.options), stripChoicePrefix).forEach((option: any, oi: number) => lines.push(formatChoiceLine(option, oi)));
            appendAssessmentQuestionSupportText(lines, question);
            lines.push(`Đáp án: ${question?.answer || ""}`);
        });
        list(formative?.part2_trueFalse).forEach((question: any, idx: number) => {
            lines.push(`Phần II - Câu ${idx + 1}: ${stripQuestionPrefix(question?.question)}`);
            uniqueByText(list(question?.statements), stripChoicePrefix).forEach((statement: any, oi: number) => {
                lines.push(`${formatChoiceLine(statement, oi)} (${question?.answers?.[oi] || ""})`);
            });
            appendAssessmentQuestionSupportText(lines, question);
        });
        list(formative?.part3_shortAnswer).forEach((question: any, idx: number) => {
            lines.push(`Phần III - Câu ${idx + 1}: ${stripQuestionPrefix(question?.question)}`);
            appendAssessmentQuestionSupportText(lines, question);
            lines.push(`Đáp án: ${question?.answer || ""}`);
        });
        lines.push("Bảng kiểm:");
        const checklistHeaders = ["STT", "Nội dung quan sát/đánh giá"];
        lines.push(markdownTableRow(checklistHeaders));
        lines.push(markdownTableSeparator(checklistHeaders.length));
        uniqueByText(list(formative?.checklists)).forEach((item: any, idx: number) => lines.push(markdownTableRow([idx + 1, item])));

        lines.push("", "3. ĐÁNH GIÁ ĐỊNH KỲ");
        const summativeHeaders = ["Thành phần", "Nội dung"];
        lines.push(markdownTableRow(summativeHeaders));
        lines.push(markdownTableSeparator(summativeHeaders.length));
        lines.push(markdownTableRow(["Nội dung yêu cầu", evaluation?.summativeAssessment?.projectOrTest || ""]));
        uniqueByText(list(evaluation?.summativeAssessment?.requirements)).forEach((item: any, idx: number) => {
            lines.push(markdownTableRow([`Yêu cầu ${idx + 1}`, item]));
        });

        lines.push("", "4. MẪU NHẬN XÉT CHI TIẾT");
        const feedbackHeaders = ["Mức độ", "Mẫu nhận xét"];
        lines.push(markdownTableRow(feedbackHeaders));
        lines.push(markdownTableSeparator(feedbackHeaders.length));
        uniqueByText(list(evaluation?.feedbackSamples), (feedback: any) => `${feedback?.level || ""} ${feedback?.sampleText || ""}`).forEach((feedback: any) => {
            lines.push(markdownTableRow([feedback?.level || "Mức độ", feedback?.sampleText || ""]));
        });

        return lines.filter(line => line !== undefined && line !== null).join("\n");
    };

    const embedAssessmentResultInDocx = async (evaluation: any, sourceBlob: Blob | null = readyBlob) => {
        if (!sourceBlob || !evaluation) return sourceBlob;
        const assessmentText = formatPreservedAssessmentText(evaluation);
        setIsUpdatingDocxWithAssessment(true);
        try {
            const updated = await appendAssessmentDesignToDocx(sourceBlob, assessmentText);
            const assessmentPreviewItem = {
                activityName: "Thiết kế đánh giá NLS/NL AI",
                injectedText: assessmentText,
                found: true
            };
            const redPreviewItems = [...(injectionResult?.previewItems || []), assessmentPreviewItem];
            const preview = await buildDocxHtmlPreview(updated.blob, redPreviewItems);
            setReadyBlob(updated.blob);
            setAssessmentEmbeddedInDocx(true);
            setFullPreviewText(preview.text || [fullPreviewText, "", "V. THIẾT KẾ ĐÁNH GIÁ NLS/NL AI", assessmentText].filter(Boolean).join("\n"));
            setFullPreviewHtml(preview.html);
            setPreviewHtmlWarning(preview.warning);
            setInjectionResult(prev => prev ? {
                ...prev,
                blob: updated.blob,
                injectedCount: prev.injectedCount + 1,
                preservationReport: updated.preservationReport,
                previewItems: [
                    ...prev.previewItems,
                    assessmentPreviewItem
                ]
            } : prev);
            return updated.blob;
        } finally {
            setIsUpdatingDocxWithAssessment(false);
        }
    };

    const ensureAssessmentResultInDocx = async () => {
        if (!readyBlob) return null;
        if (!preservedAssessmentResult || assessmentEmbeddedInDocx) return readyBlob;
        return embedAssessmentResultInDocx(preservedAssessmentResult, readyBlob);
    };

    const escapeHtml = (text: string) => text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const buildPreviewBodyHtml = () => fullPreviewHtml
        ? `<div class="note">Bản HTML/PDF dùng để xem nhanh trên màn hình. Bản DOCX tải xuống mới là bản bảo toàn nghiêm ngặt hình ảnh, bảng, biểu đồ, hình vẽ và công thức.</div><div class="docx">${fullPreviewHtml}</div>`
        : `<pre>${escapeHtml(fullPreviewText)}</pre>`;

    const buildPreviewHtmlDocument = () => {
        const body = buildPreviewBodyHtml();
        return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(analysisResult?.topic || "Giáo án tích hợp NLS/NL AI")}</title><style>body{font-family:Arial,sans-serif;line-height:1.6;margin:32px;color:#0f172a}.note{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin-bottom:16px;color:#1e3a8a;font-weight:700}.docx table{border-collapse:collapse;width:100%;margin:12px 0}.docx td,.docx th{border:1px solid #cbd5e1;padding:6px;vertical-align:top}.docx img{max-width:100%;height:auto}.docx-ai-red{color:#dc2626!important;font-weight:700}pre{white-space:pre-wrap;font-family:Arial,sans-serif}</style></head><body>${body}</body></html>`;
    };

    const handleDownloadPreviewText = () => {
        if (!fullPreviewText) return;
        downloadTextFile(buildUpgradeFileName("AI_XemTruoc", ".txt"), fullPreviewText);
    };

    const handleDownloadPreviewHtml = () => {
        if (!fullPreviewText && !fullPreviewHtml) return;
        downloadTextFile(buildUpgradeFileName("AI_XemTruoc", ".html"), buildPreviewHtmlDocument(), "text/html;charset=utf-8");
    };

    const handleDownloadPreviewPdf = async () => {
        if (!fullPreviewText && !fullPreviewHtml) return;
        const wrapper = document.createElement("div");
        wrapper.innerHTML = buildPreviewBodyHtml();
        wrapper.style.cssText = "font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; background: #ffffff; padding: 24px; max-width: 760px;";
        const style = document.createElement("style");
        style.textContent = ".docx table{border-collapse:collapse;width:100%;margin:12px 0}.docx td,.docx th{border:1px solid #cbd5e1;padding:6px;vertical-align:top}.docx img{max-width:100%;height:auto}.docx-ai-red{color:#dc2626!important;font-weight:700}.note{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin-bottom:16px;color:#1e3a8a;font-weight:700}pre{white-space:pre-wrap;font-family:Arial,sans-serif}";
        wrapper.prepend(style);
        document.body.appendChild(wrapper);

        try {
            await html2pdf()
                .set({
                    margin: 10,
                    filename: buildUpgradeFileName("AI_XemTruoc", ".pdf"),
                    image: { type: "jpeg", quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
                })
                .from(wrapper)
                .save();
        } finally {
            wrapper.remove();
        }
    };

    const handleDownloadAssessmentText = () => {
        if (!assessmentPreview.length && !preservedAssessmentResult) return;
        downloadTextFile(
            buildUpgradeFileName("DanhGia_NLS_NLAI", ".txt"),
            preservedAssessmentResult ? formatPreservedAssessmentText(preservedAssessmentResult) : assessmentPreview.join("\n")
        );
    };

    const handleStartOver = () => {
        setStep(1);
        setFile(null);
        setAnalysisResult(null);
        setInjectionResult(null);
        setReadyBlob(null);
        setFullPreviewText("");
        setFullPreviewHtml("");
        setPreviewHtmlWarning("");
        setAssessmentPreview([]);
        setShowAssessmentDesign(false);
        setPreservedAssessmentResult(null);
        setIsDesigningAssessment(false);
        setAssessmentEmbeddedInDocx(false);
        setIsUpdatingDocxWithAssessment(false);
        setPreservedCouncilEvaluation(null);
        setIsEvaluatingPreservedCouncil(false);
    };

    const previewToolbarButtonClass = "p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed";

    const buildUpgradePayload = () => {
        const objectiveText = buildObjectiveText();
        const assessmentText = buildAssessmentText();
        const geoDataText = buildGeoDataText();
        const selectedNlsIndicators = selectedIntegrations
            .filter(suggestionUsesNls)
            .map((sug: any) => ({ code: sug.suggestedNLS, description: `${sug.activityName}: ${sug.yccdEvidence || sug.reason || sug.action}` }))
            .filter((item: any) => item.code && !String(item.code).toLowerCase().includes("không"));
        return {
            subject: analysisResult.subject || "Khác",
            grade: analysisResult.grade || "10",
            topic: analysisResult.topic || "Bài học nâng cấp",
            duration: analysisResult.duration || "2 tiết",
            contextStudents: analysisResult.contextStudents || "",
            contextSchool: analysisResult.contextSchool || "",
            objectivesKnowledge: analysisResult.objectivesKnowledge || "",
            objectivesCompetency: [analysisResult.objectivesCompetency, objectiveText].filter(Boolean).join("\n"),
            objectivesQuality: analysisResult.objectivesQuality || "",
            existingRawText: rawText,
            existingPdfBase64: pdfBase64,
            aiIntegrationOptions: selectedIntegrations,
            socialIntegrations: selectedSocialIntegrations,
            newContentFromTextbook: analysisResult.newContentFromTextbook || [],
            additionalNotes: `Nội dung tích hợp đã duyệt:\n${objectiveText}\n\n${geoDataText ? `${geoDataText}\n\n` : ""}Gợi ý đánh giá:\n${assessmentText}`,
            indicatorCode: selectedIntegrations.find((sug: any) => hasValidAiCode(sug.suggestedAI))?.suggestedAI,
            selectedNlsIndicators
        };
    };

    const handleOpenFullLessonPlan = (nextAction: UpgradeNextAction = "khbd") => {
        onUpgradeReady(buildUpgradePayload(), nextAction);
    };

    const handleCreateTeacherPlan = () => {
        const payload = buildUpgradePayload();
        if (onCreateTeacherPlan) {
            onCreateTeacherPlan(payload);
            return;
        }
        onUpgradeReady(payload, "teacher-plan");
    };

    const handleShowAssessmentDesign = async () => {
        setShowAssessmentDesign(true);
        setTimeout(() => {
            document.getElementById("upgrade-assessment-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
        if (preservedAssessmentResult || isDesigningAssessment || !onDesignPreservedAssessment) return;

        setIsDesigningAssessment(true);
        try {
            const payload = buildUpgradePayload();
            const result = await onDesignPreservedAssessment({
                ...payload,
                preservedLessonText: fullPreviewText,
                preservedLessonHtml: fullPreviewHtml,
                assessmentText: buildAssessmentText(),
                injectedItems: injectionResult?.previewItems || [],
                preservationReport: injectionResult?.preservationReport,
                strictRule: "Thiết kế đánh giá dựa trên DOCX gốc đã được chèn trực tiếp; không tái tạo, không thay thế và không rút gọn giáo án gốc."
            });
            if (result) {
                setPreservedAssessmentResult(result);
                try {
                    await embedAssessmentResultInDocx(result);
                } catch (err) {
                    console.error("Không chèn được thiết kế đánh giá vào DOCX", err);
                    alert("⚠️ Đã tạo được thiết kế đánh giá, nhưng chưa chèn được vào file DOCX tải xuống. Vui lòng bấm tải lại DOCX sau khi kiểm tra kết nối.");
                }
                setTimeout(() => {
                    document.getElementById("upgrade-assessment-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 50);
            }
        } finally {
            setIsDesigningAssessment(false);
        }
    };

    const handleEvaluatePreservedCouncil = async () => {
        if (!onEvaluatePreservedLesson) {
            handleShowAssessmentDesign();
            return;
        }
        setIsEvaluatingPreservedCouncil(true);
        try {
            const payload = buildUpgradePayload();
            const council = await onEvaluatePreservedLesson({
                ...payload,
                preservedLessonText: fullPreviewText,
                preservedLessonHtml: fullPreviewHtml,
                assessmentText: buildAssessmentText(),
                injectedItems: injectionResult?.previewItems || [],
                preservationReport: injectionResult?.preservationReport,
                strictRule: "Đánh giá dựa trên DOCX gốc đã được chèn trực tiếp; không tái tạo hoặc rút gọn giáo án."
            });
            if (council) {
                setPreservedCouncilEvaluation(council);
                setTimeout(() => {
                    document.getElementById("upgrade-council-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 50);
            }
        } finally {
            setIsEvaluatingPreservedCouncil(false);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-4 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-100 p-6 flex items-center gap-3 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
                    <div className="bg-blue-100 p-2 rounded-lg">
                        <Zap className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold font-display text-slate-800">Nâng cấp Giáo án cũ theo SGK Mới</h2>
                        <p className="text-sm text-slate-500">Tải lên Giáo án cũ + ảnh chụp trang SGK mới. AI sẽ phân tích nội dung thiếu & đề xuất tích hợp.</p>
                    </div>
                </div>

                <div className="p-6">
                    {step === 1 && (
                        <div className="space-y-6">
                            {/* Textbook Image Upload Zone */}
                            <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/40 p-5 space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="bg-indigo-100 p-1.5 rounded-lg">
                                        <BookOpen className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm text-indigo-800">Ảnh chụp trang Sách giáo khoa mới <span className="font-normal text-indigo-500">(Tùy chọn – tối đa 1 ảnh)</span></p>
                                        <p className="text-xs text-indigo-500">AI sẽ so sánh SGK mới với giáo án cũ để tìm nội dung còn thiếu.</p>
                                    </div>
                                </div>

                                {textbookImages.length > 0 && (
                                    <div className="flex flex-wrap gap-3">
                                        {textbookImages.map((img, idx) => (
                                            <div key={idx} className="relative group">
                                                <img src={img.previewUrl} alt={img.name} className="w-20 h-20 object-cover rounded-lg border-2 border-indigo-200 shadow-sm" />
                                                <button
                                                    onClick={() => removeTextbookImage(idx)}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                                <p className="text-xs text-center text-indigo-600 mt-1 w-20 truncate">{img.name}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {textbookImages.length < 1 && (
                                <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm cursor-pointer transition-colors text-sm font-medium">
                                    <ImagePlus className="w-4 h-4" />
                                    <span>Thêm ảnh SGK (1 ảnh)</span>
                                    <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleTextbookImageUpload} />
                                </label>
                                )}
                            </div>

                            {/* PL1 Upload Zone */}
                            <div className="rounded-xl border border-dashed border-teal-300 bg-teal-50/40 p-5 space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="bg-teal-100 p-1.5 rounded-lg">
                                        <FileText className="w-5 h-5 text-teal-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm text-teal-800">Tải lên KHTCM (PL1) <span className="font-normal text-teal-500">(Tùy chọn – Để đồng bộ mã NLS & NL AI)</span></p>
                                        <p className="text-xs text-teal-500">Hệ thống sẽ giữ nguyên các mã NLS/NL AI đã duyệt từ KHTCM sang giáo án.</p>
                                    </div>
                                </div>

                                {pl1FileName ? (
                                    <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-teal-200 shadow-sm w-fit">
                                        <FileText className="w-5 h-5 text-teal-500" />
                                        <span className="text-sm font-medium text-slate-700">{pl1FileName}</span>
                                        <button
                                            onClick={() => { setPl1Text(""); setPl1FileName(""); }}
                                            className="text-slate-400 hover:text-red-500 transition-colors ml-2"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow-sm cursor-pointer transition-colors text-sm font-medium">
                                        <UploadCloud className="w-4 h-4" />
                                        <span>Chọn file PL1 (DOCX / XLSX)</span>
                                        <input type="file" className="hidden" accept=".docx,.xlsx,.xls" onChange={handlePl1Upload} />
                                    </label>
                                )}
                            </div>

                            {/* Main Lesson Plan File Upload */}
                            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-12 bg-slate-50 relative">
                                {isAnalyzing ? (
                                    <div className="text-center space-y-4">
                                        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
                                        <h3 className="text-lg font-medium text-slate-700">
                                            AI đang phân tích giáo án{textbookImages.length > 0 ? ` & ${textbookImages.length} ảnh SGK` : ""}...
                                        </h3>
                                        <p className="text-sm text-slate-500">Quá trình này mất khoảng 10-20 giây.</p>
                                    </div>
                                ) : (
                                    <div className="text-center space-y-4">
                                        <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-blue-600">
                                            <UploadCloud className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-medium text-slate-800">Tải lên Giáo án gốc</h3>
                                            <p className="text-sm text-slate-500 mt-1">
                                                {textbookImages.length > 0
                                                    ? `✅ Đã chọn ${textbookImages.length} ảnh SGK. AI sẽ phân tích so sánh.`
                                                    : "Hỗ trợ DOCX, XLSX (Excel), PDF. File Word và Excel giúp AI đọc và phân tích cấu trúc bài học tốt nhất."}
                                            </p>
                                        </div>
                                        <label className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm cursor-pointer transition-colors font-medium">
                                            <FileText className="w-4 h-4" />
                                            <span>Chọn Giáo án / PPCT (DOCX, PDF, XLSX)</span>
                                            <input type="file" className="hidden" accept=".docx,.pdf,.xlsx,.xls" onChange={handleFileUpload} />
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && analysisResult && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Thông tin bài học</h3>
                                    <ul className="space-y-2 text-sm">
                                        <li><span className="font-semibold text-slate-700">Tên bài:</span> {analysisResult.topic}</li>
                                        <li><span className="font-semibold text-slate-700">Khối lớp:</span> {analysisResult.grade}</li>
                                        <li><span className="font-semibold text-slate-700">Môn học:</span> {analysisResult.subject}</li>
                                    </ul>
                                </div>
                                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                                    <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <Bot className="w-4 h-4" /> Đề xuất điểm chạm NLS/NL AI
                                    </h3>
                                    <p className="text-xs text-slate-600">{analysisResult.aiSuggestions?.length || 0} điểm tích hợp NLS/NL AI được tìm thấy.</p>
                                </div>
                            </div>

                            {file && !file.name.toLowerCase().endsWith(".docx") && (
                                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-amber-900">Cần file DOCX để tích hợp mà vẫn giữ nguyên giáo án gốc</p>
                                        <p className="text-xs text-amber-800 mt-1">PDF có thể giúp AI đọc và gợi ý, nhưng không thể chèn trực tiếp để bảo toàn đầy đủ hình ảnh, bảng, biểu đồ, hình vẽ và công thức như file Word gốc.</p>
                                    </div>
                                </div>
                            )}

                            {/* NEW: Content from new textbook */}
                            {analysisResult.newContentFromTextbook?.length > 0 && (
                                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
                                    <h3 className="text-sm font-bold text-amber-700 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        Nội dung SGK mới còn thiếu trong Giáo án cũ ({analysisResult.newContentFromTextbook.length} mục)
                                    </h3>
                                    <ul className="space-y-1.5">
                                        {analysisResult.newContentFromTextbook.map((item: string, idx: number) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm text-amber-900">
                                                <span className="font-bold mt-0.5 shrink-0">•</span>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="text-xs text-amber-600">✅ AI sẽ tự động bổ sung các nội dung này khi tạo giáo án nâng cấp.</p>
                                </div>
                            )}

                            {/* Social Integration Suggestions from AI */}
                            {analysisResult.socialSuggestions?.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <Users className="w-4 h-4 text-green-600" />
                                        AI đề xuất Nội dung lồng ghép bắt buộc phù hợp với SGK mới
                                    </h3>
                                    <div className="space-y-2">
                                        {analysisResult.socialSuggestions.map((sug: any, idx: number) => (
                                            <div key={idx} className={`rounded-xl border p-3 ${getSocialThemeColor(sug.theme)}`}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-xs px-2 py-0.5 rounded-full bg-white/70">{sug.theme}</span>
                                                    <span className="font-semibold text-sm">{sug.activityName}</span>
                                                </div>
                                                <p className="text-xs">{sug.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Manual Social Integration Selection */}
                            <div className="space-y-4 pt-2">
                                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-blue-600" />
                                    Chọn Nội dung lồng ghép bắt buộc (Theo quy định Bộ GD&ĐT)
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {[
                                        { id: "Heritage", label: "🏛️ Giáo dục Di sản văn hóa" },
                                        { id: "DrugPrevention", label: "🚫 Phòng chống Ma túy & Thuốc lá" },
                                        { id: "Population", label: "👨‍👩‍👧 Dân số & Phát triển bền vững" },
                                        { id: "Inclusive", label: "🤝 Giáo dục Hòa nhập" }
                                    ].map((item) => (
                                        <label key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-all">
                                            <input
                                                type="checkbox"
                                                checked={selectedSocialIntegrations.includes(item.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedSocialIntegrations([...selectedSocialIntegrations, item.id]);
                                                    } else {
                                                        setSelectedSocialIntegrations(selectedSocialIntegrations.filter(id => id !== item.id));
                                                    }
                                                }}
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm font-medium text-slate-700">{item.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* AI Activity Suggestions */}
                            <div className="space-y-4 pt-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-indigo-600" />
                                            ✨ Điểm chạm NLS / NL AI do AI tự động đọc và đề xuất
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            AI đã phân tích các hoạt động trong giáo án và tự động đề xuất mã NLS (TT 02/2025 mức NC) & mã NL AI (QĐ 2422).
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Đã tự động chọn ({selectedIntegrations.length}/{analysisResult.aiSuggestions?.length || 0})
                                        </span>
                                        {analysisResult.aiSuggestions && analysisResult.aiSuggestions.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (selectedIntegrations.length === analysisResult.aiSuggestions.length) {
                                                        setSelectedIntegrations([]);
                                                    } else {
                                                        setSelectedIntegrations([...analysisResult.aiSuggestions]);
                                                    }
                                                }}
                                                className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline ml-1"
                                            >
                                                {selectedIntegrations.length === analysisResult.aiSuggestions.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                {analysisResult.aiSuggestions?.map((sug: any, idx: number) => {
                                    const usesNls = suggestionUsesNls(sug);
                                    const usesAi = suggestionUsesAi(sug);
                                    const validNlsCode = hasValidNlsCode(sug.suggestedNLS);
                                    const validCode = hasValidAiCode(sug.suggestedAI);
                                    const nlsNeedsReview = usesNls && !validNlsCode;
                                    const aiNeedsReview = usesAi && !validCode;
                                    const canApply = hasUsableIntegration(sug);
                                    const aiFields = usesAi ? buildAiOrderedFields(sug) : null;
                                    const isSelected = selectedIntegrations.includes(sug);
                                    const isSelClass = isSelected
                                        ? "border-blue-600 bg-blue-50/70 shadow-sm"
                                        : "border-slate-200 hover:border-slate-300 bg-white";
                                    const circleClass = isSelected ? "bg-blue-600 text-white" : "bg-slate-200";

                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => toggleIntegration(sug)}
                                            className={"cursor-pointer border-2 transition-all rounded-xl p-4 flex gap-4 " + isSelClass}
                                        >
                                            <div className="pt-1">
                                                <div className={"w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs transition-colors " + circleClass}>
                                                    {isSelected ? <CheckCircle2 className="w-4 h-4 text-white" /> : idx + 1}
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start mb-1">
                                                    <h4 className="font-bold text-slate-800">{sug.activityName}</h4>
                                                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                                                        <span className="px-2 py-0.5 font-bold text-xs rounded-md bg-slate-100 text-slate-700">{getIntegrationDecision(sug)}</span>
                                                        {usesNls && <span className={`px-2 py-0.5 font-bold text-xs rounded-md ${nlsNeedsReview ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-700"}`}>{sug.suggestedNLS || "1.1.NCa"}</span>}
                                                        {usesAi && <span className={`px-2 py-0.5 font-bold text-xs rounded-md ${validCode ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-800"}`}>{sug.suggestedAI || "NLc-10.C3.1"}</span>}
                                                    </div>
                                                </div>
                                                {sug.targetContent && <p className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mb-2"><span className="font-bold">Vị trí chèn — {sug.targetSection || "Nội dung"}:</span> “{compactSentence(sug.targetContent, 180)}”</p>}
                                                {sug.yccdEvidence && <p className="text-sm text-slate-600 mb-2"><span className="font-semibold text-slate-700">Căn cứ YCCĐ:</span> {sug.yccdEvidence}</p>}
                                                {usesNls && <p className="text-sm text-red-600 font-semibold mb-2">Mã chỉ báo NLS: {sug.suggestedNLS || "1.1.NCa"}; Thành phần NLS: {sug.nlsCompetencyName}</p>}
                                                {usesAi && aiFields && <p className="text-sm text-red-600 font-semibold mb-2">{buildAiIdentityText(aiFields)}</p>}
                                                <p className="text-sm text-slate-600 mb-2"><span className="font-semibold text-slate-700">Lý do:</span> {sug.reason}</p>
                                                <p className="text-sm text-slate-600"><span className="font-semibold text-slate-700">Hành động của HS:</span> {sug.action}</p>
                                                {sug.geoDataRequirement && (
                                                    <div className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-950 space-y-1">
                                                        <p className="font-bold text-cyan-800">Bảng số liệu / biểu đồ Địa lí bắt buộc</p>
                                                        <p><span className="font-semibold">Bảng:</span> {sug.geoDataRequirement.dataTable}</p>
                                                        <p><span className="font-semibold">Biểu đồ:</span> {sug.geoDataRequirement.chart}</p>
                                                        <p><span className="font-semibold">Nguồn:</span> {sug.geoDataRequirement.dataSource}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                <button
                                    onClick={() => setStep(1)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Tải file khác
                                </button>
                                <button
                                    onClick={handleApply}
                                    disabled={selectedIntegrations.length === 0 || isGeneratingDocx || !file?.name.toLowerCase().endsWith(".docx")}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl shadow-sm text-sm font-bold flex items-center gap-2 transition-colors"
                                >
                                    {isGeneratingDocx ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Đang chèn nội dung...</>
                                    ) : (
                                        <><Sparkles className="w-4 h-4" /> {file?.name.toLowerCase().endsWith(".docx") ? "Chèn NLS/NL AI vào File DOCX" : "Vui lòng tải DOCX để giữ nguyên"}</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ===== STEP 3: PREVIEW BEFORE DOWNLOAD ===== */}
                    {step === 3 && injectionResult && (
                        <div className="space-y-6">
                            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 sticky top-6 z-10 bg-brand-bg/85 backdrop-blur-md py-2 px-1">
                                <div className="min-w-0">
                                    <h3 className="text-xl font-extrabold text-brand-sidebar line-clamp-1">
                                        GIÁO ÁN GỐC ĐÃ NÂNG CẤP: {analysisResult?.topic || file?.name || "Bản DOCX bảo toàn"}
                                    </h3>
                                    <div className="text-[10px] text-brand-muted font-bold uppercase flex flex-wrap items-center gap-2 mt-1">
                                        DOCX gốc + NLS/NL AI
                                        <span className="w-1 h-1 bg-brand-muted rounded-full"></span>
                                        Môn: {analysisResult?.subject || "..."}
                                        <span className="w-1 h-1 bg-brand-muted rounded-full"></span>
                                        Lớp: {analysisResult?.grade || "..."}
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        onClick={handleConfirmDownload}
                                        disabled={isUpdatingDocxWithAssessment}
                                        className={`${previewToolbarButtonClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                                        title="Tải xuống Word DOCX giữ nguyên giáo án gốc"
                                    >
                                        {isUpdatingDocxWithAssessment ? <Loader2 className="w-4 h-4 text-blue-600 animate-spin" /> : <FileDown className="w-4 h-4 text-blue-600" />}
                                    </button>
                                    <button onClick={handleDownloadPreviewPdf} className={previewToolbarButtonClass} title="Tải xuống PDF xem nhanh">
                                        <FileDown className="w-4 h-4 text-red-500" />
                                    </button>
                                    <button onClick={handleDownloadPreviewText} className={previewToolbarButtonClass} title="Tải xuống Text (.txt)">
                                        <FileText className="w-4 h-4 text-brand-muted" />
                                    </button>
                                    <button onClick={handleDownloadPreviewHtml} className={previewToolbarButtonClass} title="Tải xuống HTML xem nhanh">
                                        <FileCode className="w-4 h-4 text-orange-500" />
                                    </button>
                                    <button onClick={handleDownloadAssessmentText} disabled={!assessmentPreview.length && !preservedAssessmentResult} className={previewToolbarButtonClass} title="Tải nội dung đánh giá">
                                        <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                                    </button>
                                    <button onClick={() => window.print()} className={previewToolbarButtonClass} title="In">
                                        <Printer className="w-4 h-4 text-brand-muted" />
                                    </button>
                                    <button
                                        onClick={() => setStep(2)}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-indigo-700 transition-colors"
                                    >
                                        Chỉnh sửa
                                    </button>
                                    <button
                                        onClick={handleStartOver}
                                        className="px-4 py-2 bg-brand-sidebar text-white rounded-lg text-xs font-bold shadow-md hover:bg-slate-900 transition-colors"
                                    >
                                        Tạo mới
                                    </button>
                                    <button
                                        onClick={handleCreateTeacherPlan}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
                                    >
                                        <Calendar className="w-3 h-3" /> Lập KH Giáo dục GV
                                    </button>
                                    <button
                                        onClick={handleShowAssessmentDesign}
                                        disabled={isDesigningAssessment}
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {isDesigningAssessment ? <Loader2 className="w-3 h-3 animate-spin" /> : <ClipboardCheck className="w-3 h-3" />}
                                        {isDesigningAssessment ? "Đang thiết kế..." : "Thiết kế đánh giá"}
                                    </button>
                                    <button
                                        onClick={handleEvaluatePreservedCouncil}
                                        disabled={isEvaluatingPreservedCouncil}
                                        className="px-4 py-2 bg-brand-accent text-white rounded-lg text-xs font-bold shadow-md hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {isEvaluatingPreservedCouncil ? <Loader2 className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3 h-3" />}
                                        {isEvaluatingPreservedCouncil ? "Đang phản biện..." : "Đánh giá Hội đồng AI"}
                                    </button>
                                </div>
                            </div>

                            {/* Header Summary */}
                            <div className={`rounded-xl p-4 border flex items-start gap-3 ${injectionResult.injectedCount > 0 ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                                <div className={`rounded-full p-1.5 mt-0.5 ${injectionResult.injectedCount > 0 ? "bg-green-100" : "bg-amber-100"}`}>
                                    <CheckCircle2 className={`w-5 h-5 ${injectionResult.injectedCount > 0 ? "text-green-600" : "text-amber-600"}`} />
                                </div>
                                <div>
                                    <p className={`font-bold text-sm ${injectionResult.injectedCount > 0 ? "text-green-800" : "text-amber-800"}`}>
                                        ✅ Đã chèn thành công {injectionResult.injectedCount}/{injectionResult.previewItems.length} mục bổ sung
                                    </p>
                                    <p className="text-xs text-slate-600 mt-1">
                                        File: <span className="font-semibold">{file?.name.replace(".docx", "_AI_NangCap.docx")}</span> đã sẵn sàng tải xuống.
                                        {injectionResult.skippedActivities.length > 0 && (
                                            <span className="text-amber-700"> ({injectionResult.skippedActivities.length} hoạt động chưa tìm được đoạn nguyên văn hoặc mục con tương ứng nên được bỏ qua để tránh chèn sai.)</span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-emerald-950">Đã kiểm tra bảo toàn giáo án gốc trong file DOCX</p>
                                        <p className="text-xs text-emerald-900 mt-1">
                                            File tải xuống được tạo bằng cách chèn bổ sung vào chính DOCX gốc. App không tái tạo lại giáo án bằng văn bản nên hình ảnh, bảng, biểu đồ, hình vẽ, đối tượng nhúng và công thức trong gói Word được giữ lại.
                                            Phần NLS/NL AI được đặt trong I. MỤC TIÊU - thành phần Năng lực, sau Năng lực chung và Năng lực đặc thù môn học; các hoạt động dạy học có tích hợp đều được đánh dấu bằng chữ màu đỏ.
                                        </p>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                                            {[
                                                ["Thành phần Word", `${injectionResult.preservationReport.outputPackageParts}/${injectionResult.preservationReport.originalPackageParts}`],
                                                ["Ảnh", injectionResult.preservationReport.mediaParts],
                                                ["Bảng", injectionResult.preservationReport.tableCount],
                                                ["Công thức", injectionResult.preservationReport.mathCount],
                                                ["Biểu đồ", injectionResult.preservationReport.chartParts],
                                                ["Hình vẽ/diagram", injectionResult.preservationReport.diagramParts],
                                                ["Đối tượng nhúng", injectionResult.preservationReport.embeddedParts],
                                                ["Hình trong nội dung", injectionResult.preservationReport.drawingCount]
                                            ].map(([label, value]) => (
                                                <div key={String(label)} className="rounded-lg bg-white/80 border border-emerald-100 p-2">
                                                    <p className="text-[11px] uppercase tracking-wide text-emerald-700 font-bold">{label}</p>
                                                    <p className="text-sm font-bold text-emerald-950">{value}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-start gap-3">
                                        <FileDown className="w-5 h-5 text-sky-700 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-sm font-bold text-sky-950">Chế độ xuất file đã kiểm định</p>
                                            <p className="text-xs text-sky-900 mt-1 leading-relaxed">
                                                DOCX là bản chuẩn vì được chèn trực tiếp vào file gốc và đã kiểm tra bảo toàn. HTML/PDF/TXT chỉ dùng để xem nhanh, đối chiếu hoặc chia sẻ nội dung kiểm tra.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[11px] font-black sm:grid-cols-4">
                                        <span className="rounded-lg bg-white/80 px-3 py-2 text-emerald-700">DOCX: bản chuẩn</span>
                                        <span className="rounded-lg bg-white/80 px-3 py-2 text-sky-700">HTML: xem nhanh</span>
                                        <span className="rounded-lg bg-white/80 px-3 py-2 text-red-700">PDF: xem nhanh</span>
                                        <span className="rounded-lg bg-white/80 px-3 py-2 text-slate-700">TXT: đối chiếu</span>
                                    </div>
                                </div>
                            </div>

                            <div className="glass rounded-[24px] p-6 shadow-xl border border-white/70">
                                <section className="space-y-5">
                                    <h4 className="text-base font-extrabold text-brand-sidebar border-t border-slate-100 pt-4 uppercase tracking-tight flex items-center gap-3">
                                        <span className="w-1 h-6 bg-brand-accent rounded-full"></span>
                                        I. MỤC TIÊU - THỨ TỰ THÀNH PHẦN NĂNG LỰC
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-2">
                                        <div className="space-y-4">
                                            <div>
                                                <span className="inline-block px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-brand-muted uppercase mb-3 border border-slate-200">1. Năng lực chung</span>
                                                <p className="text-xs leading-relaxed text-brand-dark">Giữ nguyên nội dung trong giáo án gốc.</p>
                                            </div>
                                            <div>
                                                <span className="inline-block px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-emerald-700 uppercase mb-3 border border-slate-200">2. Năng lực đặc thù môn học</span>
                                                <p className="text-xs leading-relaxed text-brand-dark">Giữ nguyên nội dung trong giáo án gốc.</p>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <span className="inline-block px-2 py-1 bg-red-50 rounded text-[10px] font-bold text-red-600 uppercase mb-3 border border-red-100">3. Năng lực số</span>
                                                <ul className="list-disc list-inside space-y-2 text-red-600 text-xs leading-relaxed font-medium">
                                                    {buildNlsObjectiveLines().map((line, idx) => <li key={idx}>{line.replace(/^\d+\.\s*/, "")}</li>)}
                                                </ul>
                                            </div>
                                            <div>
                                                <span className="inline-block px-2 py-1 bg-red-50 rounded text-[10px] font-bold text-red-600 uppercase mb-3 border border-red-100">4. Năng lực AI đặc thù (2422)</span>
                                                <ul className="list-disc list-inside space-y-2 text-red-600 text-xs leading-relaxed italic font-medium">
                                                    {buildAiObjectiveLines().map((line, idx) => <li key={idx}>{line.replace(/^\d+\.\s*/, "")}</li>)}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Full lesson preview */}
                            {fullPreviewText && (
                                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="flex items-center gap-2">
                                            <Eye className="w-4 h-4 text-blue-700" />
                                            <div>
                                                <p className="text-sm font-bold text-blue-900">Xem trước giáo án DOCX sau tích hợp trên màn hình</p>
                                                <p className="text-xs text-blue-800 mt-0.5">Bản xem trước HTML dùng để kiểm tra nhanh. Bản DOCX tải xuống là bản giữ nguyên định dạng gốc đầy đủ nhất.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mb-3 rounded-lg border border-indigo-100 bg-white/80 p-3 text-xs leading-relaxed text-indigo-900">
                                        Màn hình này là bản xem nhanh được bóc trực tiếp từ DOCX đã chèn. Bản DOCX tải xuống mới là bản bảo toàn nghiêm ngặt toàn bộ bảng, biểu đồ, hình vẽ, ảnh, đối tượng nhúng và công thức của giáo án gốc.
                                    </div>
                                    <div className="max-h-[620px] overflow-y-auto rounded-lg bg-slate-100 border border-blue-100 p-4">
                                        <style>{`
                                            .docx-preview-page { max-width: 794px; min-height: 1123px; margin: 0 auto; background: #fff; padding: 42px 48px; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.16); color: #111827; font-family: "Times New Roman", Arial, sans-serif; }
                                            .docx-preview-html table { border-collapse: collapse; width: 100%; margin: 12px 0; }
                                            .docx-preview-html td, .docx-preview-html th { border: 1px solid #cbd5e1; padding: 6px; vertical-align: top; }
                                            .docx-preview-html img { max-width: 100%; height: auto; }
                                            .docx-preview-html p { margin: 0 0 8px; }
                                            .docx-preview-html ul, .docx-preview-html ol { padding-left: 24px; margin: 8px 0; }
                                            .docx-preview-html .docx-ai-red, .docx-preview-html span[style*="FF0000"], .docx-preview-html span[style*="ff0000"], .docx-preview-html span[style*="red"] { color: #dc2626 !important; font-weight: 700; }
                                            @media (max-width: 768px) { .docx-preview-page { min-height: auto; padding: 24px 18px; } }
                                        `}</style>
                                        {fullPreviewHtml ? (
                                            <div className="docx-preview-page docx-preview-html text-[13px] leading-relaxed text-slate-900" dangerouslySetInnerHTML={{ __html: fullPreviewHtml }} />
                                        ) : (
                                            <pre className="docx-preview-page text-[13px] leading-relaxed text-slate-900 whitespace-pre-wrap">{fullPreviewText}</pre>
                                        )}
                                    </div>
                                    {previewHtmlWarning && (
                                        <p className="text-xs text-amber-700 mt-2">
                                            Lưu ý xem trước: {previewHtmlWarning}
                                        </p>
                                    )}
                                </div>
                            )}

                            {(assessmentPreview.length > 0 || showAssessmentDesign || preservedAssessmentResult || isDesigningAssessment) && (
                                <div id="upgrade-assessment-panel" className={`rounded-xl border p-4 ${showAssessmentDesign ? "border-emerald-400 bg-emerald-50 shadow-lg shadow-emerald-100/70" : "border-emerald-200 bg-emerald-50/60"}`}>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-2">
                                            <Bot className="w-4 h-4 text-emerald-700" />
                                            <div>
                                                <p className="text-sm font-bold text-emerald-900">Thiết kế đánh giá sau tích hợp</p>
                                                <p className="text-xs text-emerald-800 mt-0.5">Thiết kế này bám trên giáo án gốc đã được chèn trực tiếp, không thay thế hoặc rút gọn nội dung giáo án.</p>
                                            </div>
                                        </div>
                                        <button onClick={handleDownloadAssessmentText} disabled={!assessmentPreview.length && !preservedAssessmentResult} className="px-3 py-2 bg-white border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-50 w-fit disabled:opacity-50">
                                            Tải nội dung đánh giá
                                        </button>
                                    </div>
                                    {isDesigningAssessment && (
                                        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-white/80 p-4 text-sm font-semibold text-emerald-800">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Đang thiết kế bộ đánh giá đầy đủ như PL4 từ giáo án DOCX đã bảo toàn...
                                        </div>
                                    )}

                                    {preservedAssessmentResult && (
                                        <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-white/85 px-3 py-2 text-xs font-semibold text-emerald-800">
                                            {isUpdatingDocxWithAssessment ? (
                                                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                                            ) : (
                                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                                            )}
                                            <span>
                                                {isUpdatingDocxWithAssessment
                                                    ? "Đang đưa thiết kế đánh giá vào KHBD để xuất file..."
                                                    : assessmentEmbeddedInDocx
                                                        ? "Thiết kế đánh giá đã được đưa vào file KHBD tải xuống, giữ nguyên giáo án gốc và bổ sung bằng chữ màu đỏ."
                                                        : "Khi tải DOCX, app sẽ tự đưa thiết kế đánh giá vào KHBD và giữ nguyên giáo án gốc."}
                                            </span>
                                        </div>
                                    )}

                                    {preservedAssessmentResult && (
                                        <div className="space-y-8 pt-2">
                                            <header className="flex items-center gap-3 border-t border-emerald-100 pt-5">
                                                <div className="p-3 bg-emerald-100 rounded-2xl">
                                                    <ClipboardCheck className="w-6 h-6 text-emerald-600" />
                                                </div>
                                                <div>
                                                    <h4 className="text-xl font-black text-brand-sidebar uppercase tracking-tight">Hệ thống đánh giá năng lực</h4>
                                                    <p className="text-xs text-brand-muted font-bold uppercase tracking-widest mt-1">Chuẩn QĐ 2422/QĐ-BGDĐT & Chương trình GDPT 2018</p>
                                                </div>
                                            </header>

                                            <div className="space-y-6">
                                                <h5 className="text-sm font-extrabold text-emerald-700 bg-white px-4 py-2 rounded-lg inline-flex items-center gap-2 border border-emerald-100">
                                                    <CheckCircle2 className="w-4 h-4" /> 1. TIÊU CHÍ ĐÁNH GIÁ (RUBRICS)
                                                </h5>
                                                <div className="grid grid-cols-1 gap-6">
                                                    {list(preservedAssessmentResult.rubrics).map((rubric: any, idx: number) => (
                                                        <div key={idx} className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                                            <table className="w-full text-left border-collapse min-w-[600px]">
                                                                <thead>
                                                                    <tr className="bg-slate-50 border-b border-slate-200">
                                                                        <th className="p-4 text-[10px] font-black text-brand-sidebar uppercase tracking-wider w-1/4">Năng lực: {rubric?.competencyName || "Năng lực cần đánh giá"}</th>
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
                                                                                {list(rubric?.criteria).map((c: string, ci: number) => <li key={ci}>{c}</li>)}
                                                                            </ul>
                                                                        </td>
                                                                        <td className="p-4 text-[11px] text-brand-dark align-top leading-relaxed">{rubric?.levels?.level1 || ""}</td>
                                                                        <td className="p-4 text-[11px] text-brand-dark align-top leading-relaxed">{rubric?.levels?.level2 || ""}</td>
                                                                        <td className="p-4 text-[11px] text-brand-dark align-top leading-relaxed">{rubric?.levels?.level3 || ""}</td>
                                                                        <td className="p-4 text-[11px] text-brand-dark align-top leading-relaxed">{rubric?.levels?.level4 || ""}</td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div className="space-y-4">
                                                    <h5 className="text-sm font-extrabold text-blue-700 bg-white px-4 py-2 rounded-lg inline-flex items-center gap-2 border border-blue-100">
                                                        <Search className="w-4 h-4" /> 2. ĐÁNH GIÁ THƯỜNG XUYÊN
                                                    </h5>
                                                    <div className="space-y-4">
                                                        {list(preservedAssessmentResult.formativeAssessment?.quizzes).map((q: any, qi: number) => (
                                                            <div key={`quiz-${qi}`} className="p-4 bg-white rounded-xl border border-slate-100 space-y-3">
                                                                <p className="text-[12px] font-bold text-brand-sidebar">Câu {qi + 1}: {stripQuestionPrefix(q?.question)}</p>
                                                                {renderAssessmentQuestionSupport(q)}
                                                                <div className="grid grid-cols-1 gap-2">
                                                                    {uniqueByText(list(q?.options), stripChoicePrefix).map((opt: string, oi: number) => (
                                                                        <div key={oi} className="flex items-center gap-2 text-[11px] text-brand-muted bg-slate-50 p-2 rounded-lg border border-slate-200">
                                                                            <span className="w-5 h-5 flex items-center justify-center bg-white rounded-full text-[9px] font-bold">{optionLabel(oi)}</span>
                                                                            {stripChoicePrefix(opt)}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <p className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded inline-block">Đáp án: {q?.answer}</p>
                                                            </div>
                                                        ))}

                                                        {list(preservedAssessmentResult.formativeAssessment?.part1_multipleChoice).length > 0 && (
                                                            <div className="space-y-3">
                                                                <h6 className="text-[11px] font-bold text-slate-500 uppercase">Phần I: Trắc nghiệm khách quan nhiều lựa chọn</h6>
                                                                {list(preservedAssessmentResult.formativeAssessment?.part1_multipleChoice).map((q: any, qi: number) => (
                                                                    <div key={`mc-${qi}`} className="p-4 bg-white rounded-xl border border-slate-100 space-y-3">
                                                                        <p className="text-[12px] font-bold text-brand-sidebar">Câu {qi + 1}: {stripQuestionPrefix(q?.question)}</p>
                                                                        {renderAssessmentQuestionSupport(q)}
                                                                        <div className="grid grid-cols-1 gap-2">
                                                                            {uniqueByText(list(q?.options), stripChoicePrefix).map((opt: string, oi: number) => (
                                                                                <div key={oi} className="flex items-center gap-2 text-[11px] text-brand-muted bg-slate-50 p-2 rounded-lg border border-slate-200">
                                                                                    <span className="w-5 h-5 flex items-center justify-center bg-white rounded-full text-[9px] font-bold">{optionLabel(oi)}</span>
                                                                                    {stripChoicePrefix(opt)}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                        <p className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded inline-block">Đáp án: {q?.answer}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {list(preservedAssessmentResult.formativeAssessment?.part2_trueFalse).length > 0 && (
                                                            <div className="space-y-3 mt-4">
                                                                <h6 className="text-[11px] font-bold text-slate-500 uppercase">Phần II: Trắc nghiệm Đúng/Sai</h6>
                                                                {list(preservedAssessmentResult.formativeAssessment?.part2_trueFalse).map((q: any, qi: number) => (
                                                                    <div key={`tf-${qi}`} className="p-4 bg-white rounded-xl border border-slate-100 space-y-3">
                                                                        <p className="text-[12px] font-bold text-brand-sidebar">Câu {qi + 1}: {stripQuestionPrefix(q?.question)}</p>
                                                                        {renderAssessmentQuestionSupport(q)}
                                                                        <div className="grid grid-cols-1 gap-2">
                                                                            {uniqueByText(list(q?.statements), stripChoicePrefix).map((stmt: string, oi: number) => (
                                                                                <div key={oi} className="flex flex-col gap-1 text-[11px] text-brand-muted bg-slate-50 p-2 rounded-lg border border-slate-200">
                                                                                    <div className="flex items-start gap-2">
                                                                                        <span className="w-5 h-5 flex items-center justify-center bg-white rounded-full text-[9px] font-bold shrink-0">{optionLabel(oi)}</span>
                                                                                        <span>{stripChoicePrefix(stmt)}</span>
                                                                                    </div>
                                                                                    <p className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded self-start mt-1">Đáp án: {q?.answers?.[oi]}</p>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {list(preservedAssessmentResult.formativeAssessment?.part3_shortAnswer).length > 0 && (
                                                            <div className="space-y-3 mt-4">
                                                                <h6 className="text-[11px] font-bold text-slate-500 uppercase">Phần III: Trả lời ngắn / Tính toán</h6>
                                                                {list(preservedAssessmentResult.formativeAssessment?.part3_shortAnswer).map((q: any, qi: number) => (
                                                                    <div key={`short-${qi}`} className="p-4 bg-white rounded-xl border border-slate-100 space-y-3">
                                                                        <p className="text-[12px] font-bold text-brand-sidebar">Câu {qi + 1}: {stripQuestionPrefix(q?.question)}</p>
                                                                        {renderAssessmentQuestionSupport(q)}
                                                                        <p className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-2 rounded-lg border border-emerald-100">Đáp án: {q?.answer}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {list(preservedAssessmentResult.formativeAssessment?.checklists).length > 0 && (
                                                            <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl bg-white">
                                                                <p className="text-[10px] font-black text-brand-sidebar uppercase mb-3 opacity-70">Bảng kiểm (Checklist) tiến trình</p>
                                                                <ul className="space-y-2">
                                                                    {list(preservedAssessmentResult.formativeAssessment?.checklists).map((c: string, ci: number) => (
                                                                        <li key={ci} className="flex items-start gap-2 text-[11px] text-brand-muted">
                                                                            <div className="w-4 h-4 border border-slate-300 rounded mt-0.5 shrink-0"></div>
                                                                            {c}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <h5 className="text-sm font-extrabold text-indigo-700 bg-white px-4 py-2 rounded-lg inline-flex items-center gap-2 border border-indigo-100">
                                                        <LayoutGrid className="w-4 h-4" /> 3. ĐÁNH GIÁ ĐỊNH KỲ
                                                    </h5>
                                                    <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-2xl text-white space-y-4 shadow-lg shadow-indigo-100 relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                                            <Sparkles className="w-12 h-12" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[9px] font-black uppercase opacity-70 tracking-widest">Nội dung yêu cầu</p>
                                                            <h6 className="text-base font-bold leading-tight">{preservedAssessmentResult.summativeAssessment?.projectOrTest}</h6>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <p className="text-[9px] font-black uppercase opacity-70 tracking-widest">Tiêu chí bổ sung</p>
                                                            <ul className="list-disc list-inside space-y-1 text-[11px] opacity-90 leading-relaxed font-medium">
                                                                {list(preservedAssessmentResult.summativeAssessment?.requirements).map((r: string, ri: number) => <li key={ri}>{r}</li>)}
                                                            </ul>
                                                        </div>
                                                    </div>

                                                    {list(preservedAssessmentResult.feedbackSamples).length > 0 && (
                                                        <div className="space-y-4 pt-4">
                                                            <h5 className="text-sm font-extrabold text-brand-muted flex items-center gap-2">
                                                                <AlertCircle className="w-4 h-4 text-emerald-500" /> 4. MẪU NHẬN XÉT CHI TIẾT
                                                            </h5>
                                                            <div className="grid grid-cols-1 gap-3">
                                                                {list(preservedAssessmentResult.feedbackSamples).map((fb: any, fi: number) => (
                                                                    <div key={fi} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm space-y-1">
                                                                        <p className="text-[9px] font-black uppercase tracking-wider text-brand-muted">{fb?.level}</p>
                                                                        <p className="text-[11px] text-brand-dark italic leading-relaxed">"{fb?.sampleText}"</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {!preservedAssessmentResult && !isDesigningAssessment && (
                                        <div className="space-y-3">
                                            {renderAssessmentPreviewLines()}
                                        </div>
                                    )}
                                </div>
                            )}

                            {preservedCouncilEvaluation && (
                                <div id="upgrade-council-panel" className="glass rounded-[24px] p-6 shadow-xl border-l-4 border-l-brand-accent animate-in fade-in slide-in-from-top-4">
                                    <h3 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <BrainCircuit className="w-6 h-6 text-brand-accent" />
                                        Báo cáo đánh giá trên giáo án gốc đã nâng cấp
                                        {preservedCouncilEvaluation.overallScore && (
                                            <span className="ml-auto text-brand-accent text-2xl font-black">{preservedCouncilEvaluation.overallScore}/10</span>
                                        )}
                                    </h3>
                                    <p className="text-xs text-slate-600 mb-5">
                                        Hội đồng AI chỉ phản biện bản DOCX gốc đã được chèn NLS/NL AI. App không tạo lại, không thay thế và không lược bỏ nội dung giáo án gốc trong bước này.
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {[
                                            ["Chuyên gia giáo dục", preservedCouncilEvaluation.educationalExpert],
                                            ["Chuyên gia công nghệ", preservedCouncilEvaluation.digitalExpert],
                                            ["Chuyên gia phản biện AI", preservedCouncilEvaluation.aiExpert]
                                        ].map(([title, item]: any) => (
                                            <div key={title} className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                                <h4 className="font-bold text-sm text-brand-sidebar uppercase border-b border-slate-200 pb-2">{title}</h4>
                                                <div><span className="text-xs font-bold text-emerald-600">Ưu điểm:</span><p className="text-xs text-slate-700 mt-1">{item?.strengths || "Đã ghi nhận nội dung bảo toàn giáo án gốc."}</p></div>
                                                <div><span className="text-xs font-bold text-amber-600">Hạn chế:</span><p className="text-xs text-slate-700 mt-1">{item?.weaknesses || "Cần đối chiếu lại bản DOCX tải xuống nếu giáo án có công thức hoặc đối tượng Word phức tạp."}</p></div>
                                                <div><span className="text-xs font-bold text-brand-accent">Đề xuất:</span><p className="text-xs text-slate-700 mt-1">{item?.suggestions || "Tiếp tục sử dụng bản DOCX giữ nguyên làm bản chính thức."}</p></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Preview list of injected content */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Eye className="w-4 h-4 text-blue-600" />
                                    <p className="text-sm font-bold text-slate-700">Kiểm tra nội dung AI đã chèn:</p>
                                </div>
                                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                                    {injectionResult.previewItems.map((item, idx) => (
                                        <div key={idx} className={`rounded-xl border p-4 ${item.found ? "border-green-200 bg-green-50/60" : "border-amber-200 bg-amber-50/60"}`}>
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <p className="text-sm font-semibold text-slate-800 flex-1">{item.activityName}</p>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${item.found ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                                    {item.found ? "✓ Đã chèn đúng hoạt động và nội dung" : "⚠ Chưa chèn — chưa tìm được đoạn nguyên văn hoặc mục con trong hoạt động"}
                                                </span>
                                            </div>
                                            <div className="bg-white rounded-lg border border-red-200 p-3">
                                                <p className="text-xs font-mono text-red-700 whitespace-pre-wrap leading-relaxed">{item.injectedText}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-4 border-t border-slate-100">
                                <button
                                    onClick={() => setStep(2)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                                >
                                    ← Chỉnh sửa lại
                                </button>
                                <div className="flex flex-wrap gap-3 justify-end">
                                    <button
                                        onClick={handleStartOver}
                                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors border border-slate-200"
                                    >
                                        Tải file khác
                                    </button>
                                    <button
                                        onClick={handleConfirmDownload}
                                        disabled={isUpdatingDocxWithAssessment}
                                        className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-sm text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {isUpdatingDocxWithAssessment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                        {isUpdatingDocxWithAssessment ? "Đang chèn đánh giá..." : "Tải DOCX giữ nguyên giáo án gốc"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

