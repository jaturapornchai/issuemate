"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Search,
  RefreshCw,
  Layers,
  X,
  Eye,
  ListFilter,
  FilterX,
  Command,
  PlugZap,
  PanelLeft,
  LayoutList,
  SquareKanban,
  ChartNoAxesColumn,
  Vote,
  MessageCircleQuestion,
  CheckCircle2,
  CircleAlert,
  ChevronRight,
  FolderPlus,
  Loader2,
  ChevronDown,
  Bot,
  Zap,
  Hourglass,
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
import { type AuthUser, getUserProjectPermission } from "@/lib/permissions";
import {
  MonitorDashboardView,
  type MonitorDrillDown,
} from "@/components/MonitorDashboardView";
import {
  STATUS_CONFIG,
  TYPE_CONFIG,
  TYPE_ORDER,
  PRIORITY_CONFIG,
  PRIORITY_ORDER,
  PERMISSION_UI,
  TONE,
  Avatar,
  type Tone,
} from "@/components/ui/Badges";
import { IssuesTableView } from "@/components/IssuesTableView";
import { KanbanBoardView } from "@/components/KanbanBoardView";
import { IdeasRoadmapView } from "@/components/IdeasRoadmapView";
import { IssueDetailDrawer } from "@/components/IssueDetailDrawer";
import { CommandPaletteModal } from "@/components/CommandPaletteModal";
import { GoogleLoginModal } from "@/components/GoogleLoginModal";
import {
  CreateProjectModal,
  CreateIssueModal,
  AiMcpGuideModal,
} from "@/components/Modals";
import { APP_VERSION, DEPLOYED_AT_TH } from "@/lib/version";
import { LogoMark } from "@/components/ui/Logo";
import { AnimatePresence, ViewSwitch, motion, SPRING } from "@/components/ui/Motion";

type ProjectWithCounts = ProjectRecord & { openCount: number; totalCount: number };
type ViewMode = "monitor" | "table" | "kanban" | "roadmap";

const LAST_PROJECT_STORAGE_KEY = "issuemate:lastProjectKey";
const LAST_SPECIFIC_PROJECT_STORAGE_KEY = "issuemate:lastSpecificProjectKey";

const STATUS_FILTER_LABEL: Record<
  Exclude<IssueStatusFilter, IssueStatus | "all">,
  string
> = {
  pending_review: "รอตรวจสอบ",
  active: "กำลังดำเนินการ",
  overdue: "เลยกำหนด",
};

const VIEWS: Array<{
  key: ViewMode;
  label: string;
  hint: string;
  testId: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "table", label: "รายการทั้งหมด", hint: "ปัญหาและคำถามทั้งหมด", testId: "nav-table-btn", icon: LayoutList },
  { key: "kanban", label: "บอร์ดติดตามงาน", hint: "ดูงานตามขั้นตอน", testId: "nav-kanban-btn", icon: SquareKanban },
  { key: "monitor", label: "ภาพรวม", hint: "สถิติและความคืบหน้า", testId: "nav-monitor-btn", icon: ChartNoAxesColumn },
  { key: "roadmap", label: "โหวต & แผนงาน", hint: "จัดลำดับความสำคัญ", testId: "nav-roadmap-btn", icon: Vote },
];

const STATUS_TABS: Array<{
  key: IssueStatusFilter;
  label: string;
  hint: string;
  testId: string;
  tone?: Tone;
  isActive: (f: IssueStatusFilter) => boolean;
  count: (s: MonitorStats | null, fallback: number) => number;
}> = [
  {
    key: "all",
    label: "ทั้งหมด",
    hint: "แสดงทุกสถานะ",
    testId: "filter-tab-all",
    isActive: (f) => f === "all",
    count: (s, fallback) => s?.totalIssues ?? fallback,
  },
  {
    key: "pending_review",
    label: "รอตรวจสอบ",
    hint: "รอตรวจสอบ + กำลังตรวจสอบ",
    testId: "filter-tab-pending-review",
    tone: "amber",
    isActive: (f) => f === "pending_review" || f === "open" || f === "reviewing",
    count: (s) => (s?.openIssues ?? 0) + (s?.reviewingIssues ?? 0),
  },
  {
    key: "ready_to_fix",
    label: "รอแก้ไข",
    hint: STATUS_CONFIG.ready_to_fix.description,
    testId: "filter-tab-ready-to-fix",
    tone: "sky",
    isActive: (f) => f === "ready_to_fix",
    count: (s) => s?.readyToFixIssues ?? 0,
  },
  {
    key: "fixing",
    label: "กำลังแก้ไข",
    hint: STATUS_CONFIG.fixing.description,
    testId: "filter-tab-fixing",
    tone: "blue",
    isActive: (f) => f === "fixing",
    count: (s) => s?.fixingIssues ?? 0,
  },
  {
    key: "deployed",
    label: "เสร็จแล้ว",
    hint: STATUS_CONFIG.deployed.description,
    testId: "filter-tab-deployed",
    tone: "emerald",
    isActive: (f) => f === "deployed",
    count: (s) => s?.deployedIssues ?? 0,
  },
  {
    key: "wont_fix",
    label: "ไม่แก้ไข",
    hint: STATUS_CONFIG.wont_fix.description,
    testId: "filter-tab-wont-fix",
    tone: "zinc",
    isActive: (f) => f === "wont_fix",
    count: (s) => s?.wontFixIssues ?? 0,
  },
];

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
  const [aiApprovalFilter, setAiApprovalFilter] = useState<"all" | "awaiting">("all");
  const [isSavingAutoMode, setIsSavingAutoMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(false);
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
        if (aiApprovalFilter !== "all") params.set("aiApproval", aiApprovalFilter);

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
          setHasLoadedOnce(true);
        }
      }
    },
    [
      selectedProjectKey,
      statusFilter,
      typeFilter,
      priorityFilter,
      aiApprovalFilter,
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
        else if (isMobileSidebarOpen) setIsMobileSidebarOpen(false);
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
    isMobileSidebarOpen,
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
    setAiApprovalFilter("all");
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
      label: `ประเภท: ${TYPE_CONFIG[typeFilter].shortLabel}`,
      clear: () => setTypeFilter("all"),
    },
    priorityFilter !== "all" && {
      key: "priority",
      label: `ความเร่งด่วน: ${PRIORITY_CONFIG[priorityFilter].label}`,
      clear: () => setPriorityFilter("all"),
    },
    aiApprovalFilter === "awaiting" && {
      key: "ai-approval",
      label: "รออนุมัติให้ AI แก้ไข",
      clear: () => setAiApprovalFilter("all"),
    },
    searchQuery.trim() && {
      key: "search",
      label: `ค้นหา: "${searchQuery.trim()}"`,
      clear: () => setSearchQuery(""),
    },
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  const handleToggleAutoMode = async (project: ProjectWithCounts) => {
    const next = !project.aiAutoApproval?.enabled;
    if (
      next &&
      !window.confirm(
        `เปิดโหมดอัตโนมัติของโปรเจกต์ ${project.key}?\n\nAI จะแก้ไขเรื่องที่ตรวจสอบแล้วได้ทันที โดยไม่ต้องรอกดอนุมัติทีละเรื่อง (ยกเว้นเรื่องที่กด "ไม่อนุมัติ" ไว้) — ปิดได้ทุกเมื่อ`
      )
    ) {
      return;
    }
    setIsSavingAutoMode(true);
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: project.key, aiAutoApproval: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFeedback("error", `บันทึกโหมดอัตโนมัติไม่สำเร็จ: ${data.error || "เกิดข้อผิดพลาด"}`);
        return;
      }
      showFeedback(
        "success",
        next
          ? `เปิดโหมดอัตโนมัติของ ${project.key} แล้ว — AI แก้เรื่องที่ตรวจสอบแล้วได้ทันที`
          : `ปิดโหมดอัตโนมัติของ ${project.key} แล้ว — ต้องอนุมัติให้ AI แก้ทีละเรื่อง`
      );
      await fetchAllData({ silent: true });
    } catch {
      showFeedback("error", "บันทึกโหมดอัตโนมัติไม่สำเร็จ: เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setIsSavingAutoMode(false);
    }
  };

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
      showFeedback("error", `อัปเดต ${code} ไม่สำเร็จ: ${errMsg}`);
      throw new Error(errMsg);
    }
    if (data.issue) {
      setSelectedIssue((prev) =>
        prev && prev.code === data.issue.code ? data.issue : prev
      );
    }
    showFeedback("success", `บันทึกการอัปเดต ${code} เรียบร้อยแล้ว`);
    await fetchAllData();
  };

  const handleDeleteIssue = async (code: string) => {
    const res = await fetch(`/api/issues/${encodeURIComponent(code)}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data.error || "ลบรายการไม่สำเร็จ";
      showFeedback("error", `ลบ ${code} ไม่สำเร็จ: ${errMsg}`);
      throw new Error(errMsg);
    }
    setSelectedIssue(null);
    showFeedback("success", `ลบรายการ ${code} เรียบร้อยแล้ว`);
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
      showFeedback("error", `ส่งข้อความใน ${code} ไม่สำเร็จ: ${errMsg}`);
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
        ? `ส่งคำตอบและปิดเรื่อง ${code} เรียบร้อยแล้ว`
        : `ส่งข้อความใน ${code} เรียบร้อยแล้ว`
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
      showFeedback("error", `อัปโหลดไฟล์ไม่สำเร็จ: ${data.error || "เกิดข้อผิดพลาด"}`);
      throw new Error(data.error || "อัปโหลดไฟล์ไม่สำเร็จ");
    }
    showFeedback("success", `อัปโหลดไฟล์ "${file.name}" เรียบร้อยแล้ว`);
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
        showFeedback("success", `บันทึกคะแนนโหวต ${code} เรียบร้อยแล้ว`);
        void fetchAllData();
      } else {
        showFeedback("error", `โหวต ${code} ไม่สำเร็จ: ${data.error || "ไม่มีสิทธิ์"}`);
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
        showFeedback("success", "ล้างข้อมูล Issues ทั้งหมดและรีเซ็ตระบบเรียบร้อยแล้ว");
      } else {
        showFeedback("error", "ล้างข้อมูลไม่สำเร็จ");
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

  const canCreateAnything =
    activeProjectPermission !== "viewer" && activeProjectPermission !== "none";
  const canReportIssue = canCreateAnything && activeProjectPermission !== "question_only";
  const canUseMcp =
    Boolean(currentUser?.isAdmin) ||
    activeProjectPermission === "developer" ||
    activeProjectPermission === "project_admin";
  const canApproveAi = activeProjectPermission === "project_admin";
  const autoApproveProjectKeys = visibleProjects
    .filter((p) => p.aiAutoApproval?.enabled)
    .map((p) => p.key);
  const currentProjectAutoMode = Boolean(currentProject?.aiAutoApproval?.enabled);
  const awaitingAiApprovalCount = monitorStats?.awaitingAiApprovalCount ?? 0;
  const showAiBar = canApproveAi || currentProjectAutoMode;
  const activeView = VIEWS.find((v) => v.key === viewMode) || VIEWS[0];
  const ActiveViewIcon = activeView.icon;
  const showFilterToolbar = viewMode !== "monitor";

  /* ---------------- Signed-out / loading states ---------------- */

  if (!authChecked) {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <LogoMark className="h-12 w-12" />
        </motion.div>
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <Loader2 className="h-4 w-4 animate-spin text-brand-400" />
          กำลังโหลด IssueMate…
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <GoogleLoginModal
        open
        variant="page"
        user={null}
        onClose={() => setAuthErrorNotice(null)}
        onUserUpdated={(u) => setCurrentUser(u)}
        initialError={authErrorNotice}
      />
    );
  }

  /* ---------------- Signed-in app shell ---------------- */

  const sidebar = (
    <aside
      className={`fixed inset-y-0 left-0 z-50 glass flex w-[272px] shrink-0 flex-col border-r transition-transform duration-300 ease-out lg:static lg:z-auto lg:translate-x-0 ${
        isMobileSidebarOpen ? "translate-x-0 shadow-pop" : "-translate-x-full"
      }`}
    >
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center gap-3 px-4">
        <LogoMark />
        <div className="min-w-0 flex-1">
          <p className="text-gradient text-[15px] leading-tight font-semibold tracking-tight">IssueMate</p>
          <p className="truncate text-[11px] leading-tight text-fg-subtle">
            แจ้งปัญหา · สอบถาม · ติดตามงาน
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-label="ปิดเมนู"
          className="btn btn-ghost btn-icon btn-sm lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Quick search */}
      <div className="px-3">
        <button
          type="button"
          data-testid="open-command-palette-btn"
          onClick={() => {
            setIsMobileSidebarOpen(false);
            setIsCommandPaletteOpen(true);
          }}
          className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-line bg-[rgb(6_7_26/0.45)] px-2.5 text-[13px] text-fg-subtle transition hover:border-brand-400/40 hover:text-fg-muted"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">ค้นหาด่วน / คำสั่ง</span>
          <span className="kbd">
            <Command className="mr-0.5 h-2.5 w-2.5" />K
          </span>
        </button>
      </div>

      {/* Views */}
      <nav className="space-y-0.5 px-3 pt-5" aria-label="มุมมอง">
        <p className="section-label pb-1.5">เมนูหลัก</p>
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const active = viewMode === v.key;
          return (
            <button
              key={v.key}
              type="button"
              data-testid={v.testId}
              aria-current={active ? "page" : undefined}
              onClick={() => {
                setViewMode(v.key);
                setIsMobileSidebarOpen(false);
              }}
              className={`group relative flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors ${
                active ? "text-fg" : "text-fg-muted hover:bg-white/[0.04] hover:text-fg"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  transition={SPRING}
                  className="absolute inset-0 rounded-lg bg-gradient-to-r from-brand-500/25 via-brand-500/10 to-transparent shadow-[inset_0_0_0_1px_rgb(167_139_250/0.25)]"
                >
                  <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-gradient-to-b from-brand-300 to-cyan-300" />
                </motion.span>
              )}
              <Icon
                className={`relative h-4 w-4 shrink-0 transition ${
                  active ? "text-brand-300" : "text-fg-subtle group-hover:text-fg-muted"
                }`}
              />
              <span className="relative truncate">{v.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Projects */}
      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-3 pb-1.5">
          <p className="section-label">โปรเจกต์ของคุณ</p>
          {currentUser.isAdmin && (
            <button
              type="button"
              data-testid="open-create-project-btn"
              onClick={() => setIsCreateProjectOpen(true)}
              className="btn btn-ghost btn-xs"
              title="สร้างโปรเจกต์ใหม่"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span>เพิ่ม</span>
            </button>
          )}
        </div>

        {rememberedSpecificProject && (
          <div
            data-testid="remembered-project-banner"
            className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-brand-400/15 bg-brand-400/[0.06] px-2.5 py-2 text-xs"
            title="ระบบจำโปรเจกต์ล่าสุดไว้ให้ เพื่อกันการแจ้งเรื่องผิดโปรเจกต์"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: rememberedSpecificProject.color }}
            />
            <span className="min-w-0 flex-1 truncate text-brand-100/90">
              เรื่องใหม่จะส่งเข้า{" "}
              <strong className="font-semibold text-white">{rememberedSpecificProject.key}</strong>
            </span>
            {selectedProjectKey === "ALL" && (
              <button
                type="button"
                data-testid="resume-last-project-btn"
                onClick={() => selectProject(rememberedSpecificProject.key)}
                className="inline-flex shrink-0 cursor-pointer items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold text-brand-300 hover:bg-brand-400/15"
              >
                เปิด
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
          <button
            type="button"
            data-testid="project-item-ALL"
            onClick={() => {
              selectProject("ALL");
              setIsMobileSidebarOpen(false);
            }}
            className={`flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition ${
              selectedProjectKey === "ALL"
                ? "bg-white/[0.07] font-medium text-fg"
                : "text-fg-muted hover:bg-white/[0.04] hover:text-fg"
            }`}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              <Layers className="h-3.5 w-3.5 text-fg-subtle" />
            </span>
            <span className="flex-1 truncate text-left">ทุกโปรเจกต์</span>
            <span className="count" title="เรื่องที่ยังไม่ปิด">
              {totalOpenAllProjects}
            </span>
          </button>

          {visibleProjects.map((proj) => {
            const isSelected = selectedProjectKey === proj.key;
            const perm = getUserProjectPermission(currentUser, proj.key);
            const restrictedPerm =
              !currentUser.isAdmin && (perm === "viewer" || perm === "question_only") ? perm : null;
            const PermIcon = restrictedPerm ? PERMISSION_UI[restrictedPerm].icon : null;
            return (
              <button
                key={proj.key}
                type="button"
                data-testid={`project-item-${proj.key}`}
                onClick={() => {
                  selectProject(proj.key);
                  setIsMobileSidebarOpen(false);
                }}
                title={`${proj.key} — ${proj.name}`}
                className={`flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition ${
                  isSelected
                    ? "bg-white/[0.07] font-medium text-fg"
                    : "text-fg-muted hover:bg-white/[0.04] hover:text-fg"
                }`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  <span
                    className="h-2.5 w-2.5 rounded-[4px] ring-2 ring-black/30"
                    style={{ backgroundColor: proj.color }}
                  />
                </span>
                <span className="flex-1 truncate text-left">{proj.name}</span>
                {proj.aiAutoApproval?.enabled && (
                  <span title="เปิดโหมดอัตโนมัติ — AI แก้เรื่องที่ตรวจสอบแล้วได้ทันที">
                    <Zap className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                  </span>
                )}
                {PermIcon && restrictedPerm && (
                  <span title={`สิทธิ์ของคุณ: ${PERMISSION_UI[restrictedPerm].label}`}>
                    <PermIcon className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
                  </span>
                )}
                <span className={`count ${proj.openCount > 0 && isSelected ? "bg-brand-400/15 text-brand-200" : ""}`}>
                  {proj.openCount}
                </span>
              </button>
            );
          })}

          {visibleProjects.length === 0 && hasLoadedOnce && (
            <p className="px-2.5 py-3 text-xs leading-relaxed text-fg-subtle">
              ยังไม่มีโปรเจกต์ที่คุณเข้าถึงได้ — ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 space-y-2 border-t border-line p-3">
        {canUseMcp && (
          <button
            type="button"
            data-testid="open-mcp-guide-btn"
            onClick={() => {
              setIsMobileSidebarOpen(false);
              setIsAiMcpOpen(true);
            }}
            className="group flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-gradient-to-r from-sky-400/[0.07] to-violet-400/[0.07] px-2.5 py-2 text-left transition hover:border-line-strong"
            title="สร้าง MCP Token เพื่อให้ AI (Antigravity / Claude Code / Codex) ดึงงานไปแก้ไข"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-400/15 text-sky-300">
              <PlugZap className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-fg">เชื่อมต่อ AI</span>
              <span className="block truncate text-[11px] text-fg-subtle">MCP Token สำหรับทีมพัฒนา</span>
            </span>
            <ChevronRight className="h-4 w-4 text-fg-subtle transition group-hover:translate-x-0.5" />
          </button>
        )}

        {activeProjectPermission !== "none" && (
          <div
            data-testid="sidebar-user-permission-indicator"
            className="flex items-center justify-between gap-2 px-1 text-xs"
          >
            <span className="truncate text-fg-subtle">สิทธิ์ใน {effectiveDefaultProjectKey}</span>
            <span className={`inline-flex shrink-0 items-center gap-1 font-medium ${TONE[PERMISSION_UI[activeProjectPermission].tone].text}`}>
              {React.createElement(PERMISSION_UI[activeProjectPermission].icon, { className: "h-3.5 w-3.5" })}
              {PERMISSION_UI[activeProjectPermission].shortLabel}
            </span>
          </div>
        )}

        <div
          data-testid="app-version-deploy-info"
          className="flex items-center justify-between gap-2 px-1 text-[11px] text-fg-subtle"
          title={`เวอร์ชัน ${APP_VERSION} · อัปเดตระบบล่าสุด ${DEPLOYED_AT_TH}`}
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono">{APP_VERSION}</span>
          </span>
          <span className="truncate">อัปเดต {DEPLOYED_AT_TH}</span>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-dvh w-full overflow-hidden text-fg">
      {/* Mobile Sidebar Backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 animate-fade-in bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {sidebar}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-3 sm:gap-3 sm:px-5">
          <button
            type="button"
            data-testid="mobile-sidebar-toggle-btn"
            onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
            className="btn btn-secondary btn-icon lg:hidden"
            aria-label="เปิดเมนู"
            title="เปิดเมนูและรายชื่อโปรเจกต์"
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          {/* Breadcrumb: project switcher / current view */}
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <div className="relative inline-flex h-9 max-w-[14rem] min-w-0 items-center rounded-lg border border-transparent pr-7 pl-8 text-sm font-semibold text-fg transition hover:border-line hover:bg-white/[0.04] focus-within:border-brand-400/50 sm:max-w-[20rem]">
              <span
                className="pointer-events-none absolute top-1/2 left-3 h-2.5 w-2.5 -translate-y-1/2 rounded-[4px]"
                style={{ backgroundColor: currentProject?.color || "#6d7787" }}
              />
              <span className="truncate">
                {currentProject
                  ? `${currentProject.name} · ${currentProject.key}`
                  : "ทุกโปรเจกต์"}
              </span>
              <select
                value={selectedProjectKey}
                data-testid="header-project-select"
                onChange={(e) => selectProject(e.target.value)}
                aria-label="เลือกโปรเจกต์"
                title="สลับโปรเจกต์ (ระบบจะจำโปรเจกต์ที่เลือกไว้ให้อัตโนมัติ)"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              >
                <option value="ALL">ทุกโปรเจกต์</option>
                {visibleProjects.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name} · {p.key}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            </div>
            <ChevronRight className="hidden h-4 w-4 shrink-0 text-fg-subtle/60 sm:block" />
            <h1
              data-testid="header-title"
              className="hidden min-w-0 items-center gap-1.5 truncate text-sm font-medium text-fg-muted sm:flex"
            >
              <ActiveViewIcon className="h-4 w-4 shrink-0 text-fg-subtle" />
              <span className="truncate">{activeView.label}</span>
            </h1>
          </div>

          {/* Search (desktop) */}
          <div className="relative hidden w-52 items-center md:flex xl:w-64">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-fg-subtle" />
            <input
              type="text"
              data-testid="search-issues-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหารหัส หรือหัวข้อเรื่อง…"
              className="input h-9 pr-8 pl-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                data-testid="clear-search-btn"
                title="ล้างคำค้นหา"
                className="absolute right-1.5 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-fg-subtle hover:bg-white/10 hover:text-fg"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => void fetchAllData()}
            className="btn btn-ghost btn-icon hidden sm:inline-flex"
            title="รีเฟรชข้อมูล (ระบบอัปเดตให้อัตโนมัติทุก 8 วินาที)"
            aria-label="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-brand-400" : ""}`} />
          </button>

          {activeProjectPermission === "viewer" ? (
            <span
              data-testid="sidebar-viewer-only-notice"
              className="pill bg-white/[0.04] text-fg-muted ring-line"
              title="สิทธิ์ของคุณในโปรเจกต์นี้คือดูข้อมูลอย่างเดียว จึงไม่สามารถแจ้งเรื่องใหม่ได้"
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">ดูอย่างเดียว</span>
            </span>
          ) : (
            canCreateAnything && (
              <>
                <button
                  type="button"
                  data-testid="quick-ask-question-btn"
                  onClick={() => openCreateModalWithType("question")}
                  className="btn btn-secondary px-2.5 sm:px-3.5"
                  title="ถามคำถามการใช้งาน ขอคู่มือ หรือขอคำแนะนำ"
                >
                  <MessageCircleQuestion className="h-4 w-4 text-sky-300" />
                  <span className="hidden sm:inline">ถามคำถาม</span>
                </button>
                {canReportIssue && (
                  <button
                    type="button"
                    data-testid="new-issue-btn"
                    onClick={() => openCreateModalWithType("bug")}
                    className="btn btn-primary px-3"
                    title="แจ้งปัญหา ขอฟีเจอร์ หรือแจ้งเรื่องด่วน"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                    <span>แจ้งปัญหา</span>
                  </button>
                )}
              </>
            )
          )}

          <button
            type="button"
            data-testid="open-google-login-btn"
            onClick={() => setIsGoogleLoginOpen(true)}
            className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-line bg-white/[0.03] py-0.5 pr-0.5 pl-0.5 transition hover:border-line-strong hover:bg-white/[0.06] xl:pr-3"
            title="บัญชีของฉันและสิทธิ์การใช้งาน"
          >
            <Avatar name={currentUser.name} src={currentUser.picture} />
            <span className="hidden max-w-[140px] truncate text-[13px] font-medium text-fg xl:inline">
              {currentUser.name}
            </span>
          </button>
        </header>

        {/* Filter toolbar */}
        {showFilterToolbar && (
          <div className="shrink-0 space-y-2 border-b border-line px-3 py-2.5 sm:px-5">
            {/* Mobile search */}
            <div className="relative flex items-center md:hidden">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-fg-subtle" />
              <input
                type="text"
                data-testid="search-issues-input-mobile"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหารหัส หรือหัวข้อเรื่อง…"
                className="input h-9 pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                role="tablist"
                aria-label="กรองตามสถานะ"
                className="-mx-1 flex max-w-full items-center gap-0.5 overflow-x-auto px-1"
              >
                {STATUS_TABS.map((tab) => {
                  const active = tab.isActive(statusFilter);
                  const count = tab.count(monitorStats, issues.length);
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      data-testid={tab.testId}
                      title={tab.hint}
                      onClick={() => setStatusFilter(tab.key)}
                      className={`relative inline-flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-[13px] whitespace-nowrap transition-colors ${
                        active ? "font-medium text-fg" : "text-fg-muted hover:bg-white/[0.04] hover:text-fg"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="status-tab-active"
                          transition={SPRING}
                          className="absolute inset-0 rounded-lg bg-white/[0.08] shadow-[inset_0_0_0_1px_rgb(167_139_250/0.3)]"
                        />
                      )}
                      {tab.tone && <span className={`relative h-2 w-2 rounded-full ${TONE[tab.tone].dot}`} />}
                      <span className="relative">{tab.label}</span>
                      <span className={`relative text-xs tabular-nums ${active ? "text-fg-muted" : "text-fg-subtle"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex w-full items-center gap-1.5 sm:ml-auto sm:w-auto sm:flex-wrap sm:gap-2">
                <button
                  type="button"
                  data-testid="filter-type-question-pill"
                  aria-pressed={typeFilter === "question"}
                  onClick={() =>
                    setTypeFilter((prev) => (prev === "question" ? "all" : "question"))
                  }
                  className={`btn btn-sm shrink-0 px-2 sm:px-2.5 ${
                    typeFilter === "question"
                      ? "border border-sky-400/40 bg-sky-400/15 text-sky-100"
                      : "btn-secondary"
                  }`}
                  title="แสดงเฉพาะคำถาม"
                >
                  <MessageCircleQuestion className="h-3.5 w-3.5 text-sky-300" />
                  <span>เฉพาะคำถาม</span>
                  <span className="text-fg-subtle tabular-nums">{monitorStats?.byType?.question ?? 0}</span>
                </button>

                <select
                  value={typeFilter}
                  data-testid="type-filter-select"
                  onChange={(e) => setTypeFilter(e.target.value as IssueType | "all")}
                  aria-label="กรองตามประเภท"
                  className="select h-8 min-w-0 flex-1 pr-6 pl-2.5 text-xs sm:w-auto sm:flex-none sm:pr-8 sm:pl-3"
                >
                  <option value="all">ทุกประเภท</option>
                  {TYPE_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_CONFIG[t].label}
                    </option>
                  ))}
                </select>

                <select
                  value={priorityFilter}
                  data-testid="priority-filter-select"
                  onChange={(e) => setPriorityFilter(e.target.value as IssuePriority | "all")}
                  aria-label="กรองตามความเร่งด่วน"
                  className="select h-8 min-w-0 flex-1 pr-6 pl-2.5 text-xs sm:w-auto sm:flex-none sm:pr-8 sm:pl-3"
                >
                  <option value="all">ทุกความเร่งด่วน</option>
                  {PRIORITY_ORDER.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_CONFIG[p].label} — {PRIORITY_CONFIG[p].hint}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* AI approval bar */}
        {showAiBar && (
          <div
            data-testid="ai-approval-bar"
            className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-gradient-to-r from-sky-400/[0.05] via-transparent to-transparent px-3 py-2 text-xs sm:px-5"
          >
            <span className="inline-flex items-center gap-1.5 font-medium text-fg-muted">
              <Bot className="h-4 w-4 text-sky-300" />
              AI แก้ไขอัตโนมัติ
            </span>

            {canApproveAi && (awaitingAiApprovalCount > 0 || aiApprovalFilter === "awaiting") && (
              <button
                type="button"
                data-testid="filter-ai-awaiting-pill"
                aria-pressed={aiApprovalFilter === "awaiting"}
                onClick={() => {
                  setAiApprovalFilter((prev) => (prev === "awaiting" ? "all" : "awaiting"));
                  if (viewMode === "monitor") setViewMode("table");
                }}
                className={`pill cursor-pointer transition ${
                  aiApprovalFilter === "awaiting"
                    ? "bg-amber-400/20 text-amber-100 ring-amber-400/40"
                    : "bg-amber-400/10 text-amber-200 ring-amber-400/25 hover:bg-amber-400/20"
                }`}
                title="แสดงเรื่องที่ตรวจสอบแล้วและรอคุณอนุมัติให้ AI แก้ไข"
              >
                <Hourglass className="h-3.5 w-3.5" />
                รออนุมัติ {awaitingAiApprovalCount} เรื่อง
              </button>
            )}

            <div className="ml-auto flex min-w-0 items-center gap-2.5">
              {currentProject ? (
                <>
                  <span className="min-w-0 truncate text-fg-subtle">
                    {currentProjectAutoMode ? (
                      <>
                        <strong className="font-semibold text-sky-200">โหมดอัตโนมัติ: เปิด</strong>
                        <span className="hidden sm:inline"> — AI แก้เรื่องที่ตรวจสอบแล้วได้ทันที</span>
                      </>
                    ) : (
                      <>
                        <strong className="font-semibold text-fg-muted">โหมดอัตโนมัติ: ปิด</strong>
                        <span className="hidden sm:inline"> — ต้องอนุมัติให้ AI แก้ทีละเรื่อง</span>
                      </>
                    )}
                  </span>
                  {canApproveAi && (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={currentProjectAutoMode}
                      aria-label={`โหมดอัตโนมัติของโปรเจกต์ ${currentProject.key}`}
                      data-testid="ai-auto-mode-switch"
                      disabled={isSavingAutoMode}
                      onClick={() => void handleToggleAutoMode(currentProject)}
                      title={
                        currentProjectAutoMode
                          ? "ปิดโหมดอัตโนมัติ (กลับไปอนุมัติทีละเรื่อง)"
                          : "เปิดโหมดอัตโนมัติ (ไม่ต้องเฝ้าจอ — AI แก้ได้ทันทีหลังตรวจสอบ)"
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition disabled:opacity-50 ${
                        currentProjectAutoMode ? "bg-sky-400" : "bg-white/15 hover:bg-white/25"
                      }`}
                    >
                      <span
                        className={`h-4 w-4 rounded-full bg-white shadow transition ${
                          currentProjectAutoMode ? "translate-x-[18px]" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  )}
                </>
              ) : (
                canApproveAi && (
                  <span className="truncate text-fg-subtle">เลือกโปรเจกต์เพื่อเปิด/ปิดโหมดอัตโนมัติ</span>
                )
              )}
            </div>
          </div>
        )}

        {/* Active filter bar */}
        {showFilterToolbar && activeFilters.length > 0 && (
          <div
            data-testid="active-filter-bar"
            className="flex shrink-0 items-center gap-2 animate-fade-in border-b border-line bg-brand-400/[0.05] px-3 py-2 sm:px-5"
          >
            <ListFilter className="h-4 w-4 shrink-0 text-brand-400" />
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={f.clear}
                  data-testid={`active-filter-${f.key}`}
                  title="คลิกเพื่อยกเลิกเงื่อนไขนี้"
                  className="pill max-w-[260px] shrink-0 cursor-pointer bg-white/[0.05] text-fg ring-line transition hover:bg-rose-400/10 hover:text-rose-100 hover:ring-rose-400/30"
                >
                  <span className="truncate">{f.label}</span>
                  <X className="h-3 w-3 shrink-0 opacity-60" />
                </button>
              ))}
            </div>
            <span className="hidden shrink-0 text-xs text-fg-muted sm:inline" data-testid="filter-result-count">
              พบ <strong className="font-semibold text-fg tabular-nums">{issues.length}</strong> รายการ
            </span>
            <button
              type="button"
              onClick={resetFilters}
              data-testid="reset-filters-btn"
              className="btn btn-ghost btn-xs shrink-0"
            >
              <FilterX className="h-3.5 w-3.5" />
              ล้างตัวกรอง
            </button>
          </div>
        )}

        {/* Main Viewport */}
        <main className="min-h-0 flex-1 overflow-hidden">
          <ViewSwitch viewKey={viewMode} className="h-full">
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
              isLoading={isLoading && !hasLoadedOnce}
              hasActiveFilters={activeFilters.length > 0}
              onResetFilters={resetFilters}
              onCreate={canCreateAnything ? () => openCreateModalWithType(canReportIssue ? "bug" : "question") : undefined}
              autoApproveProjectKeys={autoApproveProjectKeys}
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
              autoApproveProjectKeys={autoApproveProjectKeys}
            />
          )}

          {viewMode === "roadmap" && (
            <IdeasRoadmapView
              issues={issues}
              onSelectIssue={(issue) => setSelectedIssue(issue)}
              onUpvote={handleQuickUpvote}
              onOpenCreateIdea={canReportIssue ? () => openCreateModalWithType("feature") : undefined}
            />
          )}
          </ViewSwitch>
        </main>
      </div>

      {/* Floating action feedback (toast) */}
      <AnimatePresence>
      {actionFeedback && (
        <motion.div
          key="toast"
          data-testid="global-action-feedback"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.16 } }}
          transition={SPRING}
          className={`fixed right-4 bottom-4 left-4 z-[80] flex items-start gap-3 rounded-xl border bg-overlay/90 px-4 py-3 text-[13px] shadow-pop backdrop-blur-xl sm:left-auto sm:w-[380px] ${
            actionFeedback.type === "success" ? "border-emerald-400/25" : "border-rose-400/30"
          }`}
        >
          {actionFeedback.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          )}
          <span className="min-w-0 flex-1 leading-relaxed text-fg">{actionFeedback.message}</span>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            aria-label="ปิดข้อความ"
            className="-mr-1 inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-subtle hover:bg-white/10 hover:text-fg"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Issue Detail Slide-over Drawer (AnimatePresence keeps it mounted for the exit slide) */}
      <AnimatePresence>
      {selectedIssue && (
      <IssueDetailDrawer
        key="issue-drawer"
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
        onUpdate={handleUpdateIssue}
        onDelete={handleDeleteIssue}
        onAddComment={handleAddComment}
        onUploadFile={handleUploadFile}
        currentUserName={currentUser?.name}
        userPermission={selectedIssuePermission}
        projectName={visibleProjects.find((p) => p.key === selectedIssue?.projectKey)?.name}
        projectColor={visibleProjects.find((p) => p.key === selectedIssue?.projectKey)?.color}
        projectAutoApproval={
          visibleProjects.find((p) => p.key === selectedIssue?.projectKey)?.aiAutoApproval
        }
      />
      )}
      </AnimatePresence>

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
        onOpenAskQuestion={() => openCreateModalWithType("question")}
        onOpenCreateProject={() => setIsCreateProjectOpen(true)}
        onOpenMcpGuide={() => setIsAiMcpOpen(true)}
        canCreateIssue={canReportIssue}
        canAskQuestion={canCreateAnything}
        canUseMcp={canUseMcp}
        isAdmin={Boolean(currentUser?.isAdmin)}
      />

      {/* Account, Members & Setup Modal */}
      <GoogleLoginModal
        open={isGoogleLoginOpen}
        user={currentUser}
        onClose={() => {
          setIsGoogleLoginOpen(false);
          setAuthErrorNotice(null);
        }}
        onUserUpdated={(u) => setCurrentUser(u)}
        initialError={authErrorNotice}
        onOpenMcpTokens={
          canUseMcp
            ? () => {
                setIsGoogleLoginOpen(false);
                setIsAiMcpOpen(true);
              }
            : undefined
        }
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
          showFeedback("success", `สร้างโปรเจกต์ ${proj.key} — ${proj.name} เรียบร้อยแล้ว`);
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
          showFeedback("success", `ส่งเรื่อง ${created.code} เรียบร้อยแล้ว — ทีมงานจะได้รับแจ้งทันที`);
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
