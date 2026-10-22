"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  KeyRound,
  Check,
  Copy,
  ShieldCheck,
  ExternalLink,
  LogOut,
  UserCheck,
  Loader2,
  BookOpen,
  UserPlus,
  Trash2,
  Crown,
  RotateCcw,
  FolderPlus,
  FolderKanban,
} from "lucide-react";
import {
  type AuthUser,
  type AllowedUserRecord,
  type ProjectPermissionLevel,
  PROJECT_PERMISSION_CONFIG,
} from "@/lib/permissions";
import type { ProjectRecord } from "@/lib/types";
import { APP_VERSION, DEPLOYED_AT_TH } from "@/lib/version";

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

export function GoogleLoginModal({
  open,
  user,
  onClose,
  onUserUpdated,
  initialError,
  onOpenMcpTokens,
  onDataReset,
}: {
  open: boolean;
  user: AuthUser | null;
  onClose: () => void;
  onUserUpdated: (user: AuthUser | null) => void;
  initialError?: string | null;
  onOpenMcpTokens?: () => void;
  onDataReset?: () => void;
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
  const [newProjColor, setNewProjColor] = useState("#10b981");

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

  const handleToggleExistingUserProject = async (
    targetUser: AllowedUserItem,
    projKey: string
  ) => {
    if (targetUser.email.includes("***")) return;
    const currentProjs = Array.isArray(targetUser.allowedProjects)
      ? targetUser.allowedProjects
      : ["ALL"];
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
          const updatedSelf = data.allowedUsers.find(
            (u: AllowedUserItem) => u.email === targetUser.email
          );
          if (updatedSelf) {
            onUserUpdated({
              ...user,
              allowedProjects: updatedSelf.allowedProjects || ["ALL"],
              defaultPermission: updatedSelf.defaultPermission || "reporter",
              projectPermissions: updatedSelf.projectPermissions || {},
            });
          }
        }
        setSaveMessage(
          `อัปเดตสิทธิ์โปรเจกต์ของ ${targetUser.email} เป็น [${nextProjs.join(", ")}] เรียบร้อยแล้ว`
        );
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
      projectKeyOrDefault === "DEFAULT"
        ? permission
        : targetUser.defaultPermission || "reporter";
    const nextProjectPerms = {
      ...(targetUser.projectPermissions || {}),
      ...(projectKeyOrDefault !== "DEFAULT"
        ? { [projectKeyOrDefault]: permission }
        : {}),
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
          `อัปเดตระดับสิทธิ์การใช้งานของ ${targetUser.email} (${
            projectKeyOrDefault === "DEFAULT"
              ? "สิทธิ์เริ่มต้น"
              : `โปรเจกต์ ${projectKeyOrDefault}`
          } -> ${PROJECT_PERMISSION_CONFIG[permission].shortLabel}) เรียบร้อยแล้ว`
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
      setErrorMessage("กรุณากรอกรหัสย่อโปรเจกต์และชื่อโปรเจกต์ให้ครบถ้วน");
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
      setSaveMessage(
        `เพิ่มโปรเจกต์ใหม่ [${data.project.key}] ${data.project.name} สำเร็จเรียบร้อยแล้ว`
      );
      fetchAuthState();
      onDataReset?.();
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdminDeleteProject = async (projKey: string) => {
    setIsSaving(true);
    setErrorMessage(null);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/projects?key=${encodeURIComponent(projKey)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSaveMessage(`ลบโปรเจกต์ [${projKey}] เรียบร้อยแล้ว`);
        fetchAuthState();
        onDataReset?.();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || "ล้างข้อมูลไม่สำเร็จ");
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
        setSaveMessage(
          "บันทึกค่า Google OAuth Client ID & Secret สำเร็จ! กดปุ่ม Sign in with Google ได้ทันที"
        );
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
      const effectiveProjects =
        newRole === "admin" ? ["ALL"] : selectedMemberProjects;
      const effectiveDefaultPerm: ProjectPermissionLevel =
        newRole === "admin" ? "project_admin" : newDefaultPermission;
      const effectiveProjectPerms: Record<string, ProjectPermissionLevel> =
        newRole === "admin"
          ? {}
          : selectedMemberProjects.includes("ALL")
          ? newProjectPermissions
          : Object.fromEntries(
              selectedMemberProjects.map((pk) => [
                pk,
                newProjectPermissions[pk] || newDefaultPermission,
              ])
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
        `บันทึกสิทธิ์ให้ ${cleanEmail} (โปรเจกต์: ${effectiveProjects.join(", ")} · สิทธิ์: ${
          PROJECT_PERMISSION_CONFIG[effectiveDefaultPerm].shortLabel
        }) สำเร็จแล้ว`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAllowedGmail = async (targetEmail: string) => {
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
        setSaveMessage(
          `ยกเลิกสิทธิ์ของ ${targetEmail} และเพิกถอน MCP Token ที่ผูกไว้เรียบร้อยแล้ว`
        );
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
        setSaveMessage(
          `เปลี่ยนอีเมล Super Admin เป็น ${data.superAdminMasked || cleanNewAdmin} สำเร็จแล้ว`
        );
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
        setSaveMessage(
          "ล้างข้อมูล Issues ทั้งหมดและรีเซ็ตเลขเริ่มต้นเป็น #1 เรียบร้อยแล้ว"
        );
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        data-testid="google-login-modal"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2.5 text-sm font-bold text-white">
            <GoogleIcon className="h-4 w-4" />
            <span>
              เข้าสู่ระบบด้วย Gmail & จัดการสิทธิ์ผู้ใช้งาน / โปรเจกต์ (Admin: {superAdminMasked})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              data-testid="login-modal-version-info"
              className="rounded-md border border-emerald-500/35 bg-emerald-950/40 px-2.5 py-1 font-mono text-[11px] font-semibold text-emerald-300"
            >
              {APP_VERSION} · Deploy ล่าสุด: {DEPLOYED_AT_TH}
            </span>
            <button
              type="button"
              data-testid="close-google-modal-btn"
              onClick={onClose}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950/70 px-5 py-2">
          <button
            type="button"
            data-testid="google-tab-login"
            onClick={() => setActiveTab("login")}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${
              activeTab === "login"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>จัดการสิทธิ์ Gmail (หลายโปรเจกต์) & เพิ่มโปรเจกต์</span>
          </button>
          <button
            type="button"
            data-testid="google-tab-guide"
            onClick={() => setActiveTab("guide")}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${
              activeTab === "guide"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>วิธีตั้งค่า Google OAuth & เปลี่ยนอีเมล Admin</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {(initialError || errorMessage) && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
              {errorMessage || initialError}
            </div>
          )}

          {saveMessage && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-200">
              {saveMessage}
            </div>
          )}

          {activeTab === "login" ? (
            <div className="space-y-4">
              {user ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/35 bg-emerald-950/20 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-300 border border-emerald-500/40">
                      {user.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white">{user.name}</p>
                        {user.isAdmin ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/40">
                            <Crown className="h-3 w-3" /> Admin
                          </span>
                        ) : (
                          <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300 border border-sky-500/40">
                            Member
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300">
                        รหัส User (Gmail):{" "}
                        <strong className="font-mono text-emerald-300">{user.email}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {onOpenMcpTokens && (
                      <button
                        type="button"
                        data-testid="open-mcp-tokens-from-google-btn"
                        onClick={onOpenMcpTokens}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500 cursor-pointer"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        <span>สร้าง MCP Token ผูก Gmail นี้</span>
                      </button>
                    )}
                    <button
                      type="button"
                      data-testid="logout-btn"
                      onClick={handleLogout}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>ออกจากระบบ</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {isAdminUser && (
              <>
              {/* 1. Admin Gmail Access Control Panel + Multi-Project Selector */}
              <div className="rounded-xl border border-amber-500/30 bg-slate-950/90 p-4 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-bold text-amber-300">
                      <Crown className="h-4 w-4 text-amber-400" />
                      <span>
                        จัดการรายชื่อ Gmail ที่ได้รับอนุญาตให้เข้าใช้งาน (Admin:{" "}
                        {superAdminMasked})
                      </span>
                    </h3>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      อีเมลจะถูกซ่อนบางส่วน (`***`) เพื่อความเป็นส่วนตัวเมื่อยังไม่ได้ล็อกอินเป็น Admin
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="reset-all-issues-btn"
                    disabled={isSaving}
                    onClick={handleResetAllIssues}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>ล้างข้อมูล Issues เริ่มใหม่</span>
                  </button>
                </div>

                {/* Add/Update Gmail Form with Multi-Project Selection */}
                <form
                  onSubmit={handleAddAllowedGmail}
                  className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-3"
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-end">
                    <div className="sm:col-span-5">
                      <label className="mb-1 block text-[11px] font-medium text-emerald-300">
                        เพิ่มอีเมล Gmail ที่อนุญาต *
                      </label>
                      <input
                        type="email"
                        required
                        data-testid="admin-add-gmail-input"
                        value={newGmail}
                        onChange={(e) => setNewGmail(e.target.value)}
                        placeholder="เช่น developer@gmail.com"
                        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="mb-1 block text-[11px] font-medium text-slate-300">
                        ชื่อผู้ใช้งาน / ทีม
                      </label>
                      <input
                        type="text"
                        data-testid="admin-add-name-input"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="เช่น ทีม DevOps"
                        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium text-slate-300">
                        ระดับสิทธิ์
                      </label>
                      <select
                        data-testid="admin-add-role-select"
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as "member" | "admin")}
                        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        data-testid="admin-add-gmail-btn"
                        disabled={isSaving || !newGmail.trim()}
                        className="inline-flex h-9 w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>เพิ่มสิทธิ์</span>
                      </button>
                    </div>
                  </div>

                  {/* Multi-Project Checkboxes / Pills for Member */}
                  <div
                    data-testid="admin-member-projects-selector"
                    className="rounded-lg border border-slate-800/90 bg-slate-950/80 p-2.5 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                      <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                        <FolderKanban className="h-3.5 w-3.5" />
                        <span>
                          เลือกสิทธิ์โปรเจกต์ของสมาชิก (คลิกเลือกได้หลายโปรเจกต์):
                        </span>
                      </span>
                      <span className="text-slate-400">
                        เลือกอยู่:{" "}
                        <strong className="font-mono text-emerald-300">
                          {newRole === "admin" || selectedMemberProjects.includes("ALL")
                            ? "ทุกโปรเจกต์ (ALL)"
                            : selectedMemberProjects.join(", ")}
                        </strong>
                      </span>
                    </div>

                    {newRole === "admin" ? (
                      <p className="text-[11px] text-amber-200/90">
                        👑 ระดับสิทธิ์ <strong>Admin</strong> สามารถเข้าถึงและจัดการได้ทุกโปรเจกต์โดยอัตโนมัติ
                      </p>
                    ) : (
                      <div className="space-y-2.5 pt-0.5">
                        {/* Default Permission Selector for Member */}
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2">
                          <label className="text-[11px] font-semibold text-emerald-300">
                            สิทธิ์การใช้งานเริ่มต้นในโปรเจกต์ที่ได้รับอนุญาต:
                          </label>
                          <select
                            data-testid="admin-member-default-permission-select"
                            value={newDefaultPermission}
                            onChange={(e) =>
                              setNewDefaultPermission(
                                e.target.value as ProjectPermissionLevel
                              )
                            }
                            className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2.5 text-xs font-semibold text-white focus:border-emerald-500 focus:outline-none"
                          >
                            <option value="question_only">
                              💬 ถามคำถามได้อย่างเดียว (ห้ามแจ้งปัญหา/บั๊ก)
                            </option>
                            <option value="reporter">
                              📝 แจ้งปัญหา & ตั้งคำถามได้ (ผู้ใช้ทั่วไป)
                            </option>
                            <option value="viewer">
                              👁️ ดูข้อมูลและอ่านคำตอบอย่างเดียว
                            </option>
                            <option value="developer">
                              🛠️ ทีมงานแก้ไข & ตอบคำถามพร้อมแนบไฟล์
                            </option>
                            <option value="project_admin">
                              👑 ผู้ดูแลประจำโปรเจกต์ (จัดการได้ครบ)
                            </option>
                          </select>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            data-testid="toggle-member-project-ALL"
                            onClick={() => toggleNewMemberProject("ALL")}
                            className={`inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[11px] font-semibold transition cursor-pointer ${
                              selectedMemberProjects.includes("ALL")
                                ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                                : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {selectedMemberProjects.includes("ALL") && (
                              <Check className="h-3 w-3 text-emerald-400" />
                            )}
                            <span>🌐 ทุกโปรเจกต์ (ALL)</span>
                          </button>

                          {projects.map((p) => {
                            const isChecked =
                              !selectedMemberProjects.includes("ALL") &&
                              selectedMemberProjects.includes(p.key);
                            return (
                              <button
                                key={p.key}
                                type="button"
                                data-testid={`toggle-member-project-${p.key}`}
                                onClick={() => toggleNewMemberProject(p.key)}
                                className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition cursor-pointer ${
                                  isChecked
                                    ? "border-amber-400 bg-amber-500/20 text-amber-200"
                                    : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600"
                                }`}
                              >
                                {isChecked ? (
                                  <Check className="h-3 w-3 text-amber-300" />
                                ) : (
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: p.color }}
                                  />
                                )}
                                <span className="font-mono font-bold">[{p.key}]</span>
                                <span className="truncate max-w-[140px]">{p.name}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Per-project permission overrides when specific projects are selected */}
                        {!selectedMemberProjects.includes("ALL") &&
                          selectedMemberProjects.length > 0 && (
                            <div
                              data-testid="admin-member-per-project-permissions"
                              className="rounded-lg border border-amber-500/30 bg-amber-950/15 p-2.5 space-y-1.5"
                            >
                              <p className="text-[11px] font-semibold text-amber-200">
                                กำหนดสิทธิ์แยกตามโปรเจกต์ที่เลือก (เช่น โปรเจกต์นี้ให้ถามได้อย่างเดียว):
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {selectedMemberProjects.map((pk) => {
                                  const projObj = projects.find((x) => x.key === pk);
                                  const currentPerm =
                                    newProjectPermissions[pk] || newDefaultPermission;
                                  return (
                                    <div
                                      key={pk}
                                      className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950/90 px-2.5 py-1.5"
                                    >
                                      <span className="truncate font-mono text-[11px] font-bold text-amber-300">
                                        [{pk}] {projObj?.name || pk}
                                      </span>
                                      <select
                                        data-testid={`admin-member-project-perm-${pk}`}
                                        value={currentPerm}
                                        onChange={(e) =>
                                          setNewProjectPermissions((prev) => ({
                                            ...prev,
                                            [pk]: e.target
                                              .value as ProjectPermissionLevel,
                                          }))
                                        }
                                        className="h-7 rounded border border-slate-700 bg-slate-900 px-2 text-[11px] text-white focus:border-emerald-500 focus:outline-none"
                                      >
                                        <option value="question_only">
                                          ถามคำถามได้อย่างเดียว
                                        </option>
                                        <option value="reporter">
                                          แจ้งปัญหา & ถามคำถามได้
                                        </option>
                                        <option value="viewer">
                                          ดูอย่างเดียว
                                        </option>
                                        <option value="developer">
                                          แก้ไข & ตอบคำถามได้
                                        </option>
                                        <option value="project_admin">
                                          ดูแลโปรเจกต์ครบวงจร
                                        </option>
                                      </select>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                </form>

                {/* Allowed Gmails Table */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                    <span>รายชื่อผู้มีสิทธิ์เข้าใช้งาน ({allowedUsers.length})</span>
                    <span>แสดงสิทธิ์โปรเจกต์ของแต่ละ Gmail</span>
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                    {allowedUsers.map((u, idx) => {
                      const isSuper = Boolean(u.isSuperAdmin);
                      const isCurrent = user?.email === u.email;
                      const isMasked = u.email.includes("***");
                      const userProjs = u.allowedProjects || ["ALL"];
                      return (
                        <div
                          key={`${u.email}-${idx}`}
                          data-testid={`allowed-user-row-${u.email}`}
                          className={`rounded-lg border px-3 py-2 text-xs space-y-1.5 ${
                            isCurrent
                              ? "border-emerald-500/40 bg-emerald-950/20"
                              : "border-slate-800 bg-slate-900/90"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                              <span
                                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold border ${
                                  isSuper
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                    : u.role === "admin"
                                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                    : "bg-sky-500/20 text-sky-300 border-sky-500/40"
                                }`}
                              >
                                {isSuper
                                  ? "👑 Super Admin"
                                  : u.role === "admin"
                                  ? "Admin"
                                  : "Member"}
                              </span>
                              <span className="font-mono font-bold text-emerald-300">
                                {u.email}
                              </span>
                              <span className="text-slate-300">({u.name})</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {!isSuper && isAdminUser && !isMasked && (
                                <button
                                  type="button"
                                  data-testid={`remove-allowed-gmail-${u.email}`}
                                  disabled={isSaving}
                                  onClick={() => handleRemoveAllowedGmail(u.email)}
                                  className="inline-flex h-7 items-center gap-1 rounded border border-rose-500/35 bg-rose-500/10 px-2 text-[11px] font-medium text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  <span>ลบสิทธิ์</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Project Permissions Row for this User */}
                          <div className="space-y-1.5 pt-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] text-slate-400">
                                สิทธิ์โปรเจกต์:
                              </span>
                              {u.role === "admin" || isSuper ? (
                                <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                                  🌐 ทุกโปรเจกต์ (ผู้ดูแลครบวงจร)
                                </span>
                              ) : (
                                <>
                                  {userProjs.includes("ALL") ? (
                                    <span
                                      data-testid={`user-project-badge-${u.email}-ALL`}
                                      className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300"
                                    >
                                      🌐 ทุกโปรเจกต์ (ALL)
                                    </span>
                                  ) : (
                                    userProjs.map((pk) => {
                                      const pkPerm =
                                        u.projectPermissions?.[pk] ||
                                        u.defaultPermission ||
                                        "reporter";
                                      return (
                                        <span
                                          key={pk}
                                          data-testid={`user-project-badge-${u.email}-${pk}`}
                                          className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300"
                                        >
                                          <span>📁 {pk}</span>
                                          <span className="text-[9px] font-normal text-amber-200">
                                            ({PROJECT_PERMISSION_CONFIG[pkPerm].shortLabel})
                                          </span>
                                        </span>
                                      );
                                    })
                                  )}

                                  {/* Interactive toggle buttons for Admin to adjust existing member's projects */}
                                  {!isMasked && projects.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1 ml-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleToggleExistingUserProject(u, "ALL")
                                        }
                                        className={`rounded px-1.5 py-0.5 text-[10px] border cursor-pointer ${
                                          userProjs.includes("ALL")
                                            ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-200"
                                            : "border-slate-700 bg-slate-950 text-slate-400 hover:text-white"
                                        }`}
                                        title="คลิกเพื่อให้สิทธิ์ทุกโปรเจกต์"
                                      >
                                        ALL
                                      </button>
                                      {projects.map((p) => {
                                        const active =
                                          !userProjs.includes("ALL") &&
                                          userProjs.includes(p.key);
                                        return (
                                          <button
                                            key={p.key}
                                            type="button"
                                            data-testid={`row-toggle-proj-${u.email}-${p.key}`}
                                            onClick={() =>
                                              handleToggleExistingUserProject(u, p.key)
                                            }
                                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] border cursor-pointer ${
                                              active
                                                ? "border-amber-400/60 bg-amber-500/25 text-amber-200 font-bold"
                                                : "border-slate-700 bg-slate-950 text-slate-400 hover:text-white"
                                            }`}
                                            title={`คลิกเพื่อเปิด/ปิดสิทธิ์โปรเจกต์ ${p.key}`}
                                          >
                                            {active ? `✓ ${p.key}` : `+ ${p.key}`}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Granular Permission Controls per user & per project */}
                            {!isMasked && u.role !== "admin" && !isSuper && (
                              <div className="flex flex-wrap items-center gap-2 rounded border border-slate-800/80 bg-slate-950/70 px-2.5 py-1.5 text-[11px]">
                                <span className="text-slate-400">
                                  ระดับสิทธิ์การใช้งาน:
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400">
                                    เริ่มต้น:
                                  </span>
                                  <select
                                    data-testid={`row-default-perm-${u.email}`}
                                    value={u.defaultPermission || "reporter"}
                                    onChange={(e) =>
                                      handleUpdateExistingUserPermission(
                                        u,
                                        "DEFAULT",
                                        e.target.value as ProjectPermissionLevel
                                      )
                                    }
                                    className="h-6 rounded border border-slate-700 bg-slate-900 px-1.5 text-[10px] text-emerald-300 focus:border-emerald-500 focus:outline-none"
                                  >
                                    <option value="question_only">
                                      ถามคำถามได้อย่างเดียว
                                    </option>
                                    <option value="reporter">
                                      แจ้งปัญหา & ถามคำถามได้
                                    </option>
                                    <option value="viewer">ดูอย่างเดียว</option>
                                    <option value="developer">
                                      แก้ไข & ตอบคำถามได้
                                    </option>
                                    <option value="project_admin">
                                      ดูแลโปรเจกต์ครบวงจร
                                    </option>
                                  </select>
                                </div>

                                {!userProjs.includes("ALL") &&
                                  userProjs.map((pk) => {
                                    const currentPkPerm =
                                      u.projectPermissions?.[pk] ||
                                      u.defaultPermission ||
                                      "reporter";
                                    return (
                                      <div
                                        key={pk}
                                        className="flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5"
                                      >
                                        <span className="font-mono text-[10px] font-bold text-amber-300">
                                          {pk}:
                                        </span>
                                        <select
                                          data-testid={`row-proj-perm-${u.email}-${pk}`}
                                          value={currentPkPerm}
                                          onChange={(e) =>
                                            handleUpdateExistingUserPermission(
                                              u,
                                              pk,
                                              e.target.value as ProjectPermissionLevel
                                            )
                                          }
                                          className="h-5 rounded bg-slate-950 px-1 text-[10px] text-white focus:outline-none"
                                        >
                                          <option value="question_only">
                                            ถามคำถามได้อย่างเดียว
                                          </option>
                                          <option value="reporter">
                                            แจ้งปัญหา & ถามคำถามได้
                                          </option>
                                          <option value="viewer">
                                            ดูอย่างเดียว
                                          </option>
                                          <option value="developer">
                                            แก้ไข & ตอบคำถามได้
                                          </option>
                                          <option value="project_admin">
                                            ดูแลโปรเจกต์ครบวงจร
                                          </option>
                                        </select>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 2. Admin Project Manager Section (Create Project via Admin UI + MCP Info) */}
              <div
                data-testid="admin-project-manager-section"
                className="rounded-xl border border-emerald-500/30 bg-slate-950/90 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                      <FolderPlus className="h-4 w-4 text-emerald-400" />
                      <span>
                        จัดการและเพิ่มโปรเจกต์ใหม่ (เพิ่มได้ทั้งในหน้าจอ Admin นี้ และผ่าน MCP{" "}
                        <code className="text-amber-300">create_project</code>)
                      </span>
                    </h3>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      เมื่อสั่งสร้างโปรเจกต์ผ่าน MCP ระบบจะบังคับให้ Antigravity ถามรหัสย่อ ชื่อ และคำอธิบายเพื่อยืนยันกับผู้ใช้งานก่อนสร้างจริงเสมอ
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={handleAdminCreateProject}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-end rounded-lg border border-slate-800 bg-slate-900/70 p-3"
                >
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[11px] font-medium text-emerald-300">
                      รหัสย่อ *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      data-testid="admin-project-key-input"
                      value={newProjKey}
                      onChange={(e) =>
                        setNewProjKey(
                          e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                        )
                      }
                      placeholder="เช่น POS"
                      className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 font-mono text-xs uppercase text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="mb-1 block text-[11px] font-medium text-slate-300">
                      ชื่อโปรเจกต์ / ระบบงาน *
                    </label>
                    <input
                      type="text"
                      required
                      data-testid="admin-project-name-input"
                      value={newProjName}
                      onChange={(e) => setNewProjName(e.target.value)}
                      placeholder="เช่น ระบบขายหน้าร้าน POS"
                      className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="mb-1 block text-[11px] font-medium text-slate-300">
                      คำอธิบายโปรเจกต์
                    </label>
                    <input
                      type="text"
                      data-testid="admin-project-desc-input"
                      value={newProjDesc}
                      onChange={(e) => setNewProjDesc(e.target.value)}
                      placeholder="รายละเอียดระบบงาน..."
                      className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      data-testid="admin-create-project-btn"
                      disabled={isSaving || !newProjKey.trim() || !newProjName.trim()}
                      className="inline-flex h-9 w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                      <span>เพิ่มโปรเจกต์</span>
                    </button>
                  </div>
                </form>

                {/* Existing Projects List in Admin Modal */}
                {projects.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-400 mr-1">
                      โปรเจกต์ในระบบ ({projects.length}):
                    </span>
                    {projects.map((p) => (
                      <div
                        key={p.key}
                        data-testid={`admin-project-pill-${p.key}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="font-mono font-bold text-amber-300">
                          [{p.key}]
                        </span>
                        <span className="text-slate-200">{p.name}</span>
                        {isAdminUser && (
                          <button
                            type="button"
                            data-testid={`admin-delete-project-${p.key}`}
                            onClick={() => handleAdminDeleteProject(p.key)}
                            className="ml-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                            title={`ลบโปรเจกต์ ${p.key}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              </>
              )}

              {/* Official Google OAuth Redirect Button */}
              {!user && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 text-center space-y-2.5">
                <div className="flex items-center justify-center gap-2">
                  <GoogleIcon className="h-5 w-5" />
                  <h3 className="text-xs font-bold text-white">
                    เข้าสู่ระบบผ่านหน้า Google OAuth 2.0 (`accounts.google.com`)
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400">
                  ระบบจะตรวจสอบว่า Gmail ที่ใช้ล็อกอินอยู่ในรายชื่อที่ Admin ({superAdminMasked})
                  อนุญาตหรือไม่
                </p>

                <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                  <a
                    href="/api/auth/google"
                    data-testid="google-oauth-redirect-btn"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-4 text-xs font-bold text-slate-900 shadow hover:bg-slate-100 transition"
                  >
                    <GoogleIcon className="h-4 w-4" />
                    <span>Sign in with Google</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setActiveTab("guide")}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 text-xs font-semibold text-sky-300 hover:bg-sky-500/25"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>
                      {oauthConfigured
                        ? "ตั้งค่า OAuth / เปลี่ยนอีเมล Admin"
                        : "ตั้งค่า Client ID / เปลี่ยนอีเมล Admin"}
                    </span>
                  </button>
                </div>
              </div>
              )}
            </div>
          ) : (
            /* Step-by-step Guide + Change Super Admin Email + Live OAuth Config Form */
            <div className="space-y-4 text-xs">
              {/* How to Change Super Admin Email Section */}
              <div
                data-testid="change-super-admin-section"
                className="rounded-xl border border-amber-500/35 bg-amber-950/20 p-4 space-y-3"
              >
                <h3 className="flex items-center gap-2 text-sm font-bold text-amber-300">
                  <Crown className="h-4 w-4" />
                  <span>วิธีเปลี่ยนอีเมลผู้ดูแลระบบสูงสุด (Super Admin Email)</span>
                </h3>
                <div className="space-y-1.5 text-slate-200 leading-relaxed">
                  <p>
                    <strong>วิธีที่ 1 (ผ่านไฟล์ `.env.local` บนเซิร์ฟเวอร์):</strong> แก้ไขค่า{" "}
                    <code className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-emerald-300">
                      SUPER_ADMIN_EMAIL=your-new-admin@gmail.com
                    </code>{" "}
                    ในไฟล์ <code>.env.local</code> แล้วรีสตาร์ทเซิร์ฟเวอร์
                  </p>
                  <p>
                    <strong>วิธีที่ 2 (เปลี่ยนผ่านหน้าเว็บทันทีเมื่อล็อกอินเป็น Admin):</strong>{" "}
                    กรอกอีเมล Gmail ใหม่ด้านล่างเพื่อบันทึกลงฐานข้อมูล MongoDB ทันที
                  </p>
                </div>

                {isAdminUser && (
                  <form
                    onSubmit={handleChangeSuperAdmin}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-end rounded-lg border border-amber-500/30 bg-slate-950/80 p-3"
                  >
                    <div className="sm:col-span-5">
                      <label className="mb-1 block text-[11px] font-medium text-amber-300">
                        อีเมล Super Admin ใหม่ *
                      </label>
                      <input
                        type="email"
                        required
                        data-testid="change-super-admin-input"
                        value={newSuperAdminEmail}
                        onChange={(e) => setNewSuperAdminEmail(e.target.value)}
                        placeholder="เช่น new-admin@gmail.com"
                        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 font-mono text-xs text-white focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="mb-1 block text-[11px] font-medium text-slate-300">
                        ชื่อที่แสดงผล (ถ้ามี)
                      </label>
                      <input
                        type="text"
                        value={newSuperAdminName}
                        onChange={(e) => setNewSuperAdminName(e.target.value)}
                        placeholder="เช่น Super Admin"
                        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-white focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <button
                        type="submit"
                        data-testid="change-super-admin-btn"
                        disabled={isSaving || !newSuperAdminEmail.trim()}
                        className="inline-flex h-9 w-full items-center justify-center gap-1 rounded-lg bg-amber-600 px-3 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50 cursor-pointer"
                      >
                        <Crown className="h-3.5 w-3.5" />
                        <span>เปลี่ยน Admin</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-4 space-y-2.5">
                <h3 className="flex items-center gap-2 text-sm font-bold text-sky-300">
                  <ShieldCheck className="h-4 w-4" />
                  <span>วิธีทำ Login by Google (Google Cloud Console OAuth 2.0) ทีละขั้นตอน</span>
                </h3>
                <ol className="list-decimal pl-5 space-y-2 text-slate-200 leading-relaxed">
                  <li>
                    ไปที่หน้า{" "}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-sky-400 underline hover:text-sky-300"
                    >
                      Google Cloud Console &gt; APIs &amp; Services &gt; Credentials
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                  <li>
                    คลิกปุ่ม <strong>+ CREATE CREDENTIALS</strong> ด้านบน แล้วเลือก{" "}
                    <strong>OAuth client ID</strong> (หากระบบถาม Consent Screen ให้เลือก External
                    และกรอกชื่อแอป <code>IssueMate DevOps</code>)
                  </li>
                  <li>
                    ช่อง <strong>Application type</strong> เลือกเป็น{" "}
                    <strong>Web application</strong>
                  </li>
                  <li>
                    ในหัวข้อ <strong>Authorized JavaScript origins</strong> กด ADD URI แล้ววางค่านี้:
                    <div className="mt-1 flex items-center justify-between rounded border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-[11px] text-emerald-300">
                      <span>https://issue.dedezoom.com</span>
                      <button
                        type="button"
                        onClick={() => copyText("origin", "https://issue.dedezoom.com")}
                        className="inline-flex items-center gap-1 text-slate-300 hover:text-white"
                      >
                        {copiedKey === "origin" ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span>{copiedKey === "origin" ? "คัดลอกแล้ว" : "คัดลอก"}</span>
                      </button>
                    </div>
                  </li>
                  <li>
                    ในหัวข้อ <strong>Authorized redirect URIs</strong> กด ADD URI แล้ววาง Callback
                    URL นี้ให้ตรงทุกตัวอักษร:
                    <div className="mt-1 flex items-center justify-between rounded border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-[11px] text-amber-300">
                      <span>https://issue.dedezoom.com/api/auth/google/callback</span>
                      <button
                        type="button"
                        onClick={() =>
                          copyText(
                            "callback",
                            "https://issue.dedezoom.com/api/auth/google/callback"
                          )
                        }
                        className="inline-flex items-center gap-1 text-slate-300 hover:text-white"
                      >
                        {copiedKey === "callback" ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span>{copiedKey === "callback" ? "คัดลอกแล้ว" : "คัดลอก"}</span>
                      </button>
                    </div>
                    {originUrl.includes("localhost") && (
                      <div className="mt-1 flex items-center justify-between rounded border border-slate-800 bg-slate-950/70 px-3 py-1 font-mono text-[11px] text-slate-400">
                        <span>{callbackUrl} (สำหรับทดสอบ Local)</span>
                        <button
                          type="button"
                          onClick={() => copyText("callback-local", callbackUrl)}
                          className="inline-flex items-center gap-1 text-slate-300 hover:text-white"
                        >
                          <Copy className="h-3 w-3" />
                          <span>คัดลอก</span>
                        </button>
                      </div>
                    )}
                  </li>
                  <li>
                    กดปุ่ม <strong>CREATE</strong> จากนั้นนำ <strong>Client ID</strong> และ{" "}
                    <strong>Client Secret</strong> ที่ได้ มาวางในฟอร์มด้านล่างนี้แล้วกดบันทึกได้ทันที
                  </li>
                </ol>
              </div>

              {isAdminUser ? (
              <form
                onSubmit={handleSaveOAuthConfig}
                className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">
                    ตั้งค่า Google OAuth Credentials (บันทึกลงฐานข้อมูลระบบทันที)
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                      oauthConfigured
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    }`}
                  >
                    {oauthConfigured ? "ตั้งค่าพร้อมใช้งานแล้ว" : "ยังไม่ได้ใส่ Client ID"}
                  </span>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                    GOOGLE_CLIENT_ID *
                  </label>
                  <input
                    type="text"
                    required
                    data-testid="google-client-id-input"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="เช่น 1234567890-abcdefg.apps.googleusercontent.com"
                    className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-300">
                      GOOGLE_CLIENT_SECRET *
                    </label>
                    <input
                      type="password"
                      data-testid="google-client-secret-input"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder={
                        oauthConfigured
                          ? "•••••••• (เว้นว่างได้หากไม่เปลี่ยน)"
                          : "เช่น GOCSPX-..."
                      }
                      className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-300">
                      จำกัดโดเมนอีเมลเพิ่มเติม (เว้นว่าง = ใช้ตามรายชื่อที่ Admin อนุญาต)
                    </label>
                    <input
                      type="text"
                      value={allowedDomain}
                      onChange={(e) => setAllowedDomain(e.target.value)}
                      placeholder="เช่น gmail.com"
                      className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="submit"
                    data-testid="save-google-oauth-btn"
                    disabled={isSaving}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>บันทึกค่า Google OAuth</span>
                  </button>
                </div>
              </form>
              ) : (
                <p className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 text-[11px] text-slate-400">
                  ตั้งค่า Google OAuth ได้เฉพาะ Admin (หรือตั้ง env GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET บนเซิร์ฟเวอร์)
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
