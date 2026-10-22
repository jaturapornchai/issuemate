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
  HelpCircle,
  BookmarkCheck,
  ShieldCheck,
  Menu,
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
import {
  type AuthUser,
  getUserProjectPermission,
  PROJECT_PERMISSION_CONFIG,
} from "@/lib/permissions";
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
import { APP_VERSION, DEPLOYED_AT_TH } from "@/lib/version";

type ProjectWithCounts = ProjectRecord & { openCount: number; totalCount: number };
type ViewMode = "monitor" | "table" | "kanban" | "roadmap";

const LAST_PROJECT_STORAGE_KEY = "issuemate:lastProjectKey";
const LAST_SPECIFIC_PROJECT_STORAGE_KEY = "issuemate:lastSpecificProjectKey";

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
  const [lastSpecificProjectKey, setLastSpecificProjectKey] = useState<string>("");
  const [hasRestoredProject, setHasRestoredProject] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [monitorStats, setMonitorStats] = useState<MonitorStats | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<IssueRecord | null>(null);

  // Auth User (Google Login / DevOps Session)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isGoogleLoginOpen, setIsGoogleLoginOpen] = useState<boolean>(false);
  const [authErrorNotice, setAuthErrorNotice] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<IssueStatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<IssueType | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority | "all">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState<boolean>(false);
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState<boolean>(false);
  const [createIssueInitialType, setCreateIssueInitialType] =
    useState<IssueType>("bug");
  const [isAiMcpOpen, setIsAiMcpOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showFeedback = useCallback(
    (type: "success" | "error", message: string) => {
      setActionFeedback({ type, message });
      setTimeout(() => {
        setActionFeedback((prev) => (prev?.message === message ? null : prev));
      }, 4500);
    },
    []
  );

  const latestFetchId = useRef(0);

  // Helper to select a project and persist it as the Last Active Project
  const selectProject = useCallback((rawKey: string) => {
    const cleanKey = (rawKey || "ALL").trim().toUpperCase();
    setSelectedProjectKey(cleanKey);

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(LAST_PROJECT_STORAGE_KEY, cleanKey);
        if (cleanKey !== "ALL") {
          setLastSpecificProjectKey(cleanKey);
          window.localStorage.setItem(LAST_SPECIFIC_PROJECT_STORAGE_KEY, cleanKey);
        }
        const url = new URL(window.location.href);
        if (cleanKey === "ALL") {
          url.searchParams.delete("project");
        } else {
          url.searchParams.set("project", cleanKey);
        }
        window.history.replaceState({}, "", url.toString());
      } catch {
        // ignore storage errors
      }
    }
  }, []);

  // Remember a specific project (when user picks a project in Create Issue or MCP Modal)
  const rememberSpecificProject = useCallback(
    (rawKey: string, alsoSwitchFilter = true) => {
      const cleanKey = (rawKey || "").trim().toUpperCase();
      if (!cleanKey || cleanKey === "ALL") return;
      setLastSpecificProjectKey(cleanKey);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(LAST_SPECIFIC_PROJECT_STORAGE_KEY, cleanKey);
        } catch {
          // ignore
        }
      }
      if (alsoSwitchFilter) {
        selectProject(cleanKey);
      }
    },
    [selectProject]
  );

  const openCreateModalWithType = useCallback((type: IssueType) => {
    setCreateIssueInitialType(type);
    setIsCreateIssueOpen(true);
  }, []);

  // Restore last used project from URL ?project= or localStorage on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setCurrentUser(d.user || null);
        if (!d.user) setIsGoogleLoginOpen(true);
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const urlProject = url.searchParams.get("project")?.trim().toUpperCase();
      const storedSelected = window.localStorage
        .getItem(LAST_PROJECT_STORAGE_KEY)
        ?.trim()
        .toUpperCase();
      const storedSpecific = window.localStorage
        .getItem(LAST_SPECIFIC_PROJECT_STORAGE_KEY)
        ?.trim()
        .toUpperCase();

      if (storedSpecific && storedSpecific !== "ALL") {
        setLastSpecificProjectKey(storedSpecific);
      }
      if (urlProject && urlProject !== "ALL") {
        setSelectedProjectKey(urlProject);
        setLastSpecificProjectKey(urlProject);
        window.localStorage.setItem(LAST_PROJECT_STORAGE_KEY, urlProject);
        window.localStorage.setItem(LAST_SPECIFIC_PROJECT_STORAGE_KEY, urlProject);
      } else if (storedSelected) {
        setSelectedProjectKey(storedSelected);
      } else if (storedSpecific && storedSpecific !== "ALL") {
        setSelectedProjectKey(storedSpecific);
      }
      setHasRestoredProject(true);

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

  const fetchAllData = useCallback(
    async (opts?: { silent?: boolean }) => {
      const fetchId = ++latestFetchId.current;
      if (!currentUser) {
        // Logged out: drop whatever the previous session could see
        setProjects([]);
        setIssues([]);
        setMonitorStats(null);
        setSelectedIssue(null);
        setIsLoading(!authChecked);
        return;
      }
      if (!opts?.silent) {
        setIsLoading(true);
      }
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
        if (fetchId === latestFetchId.current && !opts?.silent) {
          setIsLoading(false);
        }
      }
    },
    [
      selectedProjectKey,
      statusFilter,
      typeFilter,
      priorityFilter,
      searchQuery,
      sortBy,
      sortDir,
      currentUser,
      authChecked,
    ]
  );

  useEffect(() => {
    void fetchAllData();
  }, [fetchAllData]);

  // Auto-Refresh (Real-time polling every 8s + on window focus) so AI/team updates appear automatically
  useEffect(() => {
    if (!currentUser) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchAllData({ silent: true });
      }
    }, 8000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchAllData({ silent: true });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [currentUser, fetchAllData]);

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
    if (f.projectKey) selectProject(f.projectKey);
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data.error || "อัปเดตข้อมูลไม่สำเร็จ";
      showFeedback("error", `❌ อัปเดต #${code} ไม่สำเร็จ: ${errMsg}`);
      throw new Error(errMsg);
    }
    if (data.issue) {
      setSelectedIssue((prev) =>
        prev && prev.code === data.issue.code ? data.issue : prev
      );
    }
    showFeedback("success", `✅ บันทึกการอัปเดตรายการ #${code} สำเร็จเรียบร้อยแล้ว`);
    await fetchAllData();
  };

  const handleDeleteIssue = async (code: string) => {
    const res = await fetch(`/api/issues/${encodeURIComponent(code)}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data.error || "ลบรายการไม่สำเร็จ";
      showFeedback("error", `❌ ลบ #${code} ไม่สำเร็จ: ${errMsg}`);
      throw new Error(errMsg);
    }
    setSelectedIssue(null);
    showFeedback("success", `✅ ลบรายการ #${code} เรียบร้อยแล้ว`);
    await fetchAllData();
  };

  const handleAddComment = async (
    code: string,
    author: string,
    body: string,
    attachments: AttachmentRecord[],
    options?: { isResolution?: boolean; nextStatus?: IssueStatus }
  ) => {
    const res = await fetch(`/api/issues/${encodeURIComponent(code)}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author,
        body,
        attachments,
        isResolution: options?.isResolution,
        nextStatus: options?.nextStatus,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data.error || "ส่งความคิดเห็นไม่สำเร็จ";
      showFeedback("error", `❌ ส่งความคิดเห็นใน #${code} ไม่สำเร็จ: ${errMsg}`);
      throw new Error(errMsg);
    }
    if (data.issue) {
      setSelectedIssue((prev) =>
        prev && prev.code === data.issue.code ? data.issue : prev
      );
    }
    showFeedback(
      "success",
      options?.isResolution
        ? `✅ ส่งคำตอบและปิดเรื่อง #${code} เรียบร้อยแล้ว`
        : `✅ ส่งความคิดเห็น / คำตอบใน #${code} สำเร็จเรียบร้อยแล้ว`
    );
    await fetchAllData();
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
      showFeedback("error", `❌ อัปโหลดไฟล์ไม่สำเร็จ: ${data.error || "เกิดข้อผิดพลาด"}`);
      throw new Error(data.error || "อัปโหลดไฟล์ไม่สำเร็จ");
    }
    showFeedback("success", `✅ อัปโหลดไฟล์ "${file.name}" สำเร็จแล้ว`);
    return data.attachment;
  };

  const handleQuickStatusChange = async (code: string, nextStatus: IssueStatus) => {
    try {
      await handleUpdateIssue(code, { status: nextStatus });
    } catch {
      // handled in handleUpdateIssue
    }
  };

  const handleQuickUpvote = async (code: string) => {
    try {
      if (!currentUser) return;
      const voter = currentUser.email;
      const res = await fetch(`/api/issues/${encodeURIComponent(code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toggleUpvoteBy: voter }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showFeedback("success", `✅ บันทึกคะแนนโหวต #${code} เรียบร้อยแล้ว`);
        void fetchAllData();
      } else {
        showFeedback("error", `❌ โหวต #${code} ไม่สำเร็จ: ${data.error || "ไม่มีสิทธิ์"}`);
      }
    } catch (err) {
      console.error("Upvote error:", err);
    }
  };

  const handleReseedSampleData = async () => {
    if (!window.confirm("ยืนยันล้างข้อมูล Issues ทั้งหมดและไฟล์แนบ? ย้อนกลับไม่ได้")) return;
    try {
      setIsLoading(true);
      const res = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (res.ok) {
        showFeedback("success", "✅ ล้างข้อมูล Issues ทั้งหมดและรีเซ็ตระบบเรียบร้อยแล้ว");
      } else {
        showFeedback("error", "❌ ล้างข้อมูลไม่สำเร็จ");
      }
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
    !currentUser.allowedProjects.includes("ALL")
      ? projects.filter((p) => currentUser.allowedProjects.includes(p.key))
      : projects;

  // Keep selectedProjectKey and lastSpecificProjectKey valid once visibleProjects loads
  useEffect(() => {
    if (!hasRestoredProject || visibleProjects.length === 0) return;
    if (
      selectedProjectKey !== "ALL" &&
      !visibleProjects.some((p) => p.key === selectedProjectKey)
    ) {
      const fallback = visibleProjects[0]?.key || "ALL";
      selectProject(fallback);
    }
    if (
      !lastSpecificProjectKey ||
      !visibleProjects.some((p) => p.key === lastSpecificProjectKey)
    ) {
      const firstKey =
        selectedProjectKey !== "ALL"
          ? selectedProjectKey
          : visibleProjects[0]?.key || "";
      if (firstKey) {
        setLastSpecificProjectKey(firstKey);
      }
    }
  }, [
    hasRestoredProject,
    visibleProjects,
    selectedProjectKey,
    lastSpecificProjectKey,
    selectProject,
  ]);

  const currentProject = visibleProjects.find((p) => p.key === selectedProjectKey);
  const rememberedSpecificProject = visibleProjects.find(
    (p) => p.key === (selectedProjectKey !== "ALL" ? selectedProjectKey : lastSpecificProjectKey)
  );
  const effectiveDefaultProjectKey =
    selectedProjectKey !== "ALL"
      ? selectedProjectKey
      : lastSpecificProjectKey || visibleProjects[0]?.key || "DEVOPS";

  const activeProjectPermission = currentUser
    ? getUserProjectPermission(currentUser, effectiveDefaultProjectKey)
    : "developer";

  const selectedIssuePermission =
    selectedIssue && currentUser
      ? getUserProjectPermission(currentUser, selectedIssue.projectKey)
      : "developer";

  const totalOpenAllProjects = visibleProjects.reduce(
    (sum, p) => sum + (p.openCount || 0),
    0
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Mobile Sidebar Backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/65 backdrop-blur-xs lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar: Auto-Responsive (Slide-over on mobile/tablet, fixed on desktop) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 xl:w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900/95 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-14 items-center justify-between border-b border-slate-800 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
              <Layers className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-1">
              <h1 className="text-sm font-bold leading-none tracking-tight text-white">
                IssueMate แจ้งปัญหา
              </h1>
              <p className="whitespace-nowrap text-[10px] font-medium leading-none text-emerald-400">
                สอบถาม & ติดตามงานง่ายๆ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAiMcpOpen(true)}
            data-testid="open-mcp-guide-btn"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/15 px-2 text-[11px] font-medium text-cyan-300 hover:bg-cyan-500/25 cursor-pointer"
            title="ตั้งค่าและสร้าง MCP Token สำหรับเชื่อมต่อ AI (Antigravity)"
          >
            <Terminal className="h-3 w-3" />
            <span>เชื่อมต่อ AI</span>
          </button>
        </div>

        {/* Primary Action: Submit Issue or Ask Question */}
        <div className="p-3 border-b border-slate-800/80 space-y-2">
          {rememberedSpecificProject && (
            <div
              data-testid="remembered-project-banner"
              className="flex items-center justify-between gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-1.5 text-[11px]"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <BookmarkCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span className="truncate text-emerald-200">
                  จำโปรเจกต์ล่าสุด:{" "}
                  <strong className="font-mono text-white">
                    {rememberedSpecificProject.key}
                  </strong>
                </span>
              </div>
              {selectedProjectKey === "ALL" && (
                <button
                  type="button"
                  data-testid="resume-last-project-btn"
                  onClick={() => selectProject(rememberedSpecificProject.key)}
                  className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
                >
                  เปิดใช้ต่อ
                </button>
              )}
            </div>
          )}

          {activeProjectPermission === "viewer" ? (
            <div
              data-testid="sidebar-viewer-only-notice"
              className="rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-2 text-[11px] text-slate-300"
            >
              สิทธิ์ของคุณในโปรเจกต์นี้คือ{" "}
              <strong className="text-white">ดูข้อมูลอย่างเดียว</strong>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1.5">
              {activeProjectPermission !== "question_only" && (
                <button
                  type="button"
                  data-testid="open-create-issue-btn"
                  onClick={() => openCreateModalWithType("bug")}
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>แจ้งปัญหา / เพิ่มรายการใหม่</span>
                </button>
              )}

              <button
                type="button"
                data-testid="quick-ask-question-btn"
                onClick={() => openCreateModalWithType("question")}
                className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-pink-500/40 bg-pink-500/15 px-3 text-xs font-semibold text-pink-200 transition hover:bg-pink-500/25 cursor-pointer"
              >
                <HelpCircle className="h-4 w-4 text-pink-400" />
                <span>สอบถาม / ตั้งคำถามการใช้งาน</span>
              </button>
            </div>
          )}

          <button
            type="button"
            data-testid="open-command-palette-btn"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex h-8 w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950/90 px-2.5 text-[11px] text-slate-400 transition hover:border-slate-700 hover:text-slate-200 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Command className="h-3.5 w-3.5 text-emerald-400" />
              <span>ค้นหาด่วน / สลับหน้าจอ</span>
            </span>
            <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Main View Switcher in Sidebar */}
        <div className="px-3 pt-3 pb-2 space-y-1">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            เลือกมุมมองการใช้งาน
          </p>
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
              <span>รายการแจ้งปัญหา & คำถามทั้งหมด</span>
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
              <span>บอร์ดติดตามความคืบหน้า (6 ขั้น)</span>
            </span>
          </button>

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
              <span>ภาพรวมสถิติ & ความคืบหน้า</span>
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
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
              <span>โหวตความต้องการ & แผนงาน</span>
            </span>
          </button>
        </div>

        {/* Projects List */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              โปรเจกต์ของคุณ ({visibleProjects.length})
            </span>
            <button
              type="button"
              data-testid="open-create-project-btn"
              onClick={() => setIsCreateProjectOpen(true)}
              className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/15 cursor-pointer"
              title="สร้างโปรเจกต์ใหม่"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span>เพิ่มโปรเจกต์</span>
            </button>
          </div>

          <div className="space-y-1">
            <button
              type="button"
              data-testid="project-item-ALL"
              onClick={() => selectProject("ALL")}
              className={`flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-xs font-medium transition cursor-pointer ${
                selectedProjectKey === "ALL"
                  ? "bg-slate-800 text-white border border-slate-700"
                  : "text-slate-300 hover:bg-slate-800/60"
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <FolderKanban className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="truncate">ดูรวมทุกโปรเจกต์</span>
              </span>
              <span className="rounded-full bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                {totalOpenAllProjects}
              </span>
            </button>

            {visibleProjects.map((proj) => {
              const isSelected = selectedProjectKey === proj.key;
              const isLastRemembered = lastSpecificProjectKey === proj.key;
              const perm = currentUser
                ? getUserProjectPermission(currentUser, proj.key)
                : null;
              return (
                <button
                  key={proj.key}
                  type="button"
                  data-testid={`project-item-${proj.key}`}
                  onClick={() => selectProject(proj.key)}
                  className={`flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-xs font-medium transition cursor-pointer ${
                    isSelected
                      ? "bg-emerald-500/15 text-white border border-emerald-500/40"
                      : "text-slate-300 hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: proj.color }}
                    />
                    <span className="shrink-0 font-mono text-[11px] font-bold text-slate-300">
                      {proj.key}
                    </span>
                    <span className="truncate">{proj.name}</span>
                  </div>
                  <div className="ml-1 flex shrink-0 items-center gap-1">
                    {isLastRemembered && (
                      <span
                        title="โปรเจกต์ล่าสุดที่ใช้งาน"
                        className="rounded bg-emerald-500/20 px-1 py-0.5 text-[9px] font-semibold text-emerald-300"
                      >
                        ล่าสุด
                      </span>
                    )}
                    {perm && perm !== "none" && !currentUser?.isAdmin && (
                      <span
                        title={`สิทธิ์ของคุณ: ${PROJECT_PERMISSION_CONFIG[perm].label}`}
                        className="rounded bg-slate-800 px-1 py-0.5 text-[9px] text-slate-300"
                      >
                        {PROJECT_PERMISSION_CONFIG[perm].shortLabel}
                      </span>
                    )}
                    <span className="rounded-full bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-emerald-400">
                      {proj.openCount}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Storage & Active Permission Status */}
        <div className="border-t border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-400 space-y-1">
          {currentUser && activeProjectPermission !== "none" && (
            <div
              data-testid="sidebar-user-permission-indicator"
              className="flex items-center justify-between pb-1 border-b border-slate-800/80"
            >
              <span className="inline-flex items-center gap-1 text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                สิทธิ์ ({effectiveDefaultProjectKey}):
              </span>
              <span className="font-semibold text-emerald-300">
                {PROJECT_PERMISSION_CONFIG[activeProjectPermission].shortLabel}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span>ระบบจัดเก็บไฟล์:</span>
            <span className="font-mono text-emerald-400">PDF / รูปภาพ / เอกสาร</span>
          </div>
          <div className="flex items-center justify-between">
            <span>ผู้ช่วยดูแลระบบ:</span>
            <span className="font-mono text-cyan-300">ทีมงาน & Antigravity</span>
          </div>
          <div
            data-testid="app-version-deploy-info"
            className="mt-1.5 flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/90 px-2 py-1 text-[10px]"
          >
            <span className="font-mono font-bold text-emerald-400">{APP_VERSION}</span>
            <span className="font-mono text-slate-300">Deploy: {DEPLOYED_AT_TH}</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Global Action Response Banner (Success / Error Feedback) */}
        {actionFeedback && (
          <div
            data-testid="global-action-feedback"
            className={`flex h-9 shrink-0 items-center justify-between px-5 text-xs font-semibold transition-all ${
              actionFeedback.type === "success"
                ? "border-b border-emerald-500/40 bg-emerald-950/80 text-emerald-200"
                : "border-b border-rose-500/40 bg-rose-950/80 text-rose-200"
            }`}
          >
            <span>{actionFeedback.message}</span>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-black/20 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Top Toolbar (Auto-Responsive Baseline aligned 2-row header) */}
        <header className="flex flex-col border-b border-slate-800 bg-gradient-to-r from-slate-900/95 via-slate-900/85 to-slate-900/95 px-3 sm:px-5 py-2 gap-2">
          {/* Row 1: Quick Project Switcher & Title on Left, Ask Question + Report Issue + Search + Google Login on Right */}
          <div className="flex flex-wrap min-h-9 items-center justify-between gap-2">
            <div className="flex min-h-9 min-w-0 items-center gap-2">
              <button
                type="button"
                data-testid="mobile-sidebar-toggle-btn"
                onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-500/50 lg:hidden cursor-pointer"
                title="เปิดเมนูโปรเจกต์"
              >
                <Menu className="h-4 w-4" />
              </button>

              <div className="flex h-9 items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap hidden xl:inline">
                  โปรเจกต์ที่ทำงานอยู่:
                </span>
                <select
                  value={selectedProjectKey}
                  data-testid="header-project-select"
                  onChange={(e) => selectProject(e.target.value)}
                  className="h-8 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 font-mono text-xs font-bold text-emerald-300 focus:border-emerald-400 focus:outline-none cursor-pointer"
                  title="สลับโปรเจกต์ (ระบบจะจำโปรเจกต์ที่เลือกไว้ให้อัตโนมัติ)"
                >
                  <option value="ALL" className="bg-slate-900 text-white">
                    ทุกโปรเจกต์รวมกัน ({totalOpenAllProjects})
                  </option>
                  {visibleProjects.map((p) => (
                    <option
                      key={p.key}
                      value={p.key}
                      className="bg-slate-900 text-white"
                    >
                      {p.key} — {p.name} ({p.openCount})
                    </option>
                  ))}
                </select>
              </div>

              <h2
                className="truncate text-sm font-bold leading-none text-white"
                data-testid="header-title"
              >
                {selectedProjectKey === "ALL"
                  ? "ศูนย์รับแจ้งปัญหา สอบถามการใช้งาน และติดตามการแก้ไข"
                  : currentProject?.name}
              </h2>

              {rememberedSpecificProject && (
                <span
                  data-testid="remembered-project-badge"
                  className="hidden 2xl:inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-[11px] font-medium text-emerald-300"
                >
                  <BookmarkCheck className="h-3 w-3" />
                  จำโปรเจกต์ล่าสุด: {rememberedSpecificProject.key}
                </span>
              )}

              <span
                data-testid="header-version-badge"
                className="hidden lg:inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-2.5 font-mono text-[10px] font-semibold text-cyan-300"
                title={`เวอร์ชัน ${APP_VERSION} · วันเวลา Deploy ล่าสุด: ${DEPLOYED_AT_TH}`}
              >
                {APP_VERSION} · Deploy: {DEPLOYED_AT_TH}
              </span>
            </div>

            <div className="flex flex-wrap min-h-9 shrink-0 items-center gap-1.5 sm:gap-2">
              {activeProjectPermission !== "viewer" && (
                <>
                  <button
                    type="button"
                    data-testid="header-ask-question-btn"
                    onClick={() => openCreateModalWithType("question")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-pink-500/40 bg-pink-500/15 px-3 text-xs font-bold text-pink-200 transition hover:bg-pink-500/25 cursor-pointer whitespace-nowrap"
                  >
                    <HelpCircle className="h-4 w-4 text-pink-400" />
                    <span>สอบถาม / ตั้งคำถาม</span>
                  </button>

                  {activeProjectPermission !== "question_only" && (
                    <button
                      type="button"
                      data-testid="new-issue-btn"
                      onClick={() => openCreateModalWithType("bug")}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-500 cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="h-4 w-4" />
                      <span>แจ้งปัญหา</span>
                    </button>
                  )}
                </>
              )}

              {/* Search Box */}
              <div className="relative flex h-9 items-center">
                <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  data-testid="search-issues-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหารหัส, หัวข้อคำถาม, ปัญหาที่แจ้ง..."
                  className="h-9 w-52 rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-8 text-xs text-white placeholder:text-slate-500 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 lg:w-64"
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
                title="รีเฟรชข้อมูลล่าสุด"
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
                title="เข้าสู่ระบบด้วย Google หรือจัดการสิทธิ์สมาชิกแต่ละโปรเจกต์"
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
                  {currentUser ? currentUser.name : "เข้าสู่ระบบด้วย Google"}
                </span>
              </button>
            </div>
          </div>

          {/* Row 2: 6-Stage Filter Tabs + Type & Priority Selectors */}
          <div className="flex flex-wrap min-h-9 items-center justify-between gap-2">
            <div className="inline-flex min-h-9 max-w-full items-center rounded-lg border border-slate-800 bg-slate-950 p-0.5 overflow-x-auto">
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
                  1-2. รอตรวจสอบ / รอคำตอบ (
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
                <span>3. รอทีมงานแก้ไข ({monitorStats?.readyToFixIssues ?? 0})</span>
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
                <span>
                  5. แก้ไข/ตอบเรียบร้อย ({monitorStats?.deployedIssues ?? 0})
                </span>
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
                <span>6. ปิดเรื่อง / ไม่ต้องแก้ ({monitorStats?.wontFixIssues ?? 0})</span>
              </button>
            </div>

            <div className="flex flex-wrap min-h-9 shrink-0 items-center gap-1.5">
              <button
                type="button"
                data-testid="filter-type-question-pill"
                onClick={() =>
                  setTypeFilter((prev) => (prev === "question" ? "all" : "question"))
                }
                className={`inline-flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                  typeFilter === "question"
                    ? "border-pink-500/50 bg-pink-500/20 text-pink-200"
                    : "border-slate-700 bg-slate-950 text-slate-300 hover:border-pink-500/30 hover:text-pink-200"
                }`}
              >
                <HelpCircle className="h-3.5 w-3.5 text-pink-400" />
                <span>เฉพาะคำถาม ({monitorStats?.byType?.question ?? 0})</span>
              </button>

              <select
                value={typeFilter}
                data-testid="type-filter-select"
                onChange={(e) => setTypeFilter(e.target.value as IssueType | "all")}
                className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">ทุกหัวข้อ (ปัญหา & คำถาม)</option>
                <option value="question">สอบถาม / ตั้งคำถามการใช้งาน</option>
                <option value="bug">แจ้งปัญหา / ทำงานผิดปกติ</option>
                <option value="incident">ระบบล่ม / ใช้งานไม่ได้ด่วน</option>
                <option value="feature">ขอเพิ่มฟีเจอร์ / ปรับปรุงระบบ</option>
                <option value="performance">ระบบช้า / ค้าง</option>
                <option value="deployment">อัปเดตระบบ / เซิร์ฟเวอร์</option>
                <option value="security">ความปลอดภัย / สิทธิ์การใช้งาน</option>
              </select>

              <select
                value={priorityFilter}
                data-testid="priority-filter-select"
                onChange={(e) => setPriorityFilter(e.target.value as IssuePriority | "all")}
                className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">ทุกระดับความเร่งด่วน</option>
                <option value="critical">เร่งด่วนมาก (กระทบงานทันที)</option>
                <option value="high">สำคัญสูง (ควรรีบดูแล)</option>
                <option value="medium">สำคัญปานกลาง (ทั่วไป)</option>
                <option value="low">ไม่เร่งด่วน (สอบถาม/เสนอแนะ)</option>
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
              กำลังกรองข้อมูล
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
              onReseedSampleData={currentUser?.isAdmin ? handleReseedSampleData : undefined}
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
              canChangeStatus={
                activeProjectPermission === "developer" ||
                activeProjectPermission === "project_admin"
              }
            />
          )}

          {viewMode === "roadmap" && (
            <IdeasRoadmapView
              issues={issues}
              onSelectIssue={(issue) => setSelectedIssue(issue)}
              onUpvote={handleQuickUpvote}
              onOpenCreateIdea={() => openCreateModalWithType("feature")}
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
        userPermission={selectedIssuePermission}
      />

      {/* Command Palette (Ctrl+K) */}
      <CommandPaletteModal
        open={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        issues={issues}
        projects={visibleProjects}
        onSelectIssue={(issue) => setSelectedIssue(issue)}
        onSelectProject={(key) => selectProject(key)}
        onChangeView={(v) => setViewMode(v)}
        onOpenCreateIssue={() => openCreateModalWithType("bug")}
        onOpenCreateProject={() => setIsCreateProjectOpen(true)}
        onOpenMcpGuide={() => setIsAiMcpOpen(true)}
        canCreateIssue={activeProjectPermission !== "viewer" && activeProjectPermission !== "none"}
        isAdmin={Boolean(currentUser?.isAdmin)}
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
          rememberSpecificProject(proj.key, true);
          showFeedback(
            "success",
            `✅ สร้างโปรเจกต์ใหม่ [${proj.key}] ${proj.name} สำเร็จเรียบร้อยแล้ว`
          );
          void fetchAllData();
        }}
      />

      <CreateIssueModal
        open={isCreateIssueOpen}
        projects={visibleProjects}
        defaultProjectKey={effectiveDefaultProjectKey}
        initialType={createIssueInitialType}
        currentUser={currentUser}
        onProjectChange={(projKey) => rememberSpecificProject(projKey, true)}
        onClose={() => setIsCreateIssueOpen(false)}
        onCreated={(created) => {
          rememberSpecificProject(created.projectKey, true);
          setSelectedIssue(created);
          showFeedback(
            "success",
            `✅ ส่งเรื่องใหม่ #${created.code} ("${created.title}") สำเร็จเรียบร้อยแล้ว`
          );
          void fetchAllData();
        }}
        currentUserName={
          currentUser ? `${currentUser.name} <${currentUser.email}>` : "ผู้ใช้งาน (แจ้งเรื่อง/สอบถาม)"
        }
      />

      <AiMcpGuideModal
        open={isAiMcpOpen}
        onClose={() => setIsAiMcpOpen(false)}
        onDataMutated={() => void fetchAllData()}
        currentUserEmail={currentUser?.email}
        currentUserName={currentUser?.name}
        projects={visibleProjects}
        defaultProjectKey={effectiveDefaultProjectKey}
      />
    </div>
  );
}
