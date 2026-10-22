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
  Mic,
  MicOff,
  Wand2,
  Smartphone,
  MessageCircleQuestion,
} from "lucide-react";
import type {
  ProjectRecord,
  IssueRecord,
  IssuePriority,
  IssueType,
  AttachmentItem,
} from "@/lib/types";
import {
  getUserProjectPermission,
  PROJECT_PERMISSION_CONFIG,
  type AuthUser,
} from "@/lib/permissions";
import { FileUploadZone } from "@/components/ui/FileAttachmentZone";
import {
  buildEnvironmentDetailsBlock,
  captureBrowserEnvironment,
  formatSeverityBadge,
  type ClientEnvironmentInfo,
  type QaAssistantResponse,
} from "@/lib/qa-assistant";

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
  initialType,
  currentUser,
  onProjectChange,
  onClose,
  onCreated,
  currentUserName,
}: {
  open: boolean;
  projects: ProjectRecord[];
  defaultProjectKey: string;
  initialType?: IssueType;
  currentUser?: AuthUser | null;
  onProjectChange?: (projectKey: string) => void;
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
  const [type, setType] = useState<IssueType>(initialType || "bug");
  const [priority, setPriority] = useState<IssuePriority>("high");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [similarIssues, setSimilarIssues] = useState<
    Array<{ code: string; title: string; status: string; upvotes: number }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // "Easy for Tester, Rich for Dev" states
  const [inputMode, setInputMode] = useState<"simple" | "technical">("simple");
  const [chatText, setChatText] = useState("");
  const [voiceLang, setVoiceLang] = useState<"th-TH" | "en-US">("th-TH");
  const [isListening, setIsListening] = useState(false);
  const [speechHint, setSpeechHint] = useState<string | null>(null);
  const [isFormattingAi, setIsFormattingAi] = useState(false);
  const [qaResult, setQaResult] = useState<QaAssistantResponse | null>(null);
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const [capturedEnv, setCapturedEnv] = useState<ClientEnvironmentInfo | null>(null);
  const recognitionRef = React.useRef<{ stop: () => void } | null>(null);

  const reporter = currentUserName || "ผู้แจ้งเรื่อง";
  const activePerm = getUserProjectPermission(currentUser, projectKey);
  const isQuestionOnly = activePerm === "question_only";
  const isViewOnly = activePerm === "viewer" || activePerm === "none";

  useEffect(() => {
    if (!open) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    setCapturedEnv(captureBrowserEnvironment());
    if (defaultProjectKey && defaultProjectKey !== "ALL") {
      setProjectKey(defaultProjectKey);
    } else if (projects.length > 0 && (!projectKey || projectKey === "ALL")) {
      setProjectKey(projects[0].key);
    }
    if (initialType) {
      setType(initialType);
    }
  }, [defaultProjectKey, projects, open, initialType]);

  useEffect(() => {
    if (isQuestionOnly && type !== "question") {
      setType("question");
    }
  }, [isQuestionOnly, type]);

  const handleSelectProjectKey = (nextKey: string) => {
    setProjectKey(nextKey);
    onProjectChange?.(nextKey);
  };

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

  const activeProjObj = projects.find((p) => p.key === projectKey);

  const toggleVoiceRecognition = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRec =
      typeof window !== "undefined"
        ? (
            window as unknown as {
              SpeechRecognition?: new () => {
                lang: string;
                interimResults: boolean;
                continuous: boolean;
                onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
                onerror: ((ev: { error?: string }) => void) | null;
                onend: (() => void) | null;
                start: () => void;
                stop: () => void;
              };
              webkitSpeechRecognition?: new () => {
                lang: string;
                interimResults: boolean;
                continuous: boolean;
                onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
                onerror: ((ev: { error?: string }) => void) | null;
                onend: (() => void) | null;
                start: () => void;
                stop: () => void;
              };
            }
          ).SpeechRecognition ||
          (
            window as unknown as {
              webkitSpeechRecognition?: new () => {
                lang: string;
                interimResults: boolean;
                continuous: boolean;
                onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
                onerror: ((ev: { error?: string }) => void) | null;
                onend: (() => void) | null;
                start: () => void;
                stop: () => void;
              };
            }
          ).webkitSpeechRecognition
        : undefined;

    if (!SpeechRec) {
      setSpeechHint("เบราว์เซอร์นี้ไม่รองรับการสั่งงานด้วยเสียง กรุณาพิมพ์ข้อความในช่องแชทแทน");
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = voiceLang;
      rec.interimResults = false;
      rec.continuous = false;
      rec.onresult = (ev) => {
        const transcript = Array.from(ev.results)
          .map((r) => r[0]?.transcript || "")
          .join(" ")
          .trim();
        if (transcript) {
          setChatText((prev) => {
            const next = prev ? `${prev} ${transcript}` : transcript;
            if (!title.trim()) setTitle(next.slice(0, 90));
            return next;
          });
          setSpeechHint(`รับเสียงพูดสำเร็จ: "${transcript}"`);
        }
      };
      rec.onerror = () => {
        setIsListening(false);
        setSpeechHint("ไม่สามารถรับเสียงได้ กรุณาตรวจสอบสิทธิ์ไมโครโฟนหรือพิมพ์แทน");
      };
      rec.onend = () => {
        setIsListening(false);
      };
      recognitionRef.current = rec;
      setIsListening(true);
      setSpeechHint(
        voiceLang === "th-TH"
          ? "🎙️ กำลังฟังเสียงภาษาไทย... พูดอธิบายปัญหาได้เลย"
          : "🎙️ Listening in English... Speak out the issue"
      );
      rec.start();
    } catch {
      setIsListening(false);
    }
  };

  const runAiFormatCheck = async (
    rawInput: string,
    extraAnswer?: string,
    forceCreate = false
  ): Promise<QaAssistantResponse | null> => {
    const cleanInput = rawInput.trim();
    if (!cleanInput) return null;
    setIsFormattingAi(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/format-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: cleanInput,
          clarificationAnswer: extraAnswer,
          projectKey,
          forceCreate,
        }),
      });
      const data = (await res.json()) as QaAssistantResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "วิเคราะห์ข้อความไม่สำเร็จ");
      }
      setQaResult(data);
      if (!data.needsClarification && data.issue) {
        setTitle(data.issue.title);
        setDescription(data.issue.formattedMarkdown);
        if (!isQuestionOnly) {
          setType(data.issue.inferredType || "bug");
        }
        setPriority(data.issue.inferredPriority || "high");
      }
      return data;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการวิเคราะห์ AI");
      return null;
    } finally {
      setIsFormattingAi(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly) {
      setError(`บัญชีของคุณได้รับสิทธิ์ "ดูอย่างเดียว" ในโปรเจกต์ [${projectKey}] ไม่สามารถสร้างรายการใหม่ได้`);
      return;
    }
    if (isUploadingFiles) {
      setError("กรุณารอให้อัปโหลดไฟล์แนบเสร็จสมบูรณ์ก่อนบันทึก");
      return;
    }

    let finalTitle = title.trim();
    let finalDescription = description.trim();
    let finalType: IssueType = isQuestionOnly ? "question" : type;
    let finalPriority: IssuePriority = priority;
    let finalLabels: string[] | undefined;
    let finalSubtasks: string[] | undefined;

    // If user typed in the Simple Chat box without manually filling the technical title, run AI Politeness & Formatter
    if (chatText.trim() && (!qaResult || qaResult.needsClarification)) {
      const formatted = await runAiFormatCheck(
        chatText,
        clarificationAnswer || undefined,
        false
      );
      if (formatted?.needsClarification) {
        // Pause submission and show friendly clarifying question + quick-reply pills
        return;
      }
      if (formatted?.issue) {
        finalTitle = formatted.issue.title;
        finalDescription = formatted.issue.formattedMarkdown;
        if (!isQuestionOnly) {
          finalType = formatted.issue.inferredType || finalType;
        }
        finalPriority = formatted.issue.inferredPriority || finalPriority;
        finalLabels = formatted.issue.labels;
        finalSubtasks = formatted.issue.qaRetestChecklist.map((c) =>
          c.replace(/^- \[[ x]\]\s*/i, "").trim()
        );
      }
    } else if (qaResult && !qaResult.needsClarification && qaResult.issue) {
      finalLabels = qaResult.issue.labels;
      finalSubtasks = qaResult.issue.qaRetestChecklist.map((c) =>
        c.replace(/^- \[[ x]\]\s*/i, "").trim()
      );
    }

    if (!finalTitle && chatText.trim()) {
      finalTitle = chatText.trim().slice(0, 90);
    }
    if (!finalTitle) {
      setError("กรุณาพิมพ์หรือพูดบอกปัญหาที่พบก่อนส่งเรื่อง");
      return;
    }

    // Feature 3: Zero-Effort Environment Auto-Capture appended in collapsible <details> block
    const envToAttach = capturedEnv || captureBrowserEnvironment();
    const envBlock = buildEnvironmentDetailsBlock(envToAttach);
    if (!finalDescription.includes("<summary>📱 Device & Environment Info</summary>")) {
      finalDescription = finalDescription
        ? `${finalDescription}\n\n${envBlock}`
        : envBlock;
    }

    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectKey,
          title: finalTitle,
          description: finalDescription,
          type: finalType,
          priority: finalPriority,
          labels: finalLabels,
          subtasks: finalSubtasks,
          reporter,
          attachments,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "สร้างรายการไม่สำเร็จ");
      }

      onProjectChange?.(projectKey);
      setTitle("");
      setDescription("");
      setChatText("");
      setQaResult(null);
      setClarificationAnswer("");
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

  const quickTypes: Array<{ value: IssueType; label: string; emoji: string }> = [
    { value: "question", label: "สอบถาม / ตั้งคำถาม", emoji: "❓" },
    { value: "bug", label: "แจ้งปัญหาการใช้งาน", emoji: "🐛" },
    { value: "feature", label: "ขอเพิ่มฟีเจอร์ / ปรับปรุง", emoji: "✨" },
    { value: "incident", label: "ด่วนมาก / ระบบเข้าไม่ได้", emoji: "🚨" },
    { value: "performance", label: "ระบบช้า / ค้าง", emoji: "🐢" },
    { value: "security", label: "สิทธิ์การใช้งาน / รหัสผ่าน", emoji: "🔐" },
    { value: "deployment", label: "อัปเดตระบบ / ติดตั้ง", emoji: "🚀" },
  ];

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
            <span>
              {type === "question"
                ? "สอบถาม / ตั้งคำถามเกี่ยวกับการใช้งาน (แนบรูปภาพและไฟล์ได้)"
                : "แจ้งปัญหาการใช้งาน / สอบถามเรื่องใหม่ (แนบรูปภาพและไฟล์ได้หลายรายการ)"}
            </span>
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

            {/* Remembered Project Banner + 1-Click Project Switcher Pills */}
            <div
              data-testid="create-issue-remembered-project-banner"
              className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 p-3 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 font-bold text-emerald-300">
                    📌 จำโปรเจกต์ล่าสุดที่ใช้
                  </span>
                  <span className="font-bold text-white">
                    [{projectKey}] {activeProjObj?.name || ""}
                  </span>
                </div>
                {activePerm !== "none" && (
                  <span
                    data-testid="create-modal-permission-badge"
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${PROJECT_PERMISSION_CONFIG[activePerm].badgeClass}`}
                  >
                    สิทธิ์ในโปรเจกต์นี้: {PROJECT_PERMISSION_CONFIG[activePerm].shortLabel}
                  </span>
                )}
              </div>

              {projects.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] text-slate-400 mr-1">สลับโปรเจกต์ด่วน:</span>
                  {projects.map((p) => {
                    const active = p.key === projectKey;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        data-testid={`quick-project-pill-${p.key}`}
                        onClick={() => handleSelectProjectKey(p.key)}
                        className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition cursor-pointer ${
                          active
                            ? "border-emerald-400 bg-emerald-500/25 text-white shadow-xs"
                            : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
                        }`}
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="font-mono font-bold">[{p.key}]</span>
                        <span className="truncate max-w-[140px]">{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {isQuestionOnly && (
              <div
                data-testid="question-only-permission-notice"
                className="rounded-lg border border-cyan-500/45 bg-cyan-950/30 px-3.5 py-2.5 text-xs text-cyan-200"
              >
                🔒 บัญชีของคุณได้รับสิทธิ์ <strong>&ldquo;สอบถามได้อย่างเดียว&rdquo;</strong> ในโปรเจกต์{" "}
                <strong>[{projectKey}]</strong> — ระบบเลือกหัวข้อ{" "}
                <strong>&ldquo;❓ สอบถาม / ตั้งคำถาม&rdquo;</strong> ให้อัตโนมัติ
              </div>
            )}

            {isViewOnly && (
              <div
                data-testid="viewer-permission-notice"
                className="rounded-lg border border-amber-500/45 bg-amber-950/30 px-3.5 py-2.5 text-xs text-amber-200"
              >
                👀 บัญชีของคุณมีสิทธิ์ <strong>&ldquo;ดูอย่างเดียว&rdquo;</strong> ในโปรเจกต์{" "}
                <strong>[{projectKey}]</strong> จึงไม่สามารถตั้งเรื่องใหม่ในโปรเจกต์นี้ได้
              </div>
            )}

            {/* Feature 1 & 4: "Speak or Type Like Chat" Input + Voice-to-Issue + Mode Toggle */}
            <div
              data-testid="easy-tester-chat-section"
              className="rounded-xl border border-cyan-500/40 bg-gradient-to-br from-cyan-950/30 via-slate-950 to-slate-900 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    <Wand2 className="h-4 w-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      พูดหรือพิมพ์เหมือนคุยแชท — AI จัดระเบียบ Issue ให้นักพัฒนาอัตโนมัติ
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      ไม่ต้องกรอกหลายช่อง พิมพ์หรือกดไมค์พูดอาการที่เจอได้เลย
                    </p>
                  </div>
                </div>

                {/* Mode Toggle: Simple / Technical */}
                <div
                  data-testid="issue-mode-toggle"
                  className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-950 p-0.5 text-[11px]"
                >
                  <button
                    type="button"
                    data-testid="mode-simple-btn"
                    onClick={() => setInputMode("simple")}
                    className={`rounded-md px-2.5 py-1 font-bold transition cursor-pointer ${
                      inputMode === "simple"
                        ? "bg-emerald-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    💬 โหมดง่าย (Simple)
                  </button>
                  <button
                    type="button"
                    data-testid="mode-technical-btn"
                    onClick={() => setInputMode("technical")}
                    className={`rounded-md px-2.5 py-1 font-bold transition cursor-pointer ${
                      inputMode === "technical"
                        ? "bg-cyan-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    🛠️ โหมดละเอียด (Technical)
                  </button>
                </div>
              </div>

              <div className="relative">
                <textarea
                  rows={3}
                  data-testid="chat-issue-input"
                  value={chatText}
                  onChange={(e) => {
                    const val = e.target.value;
                    setChatText(val);
                    setQaResult(null);
                  }}
                  placeholder="เจอปัญหาอะไร หรืออยากให้ทำอะไร พิมพ์หรือพูดบอกได้เลย..."
                  className="w-full rounded-xl border border-cyan-500/40 bg-slate-950/95 p-3.5 pr-28 text-sm text-white placeholder-slate-400 focus:border-emerald-400 focus:outline-none leading-relaxed"
                />

                <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="voice-lang-toggle"
                    onClick={() =>
                      setVoiceLang((prev) => (prev === "th-TH" ? "en-US" : "th-TH"))
                    }
                    className="inline-flex h-8 items-center rounded-lg border border-slate-700 bg-slate-900 px-2 text-[10px] font-mono font-bold text-slate-300 hover:border-cyan-400 cursor-pointer"
                    title="สลับภาษาไมโครโฟน ไทย / อังกฤษ"
                  >
                    {voiceLang === "th-TH" ? "🇹🇭 TH" : "🇺🇸 EN"}
                  </button>

                  <button
                    type="button"
                    data-testid="voice-speech-btn"
                    onClick={toggleVoiceRecognition}
                    className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-bold shadow transition cursor-pointer ${
                      isListening
                        ? "animate-pulse bg-rose-600 text-white"
                        : "bg-cyan-600 text-white hover:bg-cyan-500"
                    }`}
                    title="กดเพื่อพูดอธิบายปัญหาด้วยเสียง (Web Speech API)"
                  >
                    {isListening ? (
                      <>
                        <MicOff className="h-3.5 w-3.5" />
                        <span>หยุดฟัง</span>
                      </>
                    ) : (
                      <>
                        <Mic className="h-3.5 w-3.5" />
                        <span>พูดบอกปัญหา</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {speechHint && (
                <p
                  data-testid="voice-speech-hint"
                  className="text-[11px] font-medium text-cyan-300"
                >
                  {speechHint}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  data-testid="auto-env-capture-indicator"
                  className="inline-flex items-center gap-1.5 text-[11px] text-slate-400"
                >
                  <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
                  <span>
                    แนบข้อมูลอุปกรณ์ เบราว์เซอร์ และขนาดหน้าจอให้นักพัฒนาอัตโนมัติ (ไม่ต้องกรอกเอง)
                  </span>
                </span>

                <button
                  type="button"
                  data-testid="ai-structure-issue-btn"
                  disabled={!chatText.trim() || isFormattingAi}
                  onClick={() =>
                    void runAiFormatCheck(chatText, clarificationAnswer || undefined, false)
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-3 text-xs font-bold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40 cursor-pointer"
                >
                  {isFormattingAi ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                  <span>✨ ให้ AI สรุปและจัดรูปแบบ Issue</span>
                </button>
              </div>

              {/* Feature 4: AI "Missing Info" Politeness Check */}
              {qaResult?.needsClarification && (
                <div
                  data-testid="ai-clarification-box"
                  className="rounded-xl border border-amber-400/60 bg-amber-950/35 p-3.5 space-y-2.5"
                >
                  <div className="flex items-start gap-2">
                    <MessageCircleQuestion className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-amber-200">
                        น้อง AI ขอสอบถามเพิ่มนิดนึงนะคะ เพื่อให้นักพัฒนาแก้ได้ตรงจุดที่สุด:
                      </p>
                      <p
                        data-testid="ai-clarifying-question"
                        className="text-xs font-semibold text-white"
                      >
                        {qaResult.clarifyingQuestion}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {qaResult.quickReplyOptions.map((opt, idx) => (
                      <button
                        key={opt}
                        type="button"
                        data-testid={`ai-quick-reply-${idx}`}
                        onClick={() => {
                          setClarificationAnswer(opt);
                          void runAiFormatCheck(chatText, opt, true);
                        }}
                        className="rounded-lg border border-amber-400/50 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 hover:text-white cursor-pointer"
                      >
                        👉 {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Feature 1: Structured Issue Preview with Severity Badge */}
              {qaResult && !qaResult.needsClarification && qaResult.issue && (
                <div
                  data-testid="ai-structured-preview"
                  className="rounded-xl border border-emerald-500/45 bg-slate-950/90 p-3.5 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <span className="font-bold text-emerald-300">
                      ✅ AI จัดโครงสร้าง Issue พร้อมสำหรับทีมพัฒนาแล้ว:
                    </span>
                    <span
                      data-testid="ai-severity-badge"
                      className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] font-bold text-white"
                    >
                      {formatSeverityBadge(qaResult.issue.severity)}
                    </span>
                  </div>
                  <p className="font-bold text-white">{qaResult.issue.title}</p>
                  <div className="space-y-1 text-[11px] text-slate-300">
                    <p className="font-semibold text-cyan-300">ขั้นตอนการจำลองปัญหา (Steps):</p>
                    {qaResult.issue.stepsToReproduce.map((st) => (
                      <p key={st} className="pl-2">
                        {st}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Technical Mode Live Environment Preview */}
              {inputMode === "technical" && capturedEnv && (
                <div
                  data-testid="technical-mode-env-preview"
                  className="rounded-lg border border-cyan-500/35 bg-slate-950/90 p-3 text-[11px] text-slate-300 space-y-1"
                >
                  <p className="font-bold text-cyan-300">
                    🛠️ โหมดละเอียด (Technical Context Auto-Captured):
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] text-slate-400">
                    <span>OS / Device: {capturedEnv.osAndDevice}</span>
                    <span>Browser: {capturedEnv.browser}</span>
                    <span>Viewport: {capturedEnv.viewportSize}</span>
                    <span>Network: {capturedEnv.networkInfo}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Type Selector Pills (Easy for Non-Dev Users!) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-200">
                เลือกหัวข้อเรื่องที่ต้องการแจ้ง (คลิกเลือกได้ทันที)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {quickTypes.map((qt) => {
                  const isSelected = type === qt.value;
                  const disabled = isQuestionOnly && qt.value !== "question";
                  return (
                    <button
                      key={qt.value}
                      type="button"
                      disabled={disabled}
                      data-testid={`quick-type-pill-${qt.value}`}
                      onClick={() => !disabled && setType(qt.value)}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${
                        isSelected
                          ? "border-emerald-400 bg-emerald-500/25 text-white shadow-xs"
                          : disabled
                          ? "border-slate-800 bg-slate-950/40 text-slate-600 cursor-not-allowed"
                          : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500 cursor-pointer"
                      }`}
                    >
                      <span>{qt.emoji}</span>
                      <span>{qt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 1: Project, Type, Priority Dropdowns */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-200">
                  โปรเจกต์ / ระบบงาน *
                </label>
                <select
                  data-testid="issue-project-select"
                  value={projectKey}
                  onChange={(e) => handleSelectProjectKey(e.target.value)}
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
                  disabled={isQuestionOnly}
                  onChange={(e) => setType(e.target.value as IssueType)}
                  className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none disabled:opacity-60"
                >
                  <option value="question">❓ สอบถาม / ตั้งคำถาม</option>
                  <option value="bug" disabled={isQuestionOnly}>
                    🐛 แจ้งปัญหาการใช้งาน
                  </option>
                  <option value="feature" disabled={isQuestionOnly}>
                    ✨ ขอเพิ่มฟีเจอร์ / ปรับปรุง
                  </option>
                  <option value="incident" disabled={isQuestionOnly}>
                    🚨 ด่วนมาก / ระบบเข้าไม่ได้
                  </option>
                  <option value="performance" disabled={isQuestionOnly}>
                    🐢 ระบบช้า / ค้าง
                  </option>
                  <option value="security" disabled={isQuestionOnly}>
                    🔐 สิทธิ์การใช้งาน / รหัสผ่าน
                  </option>
                  <option value="deployment" disabled={isQuestionOnly}>
                    🚀 อัปเดตระบบ / ติดตั้ง
                  </option>
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
                  <option value="high">ด่วน</option>
                  <option value="medium">ปกติ</option>
                  <option value="critical">ด่วนที่สุด</option>
                  <option value="low">ทั่วไป / ไม่ด่วน</option>
                </select>
              </div>
            </div>

            {/* Row 2: Title */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-200">
                {type === "question"
                  ? "คำถาม / เรื่องที่ต้องการสอบถาม *"
                  : "หัวข้อปัญหา / เรื่องที่ต้องการแจ้ง (AI กรอกให้อัตโนมัติ หรือพิมพ์เองได้) *"}
              </label>
              <input
                type="text"
                required={!chatText.trim()}
                data-testid="issue-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  type === "question"
                    ? "พิมพ์คำถามที่สงสัย เช่น วิธีออกรายงานภาษีทำอย่างไร, ขอไฟล์ PDF คู่มือการใช้งาน..."
                    : "พิมพ์หัวข้อสั้นๆ เช่น บันทึกข้อมูลไม่ได้, ยอดเงินไม่ตรง, หน้าจอค้าง..."
                }
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />

              {similarIssues.length > 0 && (
                <div className="mt-2 rounded-lg border border-amber-500/35 bg-amber-950/20 p-2.5 text-xs">
                  <p className="mb-1 flex items-center gap-1.5 font-semibold text-amber-300">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>พบรายการหรือคำถามที่คล้ายกันในโปรเจกต์นี้:</span>
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
                placeholder={
                  type === "question"
                    ? "ระบุรายละเอียดคำถามเพิ่มเติม หรือแจ้งว่าต้องการให้ส่งคู่มือ PDF / รูปภาพตัวอย่างกลับ..."
                    : "อธิบายอาการที่พบ หรือสิ่งที่ต้องการให้แก้ไข... (สามารถกด Ctrl+V เพื่อวางรูปแคปหน้าจอได้ทันที)"
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-white focus:border-emerald-500 focus:outline-none leading-relaxed"
              />
            </div>

            {/* Row 4: Prominent Multi-Image & Multi-File Upload Zone */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-emerald-300">
                🖼️ แนบรูปภาพ & ไฟล์เอกสารประกอบ (เลือกได้หลายรูป หลายไฟล์ PDF/Excel พร้อมกัน หรือกด Ctrl+V วางรูปได้เรื่อยๆ)
              </label>
              <FileUploadZone
                attachments={attachments}
                onChange={setAttachments}
                uploadedBy={reporter}
                listenGlobalPaste={open}
                onUploadingChange={setIsUploadingFiles}
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
                disabled={isSaving || isViewOnly || isUploadingFiles}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer shadow"
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>
                  {attachments.length > 0
                    ? `บันทึกรายการ (แนบ ${attachments.length} ไฟล์)`
                    : type === "question"
                    ? "ส่งคำถาม / สอบถาม"
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

              <span
                data-testid="mcp-token-always-required"
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[11px] font-semibold text-emerald-200">
                  บังคับใช้ Token ทุกครั้ง
                </span>
              </span>
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
                  disabled={isTestingMcp || !generatedRawToken}
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
                  disabled={isTestingMcp || !generatedRawToken}
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
                  name: "list_projects",
                  desc: "ดึงรายชื่อโปรเจกต์ทั้งหมดที่ได้รับสิทธิ์พร้อมจำนวนงานค้าง",
                },
                {
                  name: "create_project",
                  desc: "สร้างโปรเจกต์ใหม่หลังจากถามยืนยันรหัส ชื่อ และคำอธิบายกับผู้ใช้แล้ว",
                },
                {
                  name: "list_issues",
                  desc: "ค้นหาและกรอง Issue ตามโปรเจกต์ สถานะ และความสำคัญ",
                },
                {
                  name: "get_issue",
                  desc: "อ่านข้อมูลเชิงลึกของ Issue รูปภาพ ไฟล์แนบ และคำสั่งแก้",
                },
                {
                  name: "find_similar_issues",
                  desc: "ค้นหาเรื่องซ้ำซ้อนหรือใกล้เคียงก่อนตั้ง Issue ใหม่",
                },
                {
                  name: "create_issue",
                  desc: "สร้างรายการปัญหาใหม่พร้อมแนบรูปภาพและไฟล์เข้า MinIO อัตโนมัติ",
                },
                {
                  name: "claim_and_plan_issue",
                  desc: "รับงานพร้อมบันทึกแผนการแก้ไขและแตก Subtasks อัตโนมัติ",
                },
                {
                  name: "converse_on_issue",
                  desc: "ให้ Antigravity พูดคุยตอบกลับ แนบไฟล์ ติ๊กงานย่อย และเปลี่ยนสถานะ",
                },
                {
                  name: "update_issue_status",
                  desc: "อัปเดตสถานะ ระดับความสำคัญ ผู้รับผิดชอบ หรือสรุป AI",
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
