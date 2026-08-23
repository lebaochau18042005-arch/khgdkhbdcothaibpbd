/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Bảng Đối Chiếu Trung Gian 22 Cột Chuẩn (Intermediate Alignment Table)
 * Thực thi chuỗi đối chiếu 13 bước và quản lý 8 trạng thái kiểm định
 */

import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Search, Edit3, Save, RotateCcw, Filter, Sparkles, Download } from "lucide-react";
import { isNlsCodeValid, NLS_INDICATORS_DB } from "../data/nlsIndicatorsDb";
import { isAiCodeValid2422, AI_REQUIREMENTS_2422_DB, normalizeAiCode2422, normalizeAiCodesInText2422 } from "../data/aiRequirements2422Db";
import { exportAlignmentRowsToExcel, importAlignmentRowsFromExcel } from "../utils/excelParser";
import { UploadCloud, FileSpreadsheet } from "lucide-react";

export interface AlignmentRow {
  id: string;
  stt: number;
  subject: string;
  grade: "10" | "11" | "12";
  topicOrLesson: string;
  yccdSubjectRaw: string;
  actionVerb: string;
  knowledgeContent: string;
  activityName: string;
  learningTask: string;
  studentBehavior: string;
  product: string;
  evidence: string;
  nlsCode: string;
  nlsIndicatorText: string;
  aiComponent: "NLa" | "NLb" | "NLc" | "NLd" | "Không";
  aiRequirementText: string;
  aiCode: string;
  tool: string;
  verificationMethod: string;
  assessmentCriteria: string;
  sourceRef: string;
  status: "Đã xác minh" | "Thiếu nguồn" | "Mâu thuẫn nguồn" | "Cần chuyên gia xác nhận" | "Dữ liệu lịch sử" | "Bản nháp" | "Đạt kiểm định" | "Bị khóa" | "Không tích hợp NLS/NL AI";
  offlineAlternative?: string;
}

interface IntermediateAlignmentTableProps {
  rows: AlignmentRow[];
  onUpdateRows: (updatedRows: AlignmentRow[]) => void;
  onSyncToAppendices?: () => void;
}

export const IntermediateAlignmentTable: React.FC<IntermediateAlignmentTableProps> = ({
  rows,
  onUpdateRows,
  onSyncToAppendices,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AlignmentRow>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [gradeFilter, setGradeFilter] = useState<string>("ALL");

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importAlignmentRowsFromExcel(file);
      if (imported && imported.length > 0) {
        const normalizedRows = imported.map((row) => {
          const normalizedRow: AlignmentRow = {
            ...row,
            aiCode: normalizeAiCode2422(row.aiCode) || row.aiCode,
            aiRequirementText: normalizeAiCodesInText2422(row.aiRequirementText),
          };
          return { ...normalizedRow, status: validateRowStatus(normalizedRow) };
        });
        onUpdateRows(normalizedRows);
        alert(`✅ Đã nhập thành công ${normalizedRows.length} dòng từ file Excel và chuẩn hóa mã NL AI theo QĐ 2422.`);
      }
    } catch (err: any) {
      alert(`❌ Lỗi nhập file Excel: ${err.message || "File không đúng cấu trúc 22 cột."}`);
    }
    e.target.value = "";
  };


  const startEdit = (row: AlignmentRow) => {
    setEditingId(row.id);
    setEditForm({ ...row });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = () => {
    if (!editingId) return;
    const updated = rows.map((r) => {
      if (r.id === editingId) {
        const editedRow = { ...r, ...editForm } as AlignmentRow;
        const normalizedRow: AlignmentRow = {
          ...editedRow,
          aiCode: normalizeAiCode2422(editedRow.aiCode) || editedRow.aiCode,
          aiRequirementText: normalizeAiCodesInText2422(editedRow.aiRequirementText),
        };
        const validatedStatus = validateRowStatus(normalizedRow);
        return {
          ...normalizedRow,
          status: validatedStatus,
        } as AlignmentRow;
      }
      return r;
    });
    onUpdateRows(updated);
    setEditingId(null);
    setEditForm({});
  };

  function validateRowStatus(row: AlignmentRow): AlignmentRow["status"] {
    if (row.aiCode && /\.(?:0\d+)\b/.test(row.aiCode)) {
      return "Bị khóa";
    }
    if (row.nlsCode && !isNlsCodeValid(row.nlsCode)) {
      return "Cần chuyên gia xác nhận";
    }
    if (row.aiCode && !isAiCodeValid2422(row.aiCode, row.grade)) {
      return "Cần chuyên gia xác nhận";
    }
    if (!row.yccdSubjectRaw || row.yccdSubjectRaw.trim() === "") {
      return "Thiếu nguồn";
    }
    if (row.studentBehavior && row.product && row.evidence) {
      return "Đã xác minh";
    }
    return "Bản nháp";
  }

  const filteredRows = rows.filter((r) => {
    const matchSearch =
      r.topicOrLesson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.yccdSubjectRaw.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.nlsCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.aiCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
    const matchGrade = gradeFilter === "ALL" || r.grade === gradeFilter;
    return matchSearch && matchStatus && matchGrade;
  });

  const getStatusBadge = (status: AlignmentRow["status"]) => {
    switch (status) {
      case "Đã xác minh":
      case "Đạt kiểm định":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case "Cần chuyên gia xác nhận":
      case "Mâu thuẫn nguồn":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case "Bị khóa":
      case "Thiếu nguồn":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case "Dữ liệu lịch sử":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            [LEGACY QĐ 3439]
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            {status}
          </span>
        );
    }
  };

  const verifiedCount = rows.filter((r) => r.status === "Đã xác minh" || r.status === "Đạt kiểm định").length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
      {/* Header Panel */}
      <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer transition-all">
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Nhập Excel (.xlsx)</span>
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} />
          </label>
          <button
            onClick={() => exportAlignmentRowsToExcel(rows)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            title="Xuất Bảng đối chiếu 22 cột ra file Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Xuất Excel (.xlsx)</span>
          </button>
            <span className="px-2.5 py-0.5 rounded-md bg-red-600 text-white text-xs font-bold uppercase tracking-wider">
              Bắt buộc
            </span>
            <h3 className="text-lg font-bold text-slate-900">
              Bảng Đối Chiếu Trung Gian (22 Cột Chuẩn)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Chuỗi 13 bước đối chiếu: YCCĐ Môn học → Hành vi HS → NLS (TT 02 Mức NC) → NL AI (QĐ 2422) → Minh chứng.
            Chỉ những dòng <strong className="text-emerald-700">“Đã xác minh”</strong> ({verifiedCount}/{rows.length}) mới được đồng bộ sang PL1–PL4 và Giáo án.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onSyncToAppendices && (
            <button
              onClick={onSyncToAppendices}
              disabled={verifiedCount === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Đồng bộ sang PL1–PL4 ({verifiedCount} bài)
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm bài học, YCCĐ, mã NLS, mã AI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-600">Trạng thái:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-medium"
          >
            <option value="ALL">Tất cả ({rows.length})</option>
            <option value="Đã xác minh">Đã xác minh</option>
            <option value="Cần chuyên gia xác nhận">Cần chuyên gia xác nhận</option>
            <option value="Thiếu nguồn">Thiếu nguồn</option>
            <option value="Bị khóa">Bị khóa</option>
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-600">Khối:</span>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-medium"
          >
            <option value="ALL">Tất cả lớp</option>
            <option value="10">Lớp 10</option>
            <option value="11">Lớp 11</option>
            <option value="12">Lớp 12</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto border-t border-slate-200">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
              <th className="p-3 w-12 text-center">STT</th>
              <th className="p-3 w-28">Môn & Khối</th>
              <th className="p-3 w-44">Bài / Chủ đề</th>
              <th className="p-3 min-w-[220px]">YCCĐ Môn học (Nguyên văn)</th>
              <th className="p-3 w-36">Hành vi học sinh</th>
              <th className="p-3 w-28 text-center text-red-600 font-bold">Mã NLS (TT 02)</th>
              <th className="p-3 w-28 text-center text-red-600 font-bold">Mã AI (QĐ 2422)</th>
              <th className="p-3 w-36">YCCĐ AI (QĐ 2422)</th>
              <th className="p-3 w-32">Sản phẩm & Minh chứng</th>
              <th className="p-3 w-32">Kiểm chứng & Tiêu chí</th>
              <th className="p-3 w-36 text-center">Trạng thái</th>
              <th className="p-3 w-20 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-8 text-center text-slate-400 italic">
                  Không tìm thấy dòng dữ liệu nào phù hợp với bộ lọc.
                </td>
              </tr>
            ) : (
              filteredRows.map((r, idx) => {
                const isEditing = editingId === r.id;
                return (
                  <tr
                    key={r.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      r.status === "Bị khóa" ? "bg-rose-50/30" : isEditing ? "bg-indigo-50/40" : ""
                    }`}
                  >
                    {/* STT */}
                    <td className="p-3 text-center font-bold text-slate-500">{idx + 1}</td>

                    {/* Môn & Khối */}
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{r.subject}</div>
                      <div className="text-[11px] text-slate-500">Khối {r.grade}</div>
                    </td>

                    {/* Bài / Chủ đề */}
                    <td className="p-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.topicOrLesson || ""}
                          onChange={(e) => setEditForm({ ...editForm, topicOrLesson: e.target.value })}
                          className="w-full p-1.5 text-xs rounded border border-indigo-300"
                        />
                      ) : (
                        <span className="font-medium text-slate-900">{r.topicOrLesson}</span>
                      )}
                    </td>

                    {/* YCCĐ Môn học */}
                    <td className="p-3 leading-relaxed text-slate-700">
                      {isEditing ? (
                        <textarea
                          rows={3}
                          value={editForm.yccdSubjectRaw || ""}
                          onChange={(e) => setEditForm({ ...editForm, yccdSubjectRaw: e.target.value })}
                          className="w-full p-1.5 text-xs rounded border border-indigo-300"
                        />
                      ) : (
                        r.yccdSubjectRaw
                      )}
                    </td>

                    {/* Hành vi học sinh */}
                    <td className="p-3 text-slate-600">
                      {isEditing ? (
                        <textarea
                          rows={3}
                          value={editForm.studentBehavior || ""}
                          onChange={(e) => setEditForm({ ...editForm, studentBehavior: e.target.value })}
                          className="w-full p-1.5 text-xs rounded border border-indigo-300"
                        />
                      ) : (
                        r.studentBehavior || <span className="text-slate-400 italic">Chưa xác định</span>
                      )}
                    </td>

                    {/* Mã NLS */}
                    <td className="p-3 text-center">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.nlsCode || ""}
                          onChange={(e) => setEditForm({ ...editForm, nlsCode: e.target.value })}
                          className="w-full p-1.5 text-xs text-center rounded border border-red-300 font-bold text-red-600"
                        />
                      ) : (
                        <span className="font-extrabold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">
                          {r.nlsCode || "Không"}
                        </span>
                      )}
                    </td>

                    {/* Mã AI */}
                    <td className="p-3 text-center">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.aiCode || ""}
                          onChange={(e) => setEditForm({ ...editForm, aiCode: e.target.value })}
                          className="w-full p-1.5 text-xs text-center rounded border border-red-300 font-bold text-red-600"
                        />
                      ) : (
                        <span className="font-extrabold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">
                          {r.aiCode || "Không"}
                        </span>
                      )}
                    </td>

                    {/* YCCĐ AI QĐ 2422 */}
                    <td className="p-3 text-slate-600 text-[11px] leading-relaxed">
                      {isEditing ? (
                        <textarea
                          rows={3}
                          value={editForm.aiRequirementText || ""}
                          onChange={(e) => setEditForm({ ...editForm, aiRequirementText: e.target.value })}
                          className="w-full p-1.5 text-xs rounded border border-indigo-300"
                        />
                      ) : (
                        r.aiRequirementText || <span className="text-slate-400 italic">Không có YCCĐ AI</span>
                      )}
                    </td>

                    {/* Sản phẩm & Minh chứng */}
                    <td className="p-3 text-slate-600 text-[11px]">
                      <div><strong>SP:</strong> {r.product || "---"}</div>
                      <div className="mt-1 text-slate-500"><strong>MC:</strong> {r.evidence || "---"}</div>
                    </td>

                    {/* Kiểm chứng & Tiêu chí */}
                    <td className="p-3 text-slate-600 text-[11px]">
                      <div><strong>KC:</strong> {r.verificationMethod || "---"}</div>
                      <div className="mt-1 text-slate-500"><strong>TC:</strong> {r.assessmentCriteria || "---"}</div>
                    </td>

                    {/* Trạng thái */}
                    <td className="p-3 text-center">{getStatusBadge(r.status)}</td>

                    {/* Thao tác */}
                    <td className="p-3 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={saveEdit}
                            className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                            title="Lưu"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300"
                            title="Hủy"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(r)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 transition-all"
                          title="Sửa bản ghi"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
