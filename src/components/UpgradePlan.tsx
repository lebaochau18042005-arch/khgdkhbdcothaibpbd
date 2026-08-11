import React, { useState } from "react";
// @ts-ignore
import * as mammoth from "mammoth";
import { UploadCloud, CheckCircle2, Bot, Zap, Loader2, Sparkles, FileText, ImagePlus, X, BookOpen, AlertTriangle, Users, Download, Eye } from "lucide-react";
import { analyzeExistingPlan, generateDirectSnippets } from "../services/geminiService";
import { injectSnippetsIntoDocx, InjectionResult } from "../utils/docxInjector";
import { saveAs } from "file-saver";

interface TextbookImage {
    mimeType: string;
    data: string;
    previewUrl: string;
    name: string;
}

export default function UpgradePlan({ onUpgradeReady, apiKey, isOnline = true }: { onUpgradeReady: (data: any) => void, apiKey: string, isOnline?: boolean }) {
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
            setSelectedIntegrations((analysis.aiSuggestions || []).filter((sug: any) => /^\d{1,2}\.[ABCD]\d+\.\d{1,2}$/i.test(sug?.suggestedAI || "")));
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
            const snippets = await generateDirectSnippets(
                analysisResult.subject || "Khác",
                analysisResult.grade || "10",
                analysisResult.topic || "Bài học nâng cấp",
                selectedIntegrations
            );
            const objectiveText = buildObjectiveText();
            const assessmentText = buildAssessmentText();

            // 2. Inject into DOCX and get preview data
            const result = await injectSnippetsIntoDocx(file, snippets, {
                objectivesText: objectiveText,
                assessmentText: assessmentText
            });
            const preview = await buildDocxHtmlPreview(result.blob);

            // 3. Go to preview step (step 3) instead of downloading directly
            setInjectionResult(result);
            setReadyBlob(result.blob);
            setAssessmentPreview(assessmentText.split("\n").filter(line => line.trim()));
            setFullPreviewText(buildFullPreview(snippets, objectiveText, assessmentText));
            setFullPreviewHtml(preview.html);
            setPreviewHtmlWarning(preview.warning);
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

    const handleConfirmDownload = () => {
        if (!readyBlob || !file) return;
        saveAs(readyBlob, file.name.replace(/\.docx$/i, "_AI_NangCap.docx"));
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

    const hasValidAiCode = (code?: string) => /^\d{1,2}\.[ABCD]\d+\.\d{1,2}$/i.test(code || "");

    const plain = (value?: string) => (value || "").replace(/<bold>|<\/bold>|<ai>|<\/ai>|\*\*/gi, "").trim();

    const buildObjectiveText = (suggestions = selectedIntegrations) => {
        const nlsLines = suggestions.map((sug: any, idx: number) => {
            const code = sug.suggestedNLS || "Không gán mã - cần đối chiếu YCCĐ theo TT 02/CV 3456.";
            const evidence = sug.yccdEvidence || sug.reason || "Căn cứ từ hoạt động học tập đã chọn.";
            return `${idx + 1}. Năng lực số: ${code} - Học sinh ${plain(sug.action).replace(/^Học sinh\s*/i, "")}. Căn cứ: ${plain(evidence)}`;
        });
        const aiLines = suggestions.map((sug: any, idx: number) => {
            const code = sug.suggestedAI || "Không gán mã";
            return `${idx + 1}. Năng lực AI: ${code} - ${plain(sug.reason || sug.action)}`;
        });
        return [
            "Bổ sung vào mục I. MỤC TIÊU:",
            "a) Năng lực số:",
            ...(nlsLines.length ? nlsLines : ["- Không có gợi ý NLS được chọn."]),
            "b) Năng lực AI:",
            ...(aiLines.length ? aiLines : ["- Không có gợi ý NL AI được chọn."])
        ].join("\n");
    };

    const buildAssessmentText = (suggestions = selectedIntegrations) => {
        if (!suggestions.length) return "Chưa có hoạt động tích hợp được chọn để đề xuất đánh giá.";
        return suggestions.map((sug: any, idx: number) => {
            const nls = sug.suggestedNLS || "NLS cần đối chiếu";
            const ai = sug.suggestedAI || "NL AI cần đối chiếu";
            return `${idx + 1}. ${sug.activityName}: đánh giá sản phẩm học tập số/AI của học sinh theo 4 tiêu chí: đúng kiến thức môn học; biết kiểm chứng nguồn/đầu ra AI; sản phẩm rõ ràng, có minh chứng; giải thích được cách dùng công cụ. Minh chứng: prompt, bản chỉnh sửa của học sinh, sản phẩm cuối. Mã liên quan: ${nls}; ${ai}.`;
        }).join("\n");
    };

    const buildFullPreview = (snippets: { activityName: string; text: string }[], objectiveText: string, assessmentText: string) => {
        const original = rawText.trim()
            ? rawText.trim()
            : "Không có toàn văn bóc tách từ DOCX/PDF để hiển thị. File DOCX đã được chèn trực tiếp và có thể tải xuống.";
        const inserted = snippets.map((snippet, idx) => `${idx + 1}. ${snippet.activityName}\n${snippet.text}`).join("\n\n");
        return [
            `KẾ HOẠCH BÀI DẠY SAU TÍCH HỢP AI`,
            `Môn: ${analysisResult?.subject || "..."}`,
            `Lớp: ${analysisResult?.grade || "..."}`,
            `Bài: ${analysisResult?.topic || "..."}`,
            "",
            objectiveText,
            "",
            "II. TOÀN VĂN GIÁO ÁN GỐC / NỘI DUNG ĐÃ BÓC TÁCH",
            original,
            "",
            "III. CÁC ĐOẠN TÍCH HỢP AI ĐÃ CHÈN",
            inserted || "Chưa có đoạn tích hợp.",
            "",
            "IV. GỢI Ý NỘI DUNG ĐÁNH GIÁ",
            assessmentText
        ].join("\n");
    };

    const buildDocxHtmlPreview = async (blob: Blob): Promise<{ html: string; warning: string }> => {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const result = await mammoth.convertToHtml(
                { arrayBuffer },
                {
                    convertImage: mammoth.images.imgElement(async (image: any) => ({
                        src: `data:${image.contentType};base64,${await image.read("base64")}`
                    }))
                }
            );
            const warning = (result.messages || []).length
                ? "Một số thành phần Word phức tạp có thể không hiển thị hoàn hảo trong bản xem nhanh HTML, nhưng vẫn được giữ trong DOCX tải xuống."
                : "";
            return { html: result.value || "", warning };
        } catch (err) {
            console.warn("Không tạo được bản xem trước HTML từ DOCX", err);
            return {
                html: "",
                warning: "Không tạo được bản xem trước HTML. File DOCX đã tích hợp vẫn là bản giữ nguyên cấu trúc gốc để tải xuống."
            };
        }
    };

    const downloadTextFile = (filename: string, content: string, type = "text/plain;charset=utf-8") => {
        const blob = new Blob([content], { type });
        saveAs(blob, filename);
    };

    const escapeHtml = (text: string) => text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const handleDownloadPreviewText = () => {
        if (!fullPreviewText) return;
        downloadTextFile(`${analysisResult?.topic || "Giao_an"}_AI_ToanVan.txt`, fullPreviewText);
    };

    const handleDownloadPreviewHtml = () => {
        if (!fullPreviewText && !fullPreviewHtml) return;
        const body = fullPreviewHtml
            ? `<div class="note">Bản HTML chỉ dùng để xem nhanh. Bản DOCX tải xuống mới là bản bảo toàn nghiêm ngặt hình ảnh, bảng, biểu đồ, hình vẽ và công thức.</div><div class="docx">${fullPreviewHtml}</div>`
            : `<pre>${escapeHtml(fullPreviewText)}</pre>`;
        const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(analysisResult?.topic || "Giáo án tích hợp AI")}</title><style>body{font-family:Arial,sans-serif;line-height:1.6;margin:32px;color:#0f172a}.note{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin-bottom:16px;color:#1e3a8a;font-weight:700}.docx table{border-collapse:collapse;width:100%;margin:12px 0}.docx td,.docx th{border:1px solid #cbd5e1;padding:6px;vertical-align:top}.docx img{max-width:100%;height:auto}pre{white-space:pre-wrap;font-family:Arial,sans-serif}</style></head><body>${body}</body></html>`;
        downloadTextFile(`${analysisResult?.topic || "Giao_an"}_AI_ToanVan.html`, html, "text/html;charset=utf-8");
    };

    const handleOpenFullLessonPlan = () => {
        const objectiveText = buildObjectiveText();
        const assessmentText = buildAssessmentText();
        const selectedNlsIndicators = selectedIntegrations
            .map((sug: any) => ({ code: sug.suggestedNLS, description: `${sug.activityName}: ${sug.yccdEvidence || sug.reason || sug.action}` }))
            .filter((item: any) => item.code && !String(item.code).toLowerCase().includes("không"));
        onUpgradeReady({
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
            additionalNotes: `Nội dung tích hợp đã duyệt:\n${objectiveText}\n\nGợi ý đánh giá:\n${assessmentText}`,
            indicatorCode: selectedIntegrations.find((sug: any) => hasValidAiCode(sug.suggestedAI))?.suggestedAI,
            selectedNlsIndicators
        });
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
                                        <span>Chọn file PL1 (DOCX)</span>
                                        <input type="file" className="hidden" accept=".docx" onChange={handlePl1Upload} />
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
                                                    : "Ưu tiên DOCX để chèn NLS/NL AI và giữ nguyên hình ảnh, bảng, biểu đồ, hình vẽ, công thức. PDF chỉ dùng để AI đọc/rà soát."}
                                            </p>
                                        </div>
                                        <label className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm cursor-pointer transition-colors font-medium">
                                            <FileText className="w-4 h-4" />
                                            <span>Chọn Giáo án từ máy tính</span>
                                            <input type="file" className="hidden" accept=".docx, .pdf" onChange={handleFileUpload} />
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
                                        <Bot className="w-4 h-4" /> AI Đề xuất điểm chạm QĐ 3439
                                    </h3>
                                    <p className="text-xs text-slate-600">{analysisResult.aiSuggestions?.length || 0} điểm lồng ghép AI được tìm thấy.</p>
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
                            <div className="space-y-3">
                                {analysisResult.aiSuggestions?.map((sug: any, idx: number) => {
                                    const validCode = hasValidAiCode(sug.suggestedAI);
                                    const isSelected = validCode && selectedIntegrations.includes(sug);
                                    const isSelClass = isSelected
                                        ? "border-blue-600 bg-blue-50 shadow-sm"
                                        : validCode
                                            ? "border-slate-200 hover:border-slate-300"
                                            : "border-amber-300 bg-amber-50 cursor-not-allowed";
                                    const circleClass = isSelected ? "bg-blue-600" : "bg-slate-200";

                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => validCode && toggleIntegration(sug)}
                                            className={(validCode ? "cursor-pointer " : "") + "border-2 transition-all rounded-xl p-4 flex gap-4 " + isSelClass}
                                        >
                                            <div className="pt-1">
                                                <div className={"w-6 h-6 rounded-full flex items-center justify-center " + circleClass}>
                                                    {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start mb-1">
                                                    <h4 className="font-bold text-slate-800">{sug.activityName}</h4>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="px-2 py-1 font-bold text-xs rounded-md bg-sky-100 text-sky-700">{sug.suggestedNLS || "NLS cần rà soát"}</span>
                                                        <span className={`px-2 py-1 font-bold text-xs rounded-md ${validCode ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-800"}`}>{sug.suggestedAI}</span>
                                                    </div>
                                                </div>
                                                {sug.yccdEvidence && <p className="text-sm text-slate-600 mb-2"><span className="font-semibold text-slate-700">Căn cứ YCCĐ:</span> {sug.yccdEvidence}</p>}
                                                <p className="text-sm text-slate-600 mb-2"><span className="font-semibold text-slate-700">Lý do:</span> {sug.reason}</p>
                                                <p className="text-sm text-slate-600"><span className="font-semibold text-slate-700">Hành động của HS:</span> {sug.action}</p>
                                            </div>
                                        </div>
                                    );
                                })}
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
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Đang chèn AI...</>
                                    ) : (
                                        <><Sparkles className="w-4 h-4" /> {file?.name.toLowerCase().endsWith(".docx") ? "Chèn AI vào File DOCX" : "Vui lòng tải DOCX để giữ nguyên"}</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ===== STEP 3: PREVIEW BEFORE DOWNLOAD ===== */}
                    {step === 3 && injectionResult && (
                        <div className="space-y-5">
                            {/* Header Summary */}
                            <div className={`rounded-xl p-4 border flex items-start gap-3 ${injectionResult.injectedCount > 0 ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                                <div className={`rounded-full p-1.5 mt-0.5 ${injectionResult.injectedCount > 0 ? "bg-green-100" : "bg-amber-100"}`}>
                                    <CheckCircle2 className={`w-5 h-5 ${injectionResult.injectedCount > 0 ? "text-green-600" : "text-amber-600"}`} />
                                </div>
                                <div>
                                    <p className={`font-bold text-sm ${injectionResult.injectedCount > 0 ? "text-green-800" : "text-amber-800"}`}>
                                        ✅ Đã chèn thành công {injectionResult.injectedCount}/{injectionResult.previewItems.length} hoạt động AI
                                    </p>
                                    <p className="text-xs text-slate-600 mt-1">
                                        File: <span className="font-semibold">{file?.name.replace(".docx", "_AI_NangCap.docx")}</span> đã sẵn sàng tải xuống.
                                        {injectionResult.skippedActivities.length > 0 && (
                                            <span className="text-amber-700"> ({injectionResult.skippedActivities.length} hoạt động không khớp vị trí – đã chèn cuối file.)</span>
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

                            {/* Full lesson preview */}
                            {fullPreviewText && (
                                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                                        <div className="flex items-center gap-2">
                                            <Eye className="w-4 h-4 text-blue-700" />
                                            <div>
                                                <p className="text-sm font-bold text-blue-900">Xem trước giáo án DOCX sau tích hợp trên màn hình</p>
                                                <p className="text-xs text-blue-800 mt-0.5">Bản xem trước HTML dùng để kiểm tra nhanh. Bản DOCX tải xuống là bản giữ nguyên định dạng gốc đầy đủ nhất.</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button onClick={handleDownloadPreviewText} className="px-3 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-50">
                                                Tải TXT kiểm tra
                                            </button>
                                            <button onClick={handleDownloadPreviewHtml} className="px-3 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-50">
                                                Tải HTML xem nhanh
                                            </button>
                                            <button onClick={handleOpenFullLessonPlan} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">
                                                Mở màn hình KHBD tích hợp
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mb-3 rounded-lg border border-indigo-100 bg-white/80 p-3 text-xs leading-relaxed text-indigo-900">
                                        Chế độ màn hình giúp thầy/cô xem KHBD đã đưa NLS/NL AI vào mục tiêu, tiến trình và đánh giá trong app. File DOCX tải xuống vẫn là bản giữ nguyên giáo án gốc đầy đủ nhất.
                                    </div>
                                    <div className="max-h-[520px] overflow-y-auto rounded-lg bg-white border border-blue-100 p-4">
                                        <style>{`
                                            .docx-preview-html table { border-collapse: collapse; width: 100%; margin: 12px 0; }
                                            .docx-preview-html td, .docx-preview-html th { border: 1px solid #cbd5e1; padding: 6px; vertical-align: top; }
                                            .docx-preview-html img { max-width: 100%; height: auto; }
                                            .docx-preview-html p { margin: 0 0 8px; }
                                            .docx-preview-html ul, .docx-preview-html ol { padding-left: 24px; margin: 8px 0; }
                                        `}</style>
                                        {fullPreviewHtml ? (
                                            <div className="docx-preview-html text-xs leading-relaxed text-slate-800" dangerouslySetInnerHTML={{ __html: fullPreviewHtml }} />
                                        ) : (
                                            <pre className="text-xs leading-relaxed text-slate-800 whitespace-pre-wrap font-sans">{fullPreviewText}</pre>
                                        )}
                                    </div>
                                    {previewHtmlWarning && (
                                        <p className="text-xs text-amber-700 mt-2">
                                            Lưu ý xem trước: {previewHtmlWarning}
                                        </p>
                                    )}
                                </div>
                            )}

                            {assessmentPreview.length > 0 && (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Bot className="w-4 h-4 text-emerald-700" />
                                        <p className="text-sm font-bold text-emerald-900">Đề xuất nội dung đánh giá sau tích hợp</p>
                                    </div>
                                    <ul className="space-y-2">
                                        {assessmentPreview.map((line, idx) => (
                                            <li key={idx} className="text-sm text-emerald-950 leading-relaxed">{line}</li>
                                        ))}
                                    </ul>
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
                                                    {item.found ? "✓ Chèn đúng vị trí" : "⚠ Chèn cuối file"}
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
                                        onClick={() => { setStep(1); setFile(null); setAnalysisResult(null); setInjectionResult(null); setReadyBlob(null); setFullPreviewText(""); setFullPreviewHtml(""); setPreviewHtmlWarning(""); setAssessmentPreview([]); }}
                                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors border border-slate-200"
                                    >
                                        Tải file khác
                                    </button>
                                    <button
                                        onClick={handleOpenFullLessonPlan}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm text-sm font-bold flex items-center gap-2 transition-colors"
                                    >
                                        <Sparkles className="w-4 h-4" /> Mở màn hình KHBD tích hợp
                                    </button>
                                    <button
                                        onClick={handleConfirmDownload}
                                        className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-sm text-sm font-bold flex items-center gap-2 transition-colors"
                                    >
                                        <Download className="w-4 h-4" /> Tải DOCX giữ nguyên giáo án gốc
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

