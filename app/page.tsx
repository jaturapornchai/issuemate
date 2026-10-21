"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity,
  FolderKanban,
  Plus,
  Search,
  Table2,
  Kanban,
  Terminal,
  RefreshCw,
  FolderPlus,
  Layers,
  CheckCircle2,
  Rocket,
  Filter,
  Command,
  FilterX,
  X,
  Eye,
  Wrench,
  XCircle,
} from "lucide-react";
import type {
  ProjectRecord,
  IssueRecord,
  MonitorStats,
  IssueStatus,
  IssueStatusFilter,
  IssueType,
  IssuePriority,
  AttachmentRecord,
} from "@/lib/types";
import type { AuthUser } from "@/lib/auth";
import {
  MonitorDashboardView,
  type MonitorDrillDown,
} from "@/components/MonitorDashboardView";
import { STATUS_CONFIG, TYPE_CONFIG, PRIORITY_CONFIG } from "@/components/ui/Badges";
import { IssuesTableView } from "@/components/IssuesTableView";
import { KanbanBoardView } from "@/components/KanbanBoardView";
import { IdeasRoadmapView } from "@/components/IdeasRoadmapView";
import { IssueDetailDrawer } from "@/components/IssueDetailDrawer";
import { CommandPaletteModal } from "@/components/CommandPaletteModal";
import { GoogleLoginModal, GoogleIcon } from "@/components/GoogleLoginModal";
import {
  CreateProjectModal,
  CreateIssueModal,
  AiMcpGuideModal,
} from "@/components/Modals";

type ProjectWithCounts = ProjectRecord & { openCount: number; totalCount: number };
type ViewMode = "monitor" | "table" | "kanban" | "roadmap";

const STATUS_FILTER_LABEL: Record<
  Exclude<IssueStatusFilter, IssueStatus | "all">,
  string
> = {
  pending_review: "รอ Antigravity รีวิว (open + reviewing)",
  active: "กำลังดำเนินการใน Pipeline",
  overdue: "เลยกำหนด SLA",
};

export default function IssueMateAppPage() {
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [selectedProjectKey, setSelectedProjectKey] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [monitorStats, setMonitorStats] = useState<MonitorStats | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<IssueRecord | null>(null);

  // Auth User (Google Login / DevOps Session)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isGoogleLoginOpen, setIsGoogleLoginOpen] = useState<boolean>(false);
  const [authErrorNotice, setAuthErrorNotice] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<IssueStatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<IssueType | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority | "all">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState<boolean>(false);
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState<boolean>(false);
  const [isAiMcpOpen, setIsAiMcpOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);

  const latestFetchId = useRef(0);

  // Check current user session & URL query params for Google OAuth callback
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setCurrentUser(d.user);
      })
      .catch(() => {});

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const authError =
        url.searchParams.get("auth_error") || url.searchParams.get("google_auth_error");
      if (authError) {
        setAuthErrorNotice(authError);
        setIsGoogleLoginOpen(true);
        url.searchParams.delete("auth_error");
        url.searchParams.delete("google_auth_error");
        window.history.replaceState({}, "", url.toString());
      } else if (url.searchParams.get("login") === "google_success") {
        url.searchParams.delete("login");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    const fetchId = ++latestFetchId.current;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedProjectKey !== "ALL") params.set("projectKey", selectedProjectKey);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);

      const monitorParams = new URLSearchParams();
      if (selectedProjectKey !== "ALL") monitorParams.set("projectKey", selectedProjectKey);

      const [projRes, issuesRes, monRes] = await Promise.all([
        fetch("/api/projects"),
        fetch(`/api/issues?${params.toString()}`),
        fetch(`/api/monitor?${monitorParams.toString()}`),
      ]);

      const [projData, issuesData, monData] = await Promise.all([
        projRes.json(),
        issuesRes.json(),
        monRes.json(),
      ]);
      if (fetchId !== latestFetchId.current) return;

      if (projData.projects) setProjects(projData.projects);
      if (issuesData.issues) {
        setIssues(issuesData.issues);
        setSelectedIssue((prev) => {
          if (!prev) return null;
          const refreshed = issuesData.issues.find(
            (i: IssueRecord) => i.code === prev.code
          );
          return refreshed || prev;
        });
      }
      if (monData.stats) setMonitorStats(monData.stats);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      if (fetchId === latestFetchId.current) setIsLoading(false);
    }
  }, [
    selectedProjectKey,
    statusFilter,
    typeFilter,
    priorityFilter,
    searchQuery,
    sortBy,
    sortDir,
    selectedIssue?.code,
  ]);

  useEffect(() => {
    void fetchAllData();
  }, [fetchAllData]);

  // Global Keyboard Shortcuts: Ctrl+K / Cmd+K for Command Palette, Esc to close modals/drawer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        if (isCommandPaletteOpen) setIsCommandPaletteOpen(false);
        else if (isGoogleLoginOpen) setIsGoogleLoginOpen(false);
        else if (isCreateIssueOpen) setIsCreateIssueOpen(false);
        else if (isCreateProjectOpen) setIsCreateProjectOpen(false);
        else if (isAiMcpOpen) setIsAiMcpOpen(false);
        else if (selectedIssue) setSelectedIssue(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isCommandPaletteOpen,
    isGoogleLoginOpen,
    isCreateIssueOpen,
    isCreateProjectOpen,
    isAiMcpOpen,
    selectedIssue,
  ]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  };

  const resetFilters = () => {
    setStatusFilter("all");
    setTypeFilter("all");
    setPriorityFilter("all");
    setSearchQuery("");
  };

  const handleDrillDown = (f: MonitorDrillDown) => {
    resetFilters();
    if (f.projectKey) setSelectedProjectKey(f.projectKey);
    if (f.status) setStatusFilter(f.status);
    if (f.priority) setPriorityFilter(f.priority);
    if (f.type) setTypeFilter(f.type);
    setViewMode("table");
  };

  const activeFilters = [
    statusFilter !== "all" && {
      key: "status",
      label: `สถานะ: ${
        statusFilter in STATUS_CONFIG
          ? STATUS_CONFIG[statusFilter as IssueStatus].shortLabel
          : STATUS_FILTER_LABEL[statusFilter as keyof typeof STATUS_FILTER_LABEL]
      }`,
      clear: () => setStatusFilter("all"),
    },
    typeFilter !== "all" && {
      key: "type",
      label: `ประเภท: ${TYPE_CONFIG[typeFilter].label}`,
      clear: () => setTypeFilter("all"),
    },
    priorityFilter !== "all" && {
      key: "priority",
      label: `ความสำคัญ: ${PRIORITY_CONFIG[priorityFilter].label}`,
      clear: () => setPriorityFilter("all"),
    },
    searchQuery.trim() && {
      key: "search",
      label: `ค้นหา: "${searchQuery.trim()}"`,
      clear: () => setSearchQuery(""),
    },
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  const handleUpdateIssue = async (code: string, updates: Record<string, unknown>) => {
    const res = await fetch(`/api/issues/${encodeURIComponent(code)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...updates,
        actor: currentUser?.name || "ลุงจืด (DevOps Lead)",
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.issue) {
        setSelectedIssue((prev) =>
          prev && prev.code === data.issue.code ? data.issue : prev
        );
      }
      await fetchAllData();
    }
  };

  const handleDeleteIssue = async (code: string) => {
    const res = await fetch(`/api/issues/${encodeURIComponent(code)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setSelectedIssue(null);
      await fetchAllData();
    }
  };

  const handleAddComment = async (
    code: string,
    author: string,
    body: string,
    attachments: AttachmentRecord[]
  ) => {
    const res = await fetch(`/api/issues/${encodeURIComponent(code)}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, body, attachments }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.issue) {
        setSelectedIssue((prev) =>
          prev && prev.code === data.issue.code ? data.issue : prev
        );
      }
      await fetchAllData();
    }
  };

  const handleUploadFile = async (file: File): Promise<AttachmentRecord> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("uploadedBy", currentUser?.name || "DevOps Team");
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "อัปโหลดไฟล์ไม่สำเร็จ");
    }
    return data.attachment;
  };

  const handleQuickStatusChange = async (code: string, nextStatus: IssueStatus) => {
    await handleUpdateIssue(code, { status: nextStatus });
  };

  const handleQuickUpvote = async (code: string) => {
    try {
      const voter =
        currentUser?.email || `devops-${Math.floor(Math.random() * 900 + 100)}`;
      const res = await fetch(`/api/issues/${encodeURIComponent(code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toggleUpvoteBy: voter }),
      });
      if (res.ok) {
        void fetchAllData();
      }
    } catch (err) {
      console.error("Upvote error:", err);
    }
  };

  const handleReseedSampleData = async () => {
    try {
      setIsLoading(true);
      await fetch("/api/seed", { method: "POST" });
      await fetchAllData();
    } catch (err) {
      console.error("Reseed error:", err);
      setIsLoading(false);
    }
  };

  const visibleProjects =
    currentUser &&
    !currentUser.isAdmin &&
    Array.isArray(currentUser.allowedProjects) &&
    currentUser.allowedProjects.length > 0 &&
    !currentUser.allowedProjects.includes("ALL")
      ? projects.filter((p) => currentUser.allowedProjects.includes(p.key))
      : projects;

  const currentProject = visibleProjects.find((p) => p.key === selectedProjectKey);
  const totalOpenAllProjects = visibleProjects.reduce(
    (sum, p) => sum + (p.openCount || 0),
    0
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Left Sidebar: DevOps Projects & Navigation */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900/95">
        {/* Brand Header */}
        <div className="flex h-14 items-center justify-between border-b border-slate-800 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
              <Layers className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-1">
              <h1 className="text-sm font-bold leading-none tracking-tight text-white">
                IssueMate DevOps
              </h1>
              <p className="whitespace-nowrap text-[10px] font-medium leading-none text-emerald-400">
                Antigravity Pipeline
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAiMcpOpen(true)}
            data-testid="open-mcp-guide-btn"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/15 px-2 text-[11px] font-medium text-cyan-300 hover:bg-cyan-500/25 cursor-pointer"
            title="ตั้งค่าและสร้าง MCP Token สำหรับ Antigravity"
          >
            <Terminal className="h-3 w-3" />
            <span>MCP</span>
          </button>
        </div>

        {/* Primary Action: Submit DevOps Issue */}
        <div className="p-3 border-b border-slate-800/80 space-y-2">
          <button
            type="button"
            data-testid="open-create-issue-btn"
            onClick={() => setIsCreateIssueOpen(true)}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>แจ้งปัญหา / เพิ่มรายการใหม่</span>
          </button>

          <button
            type="button"
            data-testid="open-command-palette-btn"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex h-8 w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950/90 px-2.5 text-[11px] text-slate-400 transition hover:border-slate-700 hover:text-slate-200 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Command className="h-3.5 w-3.5 text-emerald-400" />
              <span>ค้นหา / สั่งงานด่วน</span>
            </span>
            <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Main View Switcher in Sidebar */}
        <div className="px-3 pt-3 pb-2 space-y-1">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            มุมมอง DevOps Pipeline
          </p>
          <button
            type="button"
            data-testid="nav-monitor-btn"
            onClick={() => setViewMode("monitor")}
            className={`flex h-9 w-full items-center justify-between rounded-lg px-3 text-xs font-medium transition cursor-pointer ${
              viewMode === "monitor"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                : "text-slate-300 hover:bg-slate-800/70"
            }`}
          >
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span>Monitor & Pipeline KPI</span>
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          </button>

          <button
            type="button"
            data-testid="nav-table-btn"
            onClick={() => setViewMode("table")}
            className={`flex h-9 w-full items-center justify-between rounded-lg px-3 text-xs font-medium transition cursor-pointer ${
              viewMode === "table"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                : "text-slate-300 hover:bg-slate-800/70"
            }`}
          >
            <span className="flex items-center gap-2">
              <Table2 className="h-4 w-4 text-sky-400" />
              <span>ตาราง DevOps Issues (100%)</span>
            </span>
          </button>

          <button
            type="button"
            data-testid="nav-kanban-btn"
            onClick={() => setViewMode("kanban")}
            className={`flex h-9 w-full items-center justify-between rounded-lg px-3 text-xs font-medium transition cursor-pointer ${
              viewMode === "kanban"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                : "text-slate-300 hover:bg-slate-800/70"
            }`}
          >
            <span className="flex items-center gap-2">
              <Kanban className="h-4 w-4 text-purple-400" />
              <span>กระดาน 6-Stage Kanban</span>
            </span>
          </button>

          <button
            type="button"
            data-testid="nav-roadmap-btn"
            onClick={() => setViewMode("roadmap")}
            className={`flex h-9 w-full items-center justify-between rounded-lg px-3 text-xs font-medium transition cursor-pointer ${
              viewMode === "roadmap"
                ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                : "text-slate-300 hover:bg-slate-800/70"
            }`}
          >
            <span className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-amber-400" />
              <span>โหวตความสำคัญ & Roadmap</span>
            </span>
          </button>
        </div>

        {/* DevOps Projects List */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              โปรเจกต์ทีม DevOps ({visibleProjects.length})
            </span>
            <button
              type="button"
              data-testid="open-create-project-btn"
              onClick={() => setIsCreateProjectOpen(true)}
              className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/15 cursor-pointer"
              title="สร้างโปรเจกต์ DevOps ใหม่"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span>เพิ่มโปรเจกต์</span>
            </button>
          </div>

          <div className="space-y-1">
            <button
              type="button"
              data-testid="project-item-ALL"
              onClick={() => setSelectedProjectKey("ALL")}
              className={`flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-xs font-medium transition cursor-pointer ${
                selectedProjectKey === "ALL"
                  ? "bg-slate-800 text-white border border-slate-700"
                  : "text-slate-300 hover:bg-slate-800/60"
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <FolderKanban className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="truncate">ทุกโปรเจกต์ DevOps รวมกัน</span>
              </span>
              <span className="rounded-full bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                {totalOpenAllProjects}
              </span>
            </button>

            {visibleProjects.map((proj) => {
              const isSelected = selectedProjectKey === proj.key;
              return (
                <button
                  key={proj.key}
                  type="button"
                  data-testid={`project-item-${proj.key}`}
                  onClick={() => setSelectedProjectKey(proj.key)}
                  className={`flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-xs font-medium transition cursor-pointer ${
                    isSelected
                      ? "bg-slate-800 text-white border border-slate-700"
                      : "text-slate-300 hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: proj.color }}
                    />
                    <span className="shrink-0 font-mono text-[11px] font-bold text-slate-400">
                      {proj.key}
                    </span>
                    <span className="truncate">{proj.name}</span>
                  </div>
                  <span className="ml-1 shrink-0 rounded-full bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-emerald-400">
                    {proj.openCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Storage & AI Status */}
        <div className="border-t border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center justify-between">
            <span>ฐานข้อมูล:</span>
            <span className="font-mono text-emerald-400">MongoDB + MinIO S3</span>
          </div>
          <div className="flex items-center justify-between">
            <span>AI Agent:</span>
            <span className="font-mono text-cyan-300">Antigravity</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Toolbar (Baseline aligned 2-row header) */}
        <header className="flex flex-col border-b border-slate-800 bg-gradient-to-r from-slate-900/95 via-slate-900/85 to-slate-900/95 px-5 py-2 gap-2">
          {/* Row 1: Title on Left, Search + Refresh + Login by Google on Right */}
          <div className="flex h-9 items-center justify-between gap-3">
            <div className="flex h-9 min-w-0 items-center gap-2">
              <span className="inline-flex h-6 shrink-0 items-center rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 font-mono text-xs font-bold leading-none text-emerald-400">
                {selectedProjectKey === "ALL" ? "DEVOPS PIPELINE" : currentProject?.key}
              </span>
              <h2
                className="truncate text-sm font-bold leading-none text-white"
                data-testid="header-title"
              >
                {selectedProjectKey === "ALL"
                  ? "ศูนย์ควบคุมแจ้งปัญหา & ติดตามงาน (Antigravity รีวิว → แก้ไข → Deploy)"
                  : currentProject?.name}
              </h2>
            </div>

            <div className="flex h-9 shrink-0 items-center gap-2">
              <button
                type="button"
                data-testid="new-issue-btn"
                onClick={() => setIsCreateIssueOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-500 cursor-pointer whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                <span>แจ้งปัญหา</span>
              </button>

              {/* Search Box */}
              <div className="relative flex h-9 items-center">
                <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  data-testid="search-issues-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหารหัส, หัวข้อ, เซิร์ฟเวอร์, คำสั่งแก้..."
                  className="h-9 w-56 rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-8 text-xs text-white placeholder:text-slate-500 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 lg:w-72"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    data-testid="clear-search-btn"
                    title="ล้างคำค้นหา"
                    className="absolute right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => void fetchAllData()}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300 cursor-pointer"
                title="รีเฟรชข้อมูล"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? "animate-spin text-emerald-400" : ""}`}
                />
              </button>

              {/* Login by Google / User Profile Button */}
              <button
                type="button"
                data-testid="open-google-login-btn"
                onClick={() => setIsGoogleLoginOpen(true)}
                className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  currentUser
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                    : "border-slate-700 bg-white text-slate-900 hover:bg-slate-100 shadow-xs"
                }`}
                title="เข้าสู่ระบบด้วย Google หรือดูวิธีตั้งค่า Google OAuth 2.0"
              >
                {currentUser?.picture ? (
                  <img
                    src={currentUser.picture}
                    alt={currentUser.name}
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <GoogleIcon className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate max-w-[160px]">
                  {currentUser ? currentUser.name : "Login by Google"}
                </span>
              </button>
            </div>
          </div>

          {/* Row 2: 6-Stage DevOps Pipeline Filter Tabs + Type & Priority Selectors */}
          <div className="flex h-9 items-center justify-between gap-2">
            <div className="inline-flex h-9 items-center rounded-lg border border-slate-800 bg-slate-950 p-0.5 overflow-x-auto">
              <button
                type="button"
                data-testid="filter-tab-all"
                onClick={() => setStatusFilter("all")}
                className={`inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                ทั้งหมด ({monitorStats?.totalIssues ?? issues.length})
              </button>
              <button
                type="button"
                data-testid="filter-tab-pending-review"
                onClick={() => setStatusFilter("pending_review")}
                className={`inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  statusFilter === "pending_review" || statusFilter === "open"
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Eye className="h-3.5 w-3.5 text-amber-400" />
                <span>
                  1-2. รอรีวิว (
                  {(monitorStats?.openIssues ?? 0) +
                    (monitorStats?.reviewingIssues ?? 0)}
                  )
                </span>
              </button>
              <button
                type="button"
                data-testid="filter-tab-ready-to-fix"
                onClick={() => setStatusFilter("ready_to_fix")}
                className={`inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  statusFilter === "ready_to_fix"
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Wrench className="h-3.5 w-3.5 text-cyan-400" />
                <span>3. รอแก้ ({monitorStats?.readyToFixIssues ?? 0})</span>
              </button>
              <button
                type="button"
                data-testid="filter-tab-deployed"
                onClick={() => setStatusFilter("deployed")}
                className={`inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  statusFilter === "deployed"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>5. Deploy แล้ว ({monitorStats?.deployedIssues ?? 0})</span>
              </button>
              <button
                type="button"
                data-testid="filter-tab-wont-fix"
                onClick={() => setStatusFilter("wont_fix")}
                className={`inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  statusFilter === "wont_fix"
                    ? "bg-slate-700/60 text-slate-200"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <XCircle className="h-3.5 w-3.5 text-slate-400" />
                <span>6. ไม่แก้ ({monitorStats?.wontFixIssues ?? 0})</span>
              </button>
            </div>

            <div className="flex h-9 shrink-0 items-center gap-1.5">
              <select
                value={typeFilter}
                data-testid="type-filter-select"
                onChange={(e) => setTypeFilter(e.target.value as IssueType | "all")}
                className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">ทุกประเภท DevOps</option>
                <option value="incident">Incident / ระบบล่ม</option>
                <option value="bug">Bug / โค้ดผิดพลาด</option>
                <option value="deployment">Deploy / CI-CD / Infra</option>
                <option value="performance">Performance / DB ช้า</option>
                <option value="security">Security / ความปลอดภัย</option>
                <option value="feature">Feature / ปรับปรุง</option>
              </select>

              <select
                value={priorityFilter}
                data-testid="priority-filter-select"
                onChange={(e) => setPriorityFilter(e.target.value as IssuePriority | "all")}
                className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">ทุกระดับความสำคัญ</option>
                <option value="critical">วิกฤต (Critical)</option>
                <option value="high">สูง (High)</option>
                <option value="medium">ปานกลาง (Medium)</option>
                <option value="low">ต่ำ (Low)</option>
              </select>
            </div>
          </div>
        </header>

        {/* Active filter bar */}
        {activeFilters.length > 0 && (
          <div
            data-testid="active-filter-bar"
            className="flex h-10 shrink-0 items-center gap-2 border-b border-emerald-500/20 bg-emerald-950/25 px-5"
          >
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-emerald-300">
              <Filter className="h-3.5 w-3.5" />
              กำลังกรอง
            </span>
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={f.clear}
                  data-testid={`active-filter-${f.key}`}
                  title="คลิกเพื่อยกเลิกเงื่อนไขนี้"
                  className="inline-flex h-6 min-w-0 max-w-[260px] shrink items-center gap-1 rounded-full border border-emerald-500/30 bg-slate-900/90 px-2.5 text-[11px] leading-none text-slate-200 transition hover:border-rose-400/60 hover:text-rose-200 cursor-pointer"
                >
                  <span className="truncate">{f.label}</span>
                  <X className="h-3 w-3 shrink-0 opacity-70" />
                </button>
              ))}
            </div>
            <span className="shrink-0 text-xs text-slate-300" data-testid="filter-result-count">
              พบ <strong className="text-white tabular-nums">{issues.length}</strong> รายการ
            </span>
            <button
              type="button"
              onClick={resetFilters}
              data-testid="reset-filters-btn"
              className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25 cursor-pointer"
            >
              <FilterX className="h-3.5 w-3.5" />
              ล้างตัวกรอง
            </button>
          </div>
        )}

        {/* Main Viewport */}
        <main className="min-h-0 flex-1 overflow-hidden">
          {viewMode === "monitor" && (
            <MonitorDashboardView
              stats={monitorStats}
              issues={issues}
              onSelectIssue={(issue) => setSelectedIssue(issue)}
              onDrillDown={handleDrillDown}
              onRefresh={() => void fetchAllData()}
              onReseedSampleData={handleReseedSampleData}
              isRefreshing={isLoading}
            />
          )}

          {viewMode === "table" && (
            <IssuesTableView
              issues={issues}
              selectedCode={selectedIssue?.code}
              sortBy={sortBy}
              sortDir={sortDir}
              onSelectIssue={(issue) => setSelectedIssue(issue)}
              onSort={handleSort}
              onUpvote={handleQuickUpvote}
            />
          )}

          {viewMode === "kanban" && (
            <KanbanBoardView
              issues={issues}
              onSelectIssue={(issue) => setSelectedIssue(issue)}
              onQuickStatusChange={handleQuickStatusChange}
            />
          )}

          {viewMode === "roadmap" && (
            <IdeasRoadmapView
              issues={issues}
              onSelectIssue={(issue) => setSelectedIssue(issue)}
              onUpvote={handleQuickUpvote}
              onOpenCreateIdea={() => setIsCreateIssueOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Issue Detail Slide-over Drawer */}
      <IssueDetailDrawer
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
        onUpdate={handleUpdateIssue}
        onDelete={handleDeleteIssue}
        onAddComment={handleAddComment}
        onUploadFile={handleUploadFile}
        currentUserName={currentUser?.name}
      />

      {/* Command Palette (Ctrl+K) */}
      <CommandPaletteModal
        open={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        issues={issues}
        projects={projects}
        onSelectIssue={(issue) => setSelectedIssue(issue)}
        onSelectProject={(key) => setSelectedProjectKey(key)}
        onChangeView={(v) => setViewMode(v)}
        onOpenCreateIssue={() => setIsCreateIssueOpen(true)}
        onOpenCreateProject={() => setIsCreateProjectOpen(true)}
        onOpenMcpGuide={() => setIsAiMcpOpen(true)}
      />

      {/* Google Login & Setup Guide Modal */}
      <GoogleLoginModal
        open={isGoogleLoginOpen}
        user={currentUser}
        onClose={() => {
          setIsGoogleLoginOpen(false);
          setAuthErrorNotice(null);
        }}
        onUserUpdated={(u) => setCurrentUser(u)}
        initialError={authErrorNotice}
        onOpenMcpTokens={() => {
          setIsGoogleLoginOpen(false);
          setIsAiMcpOpen(true);
        }}
        onDataReset={() => {
          setSelectedIssue(null);
          void fetchAllData();
        }}
      />

      {/* Modals */}
      <CreateProjectModal
        open={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        onCreated={(proj) => {
          setSelectedProjectKey(proj.key);
          void fetchAllData();
        }}
      />

      <CreateIssueModal
        open={isCreateIssueOpen}
        projects={visibleProjects}
        defaultProjectKey={selectedProjectKey}
        onClose={() => setIsCreateIssueOpen(false)}
        onCreated={(created) => {
          setSelectedIssue(created);
          void fetchAllData();
        }}
        currentUserName={
          currentUser ? `${currentUser.name} <${currentUser.email}>` : "ผู้แจ้งปัญหา (DevOps)"
        }
      />

      <AiMcpGuideModal
        open={isAiMcpOpen}
        onClose={() => setIsAiMcpOpen(false)}
        onDataMutated={() => void fetchAllData()}
        currentUserEmail={currentUser?.email}
        currentUserName={currentUser?.name}
        projects={visibleProjects}
        defaultProjectKey={selectedProjectKey}
      />
    </div>
  );
}
