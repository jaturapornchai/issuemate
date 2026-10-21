"use client";

import React from "react";
import {
  ThumbsUp,
  Sparkles,
  Rocket,
  CheckCircle2,
  Eye,
  Plus,
  MessageSquare,
  Paperclip,
  Trophy,
  ClipboardCheck,
  Wrench,
} from "lucide-react";
import type { IssueRecord } from "@/lib/types";
import { PriorityBadge, TypeBadge } from "@/components/ui/Badges";

export function IdeasRoadmapView({
  issues,
  onSelectIssue,
  onUpvote,
  onOpenCreateIdea,
}: {
  issues: IssueRecord[];
  onSelectIssue: (issue: IssueRecord) => void;
  onUpvote: (code: string) => void;
  onOpenCreateIdea: () => void;
}) {
  const sortedByVotes = [...issues].sort(
    (a, b) => (b.upvotes || 0) - (a.upvotes || 0)
  );

  const roadmapStages = [
    {
      key: "pending_review",
      title: "1. รอรีวิว (open / reviewing)",
      desc: "ปัญหาและไอเดียที่รอให้ Antigravity วิเคราะห์สาเหตุและความคุ้มค่า",
      icon: Eye,
      accent: "border-amber-500/40 text-amber-300",
      items: sortedByVotes.filter((i) => i.status === "open" || i.status === "reviewing"),
    },
    {
      key: "ready_to_fix",
      title: "2. รอแก้ (Ready for Antigravity)",
      desc: "รีวิวผ่านแล้ว มีคำสั่งในการแก้ พร้อมให้ Antigravity ดึงไปทำ",
      icon: ClipboardCheck,
      accent: "border-cyan-500/40 text-cyan-300",
      items: sortedByVotes.filter((i) => i.status === "ready_to_fix"),
    },
    {
      key: "fixing",
      title: "3. กำลังแก้ & Deploy (Fixing)",
      desc: "Antigravity กำลังแก้โค้ด รันเทสต์ Playwright และเตรียม Deploy",
      icon: Wrench,
      accent: "border-sky-500/40 text-sky-300",
      items: sortedByVotes.filter((i) => i.status === "fixing"),
    },
    {
      key: "deployed",
      title: "4. Deploy ขึ้นเซิร์ฟเวอร์แล้ว (Deployed)",
      desc: "แก้ไข ทดสอบ และ Deploy ขึ้น Production เรียบร้อย",
      icon: CheckCircle2,
      accent: "border-emerald-500/40 text-emerald-300",
      items: sortedByVotes.filter((i) => i.status === "deployed"),
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-5 space-y-6" data-testid="ideas-roadmap-view">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/35 px-5 py-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-400">
            <Rocket className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">
                แผนงาน Roadmap &amp; ลำดับความสำคัญ (Antigravity Review, Fix &amp; Deploy)
              </h2>
              <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
                Prioritization
              </span>
            </div>
            <p className="text-xs text-slate-400">
              โหวตจัดลำดับความสำคัญของงาน และติดตามสถานะตั้งแต่รีวิว จนถึง Antigravity แก้ไขและ Deploy
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenCreateIdea}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-amber-500 px-4 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400"
        >
          <Plus className="h-4 w-4" />
          <span>แจ้งเรื่อง / เพิ่มแผนงาน DevOps</span>
        </button>
      </div>

      {/* Top Voted Leaderboard */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4">
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Trophy className="h-4 w-4 text-amber-400" />
            <span>รายการสำคัญสูงสุดที่ทีม DevOps โหวต (Top Priority Queue)</span>
          </h3>
          <span className="text-xs text-slate-400">คลิกปุ่มโหวตด้านซ้ายเพื่อเพิ่มคะแนนความสำคัญ</span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {sortedByVotes.slice(0, 6).map((item, idx) => (
            <div
              key={item.code}
              onClick={() => onSelectIssue(item)}
              className="group flex cursor-pointer items-stretch gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 transition hover:border-amber-500/50 hover:bg-slate-900"
            >
              <button
                type="button"
                data-testid={`roadmap-upvote-${item.code}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpvote(item.code);
                }}
                className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/10 py-2 text-amber-300 transition hover:bg-amber-500/25"
                title="คลิกเพื่อโหวตสนับสนุน"
              >
                <ThumbsUp className="h-4 w-4" />
                <span className="mt-1 font-mono text-sm font-bold">{item.upvotes || 0}</span>
                <span className="text-[9px] text-amber-200/80">โหวต</span>
              </button>

              <div className="min-w-0 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-400">
                      #{idx + 1} • {item.code}
                    </span>
                    <PriorityBadge priority={item.priority} />
                  </div>
                  <h4 className="mt-1.5 line-clamp-2 text-xs font-semibold text-slate-100 group-hover:text-amber-300">
                    {item.title}
                  </h4>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="truncate">{item.assignee || item.reporter}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {(item.attachments?.length || 0) > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-sky-400">
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
      </div>

      {/* 4-Stage Pipeline Roadmap */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {roadmapStages.map((stage) => {
          const StageIcon = stage.icon;
          return (
            <div
              key={stage.key}
              className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden"
            >
              <div className={`border-b-2 ${stage.accent} bg-slate-900 p-3.5`}>
                <div className="flex h-6 items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2 font-semibold text-xs text-white">
                    <StageIcon className="h-4 w-4 shrink-0" />
                    <span title={stage.title} className="truncate">
                      {stage.title}
                    </span>
                  </div>
                  <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-slate-800 px-2 font-mono text-xs font-bold leading-none text-slate-200">
                    {stage.items.length}
                  </span>
                </div>
                <p title={stage.desc} className="mt-1 truncate text-[11px] text-slate-400">
                  {stage.desc}
                </p>
              </div>

              <div className="flex-1 space-y-2.5 p-3">
                {stage.items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
                    ยังไม่มีรายการในระยะนี้
                  </div>
                ) : (
                  stage.items.map((issue) => {
                    const subtasksTotal = issue.subtasks?.length || 0;
                    const subtasksDone = (issue.subtasks || []).filter((s) => s.completed).length;
                    return (
                      <div
                        key={issue.code}
                        onClick={() => onSelectIssue(issue)}
                        className="cursor-pointer rounded-xl border border-slate-800 bg-slate-950/90 p-3 transition hover:border-emerald-500/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-400">
                            {issue.code}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                            <ThumbsUp className="h-3 w-3" /> {issue.upvotes || 0}
                          </span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs font-semibold text-slate-100">
                          {issue.title}
                        </p>
                        {issue.reviewMeta?.fixInstructions && (
                          <p className="mt-1 line-clamp-2 rounded bg-cyan-950/30 px-2 py-1 text-[10px] text-cyan-200">
                            <Sparkles className="mr-1 inline h-2.5 w-2.5" />
                            {issue.reviewMeta.fixInstructions}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
                          <TypeBadge type={issue.type} compact />
                          {subtasksTotal > 0 && (
                            <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                              ✓ งานย่อย {subtasksDone}/{subtasksTotal}
                            </span>
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
    </div>
  );
}
