"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Send,
  Paperclip,
  Trash2,
  CheckCircle2,
  Copy,
  Check,
  Wrench,
  CircleSlash,
  GitBranch,
  ListChecks,
  Smartphone,
  Pencil,
  ChevronDown,
  Bot,
  MessagesSquare,
  FileText,
  ClipboardCheck,
  Terminal,
  CircleAlert,
  Info,
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
  PermissionBadge,
  Avatar,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  PRIORITY_ORDER,
  TYPE_CONFIG,
  TYPE_ORDER,
  TONE,
  formatThaiDateTime,
  formatRelativeTime,
} from "./ui/Badges";
import { FileUploadZone, AttachmentGallery } from "./ui/FileAttachmentZone";
import { Notice } from "./ui/Dialog";
import { type ProjectPermissionLevel } from "@/lib/permissions";
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
  projectName?: string;
  projectColor?: string;
}

const MAIN_STEPS: IssueStatus[] = ["open", "reviewing", "ready_to_fix", "fixing", "deployed"];

function SectionTitle({
  icon: Icon,
  children,
  right,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold text-fg">
        <Icon className="h-4 w-4 text-fg-subtle" />
        {children}
      </h3>
      {right}
    </div>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3">
      <span className="shrink-0 text-xs text-fg-subtle">{label}</span>
      <div className="flex min-w-0 justify-end text-right text-[13px] text-fg">{children}</div>
    </div>
  );
}

export function IssueDetailDrawer({
  issue,
  onClose,
  onUpdate,
  onDelete,
  onAddComment,
  currentUserName,
  userPermission = "project_admin",
  projectName,
  projectColor,
}: IssueDetailDrawerProps) {
  const [commentBody, setCommentBody] = useState("");
  const [commentAuthor, setCommentAuthor] = useState(currentUserName || "ผู้ใช้งาน");
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

  // Review & Fix Form State
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
      showDrawerSuccess(successText);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "อัปเดตข้อมูลไม่สำเร็จ";
      setDrawerError(msg);
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
          ? `บันทึกผลการตรวจสอบและเปลี่ยนสถานะเป็น "${STATUS_CONFIG[nextStatus].label}" สำเร็จแล้ว`
          : "บันทึกผลการตรวจสอบสำเร็จแล้ว"
      );
      setTimeout(() => setSavedReviewNotice(false), 2500);
    } catch (err: unknown) {
      setDrawerError(err instanceof Error ? err.message : "บันทึกผลการตรวจสอบไม่สำเร็จ");
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

  const canManageStatus = userPermission === "developer" || userPermission === "project_admin";
  const canDeleteIssue = userPermission === "project_admin";
  const canComment = userPermission !== "viewer" && userPermission !== "none";

  const handleSendComment = async (
    e: { preventDefault: () => void },
    options?: { isResolution?: boolean; nextStatus?: IssueStatus }
  ) => {
    e.preventDefault();
    if (!commentBody.trim() && commentAttachments.length === 0) return;
    if (isUploadingReplyFiles || submitting) return;
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
        ? "ส่งคำตอบพร้อมไฟล์แนบ และปิดเรื่องว่าเรียบร้อยสำเร็จแล้ว"
        : "ส่งข้อความสำเร็จแล้ว";
      setCommentBody("");
      setCommentAttachments([]);
      setCommentFeedback({ type: "success", message: okMsg });
      showDrawerSuccess(okMsg);
      setTimeout(() => {
        setCommentFeedback((prev) => (prev?.message === okMsg ? null : prev));
      }, 5000);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "ส่งข้อความไม่สำเร็จ";
      setDrawerError(errMsg);
      setCommentFeedback({
        type: "error",
        message: `ส่งข้อความไม่สำเร็จ: ${errMsg}`,
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

  const currentStepIndex = MAIN_STEPS.indexOf(issue.status);
  const isWontFix = issue.status === "wont_fix";
  const subtasks = issue.subtasks || [];
  const subtasksDone = subtasks.filter((s) => s.completed).length;
  const rm = issue.reviewMeta;
  const hasTeamFindings = Boolean(rm?.reviewReason || rm?.fixInstructions || rm?.deployResult);
  const sendDisabled =
    submitting || isUploadingReplyFiles || (!commentBody.trim() && commentAttachments.length === 0);

  return (
    <div data-testid="issue-detail-drawer" className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-black/55 backdrop-blur-[2px]" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${issue.code} ${issue.title}`}
        className="relative flex h-full w-full max-w-[940px] animate-slide-in-right flex-col border-l border-line bg-overlay shadow-pop"
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4 sm:px-6">
          {projectName && (
            <span className="hidden min-w-0 items-center gap-2 text-xs text-fg-subtle sm:flex">
              <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ backgroundColor: projectColor || "#6d7787" }} />
              <span className="max-w-[180px] truncate">{projectName}</span>
              <span className="text-fg-subtle/50">/</span>
            </span>
          )}
          <button
            type="button"
            onClick={copyCode}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 font-mono text-xs font-medium text-fg-muted transition hover:bg-white/[0.06] hover:text-fg"
            title="คัดลอกรหัสเรื่อง"
          >
            {issue.code}
            {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 opacity-60" />}
          </button>
          <StatusBadge status={issue.status} />

          <div className="ml-auto flex items-center gap-1.5">
            {canDeleteIssue &&
              (confirmingDelete ? (
                <div className="flex animate-fade-in items-center gap-1.5 rounded-lg border border-rose-400/25 bg-rose-500/10 py-1 pr-1 pl-3">
                  <span className="text-xs font-medium text-rose-200">ลบเรื่องนี้ถาวร?</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await onDelete(issue.code);
                      onClose();
                    }}
                    data-testid="confirm-delete-issue-btn"
                    className="btn btn-danger-solid btn-xs"
                  >
                    ลบเลย
                  </button>
                  <button type="button" onClick={() => setConfirmingDelete(false)} className="btn btn-ghost btn-xs">
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  data-testid="delete-issue-btn"
                  className="btn btn-ghost btn-icon btn-sm hover:!text-rose-300"
                  title="ลบเรื่องนี้"
                  aria-label="ลบเรื่องนี้"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ))}
            <button
              type="button"
              onClick={onClose}
              data-testid="close-drawer-btn"
              className="btn btn-ghost btn-icon btn-sm"
              title="ปิด (Esc)"
              aria-label="ปิดหน้าต่าง"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div data-drawer-scroll className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_288px]">
            {/* ---------------- Main column ---------------- */}
            <div className="min-w-0 space-y-7 px-4 py-6 sm:px-7">
              {/* Title */}
              <div>
                {editingTitle && canManageStatus ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={titleValue}
                      onChange={(e) => setTitleValue(e.target.value)}
                      className="input h-11 text-base font-semibold"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await runDrawerUpdate({ title: titleValue }, "บันทึกหัวข้อเรียบร้อยแล้ว");
                        if (ok) setEditingTitle(false);
                      }}
                      className="btn btn-primary"
                    >
                      บันทึก
                    </button>
                    <button type="button" onClick={() => setEditingTitle(false)} className="btn btn-ghost">
                      ยกเลิก
                    </button>
                  </div>
                ) : (
                  <h2
                    onClick={() => canManageStatus && setEditingTitle(true)}
                    className={`group text-xl leading-snug font-semibold tracking-tight text-fg sm:text-2xl ${
                      canManageStatus ? "cursor-text" : ""
                    }`}
                    title={canManageStatus ? "คลิกเพื่อแก้ไขหัวข้อ" : undefined}
                  >
                    {issue.title}
                    {canManageStatus && (
                      <Pencil className="ml-2 inline h-4 w-4 align-middle text-fg-subtle opacity-0 transition group-hover:opacity-100" />
                    )}
                  </h2>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-fg-muted">
                  <Avatar name={issue.reporter} size="sm" />
                  <span>
                    แจ้งโดย <strong className="font-medium text-fg">{issue.reporter}</strong>
                  </span>
                  <span className="text-fg-subtle">·</span>
                  <span title={formatThaiDateTime(issue.createdAt)}>
                    {formatRelativeTime(issue.createdAt)}
                  </span>
                  {issue.updatedAt && issue.updatedAt !== issue.createdAt && (
                    <>
                      <span className="text-fg-subtle">·</span>
                      <span className="text-fg-subtle" title={formatThaiDateTime(issue.updatedAt)}>
                        อัปเดต {formatRelativeTime(issue.updatedAt)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {drawerError && (
                <Notice
                  tone="error"
                  testId="drawer-error-banner"
                  icon={<CircleAlert className="h-4 w-4 text-rose-300" />}
                  onDismiss={() => setDrawerError(null)}
                >
                  {drawerError}
                </Notice>
              )}

              {drawerSuccess && (
                <Notice
                  tone="success"
                  testId="drawer-feedback-banner"
                  icon={<CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                  onDismiss={() => setDrawerSuccess(null)}
                >
                  {drawerSuccess}
                </Notice>
              )}

              {/* Progress stepper */}
              <div className="card-inset p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-fg">ความคืบหน้า</span>
                  <span className="text-xs text-fg-subtle">
                    {canManageStatus ? "คลิกที่ขั้นตอนเพื่อเปลี่ยนสถานะ" : STATUS_CONFIG[issue.status].description}
                  </span>
                </div>
                <ol className="grid grid-cols-5">
                  {MAIN_STEPS.map((stKey, i) => {
                    const cfg = STATUS_CONFIG[stKey];
                    const done = !isWontFix && i < currentStepIndex;
                    const current = !isWontFix && i === currentStepIndex;
                    return (
                      <li key={stKey} className="relative flex flex-col items-center">
                        {i < MAIN_STEPS.length - 1 && (
                          <span
                            aria-hidden="true"
                            className={`absolute top-3.5 left-1/2 h-0.5 w-full ${
                              done ? "bg-emerald-400/70" : "bg-white/[0.08]"
                            }`}
                          />
                        )}
                        <button
                          type="button"
                          disabled={!canManageStatus}
                          data-testid={`status-step-${stKey}`}
                          aria-current={current ? "step" : undefined}
                          title={canManageStatus ? `เปลี่ยนสถานะเป็น "${cfg.label}"` : cfg.description}
                          onClick={() =>
                            canManageStatus &&
                            void runDrawerUpdate({ status: stKey }, `เปลี่ยนสถานะเป็น "${cfg.label}" สำเร็จแล้ว`)
                          }
                          className={`group relative z-10 flex flex-col items-center gap-2 rounded-lg px-1 text-center disabled:cursor-default ${
                            canManageStatus ? "cursor-pointer" : ""
                          }`}
                        >
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition ${
                              done
                                ? "bg-emerald-400 text-emerald-950"
                                : current
                                  ? `bg-overlay ring-2 ${TONE[cfg.tone].text} ring-current`
                                  : "bg-raised text-fg-subtle ring-1 ring-line group-hover:ring-line-strong"
                            }`}
                          >
                            {done ? (
                              <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            ) : current ? (
                              <span className={`h-2.5 w-2.5 rounded-full ${TONE[cfg.tone].dot}`} />
                            ) : (
                              i + 1
                            )}
                          </span>
                          <span
                            className={`text-[11px] leading-tight sm:text-xs ${
                              current ? "font-semibold text-fg" : done ? "text-fg-muted" : "text-fg-subtle"
                            }`}
                          >
                            {cfg.shortLabel}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="text-xs text-fg-subtle">
                    {isWontFix ? "เรื่องนี้ปิดแล้วโดยไม่ต้องแก้ไขระบบ" : "ไม่จำเป็นต้องแก้ไข?"}
                  </span>
                  <button
                    type="button"
                    disabled={!canManageStatus}
                    data-testid="status-step-wont_fix"
                    aria-current={isWontFix ? "step" : undefined}
                    onClick={() =>
                      canManageStatus &&
                      void runDrawerUpdate(
                        { status: "wont_fix" },
                        `เปลี่ยนสถานะเป็น "${STATUS_CONFIG.wont_fix.label}" สำเร็จแล้ว`
                      )
                    }
                    className={`btn btn-xs ${
                      isWontFix ? "bg-white/[0.08] text-fg ring-1 ring-line-strong" : "btn-ghost"
                    } disabled:opacity-60`}
                  >
                    <CircleSlash className="h-3.5 w-3.5" />
                    {STATUS_CONFIG.wont_fix.label}
                  </button>
                </div>
              </div>

              {/* Description */}
              <section>
                <SectionTitle
                  icon={FileText}
                  right={
                    !editingDesc &&
                    canManageStatus && (
                      <button type="button" onClick={() => setEditingDesc(true)} className="btn btn-ghost btn-xs">
                        <Pencil className="h-3 w-3" />
                        แก้ไข
                      </button>
                    )
                  }
                >
                  รายละเอียด
                </SectionTitle>

                {editingDesc && canManageStatus ? (
                  <div className="space-y-2">
                    <textarea
                      rows={6}
                      value={descValue}
                      onChange={(e) => setDescValue(e.target.value)}
                      className="textarea text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEditingDesc(false)} className="btn btn-ghost btn-sm">
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await runDrawerUpdate({ description: descValue }, "บันทึกรายละเอียดเรียบร้อยแล้ว");
                          if (ok) setEditingDesc(false);
                        }}
                        className="btn btn-primary btn-sm"
                      >
                        บันทึก
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm leading-7 whitespace-pre-wrap text-fg/90">
                      {parsedEnv.cleanDescription || issue.description || (
                        <span className="text-fg-subtle">ไม่มีรายละเอียดเพิ่มเติม</span>
                      )}
                    </div>

                    {parsedEnv.envPairs.length > 0 && (
                      <details
                        data-testid="device-env-details-block"
                        className="group rounded-xl border border-line bg-white/[0.02] text-xs"
                      >
                        <summary className="flex cursor-pointer items-center gap-2 px-3.5 py-2.5 text-fg-muted select-none hover:text-fg">
                          <Smartphone className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
                          <span className="flex-1">
                            ข้อมูลอุปกรณ์ของผู้แจ้ง <span className="text-fg-subtle">(Device & Environment Info)</span>
                          </span>
                          <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
                        </summary>
                        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 border-t border-line px-3.5 py-3 sm:grid-cols-2">
                          {parsedEnv.envPairs.map((pair) => (
                            <div key={pair.label} className="min-w-0">
                              <dt className="text-[11px] text-fg-subtle">{pair.label}</dt>
                              <dd className="font-mono text-[11px] break-all text-fg-muted">{pair.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    )}
                  </div>
                )}
              </section>

              {/* Attachments */}
              <section>
                <SectionTitle icon={Paperclip}>
                  รูปภาพและไฟล์แนบ ({issue.attachments?.length || 0} รายการ)
                </SectionTitle>
                {issue.attachments && issue.attachments.length > 0 ? (
                  <AttachmentGallery
                    attachments={issue.attachments}
                    onRemove={
                      canManageStatus
                        ? (att) => {
                            if (!window.confirm(`ลบไฟล์ "${att.name}" ออกจากเรื่องนี้?`)) return;
                            fetch(`/api/files/${encodeURIComponent(att.key)}`, { method: "DELETE" }).catch(() => {});
                            void runDrawerUpdate(
                              { attachments: issue.attachments.filter((a) => a.id !== att.id) },
                              `ลบไฟล์ "${att.name}" แล้ว`
                            );
                          }
                        : undefined
                    }
                  />
                ) : (
                  !canManageStatus && <p className="text-[13px] text-fg-subtle">ไม่มีไฟล์แนบ</p>
                )}
                {canManageStatus && (
                  <div className="mt-3">
                    <FileUploadZone
                      attachments={issue.attachments || []}
                      onChange={(next) => {
                        void onUpdate(issue.code, { attachments: next });
                      }}
                      uploadedBy={currentUserName || "ผู้ใช้งาน"}
                      compact
                      hidePreview
                    />
                  </div>
                )}
              </section>

              {/* Team findings for non-managers */}
              {!canManageStatus && hasTeamFindings && (
                <section className="rounded-2xl border border-sky-400/15 bg-sky-400/[0.04] p-4 sm:p-5">
                  <SectionTitle icon={ClipboardCheck}>ผลการตรวจสอบจากทีมงาน</SectionTitle>
                  <div className="space-y-3 text-[13px] leading-relaxed text-fg-muted">
                    {rm?.reviewReason && (
                      <div>
                        <p className="text-xs text-fg-subtle">สาเหตุ / คำอธิบาย</p>
                        <p className="mt-0.5 whitespace-pre-wrap text-fg">{rm.reviewReason}</p>
                      </div>
                    )}
                    {rm?.fixInstructions && (
                      <div>
                        <p className="text-xs text-fg-subtle">แนวทางแก้ไข</p>
                        <p className="mt-0.5 whitespace-pre-wrap text-fg">{rm.fixInstructions}</p>
                      </div>
                    )}
                    {rm?.deployResult && (
                      <div>
                        <p className="text-xs text-fg-subtle">ผลการแก้ไข</p>
                        <p className="mt-0.5 whitespace-pre-wrap text-fg">{rm.deployResult}</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Review & fix panel (team) */}
              {canManageStatus && (
                <section className="rounded-2xl border border-line bg-white/[0.02] p-4 sm:p-5">
                  <SectionTitle
                    icon={ClipboardCheck}
                    right={<span className="text-xs text-fg-subtle">สำหรับทีมงาน</span>}
                  >
                    การตรวจสอบและการแก้ไข
                  </SectionTitle>

                  <p className="mb-2 text-xs text-fg-subtle">ผลการพิจารณา (บันทึกและเปลี่ยนสถานะให้ทันที)</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {(
                      [
                        {
                          testId: "decision-fix-btn",
                          label: "ต้องแก้ไข",
                          hint: "ส่งเข้าคิวรอแก้ไข",
                          icon: Wrench,
                          active: issue.status === "ready_to_fix" || reviewDecision === "fix",
                          tone: "sky",
                          run: () => handleSaveReviewAndStatus("ready_to_fix", "fix"),
                        },
                        {
                          testId: "decision-wontfix-btn",
                          label: "ไม่ต้องแก้ไข",
                          hint: "ปิดเรื่องพร้อมเหตุผล",
                          icon: CircleSlash,
                          active: issue.status === "wont_fix" || reviewDecision === "wont_fix",
                          tone: "zinc",
                          run: () => handleSaveReviewAndStatus("wont_fix", "wont_fix"),
                        },
                        {
                          testId: "decision-deployed-btn",
                          label: "แก้ไขเสร็จแล้ว",
                          hint: "แจ้งผู้แจ้งว่าเรียบร้อย",
                          icon: CheckCircle2,
                          active: issue.status === "deployed",
                          tone: "emerald",
                          run: () => handleSaveReviewAndStatus("deployed", "fix"),
                        },
                      ] as const
                    ).map((d) => {
                      const Icon = d.icon;
                      return (
                        <button
                          key={d.testId}
                          type="button"
                          data-testid={d.testId}
                          onClick={d.run}
                          disabled={savingReview}
                          aria-pressed={d.active}
                          className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-left transition disabled:opacity-60 ${
                            d.active
                              ? `${TONE[d.tone].soft} border-white/15 ring-1 ring-inset ring-white/10`
                              : "border-line bg-transparent hover:border-line-strong hover:bg-white/[0.03]"
                          }`}
                        >
                          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${TONE[d.tone].text}`} />
                          <span>
                            <span className="block text-[13px] font-medium text-fg">{d.label}</span>
                            <span className="block text-xs text-fg-subtle">{d.hint}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="field-label">สาเหตุ / คำอธิบายถึงผู้แจ้ง</label>
                      <textarea
                        rows={2}
                        data-testid="review-reason-input"
                        value={reviewReason}
                        onChange={(e) => setReviewReason(e.target.value)}
                        placeholder="อธิบายสาเหตุ หรือสรุปคำตอบให้ผู้แจ้งเข้าใจง่ายๆ…"
                        className="textarea"
                      />
                    </div>
                    <div>
                      <label className="field-label">แนวทางแก้ไข (สำหรับทีมพัฒนา / AI)</label>
                      <textarea
                        rows={2}
                        data-testid="fix-instructions-input"
                        value={fixInstructions}
                        onChange={(e) => setFixInstructions(e.target.value)}
                        placeholder="ไฟล์หรือขั้นตอนที่ต้องแก้ไข…"
                        className="textarea font-mono text-xs"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="text-xs text-fg-subtle">
                        {rm?.reviewedBy && (
                          <span>
                            ตรวจสอบโดย <strong className="font-medium text-fg-muted">{rm.reviewedBy}</strong>
                          </span>
                        )}
                        {rm?.fixedBy && (
                          <span className="ml-3">
                            ผู้แก้ไข <strong className="font-medium text-fg-muted">{rm.fixedBy}</strong>
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        data-testid="save-review-meta-btn"
                        onClick={() => handleSaveReviewAndStatus()}
                        disabled={savingReview}
                        className="btn btn-secondary btn-sm"
                      >
                        {savedReviewNotice ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            บันทึกแล้ว
                          </>
                        ) : (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            บันทึกผลการตรวจสอบ
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* Conversation */}
              <section>
                <SectionTitle icon={MessagesSquare} right={<span className="count">{issue.comments?.length || 0}</span>}>
                  การสนทนาและคำตอบ
                </SectionTitle>

                {(issue.comments?.length || 0) === 0 ? (
                  <p className="mb-4 rounded-xl border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-subtle">
                    ยังไม่มีข้อความ — พิมพ์คำถามหรือรายละเอียดเพิ่มเติมได้ด้านล่าง
                  </p>
                ) : (
                  <ol className="mb-5 space-y-4">
                    {issue.comments.map((c, idx) => (
                      <li key={c.id} data-testid={`issue-comment-card-${idx}`} className="flex gap-3">
                        <Avatar name={c.author} className="mt-0.5" />
                        <div
                          className={`min-w-0 flex-1 rounded-2xl rounded-tl-md border px-4 py-3 ${
                            c.isResolution
                              ? "border-emerald-400/30 bg-emerald-400/[0.06]"
                              : "border-line bg-white/[0.02]"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-[13px] font-semibold text-fg">{c.author}</span>
                            {c.isResolution && (
                              <span
                                data-testid={`comment-resolution-badge-${idx}`}
                                className="pill h-5 bg-emerald-400/15 px-2 text-[11px] text-emerald-200 ring-emerald-400/30"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                คำตอบ / ดำเนินการเรียบร้อย
                              </span>
                            )}
                            <span className="text-xs text-fg-subtle" title={formatThaiDateTime(c.createdAt)}>
                              {formatRelativeTime(c.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-fg/90">{c.body}</p>
                          {c.attachments && c.attachments.length > 0 && (
                            <div className="mt-3">
                              <AttachmentGallery attachments={c.attachments} />
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                {canComment ? (
                  <form
                    onSubmit={(e) => handleSendComment(e)}
                    data-testid="reply-answer-form"
                    className="rounded-2xl border border-line bg-white/[0.02] transition focus-within:border-emerald-400/40 focus-within:ring-4 focus-within:ring-emerald-400/10"
                  >
                    <textarea
                      rows={3}
                      data-testid="comment-body-input"
                      placeholder="พิมพ์ข้อความ คำตอบ หรือรายละเอียดเพิ่มเติม… (Ctrl+Enter เพื่อส่ง · Ctrl+V เพื่อวางรูป)"
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                          void handleSendComment(e);
                        }
                      }}
                      className="block w-full resize-y bg-transparent px-4 pt-3.5 pb-2 text-sm leading-relaxed text-fg placeholder:text-fg-subtle focus:outline-none"
                    />

                    <div className="px-3 pb-3">
                      <FileUploadZone
                        attachments={commentAttachments}
                        onChange={setCommentAttachments}
                        uploadedBy={commentAuthor}
                        compact
                        onUploadingChange={setIsUploadingReplyFiles}
                      />
                    </div>

                    {commentFeedback && (
                      <div className="px-3 pb-3">
                        <Notice
                          tone={commentFeedback.type === "success" ? "success" : "error"}
                          testId="comment-feedback-banner"
                          icon={
                            commentFeedback.type === "success" ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                            ) : (
                              <CircleAlert className="h-4 w-4 text-rose-300" />
                            )
                          }
                          onDismiss={() => setCommentFeedback(null)}
                        >
                          {commentFeedback.message}
                        </Notice>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2.5">
                      <span className="flex min-w-0 items-center gap-2 text-xs text-fg-subtle">
                        <Avatar name={commentAuthor} size="sm" />
                        <span className="truncate">
                          ตอบในนาม <strong className="font-medium text-fg-muted">{commentAuthor}</strong>
                        </span>
                      </span>

                      <div className="flex flex-wrap items-center gap-2">
                        {canManageStatus && (
                          <button
                            type="button"
                            data-testid="send-answer-resolve-btn"
                            disabled={sendDisabled}
                            onClick={(e) =>
                              void handleSendComment(e, {
                                isResolution: true,
                                nextStatus: "deployed",
                              })
                            }
                            className="btn btn-secondary btn-sm"
                            title="ส่งคำตอบพร้อมไฟล์แนบ แล้วปิดเรื่องว่าเรียบร้อย"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            <span>ส่งคำตอบ & ปิดเรื่อง</span>
                          </button>
                        )}

                        <button
                          type="submit"
                          data-testid="send-comment-btn"
                          disabled={sendDisabled}
                          className="btn btn-primary btn-sm"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>
                            {submitting
                              ? "กำลังส่ง…"
                              : commentAttachments.length > 0
                                ? `ส่งพร้อมไฟล์ (${commentAttachments.length})`
                                : "ส่งข้อความ"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <Notice
                    tone="neutral"
                    testId="viewer-cannot-comment-notice"
                    icon={<Info className="h-4 w-4" />}
                  >
                    บัญชีของคุณมีสิทธิ์ <strong className="text-fg">ดูอย่างเดียว</strong> ในโปรเจกต์นี้ — อ่านคำตอบ
                    ดูรูปภาพ และเปิดไฟล์ PDF ได้ แต่ส่งข้อความไม่ได้
                  </Notice>
                )}
              </section>
            </div>

            {/* ---------------- Side panel ---------------- */}
            <aside className="space-y-6 border-t border-line px-4 py-6 sm:px-6 lg:border-t-0 lg:border-l lg:px-5">
              <div>
                <p className="mb-1.5 text-xs font-semibold text-fg-subtle">ข้อมูลเรื่อง</p>
                <div className="divide-y divide-line">
                  <PropRow label="สถานะ">
                    <StatusBadge status={issue.status} />
                  </PropRow>
                  <PropRow label="ประเภท">
                    {canManageStatus ? (
                      <select
                        value={issue.type}
                        aria-label="ประเภทเรื่อง"
                        onChange={(e) =>
                          void runDrawerUpdate(
                            { type: e.target.value as IssueType },
                            `เปลี่ยนประเภทเป็น "${TYPE_CONFIG[e.target.value as IssueType].label}" สำเร็จแล้ว`
                          )
                        }
                        className="select h-8 w-auto max-w-[170px] text-xs"
                      >
                        {TYPE_ORDER.map((k) => (
                          <option key={k} value={k}>
                            {TYPE_CONFIG[k].label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <TypeBadge type={issue.type} compact />
                    )}
                  </PropRow>
                  <PropRow label="ความเร่งด่วน">
                    {canManageStatus ? (
                      <select
                        value={issue.priority}
                        aria-label="ความเร่งด่วน"
                        onChange={(e) =>
                          void runDrawerUpdate(
                            { priority: e.target.value as IssuePriority },
                            `เปลี่ยนความเร่งด่วนเป็น "${PRIORITY_CONFIG[e.target.value as IssuePriority].label}" สำเร็จแล้ว`
                          )
                        }
                        className="select h-8 w-auto max-w-[170px] text-xs"
                      >
                        {PRIORITY_ORDER.map((k) => (
                          <option key={k} value={k}>
                            {PRIORITY_CONFIG[k].label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <PriorityBadge priority={issue.priority} compact />
                    )}
                  </PropRow>
                  <PropRow label="ผู้ดูแล">
                    {issue.assignee ? (
                      <span className="flex min-w-0 items-center gap-2">
                        <Avatar name={issue.assignee} size="sm" />
                        <span className="truncate">{issue.assignee}</span>
                      </span>
                    ) : (
                      <span className="text-fg-subtle">ยังไม่มีผู้ดูแล</span>
                    )}
                  </PropRow>
                  <PropRow label="โปรเจกต์">
                    <span className="truncate" title={projectName}>
                      {issue.projectKey}
                    </span>
                  </PropRow>
                  <PropRow label="สร้างเมื่อ">
                    <span className="text-fg-muted tabular-nums">{formatThaiDateTime(issue.createdAt)}</span>
                  </PropRow>
                  {userPermission && userPermission !== "none" && (
                    <PropRow label="สิทธิ์ของคุณ">
                      <PermissionBadge permission={userPermission} testId="drawer-user-permission-badge" />
                    </PropRow>
                  )}
                </div>
              </div>

              {subtasks.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-fg-subtle">งานย่อย</p>
                    <span className="text-xs text-fg-subtle tabular-nums">
                      {subtasksDone}/{subtasks.length}
                    </span>
                  </div>
                  <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${(subtasksDone / subtasks.length) * 100}%` }}
                    />
                  </div>
                  <ul className="space-y-1.5">
                    {subtasks.map((s) => (
                      <li key={s.id} className="flex items-start gap-2 text-[13px]">
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                            s.completed ? "bg-emerald-400 text-emerald-950" : "ring-1 ring-line-strong"
                          }`}
                        >
                          {s.completed && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <span className={s.completed ? "text-fg-subtle line-through" : "text-fg-muted"}>{s.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {canManageStatus && (
                <div data-testid="one-click-dev-action-bar">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-fg-subtle">
                    <Terminal className="h-3.5 w-3.5" />
                    เครื่องมือนักพัฒนา
                  </p>
                  <code
                    data-testid="dev-git-branch-code"
                    className="block rounded-lg border border-line bg-black/30 px-3 py-2 font-mono text-[11px] leading-relaxed break-all text-sky-200"
                  >
                    {gitBranchCommand}
                  </code>
                  <div className="mt-2 grid grid-cols-1 gap-1.5">
                    <button
                      type="button"
                      data-testid="copy-git-branch-btn"
                      onClick={handleCopyGitBranch}
                      className="btn btn-secondary btn-sm justify-start"
                    >
                      {copiedGitBranch ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <GitBranch className="h-3.5 w-3.5 text-fg-subtle" />
                      )}
                      <span>{copiedGitBranch ? "คัดลอกคำสั่งแล้ว" : "คัดลอกคำสั่งสร้าง Branch"}</span>
                    </button>
                    <button
                      type="button"
                      data-testid="copy-pr-checklist-btn"
                      onClick={handleCopyPrChecklist}
                      className="btn btn-secondary btn-sm justify-start"
                    >
                      {copiedPrChecklist ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <ListChecks className="h-3.5 w-3.5 text-fg-subtle" />
                      )}
                      <span>{copiedPrChecklist ? "คัดลอก Checklist แล้ว" : "คัดลอก Checklist สำหรับ PR"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyAntigravityPrompt}
                      data-testid="copy-antigravity-prompt-btn"
                      className="btn btn-secondary btn-sm justify-start"
                    >
                      {copiedAgPrompt ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Bot className="h-3.5 w-3.5 text-fg-subtle" />
                      )}
                      <span>{copiedAgPrompt ? "คัดลอกคำสั่งให้ AI แล้ว" : "คัดลอกคำสั่งให้ AI แก้ไข"}</span>
                    </button>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
