/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Component Trực Quan Hóa Ma Trận Tích Hợp (D3 / SVG Interactive Matrix)
 * Biểu diễn tương tác: YCCĐ Môn học ⟷ NLS (TT 02 Mức NC) ⟷ NL AI (QĐ 2422)
 */

import React, { useState } from "react";
import { AlignmentRow } from "./IntermediateAlignmentTable";
import { Sparkles, Layers, Cpu, CheckCircle2 } from "lucide-react";

interface VisualAlignmentMatrixProps {
  rows: AlignmentRow[];
}

export const VisualAlignmentMatrix: React.FC<VisualAlignmentMatrixProps> = ({ rows }) => {
  const [selectedRow, setSelectedRow] = useState<AlignmentRow | null>(rows[0] || null);

  const nlsCounts: Record<string, number> = {};
  const aiCounts: Record<string, number> = {};

  rows.forEach((r) => {
    if (r.nlsCode && r.nlsCode !== "Không") {
      nlsCounts[r.nlsCode] = (nlsCounts[r.nlsCode] || 0) + 1;
    }
    if (r.aiCode && r.aiCode !== "Không") {
      aiCounts[r.aiCode] = (aiCounts[r.aiCode] || 0) + 1;
    }
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Layers className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-slate-900">
              Ma Trận Trực Quan Điểm Chạm Năng Lực (YCCĐ ⟷ NLS ⟷ NL AI)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Trực quan hóa phân bố năng lực số theo TT 02 (Mức NC) và giáo dục AI theo QĐ 2422
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5 text-blue-600">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span>Mã NLS: {Object.keys(nlsCounts).length} mã</span>
          </div>
          <div className="flex items-center gap-1.5 text-red-600">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
            <span>Mã AI QĐ 2422: {Object.keys(aiCounts).length} mã</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Matrix Graph / List */}
        <div className="lg:col-span-7 space-y-2 max-h-96 overflow-y-auto pr-1">
          {rows.map((row, idx) => {
            const isSelected = selectedRow?.id === row.id;
            const hasNls = row.nlsCode && row.nlsCode !== "Không";
            const hasAi = row.aiCode && row.aiCode !== "Không";

            return (
              <div
                key={row.id}
                onClick={() => setSelectedRow(row)}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                  isSelected
                    ? "bg-indigo-50/70 border-indigo-300 shadow-sm ring-1 ring-indigo-400"
                    : "bg-slate-50/50 border-slate-200 hover:bg-slate-100/60"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-600 shrink-0">
                    {idx + 1}
                  </span>
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {row.topicOrLesson}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">
                      {row.yccdSubjectRaw}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {hasNls ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      {row.nlsCode}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] text-slate-400 bg-slate-100">
                      No NLS
                    </span>
                  )}

                  {hasAi ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                      {row.aiCode}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] text-slate-400 bg-slate-100">
                      No AI
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail Inspector */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-50 to-indigo-50/20 rounded-xl border border-slate-200 p-4 space-y-3.5 text-xs">
          {selectedRow ? (
            <>
              <div className="flex justify-between items-start">
                <div>
                  <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[10px]">
                    {selectedRow.subject} — Khối {selectedRow.grade}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 mt-1">
                    {selectedRow.topicOrLesson}
                  </h4>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  {selectedRow.status}
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div>
                  <span className="font-bold text-slate-700">YCCĐ Môn học (Nguyên văn):</span>
                  <p className="text-slate-600 mt-0.5 leading-relaxed bg-white p-2 rounded-lg border border-slate-200">
                    {selectedRow.yccdSubjectRaw}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-blue-50/60 p-2 rounded-lg border border-blue-100">
                    <span className="font-bold text-blue-900 block">Năng Lực Số (TT 02):</span>
                    <span className="text-xs font-extrabold text-blue-700">{selectedRow.nlsCode || "Không"}</span>
                    <p className="text-[10px] text-blue-800 mt-1 line-clamp-2">
                      {selectedRow.nlsIndicatorText || "Không có chỉ báo"}
                    </p>
                  </div>

                  <div className="bg-red-50/60 p-2 rounded-lg border border-red-100">
                    <span className="font-bold text-red-900 block">Năng Lực AI (QĐ 2422):</span>
                    <span className="text-xs font-extrabold text-red-700">{selectedRow.aiCode || "Không"}</span>
                    <p className="text-[10px] text-red-800 mt-1 line-clamp-2">
                      {selectedRow.aiRequirementText || "Không có YCCĐ AI"}
                    </p>
                  </div>
                </div>

                <div>
                  <span className="font-bold text-slate-700">Hành vi & Sản phẩm học sinh:</span>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 text-slate-600 space-y-1">
                    <div><strong>Hành vi:</strong> {selectedRow.studentBehavior || "Chưa có"}</div>
                    <div><strong>Sản phẩm:</strong> {selectedRow.product || "Chưa có"}</div>
                    <div><strong>Minh chứng:</strong> {selectedRow.evidence || "Chưa có"}</div>
                    <div><strong>Kiểm chứng:</strong> {selectedRow.verificationMethod || "Đối chiếu SGK"}</div>
                  </div>
                </div>

                {selectedRow.offlineAlternative && (
                  <div>
                    <span className="font-bold text-slate-700">Phương án ngoại tuyến (Không Internet):</span>
                    <p className="text-slate-600 mt-0.5 text-[11px] italic bg-white p-2 rounded-lg border border-slate-200">
                      {selectedRow.offlineAlternative}
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-400">
              Chọn một bài học từ danh sách để xem chi tiết chuỗi đối chiếu.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
