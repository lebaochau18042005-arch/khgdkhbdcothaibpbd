import React, { useState } from "react";
// @ts-ignore
import * as mammoth from "mammoth";
import { UploadCloud, CheckCircle2, Bot, Zap, Loader2, Sparkles, FileText, ImagePlus, X, BookOpen, AlertTriangle, Users } from "lucide-react";
import { analyzeExistingPlan } from "../services/geminiService";

interface TextbookImage {
    mimeType: string;
    data: string;
    previewUrl: string;
    name: string;
}

export default function UpgradePlan({ onUpgradeReady, apiKey }: { onUpgradeReady: (data: any) => void, apiKey: string }) {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [rawText, setRawText] = useState("");
    const [pdfBase64, setPdfBase64] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [selectedIntegrations, setSelectedIntegrations] = useState<any[]>([]);
    const [selectedSocialIntegrations, setSelectedSocialIntegrations] = useState<string[]>([]);
    const [textbookImages, setTextbookImages] = useState<TextbookImage[]>([]);

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

        setTextbookImages(prev => [...prev, ...newImages].slice(0, 8)); // Max 8 images
        e.target.value = "";
    };

    const removeTextbookImage = (idx: number) => {
        setTextbookImages(prev => prev.filter((_, i) => i !== idx));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (!uploadedFile) return;

        if (!apiKey) {
            alert("⚠️ Vui lòng nhập API Key ở phần Cài đặt trước khi rà soát.");
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
                analysis = await analyzeExistingPlan("", base64, imagePayload);
            } else {
                const buffer = await uploadedFile.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer: buffer });
                const text = result.value;
                if (!text || text.trim().length < 50) {
                    throw new Error("Không bóc tách được nội dung từ file này. Hãy thử file DOCX khác.");
                }
                setRawText(text);
                setPdfBase64("");

                analysis = await analyzeExistingPlan(text, undefined, imagePayload);
            }

            setAnalysisResult(analysis);
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

    const handleApply = () => {
        onUpgradeReady({
            subject: analysisResult.subject || "Khác",
            grade: analysisResult.grade || "10",
            topic: analysisResult.topic || "Bài học nâng cấp",
            duration: analysisResult.duration || "2 tiết",
            contextStudents: analysisResult.contextStudents || "",
            contextSchool: analysisResult.contextSchool || "",
            objectivesKnowledge: analysisResult.objectivesKnowledge || "",
            objectivesCompetency: analysisResult.objectivesCompetency || "",
            objectivesQuality: analysisResult.objectivesQuality || "",
            existingRawText: rawText,
            existingPdfBase64: pdfBase64,
            aiIntegrationOptions: selectedIntegrations,
            socialIntegrations: selectedSocialIntegrations,
            newContentFromTextbook: analysisResult.newContentFromTextbook || [],
            indicatorCode: analysisResult.grade ? `${analysisResult.grade}.A.A1.1` : undefined
        });
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
                                        <p className="font-semibold text-sm text-indigo-800">Ảnh chụp trang Sách giáo khoa mới <span className="font-normal text-indigo-500">(Tùy chọn – tối đa 8 ảnh)</span></p>
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

                                <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm cursor-pointer transition-colors text-sm font-medium">
                                    <ImagePlus className="w-4 h-4" />
                                    <span>Thêm ảnh SGK mới</span>
                                    <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" multiple onChange={handleTextbookImageUpload} />
                                </label>
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
                                            <h3 className="text-lg font-medium text-slate-800">Tải lên Giáo án gốc (DOCX hoặc PDF)</h3>
                                            <p className="text-sm text-slate-500 mt-1">
                                                {textbookImages.length > 0
                                                    ? `✅ Đã chọn ${textbookImages.length} ảnh SGK. AI sẽ phân tích so sánh.`
                                                    : "Hoặc tải ảnh SGK mới ở trên để so sánh chi tiết hơn."}
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
                                    const isSelected = selectedIntegrations.includes(sug);
                                    const isSelClass = isSelected ? "border-blue-600 bg-blue-50 shadow-sm" : "border-slate-200 hover:border-slate-300";
                                    const circleClass = isSelected ? "bg-blue-600" : "bg-slate-200";

                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => toggleIntegration(sug)}
                                            className={"cursor-pointer border-2 transition-all rounded-xl p-4 flex gap-4 " + isSelClass}
                                        >
                                            <div className="pt-1">
                                                <div className={"w-6 h-6 rounded-full flex items-center justify-center " + circleClass}>
                                                    {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start mb-1">
                                                    <h4 className="font-bold text-slate-800">{sug.activityName}</h4>
                                                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 font-bold text-xs rounded-md">{sug.suggestedAI}</span>
                                                </div>
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
                                    disabled={selectedIntegrations.length === 0}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl shadow-sm text-sm font-bold flex items-center gap-2 transition-colors"
                                >
                                    <Sparkles className="w-4 h-4" /> Tạo Giáo án Nâng cấp
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
