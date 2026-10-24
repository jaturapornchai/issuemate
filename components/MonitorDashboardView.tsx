"use client";

import React from "react";
import {
  RefreshCw,
  Database,
  ChevronRight,
  Flame,
  Layers,
  Inbox,
  Target,
  Clock3,
  Users,
  ListTodo,
  FolderKanban,
  Shapes,
} from "lucide-react";
import type {
  IssuePriority,
  IssueRecord,
  IssueStatusFilter,
  IssueType,
  MonitorStats,
} from "@/lib/types";
import {
  PriorityBadge,
  StatusBadge,
  TYPE_CONFIG,
  TYPE_ORDER,
  STATUS_CONFIG,
  TONE,
  Avatar,
  formatRelativeTime,
  formatThaiDateTime,
  type Tone,
} from "./ui/Badges";

export interface MonitorDrillDown {
  status?: IssueStatusFilter;
  priority?: IssuePriority | "all";
  type?: IssueType | "all";
  projectKey?: string;
}

function CardTitle({
  icon: Icon,
  title,
  right,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <Icon className="h-4 w-4 text-fg-subtle" />
        {title}
      </h3>
      {right}
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "zinc",
  onClick,
  valueTestId,
  subTestId,
  children,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  onClick?: () => void;
  valueTestId?: string;
  subTestId?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card group flex cursor-pointer flex-col p-4 text-left transition hover:border-line-strong hover:bg-raised/60 sm:p-5"
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-fg-muted">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONE[tone].soft}`}>
          <Icon className={`h-4 w-4 ${TONE[tone].text}`} />
        </span>
      </div>
      <p data-testid={valueTestId} className="mt-3 text-3xl font-semibold tracking-tight text-fg tabular-nums">
        {value}
      </p>
      {children}
      {sub && (
        <p data-testid={subTestId} className="mt-1.5 text-xs text-fg-subtle">
          {sub}
        </p>
      )}
    </button>
  );
}

export function MonitorDashboardView({
  stats,
  issues,
  onSelectIssue,
  onRefresh,
  onReseedSampleData,
  onDrillDown,
  isRefreshing,
}: {
  stats: MonitorStats | null;
  issues: IssueRecord[];
  onSelectIssue: (issue: IssueRecord) => void;
  onRefresh: () => void;
  onReseedSampleData?: () => void;
  onDrillDown?: (filter: MonitorDrillDown) => void;
  isRefreshing: boolean;
}) {
  if (!stats) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-5 p-4 sm:p-6">
        <div className="skeleton h-8 w-64" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    );
  }

  const pendingReviewTotal = stats.openIssues + stats.reviewingIssues;
  const unresolved = pendingReviewTotal + stats.readyToFixIssues + stats.fixingIssues;
  const queue = issues
    .filter((i) => i.status === "ready_to_fix" || i.status === "fixing" || i.status === "open")
    .slice(0, 8);
  const maxTypeCount = Math.max(1, ...TYPE_ORDER.map((t) => stats.byType[t] || 0));

  const pipeline: Array<{
    key: IssueStatusFilter;
    label: string;
    hint: string;
    value: number;
    tone: Tone;
    testId: string;
  }> = [
    {
      key: "pending_review",
      label: "รอตรวจสอบ",
      hint: `รอ ${stats.openIssues} · กำลังตรวจ ${stats.reviewingIssues}`,
      value: pendingReviewTotal,
      tone: "amber",
      testId: "kpi-open",
    },
    {
      key: "ready_to_fix",
      label: "รอแก้ไข",
      hint:
        stats.awaitingAiApprovalCount > 0
          ? `รอผู้ดูแลอนุมัติให้ AI แก้ ${stats.awaitingAiApprovalCount}`
          : "ตรวจสอบแล้ว อยู่ในคิว",
      value: stats.readyToFixIssues,
      tone: "sky",
      testId: "kpi-ready-to-fix",
    },
    {
      key: "fixing",
      label: "กำลังแก้ไข",
      hint: `งานย่อย ${stats.subtasksCompleted}/${stats.subtasksTotal}`,
      value: stats.fixingIssues,
      tone: "blue",
      testId: "kpi-fixing",
    },
    {
      key: "deployed",
      label: "เสร็จแล้ว",
      hint: `อัตราจบงาน ${stats.resolutionRatePct}%`,
      value: stats.deployedIssues,
      tone: "emerald",
      testId: "kpi-closed",
    },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1400px] space-y-5 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold tracking-tight text-fg">ภาพรวมความคืบหน้า</h2>
              <span className="pill bg-emerald-400/10 text-emerald-200 ring-emerald-400/25">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                อัปเดตอัตโนมัติ
              </span>
            </div>
            <p className="mt-1 text-[13px] text-fg-muted">
              ติดตามทุกเรื่องตั้งแต่รับแจ้ง ตรวจสอบ แก้ไข จนเสร็จเรียบร้อย — คลิกตัวเลขเพื่อดูรายการ
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onReseedSampleData && (
              <button
                type="button"
                onClick={onReseedSampleData}
                data-testid="reseed-sample-btn"
                className="btn btn-ghost btn-sm text-rose-300 hover:text-rose-200"
                title="ล้างข้อมูล Issues ทั้งหมด (เฉพาะผู้ดูแลระบบ)"
              >
                <Database className="h-3.5 w-3.5" />
                <span>ล้างข้อมูลทั้งหมด</span>
              </button>
            )}
            <button
              type="button"
              onClick={onRefresh}
              data-testid="monitor-refresh-btn"
              className="btn btn-secondary btn-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
              <span>รีเฟรช</span>
            </button>
          </div>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="เรื่องทั้งหมด"
            value={stats.totalIssues}
            icon={Layers}
            onClick={() => onDrillDown?.({ status: "all", priority: "all", type: "all" })}
            valueTestId="kpi-total"
            subTestId="kpi-biz-devops"
            sub={`ระบบล่ม/เหตุด่วนที่เปิดอยู่ ${stats.activeIncidentsCount} เรื่อง`}
          />
          <StatTile
            label="ยังไม่ปิด"
            value={unresolved}
            icon={Inbox}
            tone="amber"
            onClick={() => onDrillDown?.({ status: "active", priority: "all", type: "all" })}
            sub={`รอตรวจสอบ ${pendingReviewTotal} · อยู่ระหว่างแก้ไข ${stats.readyToFixIssues + stats.fixingIssues}`}
          />
          <StatTile
            label="อัตราจบงาน"
            value={`${stats.resolutionRatePct}%`}
            icon={Target}
            tone="emerald"
            onClick={() => onDrillDown?.({ status: "deployed", priority: "all", type: "all" })}
            sub={`เสร็จแล้ว ${stats.deployedIssues} · ไม่แก้ไข ${stats.wontFixIssues}`}
          >
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
                style={{ width: `${Math.min(100, stats.resolutionRatePct)}%` }}
              />
            </div>
          </StatTile>
          <StatTile
            label="ด่วนที่สุดที่ยังค้าง"
            value={stats.criticalOpenCount}
            icon={Flame}
            tone={stats.criticalOpenCount > 0 ? "red" : "zinc"}
            onClick={() => onDrillDown?.({ status: "active", priority: "critical", type: "all" })}
            sub={
              stats.criticalOpenCount > 0
                ? "ควรจัดการเป็นลำดับแรก"
                : "ไม่มีเรื่องด่วนค้าง — เยี่ยมมาก"
            }
          />
        </div>

        {/* Pipeline */}
        <div className="card p-4 sm:p-5">
          <CardTitle
            icon={ListTodo}
            title="ขั้นตอนการทำงาน"
            right={
              <button
                type="button"
                onClick={() => onDrillDown?.({ status: "wont_fix", priority: "all", type: "all" })}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-fg-muted transition hover:bg-white/[0.04] hover:text-fg"
                title={STATUS_CONFIG.wont_fix.description}
              >
                <span className={`h-2 w-2 rounded-full ${TONE.zinc.dot}`} />
                ปิดเรื่องโดยไม่แก้ไข
                <strong data-testid="kpi-wont-fix" className="font-semibold text-fg tabular-nums">
                  {stats.wontFixIssues}
                </strong>
              </button>
            }
          />
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {pipeline.map((stage, idx) => (
              <button
                key={stage.key}
                type="button"
                onClick={() => onDrillDown?.({ status: stage.key, priority: "all", type: "all" })}
                className="group relative cursor-pointer rounded-xl border border-line bg-white/[0.02] p-4 text-left transition hover:border-line-strong hover:bg-white/[0.04]"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-semibold text-fg-muted">
                    {idx + 1}
                  </span>
                  <span className="text-[13px] font-medium text-fg">{stage.label}</span>
                  <span className={`ml-auto h-2 w-2 rounded-full ${TONE[stage.tone].dot}`} />
                </div>
                <p data-testid={stage.testId} className={`mt-3 text-2xl font-semibold tabular-nums ${TONE[stage.tone].text}`}>
                  {stage.value}
                </p>
                <p className="mt-1 text-xs text-fg-subtle">{stage.hint}</p>
                {idx < pipeline.length - 1 && (
                  <ChevronRight className="absolute top-1/2 -right-[13px] z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full border border-line bg-surface p-0.5 text-fg-subtle lg:block" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Projects + Types */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="card p-4 sm:p-5 lg:col-span-7">
            <CardTitle
              icon={FolderKanban}
              title="ความคืบหน้าแยกตามโปรเจกต์"
              right={<span className="text-xs text-fg-subtle">{stats.byProject.length} โปรเจกต์</span>}
            />
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-fg-subtle">
              {(
                [
                  ["emerald", "เสร็จแล้ว"],
                  ["blue", "กำลังแก้ไข"],
                  ["sky", "รอแก้ไข"],
                  ["amber", "รอตรวจสอบ"],
                  ["zinc", "ไม่แก้ไข"],
                ] as Array<[Tone, string]>
              ).map(([tone, label]) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${TONE[tone].dot}`} />
                  {label}
                </span>
              ))}
            </div>
            <div className="space-y-1">
              {stats.byProject.length === 0 && (
                <p className="py-6 text-center text-[13px] text-fg-subtle">ยังไม่มีโปรเจกต์</p>
              )}
              {stats.byProject.map((p) => {
                const total = Math.max(p.total, 1);
                const seg = (n: number) => `${(n / total) * 100}%`;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => onDrillDown?.({ projectKey: p.key, status: "all" })}
                    className="w-full cursor-pointer rounded-xl px-3 py-3 text-left transition hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ backgroundColor: p.color }} />
                        <span className="truncate text-[13px] font-medium text-fg">{p.name}</span>
                        <span className="shrink-0 font-mono text-[11px] text-fg-subtle">{p.key}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-xs">
                        {p.critical > 0 && (
                          <span className="pill h-5 bg-red-500/15 px-2 text-[11px] text-red-200 ring-red-400/30">
                            <Flame className="h-3 w-3" /> ด่วน {p.critical}
                          </span>
                        )}
                        <span className="text-fg-subtle tabular-nums">
                          เสร็จ <strong className="font-semibold text-fg">{p.deployed}</strong>/{p.total}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2.5 flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-white/[0.05]">
                      <div style={{ width: seg(p.deployed) }} className="bg-emerald-400" title={`เสร็จแล้ว ${p.deployed}`} />
                      <div style={{ width: seg(p.fixing) }} className="bg-blue-400" title={`กำลังแก้ไข ${p.fixing}`} />
                      <div style={{ width: seg(p.readyToFix) }} className="bg-sky-400" title={`รอแก้ไข ${p.readyToFix}`} />
                      <div style={{ width: seg(p.open + p.reviewing) }} className="bg-amber-400" title={`รอตรวจสอบ ${p.open + p.reviewing}`} />
                      <div style={{ width: seg(p.wontFix) }} className="bg-zinc-500" title={`ไม่แก้ไข ${p.wontFix}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card p-4 sm:p-5 lg:col-span-5">
            <CardTitle icon={Shapes} title="ประเภทเรื่องที่แจ้งเข้ามา" />
            <div className="space-y-1">
              {TYPE_ORDER.map((typeKey) => {
                const cfg = TYPE_CONFIG[typeKey];
                const Icon = cfg.icon;
                const count = stats.byType[typeKey] || 0;
                return (
                  <button
                    key={typeKey}
                    type="button"
                    onClick={() => onDrillDown?.({ type: typeKey, status: "all" })}
                    className="group w-full cursor-pointer rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`h-4 w-4 shrink-0 ${TONE[cfg.tone].text}`} />
                      <span className="flex-1 truncate text-[13px] text-fg-muted group-hover:text-fg">{cfg.label}</span>
                      <span className="text-[13px] font-semibold text-fg tabular-nums">{count}</span>
                    </div>
                    <div className="mt-1.5 ml-[26px] h-1 overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className={`h-full rounded-full ${TONE[cfg.tone].dot} opacity-80`}
                        style={{ width: `${(count / maxTypeCount) * 100}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Queue + Team + Activity */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="card p-4 sm:p-5 lg:col-span-7">
            <CardTitle
              icon={ListTodo}
              title="คิวงานที่ต้องจัดการ"
              right={<span className="count">{queue.length}</span>}
            />
            {queue.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-fg-subtle">ไม่มีงานค้างในคิว</p>
            ) : (
              <div className="divide-y divide-line">
                {queue.map((issue) => (
                  <div
                    key={issue.code}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectIssue(issue)}
                    onKeyDown={(e) => e.key === "Enter" && onSelectIssue(issue)}
                    className="-mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-white/[0.03]"
                  >
                    <span className="w-24 shrink-0 truncate font-mono text-xs text-fg-subtle">{issue.code}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{issue.title}</span>
                    <PriorityBadge priority={issue.priority} compact className="hidden sm:inline-flex" />
                    <StatusBadge status={issue.status} compact />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-5 lg:col-span-5">
            <div className="card p-4 sm:p-5">
              <CardTitle
                icon={Users}
                title="ภาระงานของทีม"
                right={<span className="text-xs text-fg-subtle">{stats.byAssignee.length} ผู้ดูแล</span>}
              />
              {stats.byAssignee.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-fg-subtle">ยังไม่มีการมอบหมายงาน</p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {stats.byAssignee.map((a) => (
                    <div key={a.assignee} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
                      <Avatar name={a.assignee} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">{a.assignee}</span>
                      <div className="flex shrink-0 items-center gap-3 text-xs text-fg-subtle tabular-nums">
                        <span title="รอตรวจสอบ" className="inline-flex items-center gap-1">
                          <span className={`h-1.5 w-1.5 rounded-full ${TONE.amber.dot}`} />
                          {a.pendingReview}
                        </span>
                        <span title="รอ/กำลังแก้ไข" className="inline-flex items-center gap-1">
                          <span className={`h-1.5 w-1.5 rounded-full ${TONE.blue.dot}`} />
                          {a.readyOrFixing}
                        </span>
                        <span title="เสร็จแล้ว" className="inline-flex items-center gap-1">
                          <span className={`h-1.5 w-1.5 rounded-full ${TONE.emerald.dot}`} />
                          {a.completed}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-4 sm:p-5">
              <CardTitle icon={Clock3} title="ความเคลื่อนไหวล่าสุด" />
              {stats.recentActivities.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-fg-subtle">ยังไม่มีความเคลื่อนไหว</p>
              ) : (
                <ol className="relative max-h-80 space-y-4 overflow-y-auto pr-1">
                  {stats.recentActivities.map((act) => (
                    <li key={act.id} className="flex gap-3">
                      <Avatar name={act.actor} size="sm" className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-relaxed text-fg-muted">
                          <strong className="font-medium text-fg">{act.actor}</strong> {act.detail}
                        </p>
                        <p
                          className="mt-0.5 text-xs text-fg-subtle"
                          title={formatThaiDateTime(act.createdAt)}
                        >
                          <span className="font-mono">{act.issueCode}</span> · {formatRelativeTime(act.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
