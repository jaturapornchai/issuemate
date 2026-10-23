"use client";

import React from "react";
import { ThumbsUp, Plus, MessageSquare, Paperclip, Trophy, ListChecks, Sparkles } from "lucide-react";
import type { IssueRecord, IssueStatus } from "@/lib/types";
import { PriorityBadge, TypeBadge, STATUS_CONFIG, TONE } from "@/components/ui/Badges";

const STAGES: Array<{ key: string; statuses: IssueStatus[]; title: string; desc: string; tone: keyof typeof TONE }> = [
  { key: "pending_review", statuses: ["open", "reviewing"], title: "รอตรวจสอบ", desc: "รอทีมงานพิจารณาความจำเป็น", tone: "amber" },
  { key: "ready_to_fix", statuses: ["ready_to_fix"], title: STATUS_CONFIG.ready_to_fix.label, desc: "อนุมัติแล้ว อยู่ในคิวทำ", tone: "sky" },
  { key: "fixing", statuses: ["fixing"], title: STATUS_CONFIG.fixing.label, desc: "กำลังพัฒนาและทดสอบ", tone: "blue" },
  { key: "deployed", statuses: ["deployed"], title: STATUS_CONFIG.deployed.label, desc: "ใช้งานได้จริงแล้ว", tone: "emerald" },
];

function VoteButton({ item, onUpvote, size = "md" }: { item: IssueRecord; onUpvote: (code: string) => void; size?: "md" | "sm" }) {
  const voted = (item.upvotes || 0) > 0;
  return (
    <button
      type="button"
      data-testid={size === "md" ? `roadmap-upvote-${item.code}` : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onUpvote(item.code);
      }}
      title="คลิกเพื่อโหวตสนับสนุน"
      className={`flex shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border transition active:scale-95 ${
        size === "md" ? "h-16 w-14" : "h-11 w-10"
      } ${
        voted
          ? "border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"
          : "border-line bg-white/[0.03] text-fg-subtle hover:border-amber-400/30 hover:text-amber-200"
      }`}
    >
      <ThumbsUp className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      <span className={`mt-1 font-semibold tabular-nums ${size === "md" ? "text-sm" : "text-xs"}`}>{item.upvotes || 0}</span>
    </button>
  );
}

export function IdeasRoadmapView({
  issues,
  onSelectIssue,
  onUpvote,
  onOpenCreateIdea,
}: {
  issues: IssueRecord[];
  onSelectIssue: (issue: IssueRecord) => void;
  onUpvote: (code: string) => void;
  onOpenCreateIdea?: () => void;
}) {
  const sortedByVotes = [...issues].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
  const top = sortedByVotes.filter((i) => i.status !== "deployed" && i.status !== "wont_fix").slice(0, 6);

  return (
    <div className="h-full overflow-y-auto" data-testid="ideas-roadmap-view">
      <div className="mx-auto max-w-[1400px] space-y-5 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-fg">โหวต & แผนงาน</h2>
            <p className="mt-1 text-[13px] text-fg-muted">
              ช่วยกันโหวตเรื่องที่สำคัญที่สุด ทีมงานจะหยิบเรื่องที่ได้คะแนนสูงไปทำก่อน
            </p>
          </div>
          {onOpenCreateIdea && (
            <button type="button" onClick={onOpenCreateIdea} className="btn btn-primary">
              <Sparkles className="h-4 w-4" />
              <span>เสนอไอเดีย / ขอฟีเจอร์</span>
            </button>
          )}
        </div>

        {/* Leaderboard */}
        <div className="card p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
              <Trophy className="h-4 w-4 text-amber-300" />
              เรื่องที่ได้รับโหวตสูงสุด (ยังไม่เสร็จ)
            </h3>
            <span className="text-xs text-fg-subtle">กดปุ่มโหวตด้านซ้ายเพื่อเพิ่มคะแนนความสำคัญ</span>
          </div>

          {top.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line py-10 text-center text-[13px] text-fg-subtle">
              ยังไม่มีเรื่องที่รอโหวต
              {onOpenCreateIdea && (
                <button type="button" onClick={onOpenCreateIdea} className="btn btn-secondary btn-sm mx-auto mt-3 flex">
                  <Plus className="h-3.5 w-3.5" /> เสนอเรื่องแรก
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {top.map((item, idx) => (
                <div
                  key={item.code}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectIssue(item)}
                  onKeyDown={(e) => e.key === "Enter" && onSelectIssue(item)}
                  className="group flex cursor-pointer items-stretch gap-3 rounded-xl border border-line bg-white/[0.02] p-3 transition hover:border-line-strong hover:bg-white/[0.04]"
                >
                  <VoteButton item={item} onUpvote={onUpvote} />
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-fg-subtle">
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                            idx === 0 ? "bg-amber-400/20 text-amber-200" : "bg-white/[0.06] text-fg-muted"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="font-mono">{item.code}</span>
                        <span className={`ml-auto inline-flex items-center gap-1.5 ${TONE[STATUS_CONFIG[item.status].tone].text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${TONE[STATUS_CONFIG[item.status].tone].dot}`} />
                          {STATUS_CONFIG[item.status].shortLabel}
                        </span>
                      </div>
                      <h4 className="mt-1.5 line-clamp-2 text-[13px] leading-snug font-medium text-fg">{item.title}</h4>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-fg-subtle">
                      <PriorityBadge priority={item.priority} compact className="h-5 px-2 text-[11px]" />
                      <div className="flex shrink-0 items-center gap-2 tabular-nums">
                        {(item.attachments?.length || 0) > 0 && (
                          <span className="inline-flex items-center gap-0.5">
                            <Paperclip className="h-3 w-3" /> {item.attachments.length}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-0.5">
                          <MessageSquare className="h-3 w-3" /> {item.comments?.length || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Roadmap stages */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((stage) => {
            const items = sortedByVotes.filter((i) => stage.statuses.includes(i.status));
            return (
              <section key={stage.key} className="flex flex-col rounded-2xl border border-line bg-surface/60">
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${TONE[stage.tone].dot}`} />
                    <h3 className="truncate text-[13px] font-semibold text-fg">{stage.title}</h3>
                    <span className="count">{items.length}</span>
                  </div>
                  <p className="mt-1 text-xs text-fg-subtle">{stage.desc}</p>
                </div>

                <div className="flex-1 space-y-2 px-2.5 pb-2.5">
                  {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line p-6 text-center text-xs text-fg-subtle">
                      ยังไม่มีรายการ
                    </div>
                  ) : (
                    items.map((issue) => {
                      const subtasksTotal = issue.subtasks?.length || 0;
                      const subtasksDone = (issue.subtasks || []).filter((s) => s.completed).length;
                      return (
                        <div
                          key={issue.code}
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelectIssue(issue)}
                          onKeyDown={(e) => e.key === "Enter" && onSelectIssue(issue)}
                          className="flex cursor-pointer gap-2.5 rounded-xl border border-line bg-raised/60 p-3 transition hover:border-line-strong hover:bg-raised"
                        >
                          <VoteButton item={issue} onUpvote={onUpvote} size="sm" />
                          <div className="min-w-0 flex-1">
                            <span className="font-mono text-[11px] text-fg-subtle">{issue.code}</span>
                            <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug font-medium text-fg">{issue.title}</p>
                            {issue.reviewMeta?.fixInstructions && (
                              <p className="mt-1.5 line-clamp-2 text-xs text-fg-subtle">{issue.reviewMeta.fixInstructions}</p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <TypeBadge type={issue.type} compact className="h-5 px-2 text-[11px]" />
                              {subtasksTotal > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-fg-subtle tabular-nums">
                                  <ListChecks className="h-3 w-3" /> {subtasksDone}/{subtasksTotal}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
