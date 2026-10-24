"use client";

import React from "react";
import { Paperclip, MessageSquare, ThumbsUp, ArrowRight, ListChecks, Server } from "lucide-react";
import type { IssueRecord, IssueStatus } from "@/lib/types";
import {
  PriorityBadge,
  TypeBadge,
  STATUS_CONFIG,
  TONE,
  Avatar,
  formatThaiDate,
  formatThaiTime,
  formatThaiDateTime,
} from "./ui/Badges";

const COLUMNS: Array<{ status: IssueStatus; nextStatus?: IssueStatus; nextLabel?: string }> = [
  { status: "open", nextStatus: "reviewing", nextLabel: "เริ่มตรวจสอบ" },
  { status: "reviewing", nextStatus: "ready_to_fix", nextLabel: "ส่งเข้าคิวแก้ไข" },
  { status: "ready_to_fix", nextStatus: "fixing", nextLabel: "เริ่มแก้ไข" },
  { status: "fixing", nextStatus: "deployed", nextLabel: "แก้ไขเสร็จแล้ว" },
  { status: "deployed" },
  { status: "wont_fix", nextStatus: "open", nextLabel: "เปิดเรื่องใหม่" },
];

export function KanbanBoardView({
  issues,
  onSelectIssue,
  onQuickStatusChange,
  canChangeStatus = true,
}: {
  issues: IssueRecord[];
  onSelectIssue: (issue: IssueRecord) => void;
  onQuickStatusChange: (code: string, nextStatus: IssueStatus) => void;
  canChangeStatus?: boolean;
}) {
  return (
    <div data-testid="kanban-board-view" className="flex h-full gap-3 overflow-x-auto p-4 sm:p-5">
      {COLUMNS.map((col) => {
        const cfg = STATUS_CONFIG[col.status];
        const tone = TONE[cfg.tone];
        const colIssues = issues.filter((i) => i.status === col.status);

        return (
          <section
            key={col.status}
            aria-label={cfg.label}
            className="flex h-full w-[284px] shrink-0 flex-col rounded-2xl border border-line bg-surface/60"
          >
            {/* Column header */}
            <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2.5">
              <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
              <h3 className="truncate text-[13px] font-semibold text-fg">{cfg.label}</h3>
              <span className="count">{colIssues.length}</span>
            </div>
            <p className="-mt-1 truncate px-3.5 pb-2.5 text-xs text-fg-subtle" title={cfg.description}>
              {cfg.description}
            </p>

            {/* Cards */}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2.5 pb-2.5">
              {colIssues.length === 0 ? (
                <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-line text-xs text-fg-subtle">
                  ไม่มีรายการในขั้นตอนนี้
                </div>
              ) : (
                colIssues.map((issue) => {
                  const subtasks = issue.subtasks || [];
                  const doneCount = subtasks.filter((s) => s.completed).length;

                  return (
                    <div
                      key={issue.code}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectIssue(issue)}
                      onKeyDown={(e) => e.key === "Enter" && onSelectIssue(issue)}
                      className="group cursor-pointer rounded-xl border border-line bg-raised/60 p-3 shadow-[0_1px_0_rgb(255_255_255/0.03)_inset] transition hover:border-line-strong hover:bg-raised"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-fg-subtle">{issue.code}</span>
                        <PriorityBadge priority={issue.priority} compact className="h-5 px-2 text-[11px]" />
                      </div>

                      <p className="mt-2 line-clamp-2 text-[13px] leading-snug font-medium text-fg">
                        {issue.title}
                      </p>

                      {issue.reviewMeta?.reviewReason && (
                        <p className="mt-2 line-clamp-2 rounded-lg bg-white/[0.03] px-2 py-1.5 text-xs leading-relaxed text-fg-muted">
                          {issue.reviewMeta.reviewReason}
                        </p>
                      )}

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <TypeBadge type={issue.type} compact className="h-5 px-2 text-[11px]" />
                        {issue.devopsMeta?.serviceName && (
                          <span className="pill h-5 bg-white/[0.04] px-2 font-mono text-[10px] text-fg-subtle ring-line">
                            <Server className="h-3 w-3" />
                            {issue.devopsMeta.serviceName}
                          </span>
                        )}
                      </div>

                      {subtasks.length > 0 && (
                        <div className="mt-2.5 flex items-center gap-2 text-[11px] text-fg-subtle">
                          <ListChecks className="h-3 w-3 shrink-0" />
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className="h-full rounded-full bg-emerald-400"
                              style={{ width: `${(doneCount / subtasks.length) * 100}%` }}
                            />
                          </div>
                          <span className="tabular-nums">
                            {doneCount}/{subtasks.length}
                          </span>
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5 text-[11px] text-fg-subtle">
                        <div className="flex min-w-0 items-center gap-2.5 tabular-nums">
                          {issue.assignee && <Avatar name={issue.assignee} size="sm" />}
                          <span className="truncate" title={formatThaiDateTime(issue.createdAt)}>
                            {formatThaiDate(issue.createdAt)} {formatThaiTime(issue.createdAt)}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 tabular-nums">
                          {(issue.attachments?.length || 0) > 0 && (
                            <span className="inline-flex items-center gap-0.5">
                              <Paperclip className="h-3 w-3" /> {issue.attachments.length}
                            </span>
                          )}
                          {(issue.comments?.length || 0) > 0 && (
                            <span className="inline-flex items-center gap-0.5">
                              <MessageSquare className="h-3 w-3" /> {issue.comments.length}
                            </span>
                          )}
                          {(issue.upvotes || 0) > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-amber-300/90">
                              <ThumbsUp className="h-3 w-3" /> {issue.upvotes}
                            </span>
                          )}
                        </div>
                      </div>

                      {col.nextStatus && canChangeStatus && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onQuickStatusChange(issue.code, col.nextStatus!);
                          }}
                          className="btn btn-secondary btn-xs mt-2.5 w-full justify-between opacity-80 group-hover:opacity-100"
                          title={`ย้ายไปขั้นตอน "${STATUS_CONFIG[col.nextStatus].label}"`}
                        >
                          <span>{col.nextLabel}</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
