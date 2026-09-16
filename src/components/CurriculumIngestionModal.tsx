import React, { useState } from "react";
import { UploadCloud, FileSpreadsheet, Download, Trash2, CheckCircle2, AlertCircle, X, Loader2, BookOpen } from "lucide-react";
import { 
  parseExcelCurriculum, 
  saveCustomCurriculum, 
  getStoredCustomCurriculums, 
  removeCustomCurriculum, 
  downloadCurriculumTypeScriptFile,
  StandardCurriculumItem 
} from "../utils/curriculumIngestion";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCurriculumUpdated?: () => void;
}

const SUBJECT_OPTIONS = [
  "Toán học", "Tin học", "Vật lí", "Hóa học", "Sinh học", 
  "Ngữ văn", "Lịch sử", "Địa lí", "Giáo dục kinh tế và pháp luật", 
  "Tiếng Anh", "Công nghệ", "Khoa học tự nhiên"
];

export const CurriculumIngestionModal: React.FC<Props> = ({ isOpen, onClose, onCurriculumUpdated }) => {
  const [subject, setSubject] = useState<string>("Toán học");
  const [grade, setGrade] = useState<"10" | "11" | "12">("10");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [parsedItems, setParsedItems] = useState<StandardCurriculumItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const storedCustom = getStoredCustomCurriculums();
  const customList = Object.keys(storedCustom).flatMap(sub => 
    Object.keys(storedCustom[sub]).map(gr => ({
      subject: sub,
      grade: gr,
      count: storedCustom[sub][gr].length
    }))
  );

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setParsedItems([]);

    try {
      const res = await parseExcelCurriculum(file, subject, grade);
      if (res.success && res.items.length) {
        setParsedItems(res.items);
        setSuccessMsg(`Đã trích xuất thành công ${res.items.length} bài học từ file "${file.name}".`);
      } else {
        setErrorMsg(res.error || "Không thể phân tích dữ liệu bài học từ file Excel.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi khi xử lý file.");
    } finally {
      setIsProcessing(false);
      e.target.value = "";
    }
  };

  const handleSaveToDatabase = () => {
    if (!parsedItems.length) return;
    const ok = saveCustomCurriculum(subject, grade, parsedItems);
    if (ok) {
      setSuccessMsg(`Đã nạp thành công ${parsedItems.length} bài học môn ${subject} Lớp ${grade} vào hệ thống!`);
      if (onCurriculumUpdated) onCurriculumUpdated();
    } else {
      setErrorMsg("Không thể lưu vào bộ nhớ trình duyệt.");
    }
  };

  const handleRemove = (sub: string, gr: string) => {
    if (window.confirm(`Xác nhận xóa dữ liệu nạp của môn ${sub} Lớp ${gr}?`)) {
      removeCustomCurriculum(sub, gr);
      if (onCurriculumUpdated) onCurriculumUpdated();
      setSuccessMsg(`Đã xóa dữ liệu môn ${sub} Lớp ${gr}.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-blue-700 to-indigo-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Nạp Tri Thức Chương Trình Môn Học (Curriculum Ingestion)</h2>
              <p className="text-xs text-blue-100">Nhập phân phối chương trình từ Excel/Word để bổ sung dữ liệu bài học cho hệ thống</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Controls: Chọn môn và khối lớp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Môn học cần nạp</label>
              <select 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)}
                className="w-full text-sm font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {SUBJECT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Khối lớp (THPT)</label>
              <div className="flex gap-2">
                {(["10", "11", "12"] as const).map(gr => (
                  <button
                    key={gr}
                    type="button"
                    onClick={() => setGrade(gr)}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg border transition-all ${
                      grade === gr 
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    Lớp {gr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Upload Area */}
          <div className="border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/40 rounded-xl p-6 text-center transition-colors">
            <UploadCloud className="w-10 h-10 text-indigo-600 mx-auto mb-2 animate-bounce" />
            <h3 className="text-sm font-bold text-slate-800">Tải lên file Phân phối chương trình (.xlsx, .xls)</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              File Excel mẫu chỉ cần có các cột: <b>Tên bài / Chủ đề</b>, <b>Số tiết</b> (và tùy chọn: Tuần, YCCĐ, Thiết bị, NLS, NL AI)
            </p>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl cursor-pointer shadow-md transition-all">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              {isProcessing ? "Đang phân tích file..." : "Chọn File Excel từ máy tính"}
              <input 
                type="file" 
                accept=".xlsx,.xls" 
                className="hidden" 
                onChange={handleFileUpload}
                disabled={isProcessing}
              />
            </label>
          </div>

          {/* Alert messages */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-3.5 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-2 p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              {successMsg}
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  Xem trước dữ liệu ({parsedItems.length} bài học):
                </h4>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveToDatabase}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Lưu vào Hệ thống
                  </button>
                  <button
                    onClick={() => downloadCurriculumTypeScriptFile(subject, grade, parsedItems)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Tải file mã nguồn .ts
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-60 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-2.5 w-12 text-center">STT</th>
                      <th className="p-2.5">Tên bài học / Chủ đề</th>
                      <th className="p-2.5 w-20 text-center">Số tiết</th>
                      <th className="p-2.5 w-20 text-center">Tuần</th>
                      <th className="p-2.5">Yêu cầu cần đạt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedItems.slice(0, 15).map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2 font-semibold text-slate-800">{it.lesson}</td>
                        <td className="p-2 text-center text-slate-600">{it.periods}</td>
                        <td className="p-2 text-center text-slate-500">{it.week || "-"}</td>
                        <td className="p-2 text-slate-600 line-clamp-1 max-w-xs">{it.yccd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedItems.length > 15 && (
                <p className="text-[11px] text-slate-400 text-right">Hiển thị 15 trên tổng số {parsedItems.length} dòng...</p>
              )}
            </div>
          )}

          {/* List of Custom Loaded Curriculums */}
          {customList.length > 0 && (
            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-700 uppercase mb-3">
                Dữ liệu môn học do người dùng đã nạp ({customList.length}):
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {customList.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-xs font-bold text-slate-800">{item.subject}</span>
                      <span className="ml-2 text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                        Lớp {item.grade}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.count} bài học</p>
                    </div>
                    <button
                      onClick={() => handleRemove(item.subject, item.grade)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa dữ liệu môn này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
