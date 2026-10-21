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
} from "./ui/Badges";
import { FileUploadZone, AttachmentGallery } from "./ui/FileAttachmentZone";

interface IssueDetailDrawerProps {
  issue: IssueRecord | null;
  onClose: () => void;
  onUpdate: (code: string, updates: Record<string, unknown>) => Promise<void>;
  onDelete: (code: string) => Promise<void>;
  onAddComment: (
    code: string,
    author: string,
    body: string,
    attachments: AttachmentRecord[]
  ) => Promise<void>;
  onUploadFile: (file: File) => Promise<AttachmentRecord>;
  currentUserName?: string;
}

export function IssueDetailDrawer({
  issue,
  onClose,
  onUpdate,
  onDelete,
  onAddComment,
  currentUserName,
}: IssueDetailDrawerProps) {
  const [commentBody, setCommentBody] = useState("");
  const [commentAuthor, setCommentAuthor] = useState(
    currentUserName || "ผู้ใช้งาน (DevOps)"
  );
  const [commentAttachments, setCommentAttachments] = useState<AttachmentRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAgPrompt, setCopiedAgPrompt] = useState(false);
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
      setEditingTitle(false);
      setEditingDesc(false);
      setConfirmingDelete(false);

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

  const handleSaveReviewAndStatus = async (
    nextStatus?: IssueStatus,
    nextDecision?: "pending" | "fix" | "wont_fix"
  ) => {
    setSavingReview(true);
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
      setTimeout(() => setSavedReviewNotice(false), 2000);
    } finally {
      setSavingReview(false);
    }
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

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim() && commentAttachments.length === 0) return;
    setSubmitting(true);
    try {
      await onAddComment(
        issue.code,
        commentAuthor.trim() || "ผู้ใช้งาน",
        commentBody,
        commentAttachments
      );
      setCommentBody("");
      setCommentAttachments([]);
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
              title="คัดลอกรหัส Issue"
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
          </div>

          <div className="flex items-center gap-2">
            {confirmingDelete ? (
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
            )}
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
          {/* 1. Title & Basic Controls */}
          <div className="space-y-3">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  className="flex-1 bg-slate-900 border border-indigo-500/50 rounded-lg px-3 py-2 text-lg font-bold text-white focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={async () => {
                    await onUpdate(issue.code, { title: titleValue });
                    setEditingTitle(false);
                  }}
                  className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 cursor-pointer"
                >
                  บันทึก
                </button>
              </div>
            ) : (
              <h2
                onClick={() => setEditingTitle(true)}
                className="text-xl font-bold text-white hover:text-indigo-200 cursor-pointer transition-colors leading-snug"
                title="คลิกเพื่อแก้ไขหัวข้อ"
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
                วันที่แจ้ง:{" "}
                {new Date(issue.createdAt).toLocaleString("th-TH", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={issue.type}
                  onChange={(e) =>
                    onUpdate(issue.code, { type: e.target.value as IssueType })
                  }
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200"
                >
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <select
                  value={issue.priority}
                  onChange={(e) =>
                    onUpdate(issue.code, { priority: e.target.value as IssuePriority })
                  }
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200"
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
              {!editingDesc && (
                <button
                  onClick={() => setEditingDesc(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                >
                  แก้ไขรายละเอียด
                </button>
              )}
            </div>

            {editingDesc ? (
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
                      await onUpdate(issue.code, { description: descValue });
                      setEditingDesc(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 cursor-pointer"
                  >
                    บันทึก
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                {issue.description || "ไม่มีรายละเอียดเพิ่มเติม"}
              </div>
            )}
          </div>

          {/* 3. Multi-Image & Multi-File Attachments (Prominent at the top!) */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5" />
              <span>
                รูปภาพและไฟล์แนบ ({issue.attachments?.length || 0} รายการ) — แนบเพิ่มได้หลายรูป หลายไฟล์
              </span>
            </h3>
            <FileUploadZone
              attachments={issue.attachments || []}
              onChange={(next) => {
                void onUpdate(issue.code, { attachments: next });
              }}
              uploadedBy={currentUserName || "ผู้ใช้งาน"}
              compact
            />
          </div>

          {/* 4. 6-Stage Pipeline Status Stepper */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-indigo-400" />
                สถานะการดำเนินการ (คลิกเปลี่ยนสถานะได้ทันที)
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
                    data-testid={`status-step-${stKey}`}
                    onClick={() => onUpdate(issue.code, { status: stKey })}
                    className={`flex flex-col items-start justify-between p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      active
                        ? `${cfg.bg} text-white ring-2 ring-indigo-500/40 shadow-sm`
                        : "bg-slate-950/70 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
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

          {/* 5. Antigravity Review, Fix & Deploy Panel */}
          <div className="bg-gradient-to-br from-indigo-950/35 via-slate-900/90 to-emerald-950/25 border border-indigo-500/30 rounded-xl p-4 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white">
                  ศูนย์ควบคุม Antigravity (วิเคราะห์สาเหตุ → แก้ไขโค้ด → Deploy)
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
                  คัดลอกคำสั่งให้ Antigravity รีวิว+แก้+Deploy
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
                สั่งแก้ (รอ Antigravity แก้)
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
                ไม่แก้ (พร้อมเหตุผล)
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
                แก้และ Deploy สำเร็จแล้ว
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  ผลการวิเคราะห์ / เหตุผล
                </label>
                <textarea
                  rows={2}
                  data-testid="review-reason-input"
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder="ระบุสาเหตุของปัญหา หรือเหตุผลที่ตัดสินใจแก้ / ไม่แก้..."
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-300 mb-1">
                  คำสั่งในการแก้ไข (Fix Instructions)
                </label>
                <textarea
                  rows={2}
                  data-testid="fix-instructions-input"
                  value={fixInstructions}
                  onChange={(e) => setFixInstructions(e.target.value)}
                  placeholder="ระบุขั้นตอนการแก้ไข..."
                  className="w-full bg-slate-950/90 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="text-[11px] text-slate-400">
                  {issue.reviewMeta?.reviewedBy && (
                    <span>
                      รีวิวโดย: <strong className="text-slate-200">{issue.reviewMeta.reviewedBy}</strong>
                    </span>
                  )}
                  {issue.reviewMeta?.fixedBy && (
                    <span className="ml-3">
                      ผู้แก้/Deploy: <strong className="text-emerald-300">{issue.reviewMeta.fixedBy}</strong>
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
                      บันทึกผลรีวิว
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 6. Comments & Discussion (with Multi-Image & Multi-File support) */}
          <div className="space-y-4 pt-3 border-t border-slate-800">
            <h3 className="text-xs font-bold text-slate-300">
              ความคิดเห็น & ประวัติการพูดคุย ({issue.comments?.length || 0})
            </h3>

            <div className="space-y-3">
              {issue.comments?.map((c) => (
                <div
                  key={c.id}
                  className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-indigo-300">{c.author}</span>
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(c.createdAt).toLocaleString("th-TH")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 whitespace-pre-wrap">{c.body}</p>
                  {c.attachments && c.attachments.length > 0 && (
                    <AttachmentGallery attachments={c.attachments} />
                  )}
                </div>
              ))}
            </div>

            {/* Add Comment Form with Multi-Image & Multi-File Upload */}
            <form
              onSubmit={handleSendComment}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3"
            >
              <textarea
                rows={2}
                placeholder="พิมพ์ความคิดเห็นเพิ่มเติม..."
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />

              <FileUploadZone
                attachments={commentAttachments}
                onChange={setCommentAttachments}
                uploadedBy={commentAuthor}
                compact
              />

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  ผู้แสดงความคิดเห็น: <strong className="text-slate-200">{commentAuthor}</strong>
                </span>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? "กำลังส่ง..." : "ส่งความคิดเห็น"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
