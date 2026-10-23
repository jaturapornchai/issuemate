"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Plus,
  LayoutList,
  SquareKanban,
  ChartNoAxesColumn,
  Vote,
  PlugZap,
  FolderPlus,
  CornerDownLeft,
  MessageCircleQuestion,
  Layers,
} from "lucide-react";
import type { IssueRecord, ProjectRecord } from "@/lib/types";
import { StatusBadge } from "@/components/ui/Badges";

type PaletteItem = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconClass?: string;
  color?: string;
  issue?: IssueRecord;
  run: () => void;
};

export function CommandPaletteModal({
  open,
  onClose,
  issues,
  projects,
  onSelectIssue,
  onSelectProject,
  onChangeView,
  onOpenCreateIssue,
  onOpenAskQuestion,
  onOpenCreateProject,
  onOpenMcpGuide,
  canCreateIssue = true,
  canAskQuestion = true,
  canUseMcp = true,
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
  onOpenAskQuestion?: () => void;
  onOpenCreateProject: () => void;
  onOpenMcpGuide: () => void;
  canCreateIssue?: boolean;
  canAskQuestion?: boolean;
  canUseMcp?: boolean;
  isAdmin?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const close = (fn: () => void) => () => {
      onClose();
      fn();
    };

    const actions: PaletteItem[] = [
      ...(canCreateIssue
        ? [{ id: "new-issue", group: "คำสั่งด่วน", label: "แจ้งปัญหาใหม่", hint: "พิมพ์หรือพูดเล่าปัญหา แนบรูปได้", icon: Plus, iconClass: "text-emerald-400", run: close(onOpenCreateIssue) }]
        : []),
      ...(canAskQuestion && onOpenAskQuestion
        ? [{ id: "ask", group: "คำสั่งด่วน", label: "ถามคำถามการใช้งาน", hint: "ขอคู่มือ หรือสอบถามวิธีใช้", icon: MessageCircleQuestion, iconClass: "text-sky-300", run: close(onOpenAskQuestion) }]
        : []),
      { id: "view-table", group: "ไปที่หน้า", label: "รายการทั้งหมด", icon: LayoutList, run: close(() => onChangeView("table")) },
      { id: "view-kanban", group: "ไปที่หน้า", label: "บอร์ดติดตามงาน", icon: SquareKanban, run: close(() => onChangeView("kanban")) },
      { id: "view-monitor", group: "ไปที่หน้า", label: "ภาพรวมความคืบหน้า", icon: ChartNoAxesColumn, run: close(() => onChangeView("monitor")) },
      { id: "view-roadmap", group: "ไปที่หน้า", label: "โหวต & แผนงาน", icon: Vote, run: close(() => onChangeView("roadmap")) },
      ...(isAdmin
        ? [{ id: "new-project", group: "คำสั่งด่วน", label: "สร้างโปรเจกต์ใหม่", icon: FolderPlus, iconClass: "text-fg-muted", run: close(onOpenCreateProject) }]
        : []),
      ...(canUseMcp
        ? [{ id: "open-mcp", group: "คำสั่งด่วน", label: "เชื่อมต่อ AI (MCP Token)", hint: "สำหรับทีมพัฒนา", icon: PlugZap, iconClass: "text-sky-300", run: close(onOpenMcpGuide) }]
        : []),
    ].filter((a) => !q || a.label.toLowerCase().includes(q) || (a.hint || "").toLowerCase().includes(q));

    const matchedIssues: PaletteItem[] = issues
      .filter(
        (i) =>
          !q ||
          i.code.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          (i.reporter || "").toLowerCase().includes(q) ||
          (i.department || "").toLowerCase().includes(q)
      )
      .slice(0, 6)
      .map((issue) => ({
        id: `issue-${issue.code}`,
        group: "เรื่องที่ตรงกัน",
        label: issue.title,
        issue,
        run: () => {
          onSelectIssue(issue);
          onClose();
        },
      }));

    const matchedProjects: PaletteItem[] = projects
      .filter((p) => !q || p.key.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((p) => ({
        id: `project-${p.key}`,
        group: "สลับโปรเจกต์",
        label: p.name,
        hint: p.key,
        color: p.color,
        run: () => {
          onSelectProject(p.key);
          onClose();
        },
      }));

    const allProjects: PaletteItem[] =
      !q || "ทุกโปรเจกต์".includes(q)
        ? [{ id: "project-ALL", group: "สลับโปรเจกต์", label: "ทุกโปรเจกต์", icon: Layers, iconClass: "text-fg-subtle", run: () => { onSelectProject("ALL"); onClose(); } }]
        : [];

    const quick = actions.filter((a) => a.group === "คำสั่งด่วน");
    const views = actions.filter((a) => a.group === "ไปที่หน้า");
    return q
      ? [...matchedIssues, ...quick, ...matchedProjects, ...allProjects, ...views]
      : [...quick, ...matchedIssues, ...views, ...allProjects, ...matchedProjects];
  }, [
    query,
    issues,
    projects,
    onClose,
    onSelectIssue,
    onSelectProject,
    onChangeView,
    onOpenCreateIssue,
    onOpenAskQuestion,
    onOpenCreateProject,
    onOpenMcpGuide,
    canCreateIssue,
    canAskQuestion,
    canUseMcp,
    isAdmin,
  ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[activeIndex]?.run();
    }
  };

  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-start justify-center bg-black/70 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        data-testid="command-palette-modal"
        role="dialog"
        aria-modal="true"
        aria-label="ค้นหาด่วน"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl animate-scale-in overflow-hidden rounded-2xl border border-line bg-overlay shadow-pop"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-fg-subtle" />
          <input
            type="text"
            autoFocus
            data-testid="command-palette-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="ค้นหารหัสเรื่อง หัวข้อ โปรเจกต์ หรือคำสั่ง…"
            className="h-14 w-full bg-transparent text-[15px] text-fg placeholder:text-fg-subtle focus:outline-none"
          />
          <span className="kbd shrink-0">Esc</span>
        </div>

        <div ref={listRef} className="max-h-[56vh] overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-3 py-10 text-center text-[13px] text-fg-subtle">ไม่พบผลลัพธ์ที่ตรงกับ “{query}”</p>
          ) : (
            items.map((item, index) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              const Icon = item.icon;
              const active = index === activeIndex;
              return (
                <React.Fragment key={item.id}>
                  {showGroup && (
                    <p className="px-2.5 pt-3 pb-1.5 text-[11px] font-semibold text-fg-subtle first:pt-1">
                      {item.group}
                    </p>
                  )}
                  <button
                    type="button"
                    data-index={index}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={item.run}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
                      active ? "bg-white/[0.07] text-fg" : "text-fg-muted"
                    }`}
                  >
                    {item.issue ? (
                      <>
                        <span className="w-24 shrink-0 truncate font-mono text-xs text-fg-subtle">{item.issue.code}</span>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        <StatusBadge status={item.issue.status} compact className="h-5 text-[11px]" />
                      </>
                    ) : (
                      <>
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.04]">
                          {item.color ? (
                            <span className="h-2.5 w-2.5 rounded-[4px]" style={{ backgroundColor: item.color }} />
                          ) : Icon ? (
                            <Icon className={`h-3.5 w-3.5 ${item.iconClass || "text-fg-subtle"}`} />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.hint && <span className="shrink-0 truncate text-xs text-fg-subtle">{item.hint}</span>}
                      </>
                    )}
                    {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />}
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-fg-subtle">
          <span className="inline-flex items-center gap-1.5">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span>
            เลื่อน
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="kbd">Enter</span>
            เลือก
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <span className="kbd">Ctrl K</span>
            เปิด/ปิด
          </span>
        </div>
      </div>
    </div>
  );
}
