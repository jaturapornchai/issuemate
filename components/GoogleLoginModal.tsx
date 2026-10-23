"use client";

import React, { useState, useEffect } from "react";
import {
  KeyRound,
  Check,
  Copy,
  ShieldCheck,
  ExternalLink,
  LogOut,
  Loader2,
  UserPlus,
  Trash2,
  Crown,
  RotateCcw,
  FolderPlus,
  ArrowLeft,
  Users,
  Settings2,
  MessageCircleQuestion,
  ImagePlus,
  Activity,
  CircleAlert,
  CheckCircle2,
  ChevronDown,
  X,
  TriangleAlert,
  Globe,
} from "lucide-react";
import {
  type AuthUser,
  type AllowedUserRecord,
  type ProjectPermissionLevel,
  getUserProjectPermission,
} from "@/lib/permissions";
import type { ProjectRecord } from "@/lib/types";
import { APP_VERSION, DEPLOYED_AT_TH } from "@/lib/version";
import { Dialog, DialogHeader, Notice } from "@/components/ui/Dialog";
import { Avatar, PermissionBadge, PERMISSION_UI } from "@/components/ui/Badges";
import { LogoMark } from "@/components/ui/Logo";

export function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

type AllowedUserItem = AllowedUserRecord & { isSuperAdmin?: boolean };

const PERMISSION_OPTIONS: ProjectPermissionLevel[] = [
  "question_only",
  "reporter",
  "viewer",
  "developer",
  "project_admin",
];

function PermissionSelect({
  value,
  onChange,
  testId,
  className = "",
  ariaLabel,
}: {
  value: ProjectPermissionLevel;
  onChange: (v: ProjectPermissionLevel) => void;
  testId?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <select
      data-testid={testId}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value as ProjectPermissionLevel)}
      className={`select h-8 w-auto text-xs ${className}`}
    >
      {PERMISSION_OPTIONS.map((p) => (
        <option key={p} value={p}>
          {PERMISSION_UI[p].label}
        </option>
      ))}
    </select>
  );
}

function CopyField({
  value,
  copied,
  onCopy,
}: {
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line bg-black/30 py-1 pr-1 pl-3">
      <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-fg-muted">{value}</code>
      <button type="button" onClick={onCopy} className="btn btn-ghost btn-xs">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "คัดลอกแล้ว" : "คัดลอก"}
      </button>
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  subtitle,
  right,
  children,
  testId,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  testId?: string;
  tone?: "default" | "danger";
}) {
  return (
    <section
      data-testid={testId}
      className={`rounded-2xl border p-4 sm:p-5 ${
        tone === "danger" ? "border-rose-400/20 bg-rose-400/[0.03]" : "border-line bg-white/[0.02]"
      }`}
    >
      <div className={`flex flex-wrap items-start justify-between gap-3 ${children ? "mb-4" : ""}`}>
        <div className="flex min-w-0 items-start gap-2.5">
          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone === "danger" ? "text-rose-300" : "text-fg-subtle"}`} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-fg">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-fg-subtle">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function GoogleLoginModal({
  open,
  user,
  onClose,
  onUserUpdated,
  initialError,
  onOpenMcpTokens,
  onDataReset,
  variant = "modal",
}: {
  open: boolean;
  user: AuthUser | null;
  onClose: () => void;
  onUserUpdated: (user: AuthUser | null) => void;
  initialError?: string | null;
  onOpenMcpTokens?: () => void;
  onDataReset?: () => void;
  variant?: "modal" | "page";
}) {
  const [activeTab, setActiveTab] = useState<"login" | "guide">("login");
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [allowedDomain, setAllowedDomain] = useState("");
  const [callbackUrl, setCallbackUrl] = useState(
    "https://issue.dedezoom.com/api/auth/google/callback"
  );
  const [originUrl, setOriginUrl] = useState("https://issue.dedezoom.com");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Admin & Allowed Gmail Management State
  const [superAdminMasked, setSuperAdminMasked] = useState("a***n@example.com");
  const [allowedUsers, setAllowedUsers] = useState<AllowedUserItem[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [newGmail, setNewGmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"member" | "admin">("member");
  const [selectedMemberProjects, setSelectedMemberProjects] = useState<string[]>(["ALL"]);
  const [newDefaultPermission, setNewDefaultPermission] =
    useState<ProjectPermissionLevel>("reporter");
  const [newProjectPermissions, setNewProjectPermissions] = useState<
    Record<string, ProjectPermissionLevel>
  >({});

  // Admin Create Project State
  const [newProjKey, setNewProjKey] = useState("");
  const [newProjName, setNewProjName] = useState("");
  const [newProjDesc, setNewProjDesc] = useState("");
  const [newProjColor] = useState("#10b981");

  // Change Super Admin Email State
  const [newSuperAdminEmail, setNewSuperAdminEmail] = useState("");
  const [newSuperAdminName, setNewSuperAdminName] = useState("");

  const fetchAuthState = () => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setOauthConfigured(Boolean(d.oauthConfigured));
        if (d.clientId) setClientId(d.clientId);
        if (d.allowedDomain) setAllowedDomain(d.allowedDomain);
        if (d.callbackUrl) setCallbackUrl(d.callbackUrl);
        if (d.origin) setOriginUrl(d.origin);
        if (d.superAdminMasked) setSuperAdminMasked(d.superAdminMasked);
        if (Array.isArray(d.allowedUsers)) setAllowedUsers(d.allowedUsers);
        if (Array.isArray(d.projects)) setProjects(d.projects);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!open) return;
    setErrorMessage(null);
    setSaveMessage(null);
    setActiveTab("login");
    fetchAuthState();
  }, [open, user?.email]);

  if (!open) return null;

  const isAdminUser = Boolean(user?.isAdmin);

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const toggleNewMemberProject = (projKey: string) => {
    if (projKey === "ALL") {
      setSelectedMemberProjects(["ALL"]);
      return;
    }
    setSelectedMemberProjects((prev) => {
      const withoutAll = prev.filter((k) => k !== "ALL");
      if (withoutAll.includes(projKey)) {
        return withoutAll.filter((k) => k !== projKey);
      }
      return [...withoutAll, projKey];
    });
  };

  const handleToggleExistingUserProject = async (targetUser: AllowedUserItem, projKey: string) => {
    if (targetUser.email.includes("***")) return;
    const currentProjs = Array.isArray(targetUser.allowedProjects) ? targetUser.allowedProjects : ["ALL"];
    let nextProjs: string[];
    if (projKey === "ALL") {
      nextProjs = ["ALL"];
    } else if (currentProjs.includes("ALL")) {
      nextProjs = [projKey];
    } else if (currentProjs.includes(projKey)) {
      nextProjs = currentProjs.filter((k) => k !== projKey);
    } else {
      nextProjs = [...currentProjs, projKey];
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_allowed_user",
          email: targetUser.email,
          name: targetUser.name,
          role: targetUser.role,
          allowedProjects: nextProjs,
          defaultPermission: targetUser.defaultPermission || "reporter",
          projectPermissions: targetUser.projectPermissions || {},
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.allowedUsers)) {
        setAllowedUsers(data.allowedUsers);
        if (user?.email === targetUser.email) {
          const updatedSelf = data.allowedUsers.find((u: AllowedUserItem) => u.email === targetUser.email);
          if (updatedSelf) {
            onUserUpdated({
              ...user,
              allowedProjects: updatedSelf.allowedProjects || ["ALL"],
              defaultPermission: updatedSelf.defaultPermission || "reporter",
              projectPermissions: updatedSelf.projectPermissions || {},
            });
          }
        }
        setSaveMessage(`อัปเดตโปรเจกต์ของ ${targetUser.email} เป็น [${nextProjs.join(", ")}] เรียบร้อยแล้ว`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateExistingUserPermission = async (
    targetUser: AllowedUserItem,
    projectKeyOrDefault: string,
    permission: ProjectPermissionLevel
  ) => {
    if (targetUser.email.includes("***")) return;
    const nextDefault =
      projectKeyOrDefault === "DEFAULT" ? permission : targetUser.defaultPermission || "reporter";
    const nextProjectPerms = {
      ...(targetUser.projectPermissions || {}),
      ...(projectKeyOrDefault !== "DEFAULT" ? { [projectKeyOrDefault]: permission } : {}),
    };

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_allowed_user",
          email: targetUser.email,
          name: targetUser.name,
          role: targetUser.role,
          allowedProjects: targetUser.allowedProjects || ["ALL"],
          defaultPermission: nextDefault,
          projectPermissions: nextProjectPerms,
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.allowedUsers)) {
        setAllowedUsers(data.allowedUsers);
        if (user?.email === targetUser.email) {
          onUserUpdated({
            ...user,
            defaultPermission: nextDefault,
            projectPermissions: nextProjectPerms,
          });
        }
        setSaveMessage(
          `อัปเดตสิทธิ์ของ ${targetUser.email} (${
            projectKeyOrDefault === "DEFAULT" ? "สิทธิ์เริ่มต้น" : `โปรเจกต์ ${projectKeyOrDefault}`
          } → ${PERMISSION_UI[permission].shortLabel}) เรียบร้อยแล้ว`
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdminCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = newProjKey.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const cleanName = newProjName.trim();
    if (!cleanKey || !cleanName) {
      setErrorMessage("กรุณากรอกรหัสย่อและชื่อโปรเจกต์ให้ครบถ้วน");
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: cleanKey,
          name: cleanName,
          description: newProjDesc.trim(),
          color: newProjColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "สร้างโปรเจกต์ไม่สำเร็จ");
        return;
      }
      setNewProjKey("");
      setNewProjName("");
      setNewProjDesc("");
      setSaveMessage(`เพิ่มโปรเจกต์ ${data.project.key} — ${data.project.name} เรียบร้อยแล้ว`);
      fetchAuthState();
      onDataReset?.();
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdminDeleteProject = async (projKey: string) => {
    if (!window.confirm(`ยืนยันลบโปรเจกต์ ${projKey}? การลบย้อนกลับไม่ได้`)) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/projects?key=${encodeURIComponent(projKey)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSaveMessage(`ลบโปรเจกต์ ${projKey} เรียบร้อยแล้ว`);
        fetchAuthState();
        onDataReset?.();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || "ลบโปรเจกต์ไม่สำเร็จ");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveOAuthConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_oauth_config",
          clientId,
          clientSecret,
          allowedDomain,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setOauthConfigured(Boolean(data.configured));
        setClientSecret("");
        setSaveMessage("บันทึกค่า Google OAuth เรียบร้อย — ใช้ปุ่มเข้าสู่ระบบด้วย Google ได้ทันที");
      } else {
        setErrorMessage(data.error || "บันทึกค่า OAuth ไม่สำเร็จ");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAllowedGmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newGmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("กรุณากรอกอีเมล Gmail ให้ถูกต้อง เช่น user@gmail.com");
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    setSaveMessage(null);
    try {
      const effectiveProjects = newRole === "admin" ? ["ALL"] : selectedMemberProjects;
      const effectiveDefaultPerm: ProjectPermissionLevel =
        newRole === "admin" ? "project_admin" : newDefaultPermission;
      const effectiveProjectPerms: Record<string, ProjectPermissionLevel> =
        newRole === "admin"
          ? {}
          : selectedMemberProjects.includes("ALL")
            ? newProjectPermissions
            : Object.fromEntries(
                selectedMemberProjects.map((pk) => [pk, newProjectPermissions[pk] || newDefaultPermission])
              );
      const res = await fetch("/api/auth/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_allowed_user",
          email: cleanEmail,
          name: newName.trim() || cleanEmail.split("@")[0],
          role: newRole,
          allowedProjects: effectiveProjects,
          defaultPermission: effectiveDefaultPerm,
          projectPermissions: effectiveProjectPerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "ไม่สามารถเพิ่ม Gmail ได้");
        return;
      }
      if (Array.isArray(data.allowedUsers)) {
        setAllowedUsers(data.allowedUsers);
      }
      setNewGmail("");
      setNewName("");
      setNewRole("member");
      setSelectedMemberProjects(["ALL"]);
      setNewDefaultPermission("reporter");
      setNewProjectPermissions({});
      setSaveMessage(
        `เพิ่มสิทธิ์ให้ ${cleanEmail} (โปรเจกต์: ${effectiveProjects.join(", ")} · ${
          PERMISSION_UI[effectiveDefaultPerm].shortLabel
        }) เรียบร้อยแล้ว`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAllowedGmail = async (targetEmail: string) => {
    if (!window.confirm(`ยกเลิกสิทธิ์ของ ${targetEmail}? Token MCP ที่ผูกไว้จะถูกเพิกถอนด้วย`)) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_allowed_user",
          email: targetEmail,
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.allowedUsers)) {
        setAllowedUsers(data.allowedUsers);
        setSaveMessage(`ยกเลิกสิทธิ์ของ ${targetEmail} และเพิกถอน MCP Token ที่ผูกไว้เรียบร้อยแล้ว`);
      } else {
        setErrorMessage(data.error || "ลบสิทธิ์ไม่สำเร็จ");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNewAdmin = newSuperAdminEmail.trim().toLowerCase();
    if (!cleanNewAdmin || !cleanNewAdmin.includes("@")) {
      setErrorMessage("กรุณากรอกอีเมล Gmail ใหม่สำหรับ Super Admin ให้ถูกต้อง");
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_super_admin",
          newAdminEmail: cleanNewAdmin,
          newAdminName: newSuperAdminName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.superAdminMasked) setSuperAdminMasked(data.superAdminMasked);
        if (Array.isArray(data.allowedUsers)) setAllowedUsers(data.allowedUsers);
        setNewSuperAdminEmail("");
        setNewSuperAdminName("");
        setSaveMessage(`เปลี่ยนอีเมล Super Admin เป็น ${data.superAdminMasked || cleanNewAdmin} สำเร็จแล้ว`);
      } else {
        setErrorMessage(data.error || "เปลี่ยนอีเมล Super Admin ไม่สำเร็จ");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetAllIssues = async () => {
    if (!window.confirm("ยืนยันล้างข้อมูล Issues ทั้งหมดและไฟล์แนบ? ย้อนกลับไม่ได้")) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (res.ok) {
        setSaveMessage("ล้างข้อมูล Issues ทั้งหมดและรีเซ็ตเลขเริ่มต้นเป็น #1 เรียบร้อยแล้ว");
        onDataReset?.();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    onUserUpdated(null);
    onClose();
  };

  const messages = (
    <>
      {(initialError || errorMessage) && (
        <Notice tone="error" icon={<CircleAlert className="h-4 w-4 text-rose-300" />}>
          {errorMessage || initialError}
        </Notice>
      )}
      {saveMessage && (
        <Notice
          tone="success"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-300" />}
          onDismiss={() => setSaveMessage(null)}
        >
          {saveMessage}
        </Notice>
      )}
    </>
  );

  /* ---------------- Setup guide (shared by both variants) ---------------- */

  const guideContent = (
    <div className="space-y-5">
      <Panel
        testId="change-super-admin-section"
        icon={Crown}
        title="เปลี่ยนอีเมลผู้ดูแลระบบสูงสุด (Super Admin)"
        subtitle={`ปัจจุบัน: ${superAdminMasked}`}
      >
        <ol className="list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-fg-muted">
          <li>
            <strong className="font-medium text-fg">ผ่านไฟล์ .env.local บนเซิร์ฟเวอร์:</strong> แก้ค่า{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs text-emerald-300">
              SUPER_ADMIN_EMAIL=your-new-admin@gmail.com
            </code>{" "}
            แล้วรีสตาร์ทเซิร์ฟเวอร์
          </li>
          <li>
            <strong className="font-medium text-fg">ผ่านหน้าเว็บ (เมื่อเข้าสู่ระบบเป็น Admin):</strong>{" "}
            กรอกอีเมลใหม่ด้านล่าง ระบบจะบันทึกลงฐานข้อมูลทันที
          </li>
        </ol>

        {isAdminUser && (
          <form onSubmit={handleChangeSuperAdmin} className="mt-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-12">
            <div className="sm:col-span-5">
              <label className="field-label" htmlFor="new-super-admin">
                อีเมล Super Admin ใหม่ <span className="text-rose-300">*</span>
              </label>
              <input
                id="new-super-admin"
                type="email"
                required
                data-testid="change-super-admin-input"
                value={newSuperAdminEmail}
                onChange={(e) => setNewSuperAdminEmail(e.target.value)}
                placeholder="new-admin@gmail.com"
                className="input font-mono text-xs"
              />
            </div>
            <div className="sm:col-span-4">
              <label className="field-label" htmlFor="new-super-admin-name">
                ชื่อที่แสดง (ถ้ามี)
              </label>
              <input
                id="new-super-admin-name"
                type="text"
                value={newSuperAdminName}
                onChange={(e) => setNewSuperAdminName(e.target.value)}
                placeholder="เช่น Super Admin"
                className="input"
              />
            </div>
            <div className="sm:col-span-3">
              <button
                type="submit"
                data-testid="change-super-admin-btn"
                disabled={isSaving || !newSuperAdminEmail.trim()}
                className="btn btn-secondary w-full"
              >
                <Crown className="h-3.5 w-3.5 text-amber-300" />
                เปลี่ยน Admin
              </button>
            </div>
          </form>
        )}
      </Panel>

      <Panel icon={ShieldCheck} title="ตั้งค่า Login with Google (Google Cloud Console)" subtitle="ทำครั้งเดียวตอนติดตั้งระบบ">
        <ol className="space-y-3.5 text-[13px] leading-relaxed text-fg-muted">
          {[
            <>
              ไปที่{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-sky-300 underline-offset-2 hover:underline"
              >
                Google Cloud Console › APIs & Services › Credentials
                <ExternalLink className="h-3 w-3" />
              </a>
            </>,
            <>
              กด <strong className="font-medium text-fg">+ CREATE CREDENTIALS</strong> แล้วเลือก{" "}
              <strong className="font-medium text-fg">OAuth client ID</strong> (ถ้าระบบถาม Consent Screen ให้เลือก External
              และตั้งชื่อแอป <code className="font-mono text-xs">IssueMate</code>)
            </>,
            <>
              Application type เลือก <strong className="font-medium text-fg">Web application</strong>
            </>,
            <>
              <strong className="font-medium text-fg">Authorized JavaScript origins</strong> → กด ADD URI แล้ววางค่านี้
              <CopyField
                value="https://issue.dedezoom.com"
                copied={copiedKey === "origin"}
                onCopy={() => copyText("origin", "https://issue.dedezoom.com")}
              />
            </>,
            <>
              <strong className="font-medium text-fg">Authorized redirect URIs</strong> → กด ADD URI แล้ววางให้ตรงทุกตัวอักษร
              <CopyField
                value="https://issue.dedezoom.com/api/auth/google/callback"
                copied={copiedKey === "callback"}
                onCopy={() => copyText("callback", "https://issue.dedezoom.com/api/auth/google/callback")}
              />
              {originUrl.includes("localhost") && (
                <>
                  <span className="mt-2 block text-xs text-fg-subtle">สำหรับทดสอบในเครื่อง (Local)</span>
                  <CopyField
                    value={callbackUrl}
                    copied={copiedKey === "callback-local"}
                    onCopy={() => copyText("callback-local", callbackUrl)}
                  />
                </>
              )}
            </>,
            <>
              กด <strong className="font-medium text-fg">CREATE</strong> แล้วนำ Client ID และ Client Secret มาใส่ในฟอร์มด้านล่าง
            </>,
          ].map((content, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-semibold text-fg-muted">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">{content}</div>
            </li>
          ))}
        </ol>
      </Panel>

      {isAdminUser ? (
        <Panel
          icon={KeyRound}
          title="Google OAuth Credentials"
          subtitle="บันทึกลงฐานข้อมูลระบบทันที"
          right={
            <span
              className={`pill ${
                oauthConfigured
                  ? "bg-emerald-400/10 text-emerald-200 ring-emerald-400/25"
                  : "bg-amber-400/10 text-amber-200 ring-amber-400/25"
              }`}
            >
              {oauthConfigured ? "พร้อมใช้งาน" : "ยังไม่ได้ตั้งค่า"}
            </span>
          }
        >
          <form onSubmit={handleSaveOAuthConfig} className="space-y-3">
            <div>
              <label className="field-label" htmlFor="g-client-id">
                GOOGLE_CLIENT_ID <span className="text-rose-300">*</span>
              </label>
              <input
                id="g-client-id"
                type="text"
                required
                data-testid="google-client-id-input"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="1234567890-abcdefg.apps.googleusercontent.com"
                className="input font-mono text-xs"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="g-client-secret">
                  GOOGLE_CLIENT_SECRET
                </label>
                <input
                  id="g-client-secret"
                  type="password"
                  data-testid="google-client-secret-input"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={oauthConfigured ? "•••••••• (เว้นว่างได้ถ้าไม่เปลี่ยน)" : "GOCSPX-..."}
                  className="input font-mono text-xs"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="g-domain">
                  จำกัดโดเมนอีเมล (ไม่บังคับ)
                </label>
                <input
                  id="g-domain"
                  type="text"
                  value={allowedDomain}
                  onChange={(e) => setAllowedDomain(e.target.value)}
                  placeholder="เว้นว่าง = ใช้ตามรายชื่อที่อนุญาต"
                  className="input font-mono text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" data-testid="save-google-oauth-btn" disabled={isSaving} className="btn btn-primary btn-sm">
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                บันทึกค่า Google OAuth
              </button>
            </div>
          </form>
        </Panel>
      ) : (
        <Notice tone="neutral" icon={<KeyRound className="h-4 w-4" />}>
          การตั้งค่า Google OAuth ทำได้เฉพาะ Admin (หรือตั้ง env <code className="font-mono text-xs">GOOGLE_CLIENT_ID</code>{" "}
          / <code className="font-mono text-xs">GOOGLE_CLIENT_SECRET</code> บนเซิร์ฟเวอร์)
        </Notice>
      )}
    </div>
  );

  /* ---------------- Signed-out full page ---------------- */

  if (variant === "page") {
    return (
      <div className="relative flex min-h-dvh w-full justify-center overflow-y-auto bg-canvas px-4 py-10 sm:items-center">
        <div
          aria-hidden="true"
          className="pointer-events-none fixed -top-48 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/[0.09] blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 opacity-[0.35] [background-image:linear-gradient(rgb(255_255_255/0.035)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.035)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
        />

        <div
          data-testid="google-login-modal"
          className={`relative w-full animate-scale-in ${activeTab === "guide" ? "max-w-2xl" : "max-w-[420px]"}`}
        >
          {activeTab === "login" ? (
            <div className="card px-6 py-8 shadow-pop sm:px-8">
              <div className="flex flex-col items-center text-center">
                <LogoMark className="h-12 w-12" />
                <h1 className="mt-5 text-xl font-semibold tracking-tight text-fg">เข้าสู่ระบบ IssueMate</h1>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
                  แจ้งปัญหา ถามคำถาม และติดตามงานของทีมได้ในที่เดียว
                </p>
              </div>

              <div className="mt-6 space-y-3">{messages}</div>

              <a
                href="/api/auth/google"
                data-testid="google-oauth-redirect-btn"
                className="btn btn-white btn-lg mt-6 w-full"
              >
                <GoogleIcon className="h-5 w-5" />
                เข้าสู่ระบบด้วย Google
              </a>
              <p className="mt-3 text-center text-xs leading-relaxed text-fg-subtle">
                ใช้ได้เฉพาะ Gmail ที่ผู้ดูแลระบบ ({superAdminMasked}) อนุญาตไว้
              </p>

              <ul className="mt-7 space-y-2.5 border-t border-line pt-6 text-[13px] text-fg-muted">
                {[
                  { icon: MessageCircleQuestion, text: "พิมพ์หรือพูดเล่าปัญหาได้เหมือนคุยแชท" },
                  { icon: ImagePlus, text: "วางภาพหน้าจอ วาดชี้จุด และเบลอข้อมูลลับได้" },
                  { icon: Activity, text: "ติดตามสถานะได้ตลอด ตั้งแต่รับเรื่องจนแก้เสร็จ" },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                data-testid="google-tab-guide"
                onClick={() => setActiveTab("guide")}
                className="mt-6 flex w-full cursor-pointer items-center justify-center gap-1.5 text-xs text-fg-subtle transition hover:text-fg-muted"
              >
                <Settings2 className="h-3.5 w-3.5" />
                ผู้ดูแลระบบ: วิธีตั้งค่า Google OAuth
              </button>
            </div>
          ) : (
            <div className="card p-5 shadow-pop sm:p-6">
              <button
                type="button"
                data-testid="google-tab-login"
                onClick={() => setActiveTab("login")}
                className="btn btn-ghost btn-sm -ml-2 mb-4"
              >
                <ArrowLeft className="h-4 w-4" />
                กลับไปหน้าเข้าสู่ระบบ
              </button>
              <div className="mb-4 space-y-3">{messages}</div>
              {guideContent}
            </div>
          )}

          <p data-testid="login-modal-version-info" className="mt-6 text-center text-xs text-fg-subtle">
            IssueMate {APP_VERSION} · อัปเดตล่าสุด {DEPLOYED_AT_TH}
          </p>
        </div>
      </div>
    );
  }

  /* ---------------- Signed-in account dialog ---------------- */

  const myProjects =
    user && !isAdminUser
      ? projects.filter((p) => getUserProjectPermission(user, p.key) !== "none")
      : [];

  return (
    <Dialog onClose={onClose} size="xl" testId="google-login-modal" labelledBy="account-title">
      <DialogHeader
        titleId="account-title"
        icon={<Users className="h-4 w-4 text-fg-muted" />}
        title={isAdminUser ? "บัญชี สมาชิก และการตั้งค่า" : "บัญชีของฉัน"}
        subtitle={`ผู้ดูแลระบบสูงสุด: ${superAdminMasked}`}
        onClose={onClose}
        closeTestId="close-google-modal-btn"
        actions={
          <span
            data-testid="login-modal-version-info"
            className="hidden font-mono text-[11px] text-fg-subtle md:inline"
            title={`อัปเดตล่าสุด ${DEPLOYED_AT_TH}`}
          >
            {APP_VERSION}
          </span>
        }
      />

      {isAdminUser && (
        <div role="tablist" className="flex shrink-0 gap-1 border-b border-line px-5 sm:px-6">
          {(
            [
              { key: "login", testId: "google-tab-login", label: "บัญชีและสมาชิก", icon: Users },
              { key: "guide", testId: "google-tab-guide", label: "ตั้งค่าระบบ & Google OAuth", icon: Settings2 },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={t.testId}
                onClick={() => setActiveTab(t.key)}
                className={`relative inline-flex h-11 cursor-pointer items-center gap-2 px-3 text-[13px] transition ${
                  active ? "font-medium text-fg" : "text-fg-subtle hover:text-fg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-emerald-400" />}
              </button>
            );
          })}
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
        {messages}

        {activeTab === "guide" && isAdminUser ? (
          guideContent
        ) : (
          <>
            {/* Account card */}
            {user && (
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-gradient-to-br from-white/[0.04] to-transparent p-4 sm:p-5">
                <Avatar name={user.name} src={user.picture} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[15px] font-semibold text-fg">{user.name}</p>
                    {isAdminUser ? (
                      <span className="pill h-5 bg-amber-400/10 px-2 text-[11px] text-amber-200 ring-amber-400/25">
                        <Crown className="h-3 w-3" /> Admin
                      </span>
                    ) : (
                      <span className="pill h-5 bg-white/[0.05] px-2 text-[11px] text-fg-muted ring-line">สมาชิก</span>
                    )}
                  </div>
                  <p className="truncate font-mono text-xs text-fg-subtle">{user.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {onOpenMcpTokens && (
                    <button
                      type="button"
                      data-testid="open-mcp-tokens-from-google-btn"
                      onClick={onOpenMcpTokens}
                      className="btn btn-secondary btn-sm"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      MCP Token ของฉัน
                    </button>
                  )}
                  <button type="button" data-testid="logout-btn" onClick={handleLogout} className="btn btn-danger btn-sm">
                    <LogOut className="h-3.5 w-3.5" />
                    ออกจากระบบ
                  </button>
                </div>
              </div>
            )}

            {/* Member: my permissions per project */}
            {user && !isAdminUser && (
              <Panel icon={ShieldCheck} title="สิทธิ์ของคุณในแต่ละโปรเจกต์" subtitle="หากต้องการสิทธิ์เพิ่ม ติดต่อผู้ดูแลระบบ">
                {myProjects.length === 0 ? (
                  <p className="text-[13px] text-fg-subtle">ยังไม่มีโปรเจกต์ที่คุณเข้าถึงได้</p>
                ) : (
                  <div className="divide-y divide-line">
                    {myProjects.map((p) => {
                      const perm = getUserProjectPermission(user, p.key);
                      return (
                        <div key={p.key} className="flex items-center gap-3 py-2.5">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ backgroundColor: p.color }} />
                          <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{p.name}</span>
                          <span className="font-mono text-[11px] text-fg-subtle">{p.key}</span>
                          {perm !== "none" && <PermissionBadge permission={perm} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>
            )}

            {isAdminUser && (
              <>
                {/* Members */}
                <Panel
                  icon={Users}
                  title="สมาชิกที่เข้าใช้งานได้"
                  subtitle="เฉพาะ Gmail ในรายชื่อนี้เท่านั้นที่เข้าสู่ระบบได้ กำหนดสิทธิ์แยกตามโปรเจกต์ได้"
                  right={<span className="count">{allowedUsers.length}</span>}
                >
                  <form onSubmit={handleAddAllowedGmail} className="card-inset space-y-3 p-4">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
                      <UserPlus className="h-3.5 w-3.5" />
                      เพิ่มสมาชิกใหม่
                    </p>
                    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-12">
                      <div className="sm:col-span-5">
                        <label className="field-label" htmlFor="admin-add-gmail">
                          อีเมล Gmail <span className="text-rose-300">*</span>
                        </label>
                        <input
                          id="admin-add-gmail"
                          type="email"
                          required
                          data-testid="admin-add-gmail-input"
                          value={newGmail}
                          onChange={(e) => setNewGmail(e.target.value)}
                          placeholder="name@gmail.com"
                          className="input font-mono text-xs"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <label className="field-label" htmlFor="admin-add-name">
                          ชื่อ / ทีม
                        </label>
                        <input
                          id="admin-add-name"
                          type="text"
                          data-testid="admin-add-name-input"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="เช่น คุณสมศรี ฝ่ายบัญชี"
                          className="input"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="field-label" htmlFor="admin-add-role">
                          บทบาท
                        </label>
                        <select
                          id="admin-add-role"
                          data-testid="admin-add-role-select"
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value as "member" | "admin")}
                          className="select"
                        >
                          <option value="member">สมาชิก</option>
                          <option value="admin">Admin (ทุกโปรเจกต์)</option>
                        </select>
                      </div>
                    </div>

                    <div data-testid="admin-member-projects-selector" className="space-y-3 rounded-xl border border-line bg-black/20 p-3">
                      {newRole === "admin" ? (
                        <p className="flex items-center gap-2 text-xs text-amber-100/90">
                          <Crown className="h-3.5 w-3.5 text-amber-300" />
                          Admin เข้าถึงและจัดการได้ทุกโปรเจกต์โดยอัตโนมัติ
                        </p>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs text-fg-muted">สิทธิ์เริ่มต้น</span>
                            <PermissionSelect
                              testId="admin-member-default-permission-select"
                              value={newDefaultPermission}
                              onChange={setNewDefaultPermission}
                              ariaLabel="สิทธิ์เริ่มต้น"
                            />
                          </div>
                          <div>
                            <p className="mb-2 text-xs text-fg-muted">
                              โปรเจกต์ที่เข้าถึงได้{" "}
                              <span className="text-fg-subtle">(เลือกได้หลายโปรเจกต์)</span>
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                data-testid="toggle-member-project-ALL"
                                onClick={() => toggleNewMemberProject("ALL")}
                                aria-pressed={selectedMemberProjects.includes("ALL")}
                                className={`pill cursor-pointer transition ${
                                  selectedMemberProjects.includes("ALL")
                                    ? "bg-emerald-400/15 text-emerald-100 ring-emerald-400/40"
                                    : "bg-white/[0.03] text-fg-muted ring-line hover:ring-line-strong"
                                }`}
                              >
                                {selectedMemberProjects.includes("ALL") ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Globe className="h-3 w-3" />
                                )}
                                ทุกโปรเจกต์
                              </button>
                              {projects.map((p) => {
                                const isChecked =
                                  !selectedMemberProjects.includes("ALL") && selectedMemberProjects.includes(p.key);
                                return (
                                  <button
                                    key={p.key}
                                    type="button"
                                    data-testid={`toggle-member-project-${p.key}`}
                                    onClick={() => toggleNewMemberProject(p.key)}
                                    aria-pressed={isChecked}
                                    className={`pill cursor-pointer transition ${
                                      isChecked
                                        ? "bg-emerald-400/15 text-emerald-100 ring-emerald-400/40"
                                        : "bg-white/[0.03] text-fg-muted ring-line hover:ring-line-strong"
                                    }`}
                                  >
                                    {isChecked ? (
                                      <Check className="h-3 w-3" />
                                    ) : (
                                      <span className="h-2 w-2 rounded-[3px]" style={{ backgroundColor: p.color }} />
                                    )}
                                    <span className="font-mono">{p.key}</span>
                                    <span className="max-w-[140px] truncate text-fg-subtle">{p.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {!selectedMemberProjects.includes("ALL") && selectedMemberProjects.length > 0 && (
                            <div data-testid="admin-member-per-project-permissions" className="space-y-1.5 border-t border-line pt-3">
                              <p className="text-xs text-fg-muted">กำหนดสิทธิ์แยกตามโปรเจกต์</p>
                              {selectedMemberProjects.map((pk) => {
                                const projObj = projects.find((x) => x.key === pk);
                                return (
                                  <div key={pk} className="flex items-center justify-between gap-2">
                                    <span className="min-w-0 truncate text-xs text-fg">
                                      <span className="font-mono text-fg-muted">{pk}</span>{" "}
                                      <span className="text-fg-subtle">{projObj?.name || ""}</span>
                                    </span>
                                    <PermissionSelect
                                      testId={`admin-member-project-perm-${pk}`}
                                      value={newProjectPermissions[pk] || newDefaultPermission}
                                      onChange={(v) => setNewProjectPermissions((prev) => ({ ...prev, [pk]: v }))}
                                      ariaLabel={`สิทธิ์ในโปรเจกต์ ${pk}`}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        data-testid="admin-add-gmail-btn"
                        disabled={isSaving || !newGmail.trim()}
                        className="btn btn-primary btn-sm"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        เพิ่มสมาชิก
                      </button>
                    </div>
                  </form>

                  <div className="mt-4 space-y-2">
                    {allowedUsers.map((u, idx) => {
                      const isSuper = Boolean(u.isSuperAdmin);
                      const isCurrent = user?.email === u.email;
                      const isMasked = u.email.includes("***");
                      const userProjs = u.allowedProjects || ["ALL"];
                      const isFullAccess = u.role === "admin" || isSuper;
                      return (
                        <div
                          key={`${u.email}-${idx}`}
                          data-testid={`allowed-user-row-${u.email}`}
                          className={`rounded-xl border px-3.5 py-3 ${
                            isCurrent ? "border-emerald-400/25 bg-emerald-400/[0.04]" : "border-line bg-white/[0.015]"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            <Avatar name={u.name} size="md" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[13px] font-medium text-fg">{u.name}</span>
                                {isSuper ? (
                                  <span className="pill h-5 bg-amber-400/10 px-2 text-[11px] text-amber-200 ring-amber-400/25">
                                    <Crown className="h-3 w-3" /> Super Admin
                                  </span>
                                ) : u.role === "admin" ? (
                                  <span className="pill h-5 bg-violet-400/10 px-2 text-[11px] text-violet-200 ring-violet-400/25">
                                    Admin
                                  </span>
                                ) : null}
                                {isCurrent && <span className="text-[11px] text-emerald-300">(คุณ)</span>}
                              </div>
                              <p className="truncate font-mono text-xs text-fg-subtle">{u.email}</p>
                            </div>
                            {!isSuper && !isMasked && (
                              <button
                                type="button"
                                data-testid={`remove-allowed-gmail-${u.email}`}
                                disabled={isSaving}
                                onClick={() => handleRemoveAllowedGmail(u.email)}
                                className="btn btn-ghost btn-xs hover:!text-rose-300"
                                title="ยกเลิกสิทธิ์เข้าใช้งาน"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                ลบสิทธิ์
                              </button>
                            )}
                          </div>

                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-11">
                            {isFullAccess ? (
                              <span className="pill h-5 bg-white/[0.04] px-2 text-[11px] text-fg-muted ring-line">
                                <Globe className="h-3 w-3" /> ทุกโปรเจกต์ · จัดการได้ทั้งหมด
                              </span>
                            ) : userProjs.includes("ALL") ? (
                              <span
                                data-testid={`user-project-badge-${u.email}-ALL`}
                                className="pill h-5 bg-white/[0.04] px-2 text-[11px] text-fg-muted ring-line"
                              >
                                <Globe className="h-3 w-3" /> ทุกโปรเจกต์ ·{" "}
                                {PERMISSION_UI[u.defaultPermission || "reporter"].shortLabel}
                              </span>
                            ) : (
                              userProjs.map((pk) => {
                                const pkPerm = u.projectPermissions?.[pk] || u.defaultPermission || "reporter";
                                return (
                                  <span
                                    key={pk}
                                    data-testid={`user-project-badge-${u.email}-${pk}`}
                                    className="pill h-5 bg-white/[0.04] px-2 text-[11px] text-fg-muted ring-line"
                                  >
                                    <span className="font-mono text-fg">{pk}</span>
                                    <span className="text-fg-subtle">{PERMISSION_UI[pkPerm].shortLabel}</span>
                                  </span>
                                );
                              })
                            )}
                          </div>

                          {!isMasked && !isFullAccess && projects.length > 0 && (
                            <details className="group mt-2 pl-11">
                              <summary className="inline-flex cursor-pointer items-center gap-1 text-xs text-fg-subtle select-none hover:text-fg-muted">
                                แก้ไขสิทธิ์
                                <ChevronDown className="h-3 w-3 transition group-open:rotate-180" />
                              </summary>
                              <div className="mt-2.5 space-y-3 rounded-xl border border-line bg-black/20 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs text-fg-muted">สิทธิ์เริ่มต้น</span>
                                  <PermissionSelect
                                    testId={`row-default-perm-${u.email}`}
                                    value={u.defaultPermission || "reporter"}
                                    onChange={(v) => handleUpdateExistingUserPermission(u, "DEFAULT", v)}
                                    ariaLabel="สิทธิ์เริ่มต้น"
                                  />
                                </div>
                                <div>
                                  <p className="mb-1.5 text-xs text-fg-muted">โปรเจกต์ที่เข้าถึงได้</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleExistingUserProject(u, "ALL")}
                                      className={`pill h-6 cursor-pointer ${
                                        userProjs.includes("ALL")
                                          ? "bg-emerald-400/15 text-emerald-100 ring-emerald-400/40"
                                          : "bg-white/[0.03] text-fg-muted ring-line hover:ring-line-strong"
                                      }`}
                                      title="ให้สิทธิ์ทุกโปรเจกต์"
                                    >
                                      ทุกโปรเจกต์
                                    </button>
                                    {projects.map((p) => {
                                      const active = !userProjs.includes("ALL") && userProjs.includes(p.key);
                                      return (
                                        <button
                                          key={p.key}
                                          type="button"
                                          data-testid={`row-toggle-proj-${u.email}-${p.key}`}
                                          onClick={() => handleToggleExistingUserProject(u, p.key)}
                                          className={`pill h-6 cursor-pointer font-mono ${
                                            active
                                              ? "bg-emerald-400/15 text-emerald-100 ring-emerald-400/40"
                                              : "bg-white/[0.03] text-fg-muted ring-line hover:ring-line-strong"
                                          }`}
                                          title={`เปิด/ปิดสิทธิ์โปรเจกต์ ${p.key}`}
                                        >
                                          {active ? <Check className="h-3 w-3" /> : null}
                                          {p.key}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                {!userProjs.includes("ALL") && userProjs.length > 0 && (
                                  <div className="space-y-1.5">
                                    {userProjs.map((pk) => (
                                      <div key={pk} className="flex items-center justify-between gap-2">
                                        <span className="font-mono text-xs text-fg-muted">{pk}</span>
                                        <PermissionSelect
                                          testId={`row-proj-perm-${u.email}-${pk}`}
                                          value={u.projectPermissions?.[pk] || u.defaultPermission || "reporter"}
                                          onChange={(v) => handleUpdateExistingUserPermission(u, pk, v)}
                                          ariaLabel={`สิทธิ์ในโปรเจกต์ ${pk}`}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Panel>

                {/* Projects */}
                <Panel
                  testId="admin-project-manager-section"
                  icon={FolderPlus}
                  title="โปรเจกต์ในระบบ"
                  subtitle={
                    <>
                      เพิ่มได้ที่นี่หรือผ่าน MCP <code className="font-mono">create_project</code> (AI จะถามยืนยันกับผู้ใช้ก่อนสร้างเสมอ)
                    </>
                  }
                  right={<span className="count">{projects.length}</span>}
                >
                  <form
                    onSubmit={handleAdminCreateProject}
                    className="card-inset grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-12"
                  >
                    <div className="sm:col-span-2">
                      <label className="field-label" htmlFor="admin-proj-key">
                        รหัสย่อ <span className="text-rose-300">*</span>
                      </label>
                      <input
                        id="admin-proj-key"
                        type="text"
                        required
                        maxLength={10}
                        data-testid="admin-project-key-input"
                        value={newProjKey}
                        onChange={(e) => setNewProjKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                        placeholder="POS"
                        className="input font-mono uppercase"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="field-label" htmlFor="admin-proj-name">
                        ชื่อโปรเจกต์ <span className="text-rose-300">*</span>
                      </label>
                      <input
                        id="admin-proj-name"
                        type="text"
                        required
                        data-testid="admin-project-name-input"
                        value={newProjName}
                        onChange={(e) => setNewProjName(e.target.value)}
                        placeholder="ระบบขายหน้าร้าน"
                        className="input"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="field-label" htmlFor="admin-proj-desc">
                        คำอธิบาย
                      </label>
                      <input
                        id="admin-proj-desc"
                        type="text"
                        data-testid="admin-project-desc-input"
                        value={newProjDesc}
                        onChange={(e) => setNewProjDesc(e.target.value)}
                        placeholder="ไม่บังคับ"
                        className="input"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        data-testid="admin-create-project-btn"
                        disabled={isSaving || !newProjKey.trim() || !newProjName.trim()}
                        className="btn btn-primary w-full"
                      >
                        <FolderPlus className="h-3.5 w-3.5" />
                        เพิ่ม
                      </button>
                    </div>
                  </form>

                  {projects.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {projects.map((p) => (
                        <div
                          key={p.key}
                          data-testid={`admin-project-pill-${p.key}`}
                          className="pill h-7 bg-white/[0.03] pr-1 text-fg-muted ring-line"
                        >
                          <span className="h-2 w-2 rounded-[3px]" style={{ backgroundColor: p.color }} />
                          <span className="font-mono text-fg">{p.key}</span>
                          <span className="max-w-[160px] truncate">{p.name}</span>
                          <button
                            type="button"
                            data-testid={`admin-delete-project-${p.key}`}
                            onClick={() => handleAdminDeleteProject(p.key)}
                            className="ml-0.5 inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-fg-subtle transition hover:bg-rose-500/20 hover:text-rose-300"
                            title={`ลบโปรเจกต์ ${p.key}`}
                            aria-label={`ลบโปรเจกต์ ${p.key}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                {/* Danger zone */}
                <Panel
                  tone="danger"
                  icon={TriangleAlert}
                  title="พื้นที่อันตราย"
                  subtitle="ล้างข้อมูล Issues และไฟล์แนบทั้งหมด แล้วเริ่มเลขที่ใหม่ — ย้อนกลับไม่ได้"
                  right={
                    <button
                      type="button"
                      data-testid="reset-all-issues-btn"
                      disabled={isSaving}
                      onClick={handleResetAllIssues}
                      className="btn btn-danger btn-sm"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      ล้างข้อมูล Issues ทั้งหมด
                    </button>
                  }
                />
              </>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
