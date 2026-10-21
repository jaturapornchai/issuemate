"use client";

import React from "react";
import {
  Paperclip,
  MessageSquare,
  ThumbsUp,
  ArrowRight,
  CheckSquare,
  Terminal,
  Sparkles,
} from "lucide-react";
import type { IssueRecord, IssueStatus } from "@/lib/types";
import { PriorityBadge, TypeBadge, STATUS_CONFIG } from "./ui/Badges";

const COLUMNS: Array<{ status: IssueStatus; nextStatus?: IssueStatus; nextLabel?: string }> = [
  { status: "open", nextStatus: "reviewing", nextLabel: "Antigravity เริ่มรีวิว" },
  { status: "reviewing", nextStatus: "ready_to_fix", nextLabel: "สั่งแก้ (รอแก้)" },
  { status: "ready_to_fix", nextStatus: "fixing", nextLabel: "Antigravity รับแก้" },
  { status: "fixing", nextStatus: "deployed", nextLabel: "Deploy สำเร็จ" },
  { status: "deployed" },
  { status: "wont_fix", nextStatus: "open", nextLabel: "ส่งรีวิวใหม่" },
];

export function KanbanBoardView({
  issues,
  onSelectIssue,
  onQuickStatusChange,
}: {
  issues: IssueRecord[];
  onSelectIssue: (issue: IssueRecord) => void;
  onQuickStatusChange: (code: string, nextStatus: IssueStatus) => void;
}) {
  return (
    <div
      data-testid="kanban-board-view"
      className="grid h-full grid-cols-1 gap-3 overflow-y-auto p-4 md:grid-cols-3 xl:grid-cols-6"
    >
      {COLUMNS.map((col) => {
        const cfg = STATUS_CONFIG[col.status];
        const Icon = cfg.icon;
        const colIssues = issues.filter((i) => i.status === col.status);

        return (
          <div
            key={col.status}
            className="flex min-h-0 flex-col rounded-xl border border-slate-800 bg-slate-900/75"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <Icon className="h-4 w-4 shrink-0 text-emerald-400" />
                <h3 className="truncate text-xs font-bold text-white">{cfg.shortLabel}</h3>
              </div>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-slate-200">
                {colIssues.length}
              </span>
            </div>

            {/* Cards List */}
            <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5">
              {colIssues.length === 0 ? (
                <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-800 text-xs text-slate-400">
                  ไม่มีรายการในขั้นตอนนี้
                </div>
              ) : (
                colIssues.map((issue) => {
                  const subtasks = issue.subtasks || [];
                  const doneCount = subtasks.filter((s) => s.completed).length;

                  return (
                    <div
                      key={issue.code}
                      onClick={() => onSelectIssue(issue)}
                      className="group cursor-pointer rounded-lg border border-slate-800 bg-slate-950/90 p-3 shadow-sm transition hover:border-emerald-500/40 hover:bg-slate-900"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          #{issue.code}
                        </span>
                        <PriorityBadge priority={issue.priority} compact />
                      </div>

                      <p className="mt-2 line-clamp-2 text-xs font-semibold text-white group-hover:text-emerald-300">
                        {issue.title}
                      </p>

                      {issue.devopsMeta?.serviceName && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-mono text-rose-300 truncate">
                          <Terminal className="h-3 w-3 shrink-0" />
                          <span className="truncate">{issue.devopsMeta.serviceName}</span>
                        </div>
                      )}

                      {issue.reviewMeta?.reviewReason && (
                        <div className="mt-1.5 rounded border border-purple-500/25 bg-purple-950/20 px-2 py-1 text-[10px] text-purple-200 line-clamp-2">
                          <Sparkles className="mr-1 inline h-2.5 w-2.5 text-purple-400" />
                          {issue.reviewMeta.reviewReason}
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <TypeBadge type={issue.type} compact />
                        {subtasks.length > 0 && (
                          <span className="inline-flex h-5 items-center gap-1 rounded border border-slate-700 bg-slate-900 px-1.5 font-mono text-[10px] text-slate-300">
                            <CheckSquare className="h-2.5 w-2.5 text-emerald-400" />
                            {doneCount}/{subtasks.length}
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px] text-slate-400">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1">
                            <Paperclip className="h-3 w-3" /> {issue.attachments?.length || 0}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" /> {issue.comments?.length || 0}
                          </span>
                          <span className="inline-flex items-center gap-1 text-amber-300">
                            <ThumbsUp className="h-3 w-3" /> {issue.upvotes || 0}
                          </span>
                        </div>

                        {col.nextStatus && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onQuickStatusChange(issue.code, col.nextStatus!);
                            }}
                            className="inline-flex h-6 shrink-0 items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 text-[10px] font-medium whitespace-nowrap text-slate-200 hover:border-emerald-500/50 hover:text-emerald-300 cursor-pointer"
                          >
                            <span>{col.nextLabel}</span>
                            <ArrowRight className="h-3 w-3 shrink-0" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
