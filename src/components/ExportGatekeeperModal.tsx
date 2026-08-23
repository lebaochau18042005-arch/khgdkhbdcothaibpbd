/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Modal Kiểm Định Chất Lượng & Cổng Xuất Bản Chính Thức (Export Gatekeeper)
 * Kiểm định 23 tiêu chí bắt buộc và checklist 9 bước kiểm tra trực quan sau kết xuất
 */

import React, { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Download, Eye, FileText, Lock } from "lucide-react";

export interface GatekeeperCheckItem {
  id: number;
  label: string;
  passed: boolean;
  note?: string;
}

interface ExportGatekeeperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExport: (format: "docx" | "xlsx" | "pdf") => void;
  checks: GatekeeperCheckItem[];
  hasLegacy3439: boolean;
}

export const ExportGatekeeperModal: React.FC<ExportGatekeeperModalProps> = ({
  isOpen,
  onClose,
  onConfirmExport,
  checks,
  hasLegacy3439,
}) => {
  const [visualInspectionChecked, setVisualInspectionChecked] = useState({
    tableOverflow: false,
    textTruncation: false,
    columnWidth: false,
    redColorPreserved: false,
    imagePosition: false,
    titleAndHeader: false,
    pageNumber: false,
    appendixDataComplete: false,
    layoutPreserved: false,
  });

  const [exportStatus, setExportStatus] = useState<"IDLE" | "EXPORTED_UNCHECKED" | "VERIFIED">("IDLE");

  if (!isOpen) return null;

  const allChecksPassed = checks.every((c) => c.passed) && !hasLegacy3439;
  const passedCount = checks.filter((c) => c.passed).length;
  const totalCount = checks.length;

  const allVisualPassed = Object.values(visualInspectionChecked).every(Boolean);

  const handleExportClick = (format: "docx" | "xlsx" | "pdf") => {
    onConfirmExport(format);
    setExportStatus("EXPORTED_UNCHECKED");
  };

  const handleVisualCheckToggle = (key: keyof typeof visualInspectionChecked) => {
    setVisualInspectionChecked((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${allChecksPassed ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
              {allChecksPassed ? <ShieldCheck className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-base font-bold">Cổng Kiểm Định 23 Tiêu Chí Xuất File Chính Thức</h3>
              <p className="text-xs text-slate-300">
                Tuân thủ QĐ 2422, CV 5588, TT 02/2025 (Mức NC) & CV 5512 cho THPT Kết nối tri thức
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Legacy Warning */}
          {hasLegacy3439 && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-rose-800 text-sm">Phát hiện dữ liệu cũ thuộc QĐ 3439</h4>
                <p className="text-rose-700 mt-0.5 leading-relaxed">
                  Hệ thống phát hiện còn tồn tại mã hoặc căn cứ khung cũ QĐ 3439 trong dữ liệu hoạt động. Chức năng xuất file chính thức bị khóa cứng. Vui lòng rà soát và chuyển đổi sang chuẩn <strong>QĐ 2422/QĐ-BGDĐT</strong> trước khi xuất bản.
                </p>
              </div>
            </div>
          )}

          {/* 23 Criteria Summary */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                1. Thẩm Định 23 Tiêu Chí Kiểm Định Bắt Buộc
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${allChecksPassed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                  Đạt {passedCount}/{totalCount}
                </span>
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-3 rounded-xl bg-slate-50 border border-slate-200">
              {checks.map((c) => (
                <div
                  key={c.id}
                  className={`p-2.5 rounded-lg border flex items-start gap-2.5 transition-colors ${
                    c.passed ? "bg-white border-emerald-200" : "bg-rose-50/60 border-rose-200"
                  }`}
                >
                  {c.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className={`font-medium ${c.passed ? "text-slate-800" : "text-rose-900 font-semibold"}`}>
                      {c.id}. {c.label}
                    </div>
                    {c.note && <div className="text-[10px] text-slate-500 mt-0.5">{c.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 9-Point Visual Inspection Protocol */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                2. Quy Trình Kiểm Tra Trực Quan Sau Xuất File (Visual Inspection)
              </h4>
              <span className="text-xs text-slate-500 italic">
                {exportStatus === "IDLE"
                  ? "Chưa xuất file"
                  : exportStatus === "EXPORTED_UNCHECKED"
                  ? "“Đã xuất file - chưa kiểm tra trực quan”"
                  : "“Đã nghiệm thu”"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3.5 rounded-xl bg-indigo-50/40 border border-indigo-100">
              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-white transition-all">
                <input
                  type="checkbox"
                  checked={visualInspectionChecked.tableOverflow}
                  onChange={() => handleVisualCheckToggle("tableOverflow")}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-slate-700">1. Bảng không bị tràn trang</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-white transition-all">
                <input
                  type="checkbox"
                  checked={visualInspectionChecked.textTruncation}
                  onChange={() => handleVisualCheckToggle("textTruncation")}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-slate-700">2. Chữ không bị mất / lỗi font</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-white transition-all">
                <input
                  type="checkbox"
                  checked={visualInspectionChecked.columnWidth}
                  onChange={() => handleVisualCheckToggle("columnWidth")}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-slate-700">3. Độ rộng cột cân đối</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-white transition-all">
                <input
                  type="checkbox"
                  checked={visualInspectionChecked.redColorPreserved}
                  onChange={() => handleVisualCheckToggle("redColorPreserved")}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-slate-700 font-semibold text-red-600">4. Giữ nguyên chữ đỏ (#FF0000)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-white transition-all">
                <input
                  type="checkbox"
                  checked={visualInspectionChecked.imagePosition}
                  onChange={() => handleVisualCheckToggle("imagePosition")}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-slate-700">5. Hình ảnh đúng vị trí</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-white transition-all">
                <input
                  type="checkbox"
                  checked={visualInspectionChecked.titleAndHeader}
                  onChange={() => handleVisualCheckToggle("titleAndHeader")}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-slate-700">6. Tiêu đề, Quốc hiệu đầy đủ</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-white transition-all">
                <input
                  type="checkbox"
                  checked={visualInspectionChecked.pageNumber}
                  onChange={() => handleVisualCheckToggle("pageNumber")}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-slate-700">7. Số trang hiển thị đúng</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-white transition-all">
                <input
                  type="checkbox"
                  checked={visualInspectionChecked.appendixDataComplete}
                  onChange={() => handleVisualCheckToggle("appendixDataComplete")}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-slate-700">8. PL1–PL4 đủ dữ liệu</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-white transition-all">
                <input
                  type="checkbox"
                  checked={visualInspectionChecked.layoutPreserved}
                  onChange={() => handleVisualCheckToggle("layoutPreserved")}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-slate-700">9. Bố cục gốc giữ nguyên 100%</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-slate-500">
            {!allChecksPassed ? (
              <span className="text-rose-600 font-bold flex items-center gap-1">
                <XCircle className="w-4 h-4" /> BẢN NHÁP - CHƯA ĐẠT KIỂM ĐỊNH (Khóa xuất file)
              </span>
            ) : allVisualPassed ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> ĐÃ NGHIỆM THU - SẴN SÀNG SỬ DỤNG CHÍNH THỨC
              </span>
            ) : (
              <span className="text-amber-700 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> ĐÃ XUẤT FILE - CHƯA KIỂM TRA TRỰC QUAN
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
            >
              Đóng
            </button>

            <button
              onClick={() => handleExportClick("docx")}
              disabled={!allChecksPassed}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              <Download className="w-4 h-4" />
              Xuất Word (.docx)
            </button>

            <button
              onClick={() => handleExportClick("xlsx")}
              disabled={!allChecksPassed}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              <Download className="w-4 h-4" />
              Xuất Excel (.xlsx)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
