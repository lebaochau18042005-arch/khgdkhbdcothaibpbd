import React, { useState } from "react";
// @ts-ignore
import * as mammoth from "mammoth";
import { UploadCloud, CheckCircle2, Bot, Zap, Loader2, Sparkles, FileText } from "lucide-react";
import { analyzeExistingPlan } from "../services/geminiService";

export default function UpgradePlan({ onUpgradeReady, apiKey }: { onUpgradeReady: (data: any) => void, apiKey: string }) {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [rawText, setRawText] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [selectedIntegrations, setSelectedIntegrations] = useState<any[]>([]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (!uploadedFile) return;

        if (!apiKey) {
            alert("Vui lòng nhập API Key ở phần Cài đặt trước khi rà soát.");
            return;
        }

        setFile(uploadedFile);
        setIsAnalyzing(true);

        try {
            const buffer = await uploadedFile.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer: buffer });
            const text = result.value;
            setRawText(text);

            const analysis = await analyzeExistingPlan(text);
            setAnalysisResult(analysis);

            setSelectedIntegrations(analysis.aiSuggestions || []);
            setStep(2);
        } catch (err) {
            console.error(err);
            alert("Đã xảy ra lỗi khi bóc tách file hoặc rà soát AI. Vui lòng kiểm tra lại định dạng file (hỗ trợ .docx) và API Key.");
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
            aiIntegrationOptions: selectedIntegrations
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
                        <h2 className="text-xl font-bold font-display text-slate-800">Tích hợp AI vào Giáo án có sẵn</h2>
                        <p className="text-sm text-slate-500">Tải lên Giáo án Word của bạn, AI sẽ rà soát và tự nhúng Năng lực 3439.</p>
                    </div>
                </div>

                <div className="p-6">
                    {step === 1 && (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-12 bg-slate-50 relative">
                            {isAnalyzing ? (
                                <div className="text-center space-y-4">
                                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
                                    <h3 className="text-lg font-medium text-slate-700">Đang đọc giáo án & Rà soát bởi Gemini AI...</h3>
                                    <p className="text-sm text-slate-500">Quá trình này mất khoảng 5-15 giây để tìm điểm chạm phân bổ kiến thức số.</p>
                                </div>
                            ) : (
                                <div className="text-center space-y-4">
                                    <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-blue-600">
                                        <UploadCloud className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-medium text-slate-800">Kéo thả giáo án DOCX vào đây</h3>
                                        <p className="text-sm text-slate-500 mt-1">Hệ thống hỗ trợ file Word biên soạn thuần.</p>
                                    </div>
                                    <label className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm cursor-pointer transition-colors font-medium">
                                        <FileText className="w-4 h-4" />
                                        <span>Chọn file từ máy tính</span>
                                        <input type="file" className="hidden" accept=".docx" onChange={handleFileUpload} />
                                    </label>
                                </div>
                            )}
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
                                        <Bot className="w-4 h-4" /> AI Đề xuất điểm chạm
                                    </h3>
                                    <p className="text-xs text-slate-600 mb-3">AI đã tìm ra một số hoạt động trong giáo án có thể lồng ghép KNL 3439.</p>
                                </div>
                            </div>

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
                                    <Sparkles className="w-4 h-4" /> Bắt đầu xuất chuẩn
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
