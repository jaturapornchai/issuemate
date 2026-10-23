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
  Wrench,
  CircleSlash,
  Inbox,
  SearchX,
  FilterX,
  Plus,
  ListChecks,
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
  Avatar,
  formatThaiDateTime,
  formatThaiDate,
  formatThaiTime,
  formatRelativeTime,
} from "@/components/ui/Badges";

const COLUMNS: Array<
  ResizableColumnDef & { label: string; sortField: string; align?: "left" | "center" }
> = [
  { key: "title", label: "เรื่อง", sortField: "title", defaultWidth: 36 },
  { key: "status", label: "สถานะ", sortField: "status", defaultWidth: 12 },
  { key: "type", label: "ประเภท", sortField: "type", defaultWidth: 11 },
  { key: "priority", label: "ความเร่งด่วน", sortField: "priority", defaultWidth: 10 },
  { key: "assignee", label: "ผู้ดูแล", sortField: "assignee", defaultWidth: 10 },
  { key: "createdAt", label: "วันที่เวลาสร้าง", sortField: "createdAt", defaultWidth: 13 },
  { key: "meta", label: "โหวต", sortField: "upvotes", defaultWidth: 7, align: "center" },
];

const SORT_LABEL: Record<string, string> = {
  createdAt: "วันที่สร้าง",
  title: "หัวข้อ",
  status: "สถานะ",
  type: "ประเภท",
  priority: "ความเร่งด่วน",
  assignee: "ผู้ดูแล",
  upvotes: "คะแนนโหวต",
  code: "รหัสเรื่อง",
};

const SEVERITY_CLASS: Record<string, string> = {
  "SEV-1": "bg-red-500/15 text-red-200 ring-red-400/30",
  "SEV-2": "bg-orange-400/10 text-orange-200 ring-orange-400/25",
  "SEV-3": "bg-amber-400/10 text-amber-200 ring-amber-400/25",
};

function ContextLine({ issue }: { issue: IssueRecord }) {
  const ops = issue.devopsMeta;
  const rev = issue.reviewMeta;
  const sev = ops?.incidentSeverity?.toUpperCase();
  const subtasks = issue.subtasks || [];
  const done = subtasks.filter((s) => s.completed).length;
  const attachments = issue.attachments?.length || 0;
  const comments = issue.comments?.length || 0;

  return (
    <div className="mt-1 flex min-w-0 items-center gap-2 overflow-hidden text-xs leading-none text-fg-subtle">
      <span className="truncate">แจ้งโดย {issue.reporter}</span>
      {sev && (
        <span
          title={`ระดับความรุนแรง${ops?.environment ? ` • ${ops.environment}` : ""}`}
          className={`pill h-5 shrink-0 px-1.5 font-mono text-[10px] ${SEVERITY_CLASS[sev] || "bg-white/5 text-fg-muted ring-line"}`}
        >
          {sev}
        </span>
      )}
      {ops?.serviceName && (
        <span title="เซอร์วิสที่เกี่ยวข้อง" className="inline-flex min-w-0 shrink items-center gap-1 font-mono text-[11px]">
          <Server className="h-3 w-3 shrink-0" />
          <span className="truncate">{ops.serviceName}</span>
        </span>
      )}
      {rev?.decision === "fix" && (rev.fixInstructions || rev.reviewReason) && (
        <span
          title={`แนวทางแก้ไข: ${rev.fixInstructions || rev.reviewReason}`}
          className="inline-flex min-w-0 shrink items-center gap-1 text-sky-300/80"
        >
          <Wrench className="h-3 w-3 shrink-0" />
          <span className="truncate">{rev.fixInstructions || rev.reviewReason}</span>
        </span>
      )}
      {rev?.decision === "wont_fix" && rev.reviewReason && (
        <span title={`เหตุผลที่ไม่แก้ไข: ${rev.reviewReason}`} className="inline-flex min-w-0 shrink items-center gap-1">
          <CircleSlash className="h-3 w-3 shrink-0" />
          <span className="truncate">{rev.reviewReason}</span>
        </span>
      )}
      {subtasks.length > 0 && (
        <span title="งานย่อยที่เสร็จแล้ว" className="inline-flex shrink-0 items-center gap-1 tabular-nums">
          <ListChecks className="h-3 w-3" />
          {done}/{subtasks.length}
        </span>
      )}
      {attachments > 0 && (
        <span title={`ไฟล์แนบ ${attachments} ไฟล์`} className="inline-flex shrink-0 items-center gap-1 tabular-nums">
          <Paperclip className="h-3 w-3" />
          {attachments}
        </span>
      )}
      {comments > 0 && (
        <span title={`ข้อความ ${comments} รายการ`} className="inline-flex shrink-0 items-center gap-1 tabular-nums">
          <MessageSquare className="h-3 w-3" />
          {comments}
        </span>
      )}
    </div>
  );
}

function EmptyState({
  filtered,
  onResetFilters,
  onCreate,
}: {
  filtered: boolean;
  onResetFilters?: () => void;
  onCreate?: () => void;
}) {
  const Icon = filtered ? SearchX : Inbox;
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-white/[0.03]">
        <Icon className="h-5 w-5 text-fg-subtle" />
      </div>
      <p className="text-sm font-semibold text-fg">
        {filtered ? "ไม่พบรายการที่ตรงกับตัวกรอง" : "ยังไม่มีเรื่องในโปรเจกต์นี้"}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
        {filtered
          ? "ลองล้างตัวกรองหรือเปลี่ยนคำค้นหา"
          : "เมื่อมีคนแจ้งปัญหาหรือถามคำถาม รายการจะแสดงที่นี่"}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {filtered && onResetFilters && (
          <button type="button" onClick={onResetFilters} className="btn btn-secondary btn-sm">
            <FilterX className="h-3.5 w-3.5" />
            ล้างตัวกรอง
          </button>
        )}
        {!filtered && onCreate && (
          <button type="button" onClick={onCreate} className="btn btn-primary btn-sm">
            <Plus className="h-3.5 w-3.5" />
            แจ้งเรื่องแรก
          </button>
        )}
      </div>
    </div>
  );
}

function UpvoteButton({ issue, onUpvote }: { issue: IssueRecord; onUpvote: (code: string) => void }) {
  return (
    <button
      type="button"
      data-testid={`row-upvote-${issue.code}`}
      title="โหวตสนับสนุนเรื่องนี้"
      onClick={(e) => {
        e.stopPropagation();
        onUpvote(issue.code);
      }}
      className={`inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-lg border px-2 text-xs font-semibold tabular-nums transition active:scale-95 ${
        (issue.upvotes || 0) > 0
          ? "border-amber-400/25 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"
          : "border-line bg-white/[0.03] text-fg-subtle hover:border-amber-400/30 hover:text-amber-200"
      }`}
    >
      <ThumbsUp className="h-3 w-3" />
      {issue.upvotes || 0}
    </button>
  );
}

export function IssuesTableView({
  issues,
  selectedCode,
  sortBy = "createdAt",
  sortDir = "desc",
  onSelectIssue,
  onSort,
  onHeaderRefresh,
  onUpvote,
  isLoading = false,
  hasActiveFilters = false,
  onResetFilters,
  onCreate,
}: {
  issues: IssueRecord[];
  selectedCode?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  onSelectIssue: (issue: IssueRecord) => void;
  onSort?: (field: string) => void;
  onHeaderRefresh?: (colKey: string) => void;
  onUpvote?: (code: string) => void;
  isLoading?: boolean;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  onCreate?: () => void;
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
    storageKey: "issuemate_devops_table_v6",
    columns: COLUMNS,
    onHeaderRefresh: (colKey) => {
      if (onHeaderRefresh) {
        onHeaderRefresh(colKey);
      } else if (onSort) {
        onSort(COLUMNS.find((c) => c.key === colKey)?.sortField || "createdAt");
      }
    },
  });

  const showEmpty = !isLoading && issues.length === 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Desktop table: 100% width, no horizontal scroll */}
      <div className="hidden min-h-0 flex-1 overflow-x-hidden overflow-y-auto md:block">
        <table
          data-resizable-managed="true"
          data-testid="issues-table"
          style={tableStyle}
          className="w-full border-collapse text-[13px]"
        >
          <colgroup>
            {COLUMNS.map((c) => (
              <col key={c.key} style={getColStyle(c.key)} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-canvas/90 backdrop-blur-md">
            <tr className="border-b border-line">
              {COLUMNS.map((c, idx) => {
                const isSorted = sortBy === c.sortField;
                const SortIcon = !isSorted ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c.key}
                    data-col-key={c.key}
                    aria-sort={isSorted ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                    style={getColStyle(c.key)}
                    onClick={() => handleHeaderClick(c.key)}
                    title={`คลิกเพื่อเรียงตาม${c.label}`}
                    className={`group/th relative h-10 cursor-pointer overflow-hidden px-3 text-left text-xs font-medium whitespace-nowrap transition select-none hover:text-fg ${
                      idx === 0 ? "pl-5" : ""
                    } ${isSorted ? "text-fg" : "text-fg-subtle"}`}
                  >
                    <div
                      className={`flex items-center gap-1.5 ${
                        c.align === "center" ? "justify-center" : ""
                      }`}
                    >
                      <span className="truncate">{c.label}</span>
                      <SortIcon
                        className={`h-3 w-3 shrink-0 transition ${
                          isSorted ? "text-emerald-400" : "opacity-0 group-hover/th:opacity-70"
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
          <tbody>
            {isLoading &&
              issues.length === 0 &&
              Array.from({ length: 7 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-b border-line">
                  <td className="px-5 py-3.5" colSpan={COLUMNS.length}>
                    <div className="flex items-center gap-4">
                      <div className="skeleton h-3.5 w-16" />
                      <div className="skeleton h-3.5 flex-1" style={{ maxWidth: `${50 - i * 4}%` }} />
                      <div className="skeleton ml-auto h-5 w-20 rounded-full" />
                      <div className="skeleton h-5 w-16 rounded-full" />
                    </div>
                  </td>
                </tr>
              ))}

            {showEmpty && (
              <tr>
                <td colSpan={COLUMNS.length}>
                  <EmptyState filtered={hasActiveFilters} onResetFilters={onResetFilters} onCreate={onCreate} />
                </td>
              </tr>
            )}

            {issues.map((issue) => {
              const isSelected = selectedCode === issue.code;
              return (
                <tr
                  key={issue.code}
                  data-testid={`issue-row-${issue.code}`}
                  onClick={() => onSelectIssue(issue)}
                  className={`group cursor-pointer border-b border-line transition-colors ${
                    isSelected
                      ? "bg-emerald-400/[0.06] shadow-[inset_2px_0_0_0_rgb(52_211_153)]"
                      : "hover:bg-white/[0.025]"
                  }`}
                >
                  <td style={getColStyle("title")} className="overflow-hidden py-3 pr-3 pl-5 align-middle">
                    <div className="flex min-w-0 items-center gap-2">
                      <CopyCodeButton code={issue.code} className="shrink-0" />
                      <span
                        className="truncate font-medium text-fg group-hover:text-white"
                        title={issue.title}
                      >
                        {issue.title}
                      </span>
                      {issue.labels?.slice(0, 2).map((lbl) => (
                        <span
                          key={lbl}
                          className="pill hidden h-5 shrink-0 bg-white/[0.04] px-2 text-[11px] text-fg-subtle ring-line 2xl:inline-flex"
                        >
                          {lbl}
                        </span>
                      ))}
                    </div>
                    <ContextLine issue={issue} />
                  </td>
                  <td style={getColStyle("status")} className="overflow-hidden px-3 py-3 align-middle">
                    <StatusBadge status={issue.status} compact />
                  </td>
                  <td style={getColStyle("type")} className="overflow-hidden px-3 py-3 align-middle">
                    <TypeBadge type={issue.type} compact />
                  </td>
                  <td style={getColStyle("priority")} className="overflow-hidden px-3 py-3 align-middle">
                    <PriorityBadge priority={issue.priority} compact />
                  </td>
                  <td style={getColStyle("assignee")} className="overflow-hidden px-3 py-3 align-middle">
                    {issue.assignee ? (
                      <div className="flex min-w-0 items-center gap-2" title={issue.assignee}>
                        <Avatar name={issue.assignee} size="sm" />
                        <span className="truncate text-fg-muted">{issue.assignee}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-fg-subtle">ยังไม่มีผู้ดูแล</span>
                    )}
                  </td>
                  <td
                    style={getColStyle("createdAt")}
                    data-testid={`issue-created-at-${issue.code}`}
                    className="overflow-hidden px-3 py-3 align-middle"
                    title={`สร้างเมื่อ ${formatThaiDateTime(issue.createdAt)}${
                      issue.updatedAt && issue.updatedAt !== issue.createdAt
                        ? ` • อัปเดตล่าสุด ${formatThaiDateTime(issue.updatedAt)}`
                        : ""
                    }`}
                  >
                    <div className="truncate text-fg-muted tabular-nums">
                      {formatThaiDate(issue.createdAt)} {formatThaiTime(issue.createdAt)}
                    </div>
                    <div className="mt-1 truncate text-xs text-fg-subtle">
                      {formatRelativeTime(issue.createdAt)}
                    </div>
                  </td>
                  <td style={getColStyle("meta")} className="overflow-hidden px-2 py-3 text-center align-middle">
                    {onUpvote ? (
                      <UpvoteButton issue={issue} onUpvote={onUpvote} />
                    ) : (
                      <span className="text-xs text-fg-subtle tabular-nums">{issue.upvotes || 0}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="min-h-0 flex-1 overflow-y-auto md:hidden">
        {isLoading && issues.length === 0 && (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card space-y-3 p-4">
                <div className="skeleton h-3 w-20" />
                <div className="skeleton h-4 w-4/5" />
                <div className="skeleton h-5 w-32 rounded-full" />
              </div>
            ))}
          </div>
        )}
        {showEmpty && (
          <EmptyState filtered={hasActiveFilters} onResetFilters={onResetFilters} onCreate={onCreate} />
        )}
        <div className="space-y-2 p-3">
          {issues.map((issue) => (
            <div
              key={issue.code}
              role="button"
              tabIndex={0}
              data-testid={`issue-card-${issue.code}`}
              onClick={() => onSelectIssue(issue)}
              onKeyDown={(e) => e.key === "Enter" && onSelectIssue(issue)}
              className={`card cursor-pointer p-4 transition active:scale-[0.99] ${
                selectedCode === issue.code ? "border-emerald-400/40" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-fg-subtle">{issue.code}</span>
                <StatusBadge status={issue.status} compact />
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-snug font-medium text-fg">{issue.title}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <TypeBadge type={issue.type} compact />
                <PriorityBadge priority={issue.priority} compact />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-fg-subtle">
                <span className="truncate">
                  {issue.reporter} · {formatRelativeTime(issue.createdAt)}
                </span>
                <span className="flex shrink-0 items-center gap-2.5 tabular-nums">
                  {(issue.attachments?.length || 0) > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Paperclip className="h-3 w-3" />
                      {issue.attachments.length}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {issue.comments?.length || 0}
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-300/90">
                    <ThumbsUp className="h-3 w-3" />
                    {issue.upvotes || 0}
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-t border-line px-4 text-xs text-fg-subtle sm:px-5">
        <span className="truncate">
          แสดง{" "}
          <strong className="font-semibold text-fg-muted tabular-nums" data-testid="table-row-count">
            {issues.length}
          </strong>{" "}
          รายการ · เรียงตาม{SORT_LABEL[sortBy] || sortBy} ({sortDir === "desc" ? "ใหม่/มาก → เก่า/น้อย" : "เก่า/น้อย → ใหม่/มาก"})
          <span className="hidden lg:inline"> · คลิกหัวคอลัมน์เพื่อเรียง · คลิกรหัสเพื่อคัดลอก</span>
        </span>
        <ResetColumnWidthsButton
          isCustomized={isCustomized}
          onReset={resetWidths}
          testId="issues-reset-col-width-btn"
        />
      </div>
    </div>
  );
}
