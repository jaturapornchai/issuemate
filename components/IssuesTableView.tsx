"use client";

import React from "react";
import {
  Paperclip,
  MessageSquare,
  ThumbsUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Server,
  Sparkles,
  Wrench,
  XCircle,
} from "lucide-react";
import type { IssueRecord } from "@/lib/types";
import {
  useResizableColumns,
  ColumnResizeHandle,
  ResetColumnWidthsButton,
  type ResizableColumnDef,
} from "@/components/ui/useResizableColumns";
import {
  StatusBadge,
  TypeBadge,
  PriorityBadge,
  CopyCodeButton,
  formatThaiDateTime,
} from "@/components/ui/Badges";

const COLUMNS: Array<
  ResizableColumnDef & { label: string; sortField: string; align?: "left" | "center" }
> = [
  { key: "code", label: "รหัสเรื่อง", sortField: "code", defaultWidth: 11 },
  { key: "status", label: "สถานะ", sortField: "status", defaultWidth: 12 },
  {
    key: "title",
    label: "หัวข้อปัญหา / คำถามที่สอบถาม / ความคืบหน้าการแก้ไข",
    sortField: "title",
    defaultWidth: 34,
  },
  { key: "type", label: "หมวดหมู่", sortField: "type", defaultWidth: 12 },
  { key: "priority", label: "ความเร่งด่วน", sortField: "priority", defaultWidth: 9 },
  { key: "assignee", label: "ผู้ดูแล / ผู้ตอบ", sortField: "assignee", defaultWidth: 11 },
  { key: "meta", label: "ไฟล์ / โหวต", sortField: "upvotes", defaultWidth: 11, align: "center" },
];

const SEVERITY_CLASS: Record<string, string> = {
  "SEV-1": "border-red-500/60 bg-red-500/25 text-red-200",
  "SEV-2": "border-orange-500/50 bg-orange-500/20 text-orange-200",
  "SEV-3": "border-yellow-500/40 bg-yellow-500/15 text-yellow-200",
};

function IssueContextLine({ issue }: { issue: IssueRecord }) {
  const ops = issue.devopsMeta;
  const rev = issue.reviewMeta;
  const sev = ops?.incidentSeverity?.toUpperCase();

  return (
    <div className="mt-1 flex h-5 min-w-0 items-center gap-1.5 overflow-hidden text-[11px] leading-none text-slate-400">
      {sev && (
        <span
          title={`ระดับความรุนแรง ${ops?.environment ? `• ${ops.environment}` : ""}`}
          className={`inline-flex h-5 shrink-0 items-center rounded border px-1.5 font-mono font-bold ${
            SEVERITY_CLASS[sev] || "border-slate-600 bg-slate-800 text-slate-300"
          }`}
        >
          {sev}
        </span>
      )}
      {ops?.serviceName && (
        <span
          title={`เซอร์วิส${ops.environment ? ` (${ops.environment})` : ""}`}
          className="inline-flex h-5 shrink-0 max-w-[35%] items-center gap-1 rounded border border-sky-500/30 bg-sky-500/10 px-1.5 font-mono text-sky-200"
        >
          <Server className="h-3 w-3 shrink-0" />
          <span className="truncate">{ops.serviceName}</span>
        </span>
      )}
      {rev?.decision === "fix" && (rev.fixInstructions || rev.reviewReason) && (
        <span
          title={`คำสั่งแก้ (Antigravity): ${rev.fixInstructions || rev.reviewReason}`}
          className="inline-flex h-5 shrink-0 max-w-[45%] items-center gap-1 rounded border border-cyan-500/35 bg-cyan-500/15 px-1.5 text-cyan-200"
        >
          <Wrench className="h-3 w-3 shrink-0 text-cyan-300" />
          <span className="truncate">
            คำสั่งแก้: {rev.fixInstructions || rev.reviewReason}
          </span>
        </span>
      )}
      {rev?.decision === "wont_fix" && rev.reviewReason && (
        <span
          title={`เหตุผลที่ไม่แก้: ${rev.reviewReason}`}
          className="inline-flex h-5 shrink-0 max-w-[45%] items-center gap-1 rounded border border-rose-500/35 bg-rose-500/15 px-1.5 text-rose-200"
        >
          <XCircle className="h-3 w-3 shrink-0 text-rose-300" />
          <span className="truncate">ไม่แก้เพราะ: {rev.reviewReason}</span>
        </span>
      )}
      {rev?.decision === "pending" && rev.reviewReason && (
        <span
          title={rev.reviewReason}
          className="inline-flex h-5 shrink-0 max-w-[40%] items-center gap-1 rounded border border-purple-500/35 bg-purple-500/15 px-1.5 text-purple-200"
        >
          <Sparkles className="h-3 w-3 shrink-0 text-purple-300" />
          <span className="truncate">{rev.reviewReason}</span>
        </span>
      )}
      <span className="truncate">
        แจ้งโดย {issue.reporter} • {formatThaiDateTime(issue.updatedAt)}
      </span>
    </div>
  );
}

export function IssuesTableView({
  issues,
  selectedCode,
  sortBy = "updatedAt",
  sortDir = "desc",
  onSelectIssue,
  onSort,
  onHeaderRefresh,
  onUpvote,
}: {
  issues: IssueRecord[];
  selectedCode?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  onSelectIssue: (issue: IssueRecord) => void;
  onSort?: (field: string) => void;
  onHeaderRefresh?: (colKey: string) => void;
  onUpvote?: (code: string) => void;
}) {
  const {
    isCustomized,
    activeKey,
    tableStyle,
    getColStyle,
    startResize,
    resetColumnWidth,
    resetWidths,
    handleHeaderClick,
  } = useResizableColumns({
    storageKey: "issuemate_devops_table_v4",
    columns: COLUMNS,
    onHeaderRefresh: (colKey) => {
      if (onHeaderRefresh) {
        onHeaderRefresh(colKey);
      } else if (onSort) {
        onSort(COLUMNS.find((c) => c.key === colKey)?.sortField || "updatedAt");
      }
    },
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Table Subbar */}
      <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/70 px-4 text-xs text-slate-400">
        <span className="truncate">
          แสดง{" "}
          <strong className="text-slate-200" data-testid="table-row-count">
            {issues.length}
          </strong>{" "}
          รายการใน DevOps Pipeline • คลิกหัวคอลัมน์เพื่อจัดเรียง • ลากเส้นแบ่งเพื่อปรับความกว้าง % • คลิกรหัสเพื่อคัดลอก
        </span>
        <ResetColumnWidthsButton
          isCustomized={isCustomized}
          onReset={resetWidths}
          testId="issues-reset-col-width-btn"
        />
      </div>

      {/* Table Wrapper: 100% width, no horizontal scroll */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <table
          data-resizable-managed="true"
          data-testid="issues-table"
          style={tableStyle}
          className="w-full border-collapse text-xs"
        >
          <colgroup>
            {COLUMNS.map((c) => (
              <col key={c.key} style={getColStyle(c.key)} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-900/95 shadow-xs backdrop-blur-xs">
            <tr className="border-b border-slate-800">
              {COLUMNS.map((c) => {
                const isSorted = sortBy === c.sortField;
                const SortIcon = !isSorted ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c.key}
                    data-col-key={c.key}
                    aria-sort={isSorted ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                    style={getColStyle(c.key)}
                    onClick={() => handleHeaderClick(c.key)}
                    className={`group/th relative cursor-pointer overflow-hidden border-r border-slate-800/80 px-2.5 py-2.5 text-left font-semibold leading-normal transition hover:bg-slate-800/70 last:border-r-0 ${
                      isSorted ? "text-emerald-300" : "text-slate-300"
                    }`}
                  >
                    <div
                      className={`flex items-center gap-1 pr-2 ${
                        c.align === "center" ? "justify-center" : "justify-between"
                      }`}
                    >
                      <span className="truncate">{c.label}</span>
                      <SortIcon
                        className={`h-3 w-3 shrink-0 ${
                          isSorted
                            ? "text-emerald-400"
                            : "text-slate-500 opacity-70 group-hover/th:text-emerald-400 group-hover/th:opacity-100"
                        }`}
                      />
                    </div>
                    <ColumnResizeHandle
                      colKey={c.key}
                      isActive={activeKey === c.key}
                      onStartResize={startResize}
                      onResetColumn={resetColumnWidth}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {issues.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="py-12 text-center text-sm text-slate-400">
                  ไม่พบรายการ Issue ตามเงื่อนไขที่ค้นหา
                </td>
              </tr>
            ) : (
              issues.map((issue) => {
                const isSelected = selectedCode === issue.code;
                return (
                  <tr
                    key={issue.code}
                    data-testid={`issue-row-${issue.code}`}
                    onClick={() => onSelectIssue(issue)}
                    className={`cursor-pointer transition ${
                      isSelected
                        ? "bg-emerald-950/35 hover:bg-emerald-950/45"
                        : "hover:bg-slate-900/80"
                    }`}
                  >
                    <td style={getColStyle("code")} className="overflow-hidden px-2.5 py-2 align-middle">
                      <CopyCodeButton code={issue.code} className="h-6 px-1.5 text-xs" />
                    </td>
                    <td style={getColStyle("status")} className="overflow-hidden px-2.5 py-2 align-middle">
                      <StatusBadge status={issue.status} compact />
                    </td>
                    <td style={getColStyle("title")} className="overflow-hidden px-2.5 py-2 align-middle">
                      <div className="flex h-5 min-w-0 items-center gap-1.5">
                        <span className="truncate font-semibold text-slate-100" title={issue.title}>
                          {issue.title}
                        </span>
                        {(issue.subtasks?.length || 0) > 0 && (
                          <span className="inline-flex h-5 shrink-0 items-center rounded border border-emerald-500/30 bg-emerald-500/15 px-1.5 font-mono text-[10px] font-medium leading-none text-emerald-300">
                            ✓ {(issue.subtasks || []).filter((s) => s.completed).length}/
                            {issue.subtasks?.length}
                          </span>
                        )}
                        {issue.labels?.slice(0, 2).map((lbl) => (
                          <span
                            key={lbl}
                            className="hidden h-5 shrink-0 items-center rounded border border-slate-700 bg-slate-800/80 px-1.5 text-[10px] leading-none text-slate-300 2xl:inline-flex"
                          >
                            {lbl}
                          </span>
                        ))}
                      </div>
                      <IssueContextLine issue={issue} />
                    </td>
                    <td style={getColStyle("type")} className="overflow-hidden px-2.5 py-2 align-middle">
                      <TypeBadge type={issue.type} compact />
                    </td>
                    <td style={getColStyle("priority")} className="overflow-hidden px-2.5 py-2 align-middle">
                      <PriorityBadge priority={issue.priority} compact />
                    </td>
                    <td style={getColStyle("assignee")} className="overflow-hidden px-2.5 py-2 align-middle">
                      <div className="truncate text-xs text-slate-200" title={issue.assignee || ""}>
                        {issue.assignee || <span className="text-slate-500">ยังไม่มอบหมาย</span>}
                      </div>
                    </td>
                    <td style={getColStyle("meta")} className="overflow-hidden px-2 py-2 align-middle">
                      <div className="flex flex-wrap items-center justify-center gap-1 text-[11px] leading-none text-slate-300">
                        <span
                          className="inline-flex h-6 items-center gap-0.5 text-sky-400 shrink-0"
                          title={`ไฟล์แนบ ${issue.attachments?.length || 0} ไฟล์ • ความคิดเห็น ${
                            issue.comments?.length || 0
                          }`}
                        >
                          <Paperclip className="h-3 w-3" />
                          {issue.attachments?.length || 0}
                        </span>
                        <span className="inline-flex h-6 items-center gap-0.5 text-slate-400 shrink-0">
                          <MessageSquare className="h-3 w-3" />
                          {issue.comments?.length || 0}
                        </span>
                        {onUpvote && (
                          <button
                            type="button"
                            data-testid={`row-upvote-${issue.code}`}
                            title="โหวตสนับสนุนรายการนี้"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpvote(issue.code);
                            }}
                            className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-amber-500/35 bg-amber-500/10 px-1.5 font-semibold text-amber-300 transition hover:border-amber-400/70 hover:bg-amber-500/25 active:scale-95 cursor-pointer"
                          >
                            <ThumbsUp className="h-3 w-3" />
                            {issue.upvotes || 0}
                          </button>
                        )}
                      </div>
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
}
