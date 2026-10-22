"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Activity,
  Table2,
  Kanban,
  Rocket,
  Terminal,
  FolderPlus,
  X,
  ArrowRight,
} from "lucide-react";
import type { IssueRecord, ProjectRecord } from "@/lib/types";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badges";

export function CommandPaletteModal({
  open,
  onClose,
  issues,
  projects,
  onSelectIssue,
  onSelectProject,
  onChangeView,
  onOpenCreateIssue,
  onOpenCreateProject,
  onOpenMcpGuide,
  canCreateIssue = true,
  isAdmin = true,
}: {
  open: boolean;
  onClose: () => void;
  issues: IssueRecord[];
  projects: ProjectRecord[];
  onSelectIssue: (issue: IssueRecord) => void;
  onSelectProject: (key: string) => void;
  onChangeView: (view: "monitor" | "table" | "kanban" | "roadmap") => void;
  onOpenCreateIssue: () => void;
  onOpenCreateProject: () => void;
  onOpenMcpGuide: () => void;
  canCreateIssue?: boolean;
  isAdmin?: boolean;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  if (!open) return null;

  const q = query.trim().toLowerCase();

  const matchedIssues = issues
    .filter(
      (i) =>
        !q ||
        i.code.toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q) ||
        (i.reporter || "").toLowerCase().includes(q) ||
        (i.department || "").toLowerCase().includes(q)
    )
    .slice(0, 6);

  const quickActions = [
    ...(canCreateIssue
      ? [
          {
            id: "new-issue",
            label: "แจ้งปัญหาใหม่ / พูดด้วยเสียง / ส่งความต้องการจากทีม (Create Issue)",
            icon: Plus,
            color: "text-emerald-400",
            run: () => {
              onClose();
              onOpenCreateIssue();
            },
          },
        ]
      : []),
    {
      id: "view-monitor",
      label: "เปิดหน้าจอ Live Monitor ติดตามสถานะและ SLA",
      icon: Activity,
      color: "text-emerald-400",
      run: () => {
        onChangeView("monitor");
        onClose();
      },
    },
    {
      id: "view-roadmap",
      label: "เปิดกระดานโหวตไอเดีย & Product Roadmap",
      icon: Rocket,
      color: "text-amber-400",
      run: () => {
        onChangeView("roadmap");
        onClose();
      },
    },
    {
      id: "view-table",
      label: "เปิดตารางรายการ Issues (ความกว้าง 100%)",
      icon: Table2,
      color: "text-sky-400",
      run: () => {
        onChangeView("table");
        onClose();
      },
    },
    {
      id: "view-kanban",
      label: "เปิดกระดาน Kanban Board",
      icon: Kanban,
      color: "text-purple-400",
      run: () => {
        onChangeView("kanban");
        onClose();
      },
    },
    ...(isAdmin
      ? [
          {
            id: "new-project",
            label: "สร้างโปรเจกต์ใหม่ (New Project Workspace)",
            icon: FolderPlus,
            color: "text-cyan-400",
            run: () => {
              onClose();
              onOpenCreateProject();
            },
          },
        ]
      : []),
    {
      id: "open-mcp",
      label: "ตั้งค่าและทดสอบ AI MCP Server (14 Tools)",
      icon: Terminal,
      color: "text-purple-400",
      run: () => {
        onClose();
        onOpenMcpGuide();
      },
    },
  ].filter((a) => !q || a.label.toLowerCase().includes(q));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 pt-16 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        data-testid="command-palette-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        {/* Search Input Bar */}
        <div className="flex items-center border-b border-slate-800 px-4 py-3">
          <Search className="h-4 w-4 text-emerald-400 mr-3 shrink-0" />
          <input
            type="text"
            autoFocus
            data-testid="command-palette-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="พิมพ์ค้นหารหัส Issue, หัวข้อ, โปรเจกต์ หรือคำสั่งด่วน... (กด Esc เพื่อปิด)"
            className="w-full bg-transparent text-sm text-white placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-3 space-y-4">
          {/* Quick Actions */}
          {quickActions.length > 0 && (
            <div>
              <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                คำสั่งด่วน (Quick Commands)
              </p>
              <div className="space-y-1">
                {quickActions.map((act) => {
                  const Icon = act.icon;
                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={act.run}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs text-slate-200 transition hover:bg-slate-800"
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className={`h-4 w-4 ${act.color}`} />
                        <span>{act.label}</span>
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Matching Issues */}
          <div>
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              รายการ Issues ({matchedIssues.length})
            </p>
            {matchedIssues.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-slate-500">
                ไม่พบ Issue ที่ตรงกับคำค้นหา
              </p>
            ) : (
              <div className="space-y-1">
                {matchedIssues.map((issue) => (
                  <button
                    key={issue.code}
                    type="button"
                    onClick={() => {
                      onSelectIssue(issue);
                      onClose();
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition hover:bg-slate-800"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 rounded bg-slate-800 px-2 py-0.5 font-mono font-bold text-emerald-400">
                        {issue.code}
                      </span>
                      <span className="truncate font-medium text-slate-100">{issue.title}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <PriorityBadge priority={issue.priority} />
                      <StatusBadge status={issue.status} compact />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Switch Project */}
          <div>
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              สลับโปรเจกต์ด่วน
            </p>
            <div className="flex flex-wrap gap-1.5 px-2">
              {projects.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    onSelectProject(p.key);
                    onClose();
                  }}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/90 px-2.5 text-xs text-slate-200 hover:border-emerald-500/50"
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="font-mono font-bold text-emerald-400">{p.key}</span>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
