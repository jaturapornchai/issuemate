"use client";

import React from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  RefreshCw,
  CheckSquare,
  Layers,
  Database,
  Siren,
  Eye,
  ClipboardCheck,
  Wrench,
  XCircle,
  Sparkles,
  Rocket,
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
  TypeBadge,
  TYPE_CONFIG,
  formatThaiDateTime,
} from "./ui/Badges";

export interface MonitorDrillDown {
  status?: IssueStatusFilter;
  priority?: IssuePriority | "all";
  type?: IssueType | "all";
  projectKey?: string;
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
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        กำลังโหลดข้อมูล DevOps Monitor...
      </div>
    );
  }

  const pendingReviewTotal = stats.openIssues + stats.reviewingIssues;
  const readyAndFixingIssues = issues
    .filter((i) => i.status === "ready_to_fix" || i.status === "fixing" || i.status === "open")
    .slice(0, 8);

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-500/25 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 px-5 py-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 shadow-inner">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-bold text-white">
                ศูนย์ควบคุมแจ้งปัญหา &amp; Antigravity Pipeline (รีวิว &rarr; แก้ไข &rarr; Deploy)
              </h2>
              <span className="inline-flex h-5 items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 text-[11px] font-medium text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Pipeline
              </span>
            </div>
            <p className="text-xs text-slate-400">
              1. แจ้งปัญหา (`open`) &rarr; 2. Antigravity รีวิว (`reviewing`) &rarr; 3. สั่งแก้ (`ready_to_fix`) หรือ ไม่แก้ (`wont_fix`) &rarr; 4. Antigravity แก้และ Deploy (`fixing` &rarr; `deployed`)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onReseedSampleData && (
            <button
              type="button"
              onClick={onReseedSampleData}
              data-testid="reseed-sample-btn"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-teal-500/40 bg-teal-500/15 px-3.5 text-xs font-medium text-teal-200 transition hover:bg-teal-500/25"
            >
              <Database className="h-3.5 w-3.5 text-teal-300" />
              <span>รีเซ็ตข้อมูลตัวอย่าง DevOps</span>
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            data-testid="monitor-refresh-btn"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/90 px-3.5 text-xs font-medium text-slate-200 transition hover:border-emerald-500/50 hover:text-emerald-300"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
            <span>อัปเดตข้อมูลล่าสุด</span>
          </button>
        </div>
      </div>

      {/* Top 6 Pipeline KPI Cards */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-6">
        <button
          type="button"
          onClick={() => onDrillDown?.({ status: "all", priority: "all", type: "all" })}
          className="group rounded-xl border border-slate-800 bg-slate-900/90 p-4 text-left transition hover:border-slate-600 hover:bg-slate-800/70"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">ทั้งหมดในระบบ</span>
            <Layers className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-white" data-testid="kpi-total">
            {stats.totalIssues}
          </p>
          <p className="mt-1 text-[11px] text-slate-400" data-testid="kpi-biz-devops">
            Incident เปิดอยู่ {stats.activeIncidentsCount} รายการ
          </p>
        </button>

        <button
          type="button"
          onClick={() => onDrillDown?.({ status: "pending_review", priority: "all", type: "all" })}
          className="group rounded-xl border border-amber-500/30 bg-amber-950/15 p-4 text-left transition hover:border-amber-400/60 hover:bg-amber-950/25"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-300">1-2. รอรีวิว (Antigravity)</span>
            <Eye className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-amber-400" data-testid="kpi-open">
            {pendingReviewTotal}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            รอรีวิว {stats.openIssues} • กำลังรีวิว {stats.reviewingIssues}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onDrillDown?.({ status: "ready_to_fix", priority: "all", type: "all" })}
          className="group rounded-xl border border-cyan-500/35 bg-cyan-950/20 p-4 text-left transition hover:border-cyan-400/60 hover:bg-cyan-950/30"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cyan-300">3. รอแก้ (Antigravity)</span>
            <ClipboardCheck className="h-4 w-4 text-cyan-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-cyan-300" data-testid="kpi-ready-to-fix">
            {stats.readyToFixIssues}
          </p>
          <p className="mt-1 text-[11px] text-cyan-200/80">
            รีวิวแล้ว มีคำสั่งแก้พร้อมดึง
          </p>
        </button>

        <button
          type="button"
          onClick={() => onDrillDown?.({ status: "fixing", priority: "all", type: "all" })}
          className="group rounded-xl border border-sky-500/30 bg-slate-900/90 p-4 text-left transition hover:border-sky-400/60 hover:bg-slate-800/70"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-300">4. กำลังแก้ / Deploy</span>
            <Wrench className="h-4 w-4 text-sky-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-sky-400" data-testid="kpi-fixing">
            {stats.fixingIssues}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            งานย่อย {stats.subtasksCompleted}/{stats.subtasksTotal}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onDrillDown?.({ status: "deployed", priority: "all", type: "all" })}
          className="group rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-4 text-left transition hover:border-emerald-400/60 hover:bg-emerald-950/25"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-300">5. Deploy แล้ว</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-400" data-testid="kpi-closed">
            {stats.deployedIssues}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            อัตราจบงาน {stats.resolutionRatePct}%
          </p>
        </button>

        <button
          type="button"
          onClick={() => onDrillDown?.({ status: "wont_fix", priority: "all", type: "all" })}
          className="group rounded-xl border border-rose-500/30 bg-rose-950/15 p-4 text-left transition hover:border-rose-400/60 hover:bg-rose-950/25"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-300">6. ไม่แก้ (Won&apos;t Fix)</span>
            <XCircle className="h-4 w-4 text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-rose-400" data-testid="kpi-wont-fix">
            {stats.wontFixIssues}
          </p>
          <p className="mt-1 text-[11px] text-rose-200/80">
            รีวิวแล้วไม่แก้ (พร้อมเหตุผล)
          </p>
        </button>
      </div>

      {/* Middle Section: Project Health Matrix + Type & AI Agent Workload */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Project Health Matrix (7 cols) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 lg:col-span-7 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">
                สถานะความคืบหน้าแยกตามระบบ DevOps &amp; Infra (Project Pipeline Matrix)
              </h3>
            </div>
            <span className="text-xs text-slate-400">{stats.byProject.length} โปรเจกต์</span>
          </div>

          <div className="space-y-2.5">
            {stats.byProject.map((p) => {
              const total = Math.max(p.total, 1);
              const pOpen = Math.round(((p.open + p.reviewing) / total) * 100);
              const pReady = Math.round((p.readyToFix / total) * 100);
              const pFixing = Math.round((p.fixing / total) * 100);
              const pDeployed = Math.round((p.deployed / total) * 100);
              const pWontFix = Math.max(0, 100 - pOpen - pReady - pFixing - pDeployed);

              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => onDrillDown?.({ projectKey: p.key, status: "all" })}
                  className="w-full rounded-lg border border-slate-800/90 bg-slate-950/70 p-3 text-left transition hover:border-emerald-500/40 hover:bg-slate-950"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs font-bold text-white">
                        {p.key}
                      </span>
                      <span className="truncate text-xs font-semibold text-slate-100">
                        {p.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {p.readyToFix > 0 && (
                        <span className="inline-flex h-5 items-center gap-1 rounded-full bg-cyan-500/20 px-2 text-[11px] font-semibold text-cyan-300 border border-cyan-500/40">
                          รอแก้ {p.readyToFix}
                        </span>
                      )}
                      {p.critical > 0 && (
                        <span className="inline-flex h-5 items-center gap-1 rounded-full bg-red-500/20 px-2 text-[11px] font-semibold text-red-300 border border-red-500/30">
                          <Flame className="h-3 w-3" /> วิกฤต {p.critical}
                        </span>
                      )}
                      <span className="font-mono text-slate-300">
                        Deploy แล้ว <strong className="text-emerald-400">{p.deployed}</strong> / {p.total}
                      </span>
                    </div>
                  </div>

                  {/* Segmented Bar */}
                  <div className="mt-2.5 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      style={{ width: `${pDeployed}%` }}
                      className="bg-emerald-500 transition-all"
                      title={`Deploy แล้ว: ${p.deployed}`}
                    />
                    <div
                      style={{ width: `${pFixing}%` }}
                      className="bg-sky-500 transition-all"
                      title={`กำลังแก้/Deploy: ${p.fixing}`}
                    />
                    <div
                      style={{ width: `${pReady}%` }}
                      className="bg-cyan-400 transition-all"
                      title={`รอแก้ (Antigravity): ${p.readyToFix}`}
                    />
                    <div
                      style={{ width: `${pOpen}%` }}
                      className="bg-amber-500 transition-all"
                      title={`รอ/กำลังรีวิว (Antigravity): ${p.open + p.reviewing}`}
                    />
                    <div
                      style={{ width: `${pWontFix}%` }}
                      className="bg-rose-500 transition-all"
                      title={`ไม่แก้: ${p.wontFix}`}
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-400" /> รอ/กำลังรีวิว:{" "}
                      <strong className="text-slate-200">{p.open + p.reviewing}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-cyan-400" /> รอแก้:{" "}
                      <strong className="text-cyan-300">{p.readyToFix}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-sky-400" /> กำลังแก้:{" "}
                      <strong className="text-slate-200">{p.fixing}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" /> Deploy แล้ว:{" "}
                      <strong className="text-emerald-300">{p.deployed}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-rose-400" /> ไม่แก้:{" "}
                      <strong className="text-rose-300">{p.wontFix}</strong>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Issue Types & AI Agent Workload (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Siren className="h-4 w-4 text-rose-400" />
              <h3 className="text-sm font-bold text-white">
                สัดส่วนหมวดหมู่คำถาม &amp; ปัญหาที่แจ้งเข้ามา
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  "question",
                  "bug",
                  "incident",
                  "feature",
                  "performance",
                  "deployment",
                  "security",
                ] as IssueType[]
              ).map((typeKey) => {
                const cfg = TYPE_CONFIG[typeKey];
                const Icon = cfg.icon;
                const count = stats.byType[typeKey] || 0;
                return (
                  <button
                    key={typeKey}
                    type="button"
                    onClick={() => onDrillDown?.({ type: typeKey, status: "all" })}
                    className="flex items-center justify-between rounded-lg border border-slate-800/90 bg-slate-950/60 px-3 py-2 text-left transition hover:border-emerald-500/40 hover:bg-slate-900"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate text-xs text-slate-200">{cfg.label}</span>
                    </div>
                    <span className="ml-2 font-mono text-xs font-bold text-white">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">
                  ภาระงานของ AI Agents &amp; ทีม DevOps
                </h3>
              </div>
              <span className="text-xs text-slate-400">{stats.byAssignee.length} ผู้รับผิดชอบ</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {stats.byAssignee.map((a) => (
                <div
                  key={a.assignee}
                  className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-950/60 px-3 py-2 text-xs"
                >
                  <span className="font-medium text-slate-200 truncate">{a.assignee}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300">
                      รอรีวิว {a.pendingReview}
                    </span>
                    <span className="rounded bg-cyan-500/15 px-2 py-0.5 text-[11px] text-cyan-300">
                      รอ/กำลังแก้ {a.readyOrFixing}
                    </span>
                    <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">
                      จบ {a.completed}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Ready for Antigravity Queue & Recent Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">
                คิวงานสำคัญ (รอ Antigravity รีวิว / แก้ไข / Deploy)
              </h3>
            </div>
            <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
              {readyAndFixingIssues.length} รายการ
            </span>
          </div>

          <div className="space-y-2">
            {readyAndFixingIssues.map((issue) => (
              <div
                key={issue.code}
                onClick={() => onSelectIssue(issue)}
                className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 transition hover:border-cyan-500/40 hover:bg-slate-900"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="font-mono text-xs font-bold text-emerald-400 shrink-0">
                    #{issue.code}
                  </span>
                  <PriorityBadge priority={issue.priority} />
                  <span className="truncate text-xs font-medium text-white">{issue.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <TypeBadge type={issue.type} compact />
                  <StatusBadge status={issue.status} compact />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">
                ความเคลื่อนไหวล่าสุด (Antigravity Activity Log)
              </h3>
            </div>
            <CheckSquare className="h-4 w-4 text-slate-400" />
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {stats.recentActivities.map((act) => (
              <div
                key={act.id}
                className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-emerald-400 font-mono">
                    #{act.issueCode}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {formatThaiDateTime(act.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-slate-200">
                  <strong className="text-white">{act.actor}</strong>: {act.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
