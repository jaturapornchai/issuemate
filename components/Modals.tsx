"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  FolderPlus,
  PlusCircle,
  Terminal,
  Copy,
  Check,
  Sparkles,
  Loader2,
  AlertCircle,
  Play,
  KeyRound,
  Trash2,
  ShieldCheck,
  FolderKanban,
  MessageSquareCode,
} from "lucide-react";
import type {
  ProjectRecord,
  IssueRecord,
  IssuePriority,
  IssueType,
  AttachmentItem,
} from "@/lib/types";
import { FileUploadZone } from "@/components/ui/FileAttachmentZone";

export function CreateProjectModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (proj: ProjectRecord) => void;
}) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#10b981");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, name, description, color }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ไม่สามารถสร้างโปรเจกต์ได้");
      }
      setKey("");
      setName("");
      setDescription("");
      onCreated(data.project);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        data-testid="create-project-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <FolderPlus className="h-4 w-4 text-emerald-400" />
            <span>เพิ่มโปรเจกต์ / ระบบงานใหม่</span>
          </div>
          <button
            type="button"
            data-testid="close-create-project-modal-btn"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                รหัสย่อ *
              </label>
              <input
                type="text"
                required
                maxLength={10}
                data-testid="project-key-input"
                value={key}
                onChange={(e) =>
                  setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                }
                placeholder="เช่น SML, POS"
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 font-mono text-xs uppercase text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-300">
                ชื่อโปรเจกต์ / ระบบงาน *
              </label>
              <input
                type="text"
                required
                data-testid="project-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น SML Ai Account"
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              คำอธิบายสั้นๆ (ถ้ามี)
            </label>
            <input
              type="text"
              data-testid="project-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="รายละเอียดระบบงาน..."
              className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              สีประจำโปรเจกต์
            </label>
            <div className="flex items-center gap-2.5">
              {[
                "#10b981",
                "#3b82f6",
                "#ef4444",
                "#f59e0b",
                "#8b5cf6",
                "#06b6d4",
                "#ec4899",
              ].map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setColor(hex)}
                  style={{ backgroundColor: hex }}
                  className={`h-7 w-7 rounded-full border-2 transition cursor-pointer ${
                    color === hex ? "scale-110 border-white" : "border-transparent opacity-70"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3.5">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-4 text-xs font-medium text-slate-300 hover:bg-slate-700 cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              data-testid="submit-create-project-btn"
              disabled={isSaving}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>บันทึกโปรเจกต์</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CreateIssueModal({
  open,
  projects,
  defaultProjectKey,
  onClose,
  onCreated,
  currentUserName,
}: {
  open: boolean;
  projects: ProjectRecord[];
  defaultProjectKey: string;
  onClose: () => void;
  onCreated: (issue: IssueRecord) => void;
  currentUserName?: string;
}) {
  const [projectKey, setProjectKey] = useState(
    defaultProjectKey && defaultProjectKey !== "ALL"
      ? defaultProjectKey
      : projects[0]?.key || "DEVOPS"
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<IssueType>("bug");
  const [priority, setPriority] = useState<IssuePriority>("high");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [similarIssues, setSimilarIssues] = useState<
    Array<{ code: string; title: string; status: string; upvotes: number }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const reporter = currentUserName || "ผู้แจ้งปัญหา (DevOps)";

  useEffect(() => {
    if (defaultProjectKey && defaultProjectKey !== "ALL") {
      setProjectKey(defaultProjectKey);
    } else if (projects.length > 0 && (!projectKey || projectKey === "ALL")) {
      setProjectKey(projects[0].key);
    }
  }, [defaultProjectKey, projects, open, projectKey]);

  useEffect(() => {
    if (!open || title.trim().length < 3) {
      setSimilarIssues([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/issues/similar?q=${encodeURIComponent(title.trim())}&projectKey=${encodeURIComponent(
            projectKey
          )}`
        );
        const data = await res.json();
        if (Array.isArray(data.similar)) {
          setSimilarIssues(data.similar);
        }
      } catch {
        // ignore
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [title, projectKey, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectKey,
          title,
          description,
          type,
          priority,
          reporter,
          attachments,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "สร้างรายการไม่สำเร็จ");
      }

      setTitle("");
      setDescription("");
      setAttachments([]);
      setSimilarIssues([]);
      onCreated(data.issue);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        data-testid="create-issue-modal"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <PlusCircle className="h-4 w-4 text-emerald-400" />
            <span>แจ้งปัญหา / เพิ่มรายการใหม่ (แนบรูปภาพและไฟล์ได้หลายรายการ)</span>
          </div>
          <button
            type="button"
            data-testid="close-create-issue-modal-btn"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {error && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-300">
                {error}
              </div>
            )}

            {/* Row 1: Project, Type, Priority */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-200">
                  โปรเจกต์ / ระบบงาน *
                </label>
                <select
                  data-testid="issue-project-select"
                  value={projectKey}
                  onChange={(e) => setProjectKey(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  {projects.map((p) => (
                    <option key={p.key} value={p.key}>
                      [{p.key}] {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-200">
                  ประเภทเรื่อง
                </label>
                <select
                  data-testid="issue-type-select"
                  value={type}
                  onChange={(e) => setType(e.target.value as IssueType)}
                  className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="bug">แจ้งปัญหา / บั๊กการใช้งาน</option>
                  <option value="feature">ขอเพิ่มฟีเจอร์ / ปรับปรุง</option>
                  <option value="incident">ด่วน / ระบบใช้งานไม่ได้</option>
                  <option value="performance">ระบบช้า / ประสิทธิภาพ</option>
                  <option value="deployment">งานอัปเดตระบบ / Deploy</option>
                  <option value="security">ความปลอดภัย / สิทธิ์การใช้งาน</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-200">
                  ความเร่งด่วน
                </label>
                <select
                  data-testid="issue-priority-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as IssuePriority)}
                  className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="high">ด่วน (High)</option>
                  <option value="medium">ปกติ (Medium)</option>
                  <option value="critical">ด่วนมาก (Critical)</option>
                  <option value="low">ทั่วไป (Low)</option>
                </select>
              </div>
            </div>

            {/* Row 2: Title */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-200">
                หัวข้อปัญหา / เรื่องที่ต้องการแจ้ง *
              </label>
              <input
                type="text"
                required
                data-testid="issue-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="พิมพ์หัวข้อสั้นๆ เช่น บันทึกข้อมูลไม่ได้, ยอดเงินไม่ตรง, หน้าจอค้าง..."
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />

              {similarIssues.length > 0 && (
                <div className="mt-2 rounded-lg border border-amber-500/35 bg-amber-950/20 p-2.5 text-xs">
                  <p className="mb-1 flex items-center gap-1.5 font-semibold text-amber-300">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>พบรายการที่คล้ายกันในระบบ:</span>
                  </p>
                  <div className="space-y-1">
                    {similarIssues.map((sim) => (
                      <div
                        key={sim.code}
                        className="flex items-center justify-between rounded bg-slate-900/90 px-2.5 py-1 text-[11px]"
                      >
                        <span className="truncate text-slate-200">
                          <strong className="font-mono text-emerald-400 mr-1.5">
                            #{sim.code}
                          </strong>
                          {sim.title}
                        </span>
                        <span className="shrink-0 text-amber-300 ml-2">
                          สถานะ: {sim.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Row 3: Description */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-200">
                รายละเอียดเพิ่มเติม (ถ้ามี)
              </label>
              <textarea
                rows={2}
                data-testid="issue-desc-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="อธิบายอาการที่พบ หรือสิ่งที่ต้องการให้แก้ไข... (สามารถกด Ctrl+V เพื่อวางรูปแคปหน้าจอได้ทันที)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-white focus:border-emerald-500 focus:outline-none leading-relaxed"
              />
            </div>

            {/* Row 4: Prominent Multi-Image & Multi-File Upload Zone */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-emerald-300">
                🖼️ แนบรูปภาพ & ไฟล์ประกอบ (เลือกได้หลายรูป หลายไฟล์พร้อมกัน หรือกด Ctrl+V
                วางรูปได้เรื่อยๆ)
              </label>
              <FileUploadZone
                attachments={attachments}
                onChange={setAttachments}
                uploadedBy={reporter}
                listenGlobalPaste={open}
              />
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-950/90 px-5 py-3.5">
            <span className="text-[11px] text-slate-400">
              ผู้แจ้ง: <strong className="text-slate-200">{reporter}</strong>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-4 text-xs font-medium text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                data-testid="submit-create-issue-btn"
                disabled={isSaving}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer shadow"
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>
                  {attachments.length > 0
                    ? `บันทึกแจ้งปัญหา (แนบ ${attachments.length} ไฟล์)`
                    : "บันทึกแจ้งปัญหา"}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

interface McpTokenPublic {
  id: string;
  name: string;
  projectKey: string;
  ownerEmail: string;
  ownerName: string;
  agentRole: "claude_reviewer" | "antigravity_fixer" | "admin";
  tokenPrefix: string;
  maskedToken: string;
  createdBy: string;
  createdAt: string;
  lastUsedAt?: string | null;
  usageCount: number;
}

const ROLE_BADGE: Record<
  McpTokenPublic["agentRole"],
  { label: string; className: string }
> = {
  claude_reviewer: {
    label: "Antigravity",
    className: "border-cyan-500/40 bg-cyan-500/15 text-cyan-200",
  },
  antigravity_fixer: {
    label: "Antigravity",
    className: "border-cyan-500/40 bg-cyan-500/15 text-cyan-200",
  },
  admin: {
    label: "Antigravity",
    className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  },
};

export function AiMcpGuideModal({
  open,
  onClose,
  onDataMutated,
  currentUserEmail,
  currentUserName,
  projects: propProjects,
  defaultProjectKey,
}: {
  open: boolean;
  onClose: () => void;
  onDataMutated?: () => void;
  currentUserEmail?: string;
  currentUserName?: string;
  projects?: ProjectRecord[];
  defaultProjectKey?: string;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testOutput, setTestOutput] = useState<string>("");
  const [isTestingMcp, setIsTestingMcp] = useState<boolean>(false);

  // MCP Token Generator States (Bound to Project + Gmail User ID for Antigravity)
  const [tokens, setTokens] = useState<McpTokenPublic[]>([]);
  const [availableProjects, setAvailableProjects] = useState<
    Array<{ key: string; name: string }>
  >(propProjects || []);
  const [selectedProjectKey, setSelectedProjectKey] = useState<string>(
    defaultProjectKey && defaultProjectKey !== "ALL"
      ? defaultProjectKey
      : propProjects?.[0]?.key || "DEVOPS"
  );
  const [allowedUsers, setAllowedUsers] = useState<
    Array<{ email: string; name: string; role: string }>
  >([]);
  const [enforceTokenAuth, setEnforceTokenAuth] = useState<boolean>(false);
  const [ownerEmail, setOwnerEmail] = useState<string>(currentUserEmail || "");
  const [ownerName, setOwnerName] = useState<string>(
    currentUserName || "ผู้ใช้งาน (Antigravity)"
  );
  const [newTokenName, setNewTokenName] = useState<string>("Antigravity");
  const [newTokenRole] =
    useState<McpTokenPublic["agentRole"]>("antigravity_fixer");
  const [generatedRawToken, setGeneratedRawToken] = useState<string | null>(null);
  const [generatedForEmail, setGeneratedForEmail] = useState<string | null>(null);
  const [generatedForProject, setGeneratedForProject] = useState<string | null>(
    null
  );
  const [isGeneratingToken, setIsGeneratingToken] = useState<boolean>(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUserEmail) setOwnerEmail(currentUserEmail);
    if (currentUserName) setOwnerName(currentUserName);
  }, [currentUserEmail, currentUserName]);

  useEffect(() => {
    if (defaultProjectKey && defaultProjectKey !== "ALL") {
      setSelectedProjectKey(defaultProjectKey);
    } else if (propProjects && propProjects.length > 0 && !selectedProjectKey) {
      setSelectedProjectKey(propProjects[0].key);
    }
  }, [defaultProjectKey, propProjects, selectedProjectKey]);

  const loadTokens = async () => {
    try {
      const res = await fetch("/api/mcp/tokens");
      const data = await res.json();
      if (Array.isArray(data.tokens)) setTokens(data.tokens);
      if (Array.isArray(data.allowedUsers)) setAllowedUsers(data.allowedUsers);
      if (Array.isArray(data.projects) && data.projects.length > 0) {
        setAvailableProjects(data.projects);
        setSelectedProjectKey((prev) =>
          prev && prev !== "ALL" ? prev : data.projects[0].key
        );
      }
      if (data.settings) setEnforceTokenAuth(Boolean(data.settings.enforceTokenAuth));
      if (data.currentUser?.email && !currentUserEmail) {
        setOwnerEmail(data.currentUser.email);
        setOwnerName(data.currentUser.name || data.currentUser.email);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (open) {
      void loadTokens();
    }
  }, [open]);

  if (!open) return null;

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://issue.dedezoom.com";

  const activeProject =
    selectedProjectKey && selectedProjectKey !== "ALL"
      ? selectedProjectKey
      : availableProjects[0]?.key || "DEVOPS";

  const activeProjectObj = availableProjects.find((p) => p.key === activeProject);

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGenerateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setTokenError(null);
    if (!activeProject) {
      setTokenError("กรุณาเลือกโปรเจกต์ (Project) ที่ต้องการผูกกับ MCP Token เพื่อป้องกันความผิดพลาด");
      return;
    }
    if (!ownerEmail.trim() || !ownerEmail.includes("@")) {
      setTokenError("กรุณาระบุอีเมล Gmail ที่ได้รับอนุญาตเพื่อผูกเป็นรหัสผู้ใช้งาน (User ID)");
      return;
    }
    if (!newTokenName.trim()) return;
    setIsGeneratingToken(true);
    try {
      const res = await fetch("/api/mcp/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTokenName.trim(),
          projectKey: activeProject,
          ownerEmail: ownerEmail.trim().toLowerCase(),
          ownerName: ownerName.trim() || ownerEmail.trim().split("@")[0],
          agentRole: newTokenRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTokenError(data.error || "สร้าง Token ไม่สำเร็จ");
        return;
      }
      if (data.rawToken) {
        setGeneratedRawToken(data.rawToken);
        setGeneratedForEmail(data.token?.ownerEmail || ownerEmail.trim().toLowerCase());
        setGeneratedForProject(data.token?.projectKey || activeProject);
        await loadTokens();
      }
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const handleRevokeToken = async (id: string) => {
    await fetch(`/api/mcp/tokens?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await loadTokens();
  };

  const handleToggleEnforceAuth = async (nextVal: boolean) => {
    setEnforceTokenAuth(nextVal);
    await fetch("/api/mcp/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_settings",
        enforceTokenAuth: nextVal,
      }),
    });
  };

  const runLiveMcpToolCall = async (toolName: string, args: Record<string, unknown>) => {
    setIsTestingMcp(true);
    try {
      const targetProj = generatedForProject || activeProject;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-MCP-Project": targetProj,
      };
      if (generatedRawToken) {
        headers["Authorization"] = `Bearer ${generatedRawToken}`;
      }
      const res = await fetch(`/api/mcp?project=${encodeURIComponent(targetProj)}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: {
            name: toolName,
            arguments: {
              projectKey: targetProj,
              ...args,
            },
          },
        }),
      });
      const json = await res.json();
      const textContent = json?.result?.content?.[0]?.text;
      setTestOutput(textContent || JSON.stringify(json, null, 2));
      void loadTokens();
      if (onDataMutated) onDataMutated();
    } catch (err: unknown) {
      setTestOutput(err instanceof Error ? err.message : "Error calling MCP");
    } finally {
      setIsTestingMcp(false);
    }
  };

  const activeTokenExample =
    generatedRawToken || "ism_live_วาง_TOKEN_ที่สร้างจากด้านบน";
  const targetConfigProject = generatedForProject || activeProject;

  const mcpHttpConfig = JSON.stringify(
    {
      mcpServers: {
        issuemate: {
          url: `${origin}/mcp?project=${targetConfigProject}`,
          headers: {
            Authorization: `Bearer ${activeTokenExample}`,
            "X-MCP-Project": targetConfigProject,
          },
        },
      },
    },
    null,
    2
  );

  const mcpUrlQueryConfig = JSON.stringify(
    {
      mcpServers: {
        issuemate: {
          url: `${origin}/mcp?project=${targetConfigProject}&token=${activeTokenExample}`,
        },
      },
    },
    null,
    2
  );

  const newSessionAntigravityPrompt = `คุณกำลังดูแลโปรเจกต์ "${
    activeProjectObj?.name || targetConfigProject
  }" (รหัสโปรเจกต์ใน IssueMate คือ projectKey="${targetConfigProject}")
ให้เชื่อมต่อและใช้ MCP Server ชื่อ "issuemate" โดยระบุ projectKey="${targetConfigProject}" เสมอเพื่อกันพลาดข้ามโปรเจกต์ แล้วทำตามขั้นตอนนี้:
1. เรียก MCP tool \`get_ai_context\` (ส่ง \`projectKey: "${targetConfigProject}"\`) เพื่อตรวจสอบโปรเจกต์และดึงรายการปัญหาทั้งหมดที่รอรีวิว (open) และรอแก้ไข (ready_to_fix)
   - หากยังไม่มีโปรเจกต์ "${targetConfigProject}" ในระบบ ให้ถามยืนยันรหัสย่อ (key), ชื่อโปรเจกต์ (name) และคำอธิบาย (description) กับฉันให้เรียบร้อยก่อน แล้วจึงเรียก \`create_project\` โดยส่ง \`confirmedByUser: true\`
2. สำหรับแต่ละ Issue ให้เรียก \`get_issue\` เพื่ออ่านรายละเอียดและเปิดดูรูปภาพ/ไฟล์แนบทั้งหมดที่ผู้ใช้แนบไว้
3. วิเคราะห์สาเหตุของปัญหา แล้วเรียก \`submit_claude_review\` บันทึกผลวิเคราะห์ (เลือก decision="fix" พร้อมระบุ fixInstructions และ targetFiles หรือ decision="wont_fix" หากไม่ต้องแก้)
4. เรียก \`claim_for_fix\` เพื่อรับงานเข้าสู่สถานะกำลังแก้ (fixing) จากนั้นลงมือแก้ไขโค้ดในโปรเจกต์นี้ ทดสอบให้ผ่านจริง และ Deploy ขึ้นเซิร์ฟเวอร์
5. เมื่อแก้ไขและ Deploy เสร็จเรียบร้อยแล้ว ให้เรียก \`mark_deployed\` บันทึกผลการแก้ไขและผลการ Deploy กลับเข้า IssueMate ทันที`;

  const unmaskedUsers = allowedUsers.filter((u) => !u.email.includes("***"));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        data-testid="ai-mcp-modal"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Terminal className="h-4 w-4 text-cyan-400" />
            <span>
              ศูนย์เชื่อมต่อ MCP Server & ตัวสร้าง MCP Token ผูกโปรเจกต์ (สำหรับ Antigravity)
            </span>
          </div>
          <button
            type="button"
            data-testid="close-mcp-modal-btn"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-slate-300">
          {/* Section 1: MCP API Token Generator & Project Binding */}
          <div
            data-testid="mcp-token-generator-section"
            className="rounded-xl border border-emerald-500/35 bg-gradient-to-br from-emerald-950/25 via-slate-950/90 to-slate-900/90 p-4 space-y-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-emerald-400" />
                <div>
                  <h4 className="text-sm font-bold text-white">
                    ตัวสร้าง MCP API Token ผูกกับโปรเจกต์ (Project-Bound) & Gmail
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    ทุก MCP Token จะถูกล็อกเข้ากับ{" "}
                    <strong className="text-amber-300">รหัสโปรเจกต์ (Project Key)</strong>{" "}
                    เพื่อป้องกัน Antigravity ดึงหรือแก้ไข Issue ผิดโปรเจกต์โดยเด็ดขาด
                  </p>
                </div>
              </div>

              {/* Enforce Strict Token Auth Toggle */}
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="toggle-enforce-mcp-token"
                  checked={enforceTokenAuth}
                  onChange={(e) => handleToggleEnforceAuth(e.target.checked)}
                  className="h-3.5 w-3.5 accent-emerald-500"
                />
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[11px] font-semibold text-slate-200">
                  บังคับใช้ Token ทุกครั้ง (Strict Auth)
                </span>
              </label>
            </div>

            <form onSubmit={handleGenerateToken} className="space-y-3">
              {tokenError && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-300">
                  {tokenError}
                </div>
              )}

              {unmaskedUsers.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 mr-1">
                    เลือก Gmail ที่ได้รับอนุญาต:
                  </span>
                  {unmaskedUsers.map((u) => (
                    <button
                      key={u.email}
                      type="button"
                      onClick={() => {
                        setOwnerEmail(u.email);
                        setOwnerName(u.name);
                        setNewTokenName(`Antigravity (${activeProject})`);
                      }}
                      className="rounded-md border border-slate-700 bg-slate-800/90 px-2.5 py-1 text-[11px] text-slate-200 hover:border-emerald-500/50 hover:text-emerald-300 cursor-pointer"
                    >
                      + {u.name} ({u.email})
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
                <div className="sm:col-span-3">
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                    <FolderKanban className="h-3.5 w-3.5" />
                    <span>ระบุโปรเจกต์ (กันพลาด) *</span>
                  </label>
                  <select
                    data-testid="mcp-token-project-select"
                    value={activeProject}
                    onChange={(e) => setSelectedProjectKey(e.target.value)}
                    className="h-9 w-full rounded-lg border border-amber-500/50 bg-slate-950 px-2.5 font-mono text-xs font-bold text-amber-300 focus:border-amber-400 focus:outline-none"
                  >
                    {availableProjects.map((p) => (
                      <option key={p.key} value={p.key}>
                        [{p.key}] {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-4">
                  <label className="mb-1 block text-[11px] font-semibold text-emerald-300">
                    อีเมล Gmail ที่ได้รับอนุญาต *
                  </label>
                  <input
                    type="email"
                    required
                    data-testid="mcp-token-gmail-input"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="กรอก Gmail ที่มีสิทธิ์..."
                    className="h-9 w-full rounded-lg border border-emerald-500/40 bg-slate-950 px-3 font-mono text-xs text-emerald-200 focus:border-emerald-400 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="mb-1 block text-[11px] font-semibold text-slate-300">
                    ชื่อเครื่อง / Agent (Antigravity) *
                  </label>
                  <input
                    type="text"
                    required
                    data-testid="mcp-token-name-input"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    placeholder="เช่น Antigravity"
                    className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2 flex items-end">
                  <button
                    type="submit"
                    data-testid="generate-mcp-token-btn"
                    disabled={isGeneratingToken}
                    className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white shadow hover:bg-emerald-500 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    {isGeneratingToken ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="h-3.5 w-3.5" />
                    )}
                    <span>สร้าง Token</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Newly Generated Raw Token Display Box */}
            {generatedRawToken && (
              <div
                data-testid="generated-token-banner"
                className="rounded-lg border border-emerald-400/60 bg-emerald-950/50 p-3 space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-emerald-300">
                    ✅ สร้าง MCP Token ล็อกเฉพาะโปรเจกต์{" "}
                    <code className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300 border border-amber-500/40">
                      [{generatedForProject}]
                    </code>{" "}
                    ผูกกับ Gmail{" "}
                    <code className="rounded bg-slate-950 px-1.5 py-0.5 text-white">
                      {generatedForEmail}
                    </code>{" "}
                    สำเร็จ!
                  </span>
                  <button
                    type="button"
                    data-testid="copy-generated-token-btn"
                    onClick={() => copyText("raw-token", generatedRawToken)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                  >
                    {copiedKey === "raw-token" ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> คัดลอกแล้ว
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> คัดลอก Token
                      </>
                    )}
                  </button>
                </div>
                <code
                  data-testid="generated-raw-token-value"
                  className="block w-full select-all rounded bg-slate-950 px-3 py-2 font-mono text-xs font-bold text-emerald-300 border border-emerald-500/30"
                >
                  {generatedRawToken}
                </code>
              </div>
            )}

            {/* Existing Tokens List */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                <span>รายการ MCP Token ที่ผูกกับโปรเจกต์และ Gmail ({tokens.length})</span>
                <span>โปรเจกต์ · รหัส User (Gmail) · จำนวนครั้งที่เรียกใช้</span>
              </div>

              {tokens.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 py-4 text-center text-xs text-slate-400">
                  ยังไม่มี MCP Token — เลือกโปรเจกต์และกรอกอีเมล Gmail แล้วกดปุ่ม{" "}
                  <strong>&ldquo;สร้าง Token&rdquo;</strong> ด้านบน
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 rounded-lg border border-slate-800 bg-slate-950/90">
                  {tokens.map((tok) => {
                    const roleCfg = ROLE_BADGE[tok.agentRole] || ROLE_BADGE.admin;
                    return (
                      <div
                        key={tok.id}
                        data-testid={`mcp-token-row-${tok.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span
                            data-testid={`token-project-${tok.id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-300"
                            title={`ล็อกเฉพาะโปรเจกต์: ${tok.projectKey}`}
                          >
                            📁 {tok.projectKey}
                          </span>
                          <span
                            data-testid={`token-gmail-${tok.id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300"
                            title={`รหัส User (Gmail): ${tok.ownerEmail}`}
                          >
                            📧 {tok.ownerEmail}
                          </span>
                          <span className="font-bold text-white truncate">{tok.name}</span>
                          <span
                            className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold ${roleCfg.className}`}
                          >
                            {roleCfg.label}
                          </span>
                          <code className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-slate-300 border border-slate-800">
                            {tok.maskedToken}
                          </code>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-slate-400">
                            เรียกใช้:{" "}
                            <strong
                              data-testid={`token-usage-${tok.id}`}
                              className="text-emerald-400 font-mono"
                            >
                              {tok.usageCount}
                            </strong>{" "}
                            ครั้ง
                            {tok.lastUsedAt && (
                              <span className="ml-1.5 text-slate-500">
                                (ล่าสุด{" "}
                                {new Date(tok.lastUsedAt).toLocaleTimeString("th-TH", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                )
                              </span>
                            )}
                          </span>

                          <button
                            type="button"
                            data-testid={`revoke-token-btn-${tok.id}`}
                            onClick={() => handleRevokeToken(tok.id)}
                            className="inline-flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                            title="ยกเลิก Token นี้"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>ยกเลิก</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Ready-to-Copy Prompt for Antigravity on a New Project / New Session */}
          <div
            data-testid="new-session-antigravity-prompt-section"
            className="rounded-xl border border-amber-500/35 bg-amber-950/20 p-4 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquareCode className="h-4 w-4 text-amber-400" />
                <div>
                  <h4 className="text-xs font-bold text-amber-300">
                    วิธีสั่ง Prompt ให้กับ Antigravity สำหรับโปรเจกต์ [{targetConfigProject}] (เมื่อเปิด Session ใหม่)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    คัดลอกข้อความด้านล่างไปวางในหน้าแชท Antigravity เมื่อเปิดโปรเจกต์ใหม่ เพื่อให้ดึงและแก้ไขงานถูกโปรเจกต์ 100%
                  </p>
                </div>
              </div>
              <button
                type="button"
                data-testid="copy-new-session-prompt-btn"
                onClick={() => copyText("new-session-prompt", newSessionAntigravityPrompt)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500 cursor-pointer"
              >
                {copiedKey === "new-session-prompt" ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> คัดลอก Prompt แล้ว
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> คัดลอก Prompt สั่ง Antigravity
                  </>
                )}
              </button>
            </div>
            <pre
              data-testid="new-session-antigravity-prompt"
              className="whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-amber-200 leading-relaxed"
            >
              {newSessionAntigravityPrompt}
            </pre>
          </div>

          {/* Live AI MCP Playground */}
          <div className="rounded-xl border border-cyan-500/35 bg-cyan-950/20 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-semibold text-cyan-200 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  <span>
                    สนามทดสอบ Antigravity MCP สด (โปรเจกต์ [{targetConfigProject}])
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  กดปุ่มด้านล่างเพื่อยิง JSON-RPC ไปยัง{" "}
                  <code>/api/mcp?project={targetConfigProject}</code> และดูผลลัพธ์จริงได้ทันที
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="mcp-test-context-btn"
                  disabled={isTestingMcp}
                  onClick={() =>
                    runLiveMcpToolCall("get_ai_context", {
                      projectKey: targetConfigProject,
                    })
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30 cursor-pointer"
                >
                  <Play className="h-3 w-3" /> 1. ดึงคิวงาน [{targetConfigProject}] (get_ai_context)
                </button>
                <button
                  type="button"
                  data-testid="mcp-test-converse-btn"
                  disabled={isTestingMcp}
                  onClick={() =>
                    runLiveMcpToolCall("list_issues", {
                      projectKey: targetConfigProject,
                    })
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-3 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/30 cursor-pointer"
                >
                  <Play className="h-3 w-3" /> 2. ดูรายการ Issue ใน [{targetConfigProject}]
                </button>
              </div>
            </div>

            {testOutput && (
              <pre
                data-testid="mcp-test-output"
                className="max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-emerald-300"
              >
                {testOutput}
              </pre>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold text-emerald-400">
                  1. เชื่อมต่อผ่าน HTTP + Project Header (แนะนำสำหรับ Antigravity)
                </span>
                <button
                  type="button"
                  onClick={() => copyText("http", mcpHttpConfig)}
                  className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 cursor-pointer"
                >
                  {copiedKey === "http" ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  คัดลอก
                </button>
              </div>
              <pre
                data-testid="mcp-http-config-box"
                className="overflow-x-auto rounded bg-slate-900 p-2.5 font-mono text-[11px] text-slate-200"
              >
                {mcpHttpConfig}
              </pre>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold text-cyan-400">
                  2. เชื่อมต่อผ่าน URL Query (?project={targetConfigProject}&token=...)
                </span>
                <button
                  type="button"
                  onClick={() => copyText("url-query", mcpUrlQueryConfig)}
                  className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 cursor-pointer"
                >
                  {copiedKey === "url-query" ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  คัดลอก
                </button>
              </div>
              <pre
                data-testid="mcp-url-query-config-box"
                className="overflow-x-auto rounded bg-slate-900 p-2.5 font-mono text-[11px] text-slate-200"
              >
                {mcpUrlQueryConfig}
              </pre>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5">
            <h4 className="mb-2 font-semibold text-white">
              รายการ MCP Tools สำหรับ Antigravity (ทุกรายการล็อกตามโปรเจกต์เพื่อกันพลาด):
            </h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                {
                  name: "get_ai_context",
                  desc: "ดึงคิวรอ Antigravity รีวิว และคิวรอแก้/Deploy เฉพาะโปรเจกต์ที่ระบุ",
                },
                {
                  name: "submit_claude_review",
                  desc: "Antigravity บันทึกผลวิเคราะห์: สั่งแก้ (ready_to_fix) หรือ ไม่แก้ (wont_fix)",
                },
                {
                  name: "claim_for_fix",
                  desc: "Antigravity รับงานเข้าสู่สถานะ กำลังแก้ (fixing)",
                },
                {
                  name: "mark_deployed",
                  desc: "Antigravity บันทึกผลหลังแก้และ Deploy ขึ้นเซิร์ฟเวอร์สำเร็จ (deployed)",
                },
                {
                  name: "converse_on_issue",
                  desc: "ให้ Antigravity พูดคุยตอบกลับ แนบไฟล์ ติ๊กงานย่อย และเปลี่ยนสถานะ",
                },
                {
                  name: "create_issue",
                  desc: "สร้างรายการปัญหาใหม่พร้อมแนบรูปภาพและไฟล์เข้า MinIO อัตโนมัติ",
                },
                {
                  name: "batch_create_issues",
                  desc: "สร้างหลาย Issues พร้อมกันจากการสแกนโค้ดหรือ Log",
                },
                {
                  name: "find_similar_issues",
                  desc: "ค้นหาเรื่องซ้ำซ้อนหรือใกล้เคียงก่อนตั้ง Issue ใหม่",
                },
                {
                  name: "manage_subtasks",
                  desc: "เพิ่ม/ติ๊กถูก Checklist งานย่อยตามลำดับข้อหรือชื่อเรื่อง",
                },
                {
                  name: "get_issue",
                  desc: "อ่านข้อมูลเชิงลึกของ Issue รูปภาพ ไฟล์แนบ และคำสั่งแก้",
                },
                {
                  name: "list_issues",
                  desc: "ค้นหาและกรอง Issue ตามโปรเจกต์ สถานะ และความสำคัญ",
                },
                {
                  name: "update_issue",
                  desc: "อัปเดตสถานะ ผลวิเคราะห์ คำสั่งแก้ หรือคำสั่ง Deploy",
                },
                {
                  name: "add_comment",
                  desc: "เพิ่มคอมเมนต์พร้อมแนบรูป/ไฟล์และอัปเดตสถานะ",
                },
                {
                  name: "get_monitor_summary",
                  desc: "ดึงสรุป KPI ของโปรเจกต์แบบเรียลไทม์",
                },
              ].map((t) => (
                <div
                  key={t.name}
                  className="flex items-center justify-between gap-2 rounded border border-slate-800/90 bg-slate-900/70 px-2.5 py-1.5"
                >
                  <code className="font-mono font-semibold text-emerald-400 shrink-0">
                    {t.name}
                  </code>
                  <span className="truncate text-[11px] text-slate-400">{t.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
