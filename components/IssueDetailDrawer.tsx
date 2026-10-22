"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Send,
  Paperclip,
  Trash2,
  Sparkles,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Wrench,
  Rocket,
  XCircle,
  Bot,
  GitBranch,
  ListChecks,
  Smartphone,
} from "lucide-react";
import {
  IssueRecord,
  IssueStatus,
  IssuePriority,
  IssueType,
  AttachmentRecord,
  ReviewAndFixMeta,
} from "@/lib/types";
import {
  StatusBadge,
  PriorityBadge,
  TypeBadge,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  TYPE_CONFIG,
  formatThaiDateTime,
} from "./ui/Badges";
import { FileUploadZone, AttachmentGallery } from "./ui/FileAttachmentZone";
import {
  PROJECT_PERMISSION_CONFIG,
  type ProjectPermissionLevel,
} from "@/lib/permissions";
import {
  buildGitBranchCommand,
  buildPrChecklistMarkdown,
  parseEnvironmentDetailsFromDescription,
} from "@/lib/qa-assistant";

interface IssueDetailDrawerProps {
  issue: IssueRecord | null;
  onClose: () => void;
  onUpdate: (code: string, updates: Record<string, unknown>) => Promise<void>;
  onDelete: (code: string) => Promise<void>;
  onAddComment: (
    code: string,
    author: string,
    body: string,
    attachments: AttachmentRecord[],
    options?: { isResolution?: boolean; nextStatus?: IssueStatus }
  ) => Promise<void>;
  onUploadFile: (file: File) => Promise<AttachmentRecord>;
  currentUserName?: string;
  userPermission?: ProjectPermissionLevel | "none";
}

export function IssueDetailDrawer({
  issue,
  onClose,
  onUpdate,
  onDelete,
  onAddComment,
  currentUserName,
  userPermission = "project_admin",
}: IssueDetailDrawerProps) {
  const [commentBody, setCommentBody] = useState("");
  const [commentAuthor, setCommentAuthor] = useState(
    currentUserName || "ผู้ใช้งาน"
  );
  const [commentAttachments, setCommentAttachments] = useState<AttachmentRecord[]>([]);
  const [isUploadingReplyFiles, setIsUploadingReplyFiles] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerSuccess, setDrawerSuccess] = useState<string | null>(null);
  const [commentFeedback, setCommentFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAgPrompt, setCopiedAgPrompt] = useState(false);
  const [copiedGitBranch, setCopiedGitBranch] = useState(false);
  const [copiedPrChecklist, setCopiedPrChecklist] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Antigravity Review & Fix Form State
  const [reviewDecision, setReviewDecision] = useState<"pending" | "fix" | "wont_fix">("pending");
  const [reviewedBy, setReviewedBy] = useState("Antigravity");
  const [reviewReason, setReviewReason] = useState("");
  const [fixInstructions, setFixInstructions] = useState("");
  const [targetFilesInput, setTargetFilesInput] = useState("");
  const [deployCommand, setDeployCommand] = useState("");
  const [fixedBy, setFixedBy] = useState("Antigravity");
  const [deployResult, setDeployResult] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [savedReviewNotice, setSavedReviewNotice] = useState(false);

  useEffect(() => {
    if (currentUserName) {
      setCommentAuthor(currentUserName);
    }
  }, [currentUserName]);

  useEffect(() => {
    if (issue) {
      setTitleValue(issue.title);
      setDescValue(issue.description);
      const rm = issue.reviewMeta;
      setReviewDecision(rm?.decision || "pending");
      setReviewedBy(rm?.reviewedBy || "Antigravity");
      setReviewReason(rm?.reviewReason || "");
      setFixInstructions(rm?.fixInstructions || "");
      setTargetFilesInput((rm?.targetFiles || []).join(", "));
      setDeployCommand(rm?.deployCommand || "");
      setFixedBy(rm?.fixedBy || "Antigravity");
      setDeployResult(rm?.deployResult || "");
    }
  }, [issue]);

  useEffect(() => {
    setEditingTitle(false);
    setEditingDesc(false);
    setConfirmingDelete(false);
    setDrawerError(null);
    setDrawerSuccess(null);
    setCommentFeedback(null);
    setCommentBody("");
    setCommentAttachments([]);
  }, [issue?.code]);

  useEffect(() => {
    if (!issue) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [issue, onClose]);

  if (!issue) return null;

  const buildReviewMetaPayload = (
    overrideDecision?: "pending" | "fix" | "wont_fix"
  ): ReviewAndFixMeta => {
    const dec = overrideDecision ?? reviewDecision;
    return {
      decision: dec,
      reviewedBy: reviewedBy.trim() || "Antigravity",
      reviewedAt: issue.reviewMeta?.reviewedAt || new Date().toISOString(),
      reviewReason: reviewReason.trim(),
      fixInstructions: fixInstructions.trim() || undefined,
      targetFiles: targetFilesInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      deployCommand: deployCommand.trim() || undefined,
      fixedBy: fixedBy.trim() || "Antigravity",
      fixedAt: issue.reviewMeta?.fixedAt || new Date().toISOString(),
      deployResult: deployResult.trim() || undefined,
    };
  };

  const showDrawerSuccess = (msg: string) => {
    setDrawerError(null);
    setDrawerSuccess(msg);
    setTimeout(() => {
      setDrawerSuccess((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const runDrawerUpdate = async (
    updates: Record<string, unknown>,
    successText = "บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว"
  ) => {
    setDrawerError(null);
    try {
      await onUpdate(issue.code, updates);
      showDrawerSuccess(`✅ ${successText}`);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "อัปเดตข้อมูลไม่สำเร็จ";
      setDrawerError(`❌ ${msg}`);
      return false;
    }
  };

  const handleSaveReviewAndStatus = async (
    nextStatus?: IssueStatus,
    nextDecision?: "pending" | "fix" | "wont_fix"
  ) => {
    setSavingReview(true);
    setDrawerError(null);
    try {
      const dec = nextDecision ?? reviewDecision;
      if (nextDecision) setReviewDecision(nextDecision);
      const updates: Record<string, unknown> = {
        reviewMeta: buildReviewMetaPayload(dec),
      };
      if (nextStatus) {
        updates.status = nextStatus;
      }
      await onUpdate(issue.code, updates);
      setSavedReviewNotice(true);
      showDrawerSuccess(
        nextStatus
          ? `✅ บันทึกผลการตรวจสอบและเปลี่ยนสถานะเป็น "${STATUS_CONFIG[nextStatus].shortLabel}" สำเร็จแล้ว`
          : "✅ บันทึกผลการตรวจสอบสำเร็จแล้ว"
      );
      setTimeout(() => setSavedReviewNotice(false), 2500);
    } catch (err: unknown) {
      setDrawerError(
        `❌ ${err instanceof Error ? err.message : "บันทึกผลการตรวจสอบไม่สำเร็จ"}`
      );
    } finally {
      setSavingReview(false);
    }
  };

  const gitBranchCommand = buildGitBranchCommand(issue.code, issue.title, issue.type);
  const prChecklistMarkdown = buildPrChecklistMarkdown(issue);
  const parsedEnv = parseEnvironmentDetailsFromDescription(issue.description);

  const handleCopyGitBranch = () => {
    navigator.clipboard.writeText(gitBranchCommand);
    setCopiedGitBranch(true);
    setTimeout(() => setCopiedGitBranch(false), 2000);
  };

  const handleCopyPrChecklist = () => {
    navigator.clipboard.writeText(prChecklistMarkdown);
    setCopiedPrChecklist(true);
    setTimeout(() => setCopiedPrChecklist(false), 2000);
  };

  const handleCopyAntigravityPrompt = () => {
    const prompt = `คุณกำลังดูแลโปรเจกต์ [${issue.projectKey}] ให้ดึง Issue ${issue.code} ("${issue.title}") จาก MCP IssueMate (ระบุ projectKey="${issue.projectKey}") มาดำเนินการโดย Antigravity:
1. เรียก get_issue (${issue.code}) เพื่ออ่านรายละเอียดและดูรูปภาพ/ไฟล์แนบทั้งหมดใน Issue ${issue.code}
2. วิเคราะห์สาเหตุของปัญหาแล้วบันทึกผลด้วย submit_claude_review
3. ถ้าต้องแก้ไข ให้รับงาน (claim_for_fix) แก้ไขโค้ดในโปรเจกต์ [${issue.projectKey}] ทดสอบให้ผ่าน และ Deploy ขึ้นเซิร์ฟเวอร์
4. บันทึกผลการแก้ไขและ Deploy กลับเข้า IssueMate ด้วย mark_deployed`;
    navigator.clipboard.writeText(prompt);
    setCopiedAgPrompt(true);
    setTimeout(() => setCopiedAgPrompt(false), 2000);
  };

  const canManageStatus =
    userPermission === "developer" || userPermission === "project_admin";
  const canDeleteIssue = userPermission === "project_admin";
  const canComment = userPermission !== "viewer" && userPermission !== "none";

  const handleSendComment = async (
    e: React.FormEvent,
    options?: { isResolution?: boolean; nextStatus?: IssueStatus }
  ) => {
    e.preventDefault();
    if (!commentBody.trim() && commentAttachments.length === 0) return;
    if (isUploadingReplyFiles) return;
    setSubmitting(true);
    setDrawerError(null);
    setCommentFeedback(null);
    try {
      await onAddComment(
        issue.code,
        commentAuthor.trim() || "ผู้ใช้งาน",
        commentBody || (commentAttachments.length > 0 ? "ส่งไฟล์เอกสารและรูปภาพประกอบคำตอบ" : ""),
        commentAttachments,
        options
      );
      const okMsg = options?.isResolution
        ? "✅ ส่งคำตอบพร้อมไฟล์แนบ และปิดเรื่องว่าเรียบร้อยสำเร็จแล้ว!"
        : "✅ ส่งความคิดเห็น / คำตอบสำเร็จเรียบร้อยแล้ว!";
      setCommentBody("");
      setCommentAttachments([]);
      setCommentFeedback({ type: "success", message: okMsg });
      showDrawerSuccess(okMsg);
      setTimeout(() => {
        setCommentFeedback((prev) => (prev?.message === okMsg ? null : prev));
      }, 5000);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "ส่งข้อความไม่สำเร็จ";
      setDrawerError(`❌ ${errMsg}`);
      setCommentFeedback({
        type: "error",
        message: `❌ ส่งความคิดเห็นไม่สำเร็จ: ${errMsg}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(issue.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  };

  return (
    <div
      data-testid="issue-detail-drawer"
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-3xl bg-[#0d1323] border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={copyCode}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/30 font-mono text-xs font-bold text-indigo-300 hover:bg-indigo-500/20 transition-colors cursor-pointer"
              title="คัดลอกรหัสรายการ"
            >
              {issue.code}
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 opacity-70" />
              )}
            </button>
            <StatusBadge status={issue.status} />
            <PriorityBadge priority={issue.priority} />
            <TypeBadge type={issue.type} />
            {userPermission && userPermission !== "none" && (
              <span
                data-testid="drawer-user-permission-badge"
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${PROJECT_PERMISSION_CONFIG[userPermission].badgeClass}`}
              >
                สิทธิ์ของคุณ: {PROJECT_PERMISSION_CONFIG[userPermission].shortLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canDeleteIssue &&
              (confirmingDelete ? (
                <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 px-2.5 py-1 rounded-lg">
                  <span className="text-xs text-rose-300 font-medium">ยืนยันการลบ?</span>
                  <button
                    onClick={async () => {
                      await onDelete(issue.code);
                      onClose();
                    }}
                    data-testid="confirm-delete-issue-btn"
                    className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    ลบเลย
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  data-testid="delete-issue-btn"
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="ลบรายการนี้"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ))}
            <button
              onClick={onClose}
              data-testid="close-drawer-btn"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="ปิดหน้าต่าง (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {drawerError && (
            <div
              data-testid="drawer-error-banner"
              className="flex items-center justify-between gap-2 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3.5 py-2.5 text-xs font-medium text-rose-200"
            >
              <span>{drawerError}</span>
              <button
                type="button"
                onClick={() => setDrawerError(null)}
                className="text-rose-300 hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {drawerSuccess && (
            <div
              data-testid="drawer-feedback-banner"
              className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/45 bg-emerald-500/15 px-3.5 py-2.5 text-xs font-semibold text-emerald-200"
            >
              <span>{drawerSuccess}</span>
              <button
                type="button"
                onClick={() => setDrawerSuccess(null)}
                className="text-emerald-300 hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Feature 5: One-Click Dev Action Bar (For the Developer View) */}
          <div
            data-testid="one-click-dev-action-bar"
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-500/35 bg-slate-900/90 px-3.5 py-2.5"
          >
            <div className="flex items-center gap-2 text-xs">
              <GitBranch className="h-4 w-4 text-cyan-400 shrink-0" />
              <code
                data-testid="dev-git-branch-code"
                className="rounded bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-cyan-300 border border-slate-800"
              >
                {gitBranchCommand}
              </code>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="copy-git-branch-btn"
                onClick={handleCopyGitBranch}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25 cursor-pointer"
              >
                {copiedGitBranch ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>คัดลอกคำสั่ง Git Branch แล้ว</span>
                  </>
                ) : (
                  <>
                    <GitBranch className="h-3.5 w-3.5" />
                    <span>Copy Git Branch Command</span>
                  </>
                )}
              </button>

              <button
                type="button"
                data-testid="copy-pr-checklist-btn"
                onClick={handleCopyPrChecklist}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
              >
                {copiedPrChecklist ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>คัดลอก Checklist สำหรับ PR แล้ว</span>
                  </>
                ) : (
                  <>
                    <ListChecks className="h-3.5 w-3.5" />
                    <span>Copy Checklist for PR</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 1. Title & Basic Controls */}
          <div className="space-y-3">
            {editingTitle && canManageStatus ? (
              <div className="flex items-center gap-2">
                <input
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  className="flex-1 bg-slate-900 border border-indigo-500/50 rounded-lg px-3 py-2 text-lg font-bold text-white focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={async () => {
                    const ok = await runDrawerUpdate(
                      { title: titleValue },
                      "บันทึกหัวข้อรายการเรียบร้อยแล้ว"
                    );
                    if (ok) setEditingTitle(false);
                  }}
                  className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 cursor-pointer"
                >
                  บันทึก
                </button>
              </div>
            ) : (
              <h2
                onClick={() => canManageStatus && setEditingTitle(true)}
                className={`text-xl font-bold text-white leading-snug ${
                  canManageStatus ? "hover:text-indigo-200 cursor-pointer transition-colors" : ""
                }`}
                title={canManageStatus ? "คลิกเพื่อแก้ไขหัวข้อ" : undefined}
              >
                {issue.title}
              </h2>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span>
                ผู้แจ้ง: <strong className="text-slate-200">{issue.reporter}</strong>
              </span>
              <span>•</span>
              <span>
                วันที่เวลาสร้าง:{" "}
                <strong className="font-mono text-slate-200 tabular-nums">
                  {formatThaiDateTime(issue.createdAt)}
                </strong>
              </span>
              {issue.updatedAt && issue.updatedAt !== issue.createdAt && (
                <>
                  <span>•</span>
                  <span>
                    อัปเดตล่าสุด:{" "}
                    <span className="font-mono text-slate-300 tabular-nums">
                      {formatThaiDateTime(issue.updatedAt)}
                    </span>
                  </span>
                </>
              )}
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={issue.type}
                  disabled={!canManageStatus}
                  onChange={(e) =>
                    void runDrawerUpdate(
                      { type: e.target.value as IssueType },
                      `เปลี่ยนประเภทเรื่องเป็น "${TYPE_CONFIG[e.target.value as IssueType].label}" สำเร็จแล้ว`
                    )
                  }
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 disabled:opacity-60"
                >
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <select
                  value={issue.priority}
                  disabled={!canManageStatus}
                  onChange={(e) =>
                    void runDrawerUpdate(
                      { priority: e.target.value as IssuePriority },
                      `เปลี่ยนความเร่งด่วนเป็น "${PRIORITY_CONFIG[e.target.value as IssuePriority].label}" สำเร็จแล้ว`
                    )
                  }
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 disabled:opacity-60"
                >
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Description (Right at the top so users see it immediately) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300">รายละเอียด</h3>
              {!editingDesc && canManageStatus && (
                <button
                  onClick={() => setEditingDesc(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                >
                  แก้ไขรายละเอียด
                </button>
              )}
            </div>

            {editingDesc && canManageStatus ? (
              <div className="space-y-2">
                <textarea
                  rows={4}
                  value={descValue}
                  onChange={(e) => setDescValue(e.target.value)}
                  className="w-full bg-slate-950 border border-indigo-500/50 rounded-xl p-3 text-sm text-slate-200 focus:outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditingDesc(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await runDrawerUpdate(
                        { description: descValue },
                        "บันทึกรายละเอียดเรียบร้อยแล้ว"
                      );
                      if (ok) setEditingDesc(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 cursor-pointer"
                  >
                    บันทึก
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {parsedEnv.cleanDescription || issue.description || "ไม่มีรายละเอียดเพิ่มเติม"}
                </div>

                {/* Feature 3: Collapsible Device & Environment Info */}
                {parsedEnv.envPairs.length > 0 && (
                  <details
                    data-testid="device-env-details-block"
                    className="group rounded-xl border border-slate-800 bg-slate-950/90 p-3 text-xs text-slate-300"
                  >
                    <summary className="flex cursor-pointer items-center justify-between font-bold text-cyan-300 select-none">
                      <span className="inline-flex items-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
                        <span>📱 Device & Environment Info (ข้อมูลอุปกรณ์ผู้แจ้งอัตโนมัติ)</span>
                      </span>
                      <span className="text-[11px] font-normal text-slate-400 group-open:hidden">
                        คลิกเพื่อดูรายละเอียด
                      </span>
                    </summary>
                    <div className="mt-2.5 grid grid-cols-1 gap-1.5 border-t border-slate-800/80 pt-2.5 sm:grid-cols-2">
                      {parsedEnv.envPairs.map((pair) => (
                        <div
                          key={pair.label}
                          className="rounded-lg bg-slate-900/80 px-2.5 py-1.5 text-[11px]"
                        >
                          <span className="font-semibold text-slate-400">{pair.label}: </span>
                          <span className="font-mono text-slate-200 break-all">{pair.value}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* 3. Multi-Image & Multi-File Attachments (Prominent at the top!) */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5" />
              <span>
                รูปภาพและไฟล์แนบ ({issue.attachments?.length || 0} รายการ) — เปิดดู PDF, ขยายรูปภาพ หรือแนบเพิ่มได้หลายไฟล์
              </span>
            </h3>
            {issue.attachments && issue.attachments.length > 0 && (
              <AttachmentGallery attachments={issue.attachments} />
            )}
            {canManageStatus && (
              <FileUploadZone
                attachments={issue.attachments || []}
                onChange={(next) => {
                  void onUpdate(issue.code, { attachments: next });
                }}
                uploadedBy={currentUserName || "ผู้ใช้งาน"}
                compact
              />
            )}
          </div>

          {/* 4. 6-Stage Pipeline Status Stepper */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-indigo-400" />
                {canManageStatus
                  ? "สถานะการดำเนินการ (คลิกเปลี่ยนสถานะได้ทันที)"
                  : "สถานะความคืบหน้าของเรื่องนี้"}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {(Object.keys(STATUS_CONFIG) as IssueStatus[]).map((stKey) => {
                const cfg = STATUS_CONFIG[stKey];
                const active = issue.status === stKey;
                return (
                  <button
                    key={stKey}
                    type="button"
                    disabled={!canManageStatus}
                    data-testid={`status-step-${stKey}`}
                    onClick={() =>
                      canManageStatus &&
                      void runDrawerUpdate(
                        { status: stKey },
                        `เปลี่ยนสถานะเป็น "${cfg.shortLabel}" สำเร็จแล้ว`
                      )
                    }
                    className={`flex flex-col items-start justify-between p-2.5 rounded-lg border text-left transition-all ${
                      active
                        ? `${cfg.bg} text-white ring-2 ring-indigo-500/40 shadow-sm`
                        : "bg-slate-950/70 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    } ${canManageStatus ? "cursor-pointer" : "cursor-default opacity-90"}`}
                  >
                    <div className="flex items-center gap-1.5 w-full">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                      <span
                        className={`text-xs font-bold truncate ${
                          active ? cfg.color : "text-slate-300"
                        }`}
                      >
                        {cfg.shortLabel}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 line-clamp-1">
                      {cfg.step}. {cfg.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Antigravity Review, Fix & Deploy Panel (Shown for Developers/Admins or when review exists) */}
          {canManageStatus && (
            <div className="bg-gradient-to-br from-indigo-950/35 via-slate-900/90 to-emerald-950/25 border border-indigo-500/30 rounded-xl p-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold text-white">
                    บันทึกผลการตรวจสอบ / คำตอบ / สั่งแก้ไข (สำหรับผู้ดูแล & Antigravity)
                  </h3>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleCopyAntigravityPrompt}
                    data-testid="copy-antigravity-prompt-btn"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-200 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    {copiedAgPrompt ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Rocket className="w-3 h-3 text-cyan-300" />
                    )}
                    คัดลอกคำสั่งให้ Antigravity ดำเนินการ
                  </button>
                </div>
              </div>

              {/* Quick Decision Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  data-testid="decision-fix-btn"
                  onClick={() => handleSaveReviewAndStatus("ready_to_fix", "fix")}
                  disabled={savingReview}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    issue.status === "ready_to_fix" || reviewDecision === "fix"
                      ? "bg-amber-500/20 border-amber-500/50 text-amber-200 shadow-md"
                      : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-amber-500/40 hover:text-amber-200"
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5 text-amber-400" />
                  รับเรื่องแก้ไข (รอแก้ไข)
                </button>

                <button
                  type="button"
                  data-testid="decision-wontfix-btn"
                  onClick={() => handleSaveReviewAndStatus("wont_fix", "wont_fix")}
                  disabled={savingReview}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    issue.status === "wont_fix" || reviewDecision === "wont_fix"
                      ? "bg-slate-700/40 border-slate-500 text-slate-200 shadow-md"
                      : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white"
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5 text-slate-400" />
                  ปิดเรื่อง / ไม่ต้องแก้ไข
                </button>

                <button
                  type="button"
                  data-testid="decision-deployed-btn"
                  onClick={() => handleSaveReviewAndStatus("deployed", "fix")}
                  disabled={savingReview}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    issue.status === "deployed"
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-200 shadow-md"
                      : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-200"
                  }`}
                >
                  <Rocket className="w-3.5 h-3.5 text-emerald-400" />
                  ดำเนินการเรียบร้อยแล้ว
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    ผลการตรวจสอบ / คำอธิบายสาเหตุ
                  </label>
                  <textarea
                    rows={2}
                    data-testid="review-reason-input"
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    placeholder="ระบุสาเหตุของปัญหา หรือคำตอบสรุปให้ผู้แจ้งทราบ..."
                    className="w-full bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-300 mb-1">
                    รายละเอียดการแก้ไข / ขั้นตอนที่ดำเนินการ
                  </label>
                  <textarea
                    rows={2}
                    data-testid="fix-instructions-input"
                    value={fixInstructions}
                    onChange={(e) => setFixInstructions(e.target.value)}
                    placeholder="ระบุแนวทางหรือขั้นตอนการแก้ไข..."
                    className="w-full bg-slate-950/90 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-slate-400">
                    {issue.reviewMeta?.reviewedBy && (
                      <span>
                        ตรวจสอบโดย: <strong className="text-slate-200">{issue.reviewMeta.reviewedBy}</strong>
                      </span>
                    )}
                    {issue.reviewMeta?.fixedBy && (
                      <span className="ml-3">
                        ผู้ดำเนินการ: <strong className="text-emerald-300">{issue.reviewMeta.fixedBy}</strong>
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    data-testid="save-review-meta-btn"
                    onClick={() => handleSaveReviewAndStatus()}
                    disabled={savingReview}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {savedReviewNotice ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                        บันทึกแล้ว
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        บันทึกผลการตรวจสอบ
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 6. Answers, Comments & File Replies (PDF, Images, Documents) */}
          <div className="space-y-4 pt-3 border-t border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-emerald-300">
                💬 คำตอบ & ประวัติการพูดคุย ({issue.comments?.length || 0} รายการ) — รองรับการส่งไฟล์ PDF, รูปภาพ และเอกสารให้ผู้แจ้งเปิดดูได้ทันที
              </h3>
            </div>

            <div className="space-y-3">
              {issue.comments?.map((c, idx) => (
                <div
                  key={c.id}
                  data-testid={`issue-comment-card-${idx}`}
                  className={`rounded-xl p-4 space-y-2 border ${
                    c.isResolution
                      ? "bg-emerald-950/25 border-emerald-500/45 shadow-sm"
                      : "bg-slate-900/70 border-slate-800/90"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-indigo-300">{c.author}</span>
                      {c.isResolution && (
                        <span
                          data-testid={`comment-resolution-badge-${idx}`}
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-500/45 bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-200"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          คำตอบ / ดำเนินการเรียบร้อย
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(c.createdAt).toLocaleString("th-TH")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">
                    {c.body}
                  </p>
                  {c.attachments && c.attachments.length > 0 && (
                    <AttachmentGallery attachments={c.attachments} />
                  )}
                </div>
              ))}
            </div>

            {/* Reply / Answer Form with Multi-Image, PDF & Document Upload */}
            {canComment ? (
              <form
                onSubmit={(e) => handleSendComment(e)}
                data-testid="reply-answer-form"
                className="bg-slate-900 border border-emerald-500/35 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-emerald-300">
                    ✍️ ตอบคำถาม / พิมพ์ข้อความเพิ่มเติม (แนบไฟล์ PDF คู่มือ, รูปภาพแคปหน้าจอ หรือไฟล์เอกสารส่งกลับให้ผู้ถามดูได้ทันที)
                  </label>
                </div>

                <textarea
                  rows={3}
                  data-testid="comment-body-input"
                  placeholder="พิมพ์คำตอบ คำอธิบาย หรือข้อความตอบกลับที่นี่... (สามารถกด Ctrl+V เพื่อวางรูปภาพ หรือคลิกปุ่มด้านล่างเพื่อแนบไฟล์ PDF / รูปภาพ / เอกสาร)"
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />

                <FileUploadZone
                  attachments={commentAttachments}
                  onChange={setCommentAttachments}
                  uploadedBy={commentAuthor}
                  compact
                  onUploadingChange={setIsUploadingReplyFiles}
                />

                {commentFeedback && (
                  <div
                    data-testid="comment-feedback-banner"
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                      commentFeedback.type === "success"
                        ? "border-emerald-500/45 bg-emerald-500/15 text-emerald-200"
                        : "border-rose-500/45 bg-rose-500/15 text-rose-200"
                    }`}
                  >
                    <span>{commentFeedback.message}</span>
                    <button
                      type="button"
                      onClick={() => setCommentFeedback(null)}
                      className="opacity-80 hover:opacity-100 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-slate-400">
                    ผู้ตอบกลับ: <strong className="text-slate-200">{commentAuthor}</strong>
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    {canManageStatus && (
                      <button
                        type="button"
                        data-testid="send-answer-resolve-btn"
                        disabled={
                          submitting ||
                          isUploadingReplyFiles ||
                          (!commentBody.trim() && commentAttachments.length === 0)
                        }
                        onClick={(e) =>
                          void handleSendComment(e, {
                            isResolution: true,
                            nextStatus: "deployed",
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-cyan-500/45 bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-50 text-cyan-200 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-300" />
                        <span>ส่งคำตอบพร้อมไฟล์แนบ & ปิดเรื่องว่าเรียบร้อย</span>
                      </button>
                    )}

                    <button
                      type="submit"
                      data-testid="send-comment-btn"
                      disabled={
                        submitting ||
                        isUploadingReplyFiles ||
                        (!commentBody.trim() && commentAttachments.length === 0)
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer shadow"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {submitting
                          ? "กำลังส่ง..."
                          : commentAttachments.length > 0
                          ? `ส่งข้อความพร้อมไฟล์แนบ (${commentAttachments.length} ไฟล์)`
                          : "ส่งข้อความ / คำตอบ"}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div
                data-testid="viewer-cannot-comment-notice"
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 text-center text-xs text-slate-400"
              >
                👀 บัญชีของคุณได้รับสิทธิ์ <strong>&ldquo;ดูอย่างเดียว&rdquo;</strong> ในโปรเจกต์นี้ สามารถเปิดอ่านคำตอบ ดูรูปภาพ และเปิดดูไฟล์ PDF แนบได้
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
