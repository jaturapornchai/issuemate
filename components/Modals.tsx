"use client";

import React, { useState, useEffect } from "react";
import {
  FolderPlus,
  Plus,
  Copy,
  Check,
  Sparkles,
  Loader2,
  AlertCircle,
  Play,
  KeyRound,
  Trash2,
  ShieldCheck,
  MessageSquareCode,
  Mic,
  MicOff,
  Wand2,
  Smartphone,
  MessageCircleQuestion,
  BookmarkCheck,
  PlugZap,
  CircleAlert,
  ChevronDown,
  Eye,
  Lock,
  Wrench,
  Settings2,
} from "lucide-react";
import type {
  ProjectRecord,
  IssueRecord,
  IssuePriority,
  IssueType,
  AttachmentItem,
} from "@/lib/types";
import { getUserProjectPermission, type AuthUser } from "@/lib/permissions";
import { FileUploadZone } from "@/components/ui/FileAttachmentZone";
import { Dialog, DialogHeader, DialogFooter, SectionHeading, Notice } from "@/components/ui/Dialog";
import {
  TYPE_CONFIG,
  TYPE_ORDER,
  PRIORITY_CONFIG,
  PRIORITY_ORDER,
  STATUS_CONFIG,
  TONE,
  PermissionBadge,
} from "@/components/ui/Badges";
import {
  buildEnvironmentDetailsBlock,
  captureBrowserEnvironment,
  formatSeverityBadge,
  type ClientEnvironmentInfo,
  type QaAssistantResponse,
} from "@/lib/qa-assistant";
import type { IssueStatus } from "@/lib/types";

const PROJECT_COLORS = ["#10b981", "#3b82f6", "#ef4444", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899"];

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
    <Dialog onClose={onClose} size="sm" testId="create-project-modal" labelledBy="create-project-title">
      <DialogHeader
        titleId="create-project-title"
        icon={<FolderPlus className="h-4 w-4 text-brand-300" />}
        title="สร้างโปรเจกต์ใหม่"
        subtitle="แยกเรื่องของแต่ละระบบงานออกจากกัน เช่น ระบบบัญชี, POS"
        onClose={onClose}
        closeTestId="close-create-project-modal-btn"
      />

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          {error && (
            <Notice tone="error" icon={<CircleAlert className="h-4 w-4 text-rose-300" />}>
              {error}
            </Notice>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="field-label" htmlFor="project-key">
                รหัสย่อ <span className="text-rose-300">*</span>
              </label>
              <input
                id="project-key"
                type="text"
                required
                maxLength={10}
                data-testid="project-key-input"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                placeholder="เช่น POS"
                className="input font-mono uppercase"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="project-name">
                ชื่อโปรเจกต์ <span className="text-rose-300">*</span>
              </label>
              <input
                id="project-name"
                type="text"
                required
                data-testid="project-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น ระบบขายหน้าร้าน"
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="project-desc">
              คำอธิบายสั้นๆ (ถ้ามี)
            </label>
            <input
              id="project-desc"
              type="text"
              data-testid="project-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ระบบนี้ใช้ทำอะไร…"
              className="input"
            />
          </div>

          <div>
            <span className="field-label">สีประจำโปรเจกต์</span>
            <div className="flex items-center gap-2">
              {PROJECT_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setColor(hex)}
                  style={{ backgroundColor: hex }}
                  aria-label={`เลือกสี ${hex}`}
                  aria-pressed={color === hex}
                  className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition ${
                    color === hex ? "ring-2 ring-white ring-offset-2 ring-offset-overlay" : "opacity-70 hover:opacity-100"
                  }`}
                >
                  {color === hex && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="justify-end">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            ยกเลิก
          </button>
          <button type="submit" data-testid="submit-create-project-btn" disabled={isSaving} className="btn btn-primary">
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            สร้างโปรเจกต์
          </button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

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
  const isQuestion = type === "question";

  const toggleVoiceRecognition = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const w =
      typeof window !== "undefined"
        ? (window as unknown as {
            SpeechRecognition?: SpeechRecognitionCtor;
            webkitSpeechRecognition?: SpeechRecognitionCtor;
          })
        : undefined;
    const SpeechRec = w?.SpeechRecognition || w?.webkitSpeechRecognition;

    if (!SpeechRec) {
      setSpeechHint("เบราว์เซอร์นี้ไม่รองรับการสั่งงานด้วยเสียง กรุณาพิมพ์ข้อความแทน");
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
          setSpeechHint(`รับเสียงแล้ว: "${transcript}"`);
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
          ? "กำลังฟัง… พูดอธิบายปัญหาเป็นภาษาไทยได้เลย"
          : "Listening… describe the issue in English"
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
      const formatted = await runAiFormatCheck(chatText, clarificationAnswer || undefined, false);
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

    // Zero-Effort Environment Auto-Capture appended in collapsible <details> block
    const envToAttach = capturedEnv || captureBrowserEnvironment();
    const envBlock = buildEnvironmentDetailsBlock(envToAttach);
    if (!finalDescription.includes("<summary>📱 Device & Environment Info</summary>")) {
      finalDescription = finalDescription ? `${finalDescription}\n\n${envBlock}` : envBlock;
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

  return (
    <Dialog onClose={onClose} size="lg" testId="create-issue-modal" labelledBy="create-issue-title">
      <DialogHeader
        titleId="create-issue-title"
        icon={
          isQuestion ? (
            <MessageCircleQuestion className="h-4 w-4 text-sky-300" />
          ) : (
            <Plus className="h-4 w-4 text-brand-300" strokeWidth={2.5} />
          )
        }
        title={isQuestion ? "ถามคำถามใหม่" : "แจ้งปัญหา / เรื่องใหม่"}
        subtitle="เล่าแบบง่ายๆ เหมือนคุยแชท แนบรูปได้ — ทีมงานจะได้รับแจ้งทันที"
        onClose={onClose}
        closeTestId="close-create-issue-modal-btn"
      />

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-5 sm:px-6">
          {error && (
            <Notice tone="error" icon={<CircleAlert className="h-4 w-4 text-rose-300" />} onDismiss={() => setError(null)}>
              {error}
            </Notice>
          )}

          {/* Target project (remembered) */}
          <div
            data-testid="create-issue-remembered-project-banner"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-white/[0.02] px-3.5 py-3"
          >
            <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
              <BookmarkCheck className="h-3.5 w-3.5 text-brand-400" />
              ส่งเข้าโปรเจกต์
            </span>
            <div className="relative min-w-0 flex-1 sm:max-w-[320px]">
              <span
                className="pointer-events-none absolute top-1/2 left-3 h-2.5 w-2.5 -translate-y-1/2 rounded-[4px]"
                style={{ backgroundColor: activeProjObj?.color || "#6d7787" }}
              />
              <select
                data-testid="issue-project-select"
                value={projectKey}
                onChange={(e) => handleSelectProjectKey(e.target.value)}
                aria-label="โปรเจกต์ที่จะส่งเรื่องเข้า"
                className="select h-9 pl-8 font-medium"
              >
                {projects.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name} · {p.key}
                  </option>
                ))}
              </select>
            </div>
            {activePerm !== "none" && (
              <PermissionBadge
                permission={activePerm}
                testId="create-modal-permission-badge"
                className="ml-auto"
              />
            )}
          </div>

          {isQuestionOnly && (
            <Notice
              tone="info"
              testId="question-only-permission-notice"
              icon={<Lock className="h-4 w-4 text-sky-300" />}
            >
              บัญชีของคุณ<strong className="font-semibold">ถามคำถามได้อย่างเดียว</strong>ในโปรเจกต์{" "}
              <strong className="font-semibold">{projectKey}</strong> — ระบบเลือกประเภท “คำถาม” ให้อัตโนมัติ
            </Notice>
          )}

          {isViewOnly && (
            <Notice tone="warning" testId="viewer-permission-notice" icon={<Eye className="h-4 w-4 text-amber-300" />}>
              บัญชีของคุณมีสิทธิ์<strong className="font-semibold">ดูอย่างเดียว</strong>ในโปรเจกต์{" "}
              <strong className="font-semibold">{projectKey}</strong> จึงส่งเรื่องใหม่ในโปรเจกต์นี้ไม่ได้
            </Notice>
          )}

          {/* Step 1 — type */}
          <section>
            <SectionHeading step={1} title="เรื่องที่ต้องการแจ้ง" hint="เลือกหัวข้อที่ใกล้เคียงที่สุด" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-12">
              {TYPE_ORDER.map((t, idx) => {
                const cfg = TYPE_CONFIG[t];
                const Icon = cfg.icon;
                const isSelected = type === t;
                const disabled = isQuestionOnly && t !== "question";
                const spanClass =
                  idx === 0
                    ? "col-span-2 sm:col-span-4"
                    : idx < 3
                    ? "sm:col-span-4"
                    : "sm:col-span-3";
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={disabled}
                    aria-pressed={isSelected}
                    data-testid={`quick-type-pill-${t}`}
                    onClick={() => !disabled && setType(t)}
                    className={`${spanClass} flex cursor-pointer flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-35 ${
                      isSelected
                        ? "border-brand-400/50 bg-brand-400/[0.07] ring-1 ring-brand-400/30 ring-inset"
                        : "border-line bg-white/[0.02] hover:border-line-strong hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${TONE[cfg.tone].soft}`}>
                      <Icon className={`h-4 w-4 ${TONE[cfg.tone].text}`} />
                    </span>
                    <span className="text-[13px] leading-tight font-medium text-fg" title={cfg.label}>
                      {cfg.shortLabel}
                    </span>
                    <span className="text-[11px] leading-tight text-fg-subtle">{cfg.hint}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Step 2 — describe (chat / voice / AI) */}
          <section data-testid="easy-tester-chat-section">
            <SectionHeading
              step={2}
              title="เล่าให้เราฟัง"
              hint="พิมพ์หรือกดไมค์พูดได้เลย แล้วให้ AI ช่วยเรียบเรียงเป็นหัวข้อให้"
              right={
                <div
                  data-testid="issue-mode-toggle"
                  className="flex shrink-0 items-center rounded-lg border border-line bg-black/20 p-0.5 text-xs"
                >
                  <button
                    type="button"
                    data-testid="mode-simple-btn"
                    onClick={() => setInputMode("simple")}
                    aria-pressed={inputMode === "simple"}
                    className={`cursor-pointer rounded-md px-2.5 py-1 transition ${
                      inputMode === "simple" ? "bg-white/10 font-medium text-fg" : "text-fg-subtle hover:text-fg"
                    }`}
                  >
                    แบบง่าย
                  </button>
                  <button
                    type="button"
                    data-testid="mode-technical-btn"
                    onClick={() => setInputMode("technical")}
                    aria-pressed={inputMode === "technical"}
                    className={`cursor-pointer rounded-md px-2.5 py-1 transition ${
                      inputMode === "technical" ? "bg-white/10 font-medium text-fg" : "text-fg-subtle hover:text-fg"
                    }`}
                  >
                    แบบละเอียด
                  </button>
                </div>
              }
            />

            <div
              className={`rounded-2xl border bg-black/20 transition focus-within:ring-4 focus-within:ring-brand-400/10 ${
                isListening ? "border-rose-400/50" : "border-line focus-within:border-brand-400/50"
              }`}
            >
              <textarea
                rows={3}
                data-testid="chat-issue-input"
                value={chatText}
                onChange={(e) => {
                  setChatText(e.target.value);
                  setQaResult(null);
                }}
                placeholder={
                  isQuestion
                    ? "อยากถามเรื่องอะไร เล่าได้เลย เช่น “ออกรายงานภาษีซื้อเป็น PDF ยังไง”"
                    : "เจอปัญหาอะไร เล่าได้เลย เช่น “กดบันทึกใบกำกับภาษีแล้วยอด VAT เป็น 0”"
                }
                className="block w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-sm leading-relaxed text-fg placeholder:text-fg-subtle focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-1.5 px-2.5 pb-2.5">
                <button
                  type="button"
                  data-testid="voice-speech-btn"
                  onClick={toggleVoiceRecognition}
                  className={`btn btn-xs ${
                    isListening ? "animate-pulse bg-rose-500 text-white" : "btn-secondary"
                  }`}
                  title="กดเพื่อพูดอธิบายปัญหาด้วยเสียง"
                >
                  {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {isListening ? "หยุดฟัง" : "พูดบอกปัญหา"}
                </button>
                <button
                  type="button"
                  data-testid="voice-lang-toggle"
                  onClick={() => setVoiceLang((prev) => (prev === "th-TH" ? "en-US" : "th-TH"))}
                  className="btn btn-ghost btn-xs font-mono"
                  title="สลับภาษาไมโครโฟน ไทย / อังกฤษ"
                >
                  {voiceLang === "th-TH" ? "TH" : "EN"}
                </button>
                <button
                  type="button"
                  data-testid="ai-structure-issue-btn"
                  disabled={!chatText.trim() || isFormattingAi}
                  onClick={() => void runAiFormatCheck(chatText, clarificationAnswer || undefined, false)}
                  className="btn btn-xs ml-auto border border-violet-400/30 bg-violet-400/10 text-violet-100 hover:bg-violet-400/20"
                >
                  {isFormattingAi ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                  )}
                  ให้ AI ช่วยเรียบเรียง
                </button>
              </div>
            </div>

            {speechHint && (
              <p data-testid="voice-speech-hint" className="mt-2 text-xs text-fg-muted">
                {speechHint}
              </p>
            )}

            <p
              data-testid="auto-env-capture-indicator"
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-fg-subtle"
            >
              <Smartphone className="h-3.5 w-3.5 text-brand-400/80" />
              ระบบแนบข้อมูลอุปกรณ์และเบราว์เซอร์ให้ทีมพัฒนาอัตโนมัติ ไม่ต้องกรอกเอง
            </p>

            {/* AI "Missing Info" Politeness Check */}
            {qaResult?.needsClarification && (
              <div
                data-testid="ai-clarification-box"
                className="mt-3 animate-scale-in rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-4"
              >
                <div className="flex items-start gap-2.5">
                  <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <div>
                    <p className="text-xs text-amber-200/80">ขอถามเพิ่มอีกนิด เพื่อให้แก้ได้ตรงจุด</p>
                    <p data-testid="ai-clarifying-question" className="mt-0.5 text-[13px] font-medium text-fg">
                      {qaResult.clarifyingQuestion}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 pl-6">
                  {qaResult.quickReplyOptions.map((opt, idx) => (
                    <button
                      key={opt}
                      type="button"
                      data-testid={`ai-quick-reply-${idx}`}
                      onClick={() => {
                        setClarificationAnswer(opt);
                        void runAiFormatCheck(chatText, opt, true);
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Structured Issue Preview with Severity Badge */}
            {qaResult && !qaResult.needsClarification && qaResult.issue && (
              <div
                data-testid="ai-structured-preview"
                className="mt-3 animate-scale-in rounded-xl border border-violet-400/20 bg-violet-400/[0.05] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-200">
                    <Wand2 className="h-3.5 w-3.5" />
                    AI เรียบเรียงให้แล้ว — เติมหัวข้อในขั้นที่ 3 ให้อัตโนมัติ
                  </span>
                  <span data-testid="ai-severity-badge" className="pill bg-white/[0.05] text-fg ring-line">
                    {formatSeverityBadge(qaResult.issue.severity)}
                  </span>
                </div>
                <p className="mt-2 text-[13px] font-semibold text-fg">{qaResult.issue.title}</p>
                {qaResult.issue.stepsToReproduce.length > 0 && (
                  <div className="mt-2 space-y-0.5 text-xs text-fg-muted">
                    <p className="text-fg-subtle">ขั้นตอนที่ทำให้เกิดปัญหา</p>
                    {qaResult.issue.stepsToReproduce.map((st) => (
                      <p key={st}>{st}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Technical Mode Live Environment Preview */}
            {inputMode === "technical" && capturedEnv && (
              <div
                data-testid="technical-mode-env-preview"
                className="mt-3 rounded-xl border border-line bg-white/[0.02] p-3.5"
              >
                <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-fg-muted">
                  <Settings2 className="h-3.5 w-3.5" />
                  ข้อมูลเทคนิคที่จะแนบให้อัตโนมัติ
                </p>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-[11px] sm:grid-cols-2">
                  {(
                    [
                      ["ระบบปฏิบัติการ / อุปกรณ์", capturedEnv.osAndDevice],
                      ["เบราว์เซอร์", capturedEnv.browser],
                      ["ขนาดหน้าจอ", capturedEnv.viewportSize],
                      ["เครือข่าย", capturedEnv.networkInfo],
                    ] as Array<[string, string]>
                  ).map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-fg-subtle">{label}</dt>
                      <dd className="truncate font-mono text-fg-muted">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </section>

          {/* Step 3 — title, details, priority */}
          <section className="space-y-4">
            <SectionHeading
              step={3}
              title={isQuestion ? "ตรวจทานคำถาม" : "ตรวจทานหัวข้อและรายละเอียด"}
              hint="AI เติมให้อัตโนมัติ หรือพิมพ์เองก็ได้"
            />
            <div>
              <label className="field-label" htmlFor="issue-title">
                {isQuestion ? "คำถาม" : "หัวข้อเรื่อง"} <span className="text-rose-300">*</span>
              </label>
              <input
                id="issue-title"
                type="text"
                required={!chatText.trim()}
                data-testid="issue-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  isQuestion
                    ? "เช่น วิธีออกรายงานภาษีซื้อเป็น PDF"
                    : "เช่น บันทึกใบกำกับภาษีแล้วยอด VAT เป็น 0"
                }
                className="input h-11 text-sm"
              />

              {similarIssues.length > 0 && (
                <div className="mt-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-200">
                    <AlertCircle className="h-3.5 w-3.5" />
                    มีเรื่องคล้ายกันอยู่แล้ว — ลองดูก่อนส่ง จะได้ไม่ซ้ำ
                  </p>
                  <div className="space-y-1">
                    {similarIssues.map((sim) => (
                      <div key={sim.code} className="flex items-center gap-2 rounded-lg bg-black/20 px-2.5 py-1.5 text-xs">
                        <span className="shrink-0 font-mono text-fg-subtle">{sim.code}</span>
                        <span className="min-w-0 flex-1 truncate text-fg-muted">{sim.title}</span>
                        <span className="shrink-0 text-fg-subtle">
                          {STATUS_CONFIG[sim.status as IssueStatus]?.shortLabel || sim.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="field-label" htmlFor="issue-desc">
                รายละเอียดเพิ่มเติม <span className="text-fg-subtle">(ถ้ามี)</span>
              </label>
              <textarea
                id="issue-desc"
                rows={3}
                data-testid="issue-desc-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  isQuestion
                    ? "รายละเอียดคำถาม หรือบอกว่าต้องการคู่มือ PDF / รูปตัวอย่างกลับ…"
                    : "อาการที่พบ ขั้นตอนที่ทำ หรือสิ่งที่อยากให้แก้…"
                }
                className="textarea"
              />
            </div>

            <div>
              <span className="field-label">ความเร่งด่วน</span>
              <div role="radiogroup" aria-label="ความเร่งด่วน" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PRIORITY_ORDER.map((p) => {
                  const cfg = PRIORITY_CONFIG[p];
                  const Icon = cfg.icon;
                  const active = priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      data-testid={`priority-option-${p}`}
                      onClick={() => setPriority(p)}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                        active
                          ? "border-white/20 bg-white/[0.07] ring-1 ring-white/10 ring-inset"
                          : "border-line hover:border-line-strong hover:bg-white/[0.03]"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${TONE[cfg.tone].text}`} />
                      <span className="min-w-0">
                        <span className="block text-[13px] leading-tight font-medium text-fg">{cfg.label}</span>
                        <span className="block truncate text-[11px] text-fg-subtle">{cfg.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Step 4 — attachments */}
          <section>
            <SectionHeading
              step={4}
              title="แนบรูปภาพหรือไฟล์"
              hint="ไม่บังคับ แต่ภาพหน้าจอช่วยให้แก้ได้เร็วขึ้นมาก"
            />
            <FileUploadZone
              attachments={attachments}
              onChange={setAttachments}
              uploadedBy={reporter}
              listenGlobalPaste={open}
              onUploadingChange={setIsUploadingFiles}
            />
          </section>
        </div>

        <DialogFooter>
          <span className="min-w-0 truncate text-xs text-fg-subtle">
            ผู้แจ้ง <strong className="font-medium text-fg-muted">{reporter}</strong>
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              ยกเลิก
            </button>
            <button
              type="submit"
              data-testid="submit-create-issue-btn"
              disabled={isSaving || isViewOnly || isUploadingFiles}
              className="btn btn-primary"
            >
              {isSaving || isFormattingAi ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isQuestion ? (
                <MessageCircleQuestion className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" strokeWidth={2.5} />
              )}
              <span>
                {attachments.length > 0
                  ? `${isQuestion ? "ส่งคำถาม" : "ส่งเรื่อง"} (แนบ ${attachments.length} ไฟล์)`
                  : isQuestion
                    ? "ส่งคำถาม"
                    : "ส่งเรื่อง"}
              </span>
            </button>
          </div>
        </DialogFooter>
      </form>
    </Dialog>
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

const MCP_TOOLS: Array<{ name: string; desc: string }> = [
  { name: "get_ai_context", desc: "ดึงคิวรอรีวิว คิวรอแก้/Deploy และคิวคำถาม เฉพาะโปรเจกต์ที่ระบุ" },
  { name: "submit_claude_review", desc: "บันทึกผลวิเคราะห์: สั่งแก้ (ready_to_fix) หรือไม่แก้ (wont_fix)" },
  { name: "claim_for_fix", desc: "รับงานเข้าสู่สถานะกำลังแก้ (fixing) — เฉพาะเรื่องที่ผู้ดูแลอนุมัติแล้ว" },
  { name: "mark_deployed", desc: "บันทึกผลหลังแก้และ Deploy สำเร็จ (deployed)" },
  { name: "list_projects", desc: "รายชื่อโปรเจกต์ที่ได้รับสิทธิ์ พร้อมจำนวนงานค้าง" },
  { name: "create_project", desc: "สร้างโปรเจกต์ใหม่หลังถามยืนยันกับผู้ใช้แล้ว" },
  { name: "list_issues", desc: "ค้นหาและกรอง Issue ตามโปรเจกต์ สถานะ ความสำคัญ" },
  { name: "get_issue", desc: "อ่านรายละเอียด รูปภาพ ไฟล์แนบ และคำสั่งแก้" },
  { name: "find_similar_issues", desc: "ค้นหาเรื่องซ้ำก่อนสร้าง Issue ใหม่" },
  { name: "create_issue", desc: "สร้างเรื่องใหม่พร้อมแนบรูปและไฟล์" },
  { name: "claim_and_plan_issue", desc: "รับงานพร้อมบันทึกแผนและแตกงานย่อย" },
  { name: "converse_on_issue", desc: "ตอบกลับ แนบไฟล์ ติ๊กงานย่อย เปลี่ยนสถานะ" },
  { name: "update_issue_status", desc: "อัปเดตสถานะ ความสำคัญ หรือผู้รับผิดชอบ" },
  { name: "get_monitor_summary", desc: "สรุป KPI ของโปรเจกต์แบบเรียลไทม์" },
  { name: "claim_question", desc: "รับคำถามจากคิวไปตอบ (กันตอบซ้ำ)" },
  { name: "answer_question", desc: "ส่งคำตอบ ระบบสร้าง PDF ให้เองและปิดเรื่อง" },
];

function CopyButton({
  copied,
  onClick,
  label = "คัดลอก",
  testId,
  variant = "secondary",
}: {
  copied: boolean;
  onClick: () => void;
  label?: string;
  testId?: string;
  variant?: "secondary" | "primary" | "ghost";
}) {
  return (
    <button type="button" data-testid={testId} onClick={onClick} className={`btn btn-${variant} btn-xs`}>
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "คัดลอกแล้ว" : label}
    </button>
  );
}

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

  // MCP Token Generator States (Bound to Project + Gmail User ID)
  const [tokens, setTokens] = useState<McpTokenPublic[]>([]);
  const [availableProjects, setAvailableProjects] = useState<Array<{ key: string; name: string }>>(
    propProjects || []
  );
  const [selectedProjectKey, setSelectedProjectKey] = useState<string>(
    defaultProjectKey && defaultProjectKey !== "ALL"
      ? defaultProjectKey
      : propProjects?.[0]?.key || "DEVOPS"
  );
  const [allowedUsers, setAllowedUsers] = useState<Array<{ email: string; name: string; role: string }>>([]);
  const [ownerEmail, setOwnerEmail] = useState<string>(currentUserEmail || "");
  const [ownerName, setOwnerName] = useState<string>(currentUserName || "ผู้ใช้งาน (Antigravity)");
  const [newTokenName, setNewTokenName] = useState<string>("Antigravity");
  const [newTokenRole] = useState<McpTokenPublic["agentRole"]>("antigravity_fixer");
  const [generatedRawToken, setGeneratedRawToken] = useState<string | null>(null);
  const [generatedForEmail, setGeneratedForEmail] = useState<string | null>(null);
  const [generatedForProject, setGeneratedForProject] = useState<string | null>(null);
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
        setSelectedProjectKey((prev) => (prev && prev !== "ALL" ? prev : data.projects[0].key));
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

  const origin = typeof window !== "undefined" ? window.location.origin : "https://issue.dedezoom.com";

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
      setTokenError("กรุณาเลือกโปรเจกต์ที่ต้องการผูกกับ MCP Token เพื่อป้องกันความผิดพลาด");
      return;
    }
    if (!ownerEmail.trim() || !ownerEmail.includes("@")) {
      setTokenError("กรุณาระบุอีเมล Gmail ที่ได้รับอนุญาตเพื่อผูกเป็นรหัสผู้ใช้งาน");
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

  const activeTokenExample = generatedRawToken || "ism_live_วาง_TOKEN_ที่สร้างจากขั้นที่_1";
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
4. แก้โค้ดได้เฉพาะเรื่องที่ \`aiFixAllowed: true\` (ผู้ดูแลกดอนุมัติให้ AI แก้ไขแล้ว หรือโปรเจกต์เปิดโหมดอัตโนมัติ) — เรื่องที่ยังไม่อนุมัติให้ข้ามไปและห้ามแก้โค้ด
5. เรียก \`claim_for_fix\` เพื่อรับงานเข้าสู่สถานะกำลังแก้ (fixing) จากนั้นลงมือแก้ไขโค้ดในโปรเจกต์นี้ ทดสอบให้ผ่านจริง และ Deploy ขึ้นเซิร์ฟเวอร์
6. เมื่อแก้ไขและ Deploy เสร็จเรียบร้อยแล้ว ให้เรียก \`mark_deployed\` บันทึกผลการแก้ไขและผลการ Deploy กลับเข้า IssueMate ทันที`;

  const unmaskedUsers = allowedUsers.filter((u) => !u.email.includes("***"));

  return (
    <Dialog onClose={onClose} size="xl" testId="ai-mcp-modal" labelledBy="ai-mcp-title">
      <DialogHeader
        titleId="ai-mcp-title"
        icon={<PlugZap className="h-4 w-4 text-sky-300" />}
        title="เชื่อมต่อ AI ผ่าน MCP"
        subtitle="ให้ AI (Antigravity / Claude Code / Codex) ดึงงานของโปรเจกต์ไปตรวจสอบ แก้ไข และรายงานผลกลับอัตโนมัติ"
        onClose={onClose}
        closeTestId="close-mcp-modal-btn"
        actions={
          <span
            data-testid="mcp-token-always-required"
            className="pill hidden bg-emerald-400/10 text-emerald-200 ring-emerald-400/25 sm:inline-flex"
            title="ทุกการเรียก MCP ต้องใช้ Token ที่ผูกกับโปรเจกต์เสมอ"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            ต้องใช้ Token ทุกครั้ง
          </span>
        }
      />

      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-6 sm:px-6">
        {/* Step 1: Token generator */}
        <section data-testid="mcp-token-generator-section">
          <SectionHeading
            step={1}
            title="สร้าง Token ผูกกับโปรเจกต์"
            hint="Token จะล็อกไว้กับโปรเจกต์และ Gmail ที่เลือก — AI จะดึงหรือแก้เรื่องข้ามโปรเจกต์ไม่ได้"
          />

          <form onSubmit={handleGenerateToken} className="card-inset space-y-3 p-4">
            {tokenError && (
              <Notice tone="error" icon={<CircleAlert className="h-4 w-4 text-rose-300" />}>
                {tokenError}
              </Notice>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="sm:col-span-4">
                <label className="field-label" htmlFor="mcp-project">
                  โปรเจกต์ <span className="text-rose-300">*</span>
                </label>
                <select
                  id="mcp-project"
                  data-testid="mcp-token-project-select"
                  value={activeProject}
                  onChange={(e) => setSelectedProjectKey(e.target.value)}
                  className="select font-medium"
                >
                  {availableProjects.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name} · {p.key}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-5">
                <label className="field-label" htmlFor="mcp-gmail">
                  Gmail ที่ได้รับอนุญาต <span className="text-rose-300">*</span>
                </label>
                <input
                  id="mcp-gmail"
                  type="email"
                  required
                  data-testid="mcp-token-gmail-input"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="input font-mono text-xs"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="field-label" htmlFor="mcp-name">
                  ชื่อเครื่อง / Agent <span className="text-rose-300">*</span>
                </label>
                <input
                  id="mcp-name"
                  type="text"
                  required
                  data-testid="mcp-token-name-input"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  placeholder="เช่น Antigravity"
                  className="input"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              {unmaskedUsers.length > 0 ? (
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="text-xs text-fg-subtle">เลือกเร็ว:</span>
                  {unmaskedUsers.slice(0, 4).map((u) => (
                    <button
                      key={u.email}
                      type="button"
                      onClick={() => {
                        setOwnerEmail(u.email);
                        setOwnerName(u.name);
                        setNewTokenName(`Antigravity (${activeProject})`);
                      }}
                      className="pill cursor-pointer bg-white/[0.04] text-fg-muted ring-line transition hover:text-fg hover:ring-line-strong"
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              ) : (
                <span />
              )}
              <button
                type="submit"
                data-testid="generate-mcp-token-btn"
                disabled={isGeneratingToken}
                className="btn btn-primary btn-sm"
              >
                {isGeneratingToken ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                สร้าง Token
              </button>
            </div>
          </form>

          {generatedRawToken && (
            <div
              data-testid="generated-token-banner"
              className="mt-3 animate-scale-in rounded-xl border border-emerald-400/30 bg-emerald-400/[0.06] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] text-emerald-100">
                  สร้าง Token สำเร็จ — ล็อกโปรเจกต์ <strong className="font-semibold">{generatedForProject}</strong> ·{" "}
                  <span className="font-mono text-xs">{generatedForEmail}</span>
                </p>
                <CopyButton
                  testId="copy-generated-token-btn"
                  copied={copiedKey === "raw-token"}
                  onClick={() => copyText("raw-token", generatedRawToken)}
                  label="คัดลอก Token"
                  variant="primary"
                />
              </div>
              <code
                data-testid="generated-raw-token-value"
                className="mt-2.5 block w-full rounded-lg border border-line bg-black/40 px-3 py-2 font-mono text-xs break-all text-emerald-200 select-all"
              >
                {generatedRawToken}
              </code>
              <p className="mt-2 text-xs text-emerald-200/70">
                เก็บ Token นี้ไว้ให้ดี — ระบบจะแสดงเต็มเพียงครั้งเดียว
              </p>
            </div>
          )}

          <div className="mt-4">
            <p className="mb-2 text-xs text-fg-subtle">Token ที่ใช้งานอยู่ ({tokens.length})</p>
            {tokens.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line py-5 text-center text-xs text-fg-subtle">
                ยังไม่มี Token — กรอกข้อมูลด้านบนแล้วกด “สร้าง Token”
              </div>
            ) : (
              <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {tokens.map((tok) => (
                  <div
                    key={tok.id}
                    data-testid={`mcp-token-row-${tok.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-white/[0.015] px-3.5 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-medium text-fg">{tok.name}</span>
                        <span
                          data-testid={`token-project-${tok.id}`}
                          className="pill h-5 bg-white/[0.05] px-2 font-mono text-[11px] text-fg-muted ring-line"
                          title={`ล็อกเฉพาะโปรเจกต์: ${tok.projectKey}`}
                        >
                          {tok.projectKey}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
                        <span data-testid={`token-gmail-${tok.id}`} className="font-mono" title={`Gmail: ${tok.ownerEmail}`}>
                          {tok.ownerEmail}
                        </span>
                        <span>·</span>
                        <code className="font-mono">{tok.maskedToken}</code>
                      </div>
                    </div>
                    <span className="text-xs text-fg-subtle">
                      เรียกใช้{" "}
                      <strong data-testid={`token-usage-${tok.id}`} className="font-semibold text-fg-muted tabular-nums">
                        {tok.usageCount}
                      </strong>{" "}
                      ครั้ง
                      {tok.lastUsedAt && (
                        <span className="ml-1">
                          · ล่าสุด{" "}
                          {new Date(tok.lastUsedAt).toLocaleTimeString("th-TH", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      data-testid={`revoke-token-btn-${tok.id}`}
                      onClick={() => handleRevokeToken(tok.id)}
                      className="btn btn-ghost btn-xs hover:!text-rose-300"
                      title="ยกเลิก Token นี้"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      ยกเลิก
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Step 2: Config */}
        <section>
          <SectionHeading
            step={2}
            title="ใส่การตั้งค่าในเครื่องมือ AI"
            hint="คัดลอกไปวางใน mcp_config.json / .mcp.json — เลือกแบบใดแบบหนึ่ง"
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="card-inset overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
                <span className="text-xs font-medium text-fg">
                  แบบที่ 1 · HTTP + Header <span className="font-normal text-brand-300">(แนะนำ)</span>
                </span>
                <CopyButton copied={copiedKey === "http"} onClick={() => copyText("http", mcpHttpConfig)} variant="ghost" />
              </div>
              <pre
                data-testid="mcp-http-config-box"
                className="overflow-x-auto p-3.5 font-mono text-[11px] leading-relaxed text-fg-muted"
              >
                {mcpHttpConfig}
              </pre>
            </div>
            <div className="card-inset overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
                <span className="text-xs font-medium text-fg">แบบที่ 2 · URL Query</span>
                <CopyButton
                  copied={copiedKey === "url-query"}
                  onClick={() => copyText("url-query", mcpUrlQueryConfig)}
                  variant="ghost"
                />
              </div>
              <pre
                data-testid="mcp-url-query-config-box"
                className="overflow-x-auto p-3.5 font-mono text-[11px] leading-relaxed text-fg-muted"
              >
                {mcpUrlQueryConfig}
              </pre>
            </div>
          </div>
        </section>

        {/* Step 3: Prompt */}
        <section data-testid="new-session-antigravity-prompt-section">
          <SectionHeading
            step={3}
            title={`คัดลอกคำสั่งเริ่มงานให้ AI (โปรเจกต์ ${targetConfigProject})`}
            hint="วางในแชทของ AI เมื่อเปิด Session ใหม่ เพื่อให้ดึงและแก้งานถูกโปรเจกต์"
            right={
              <CopyButton
                testId="copy-new-session-prompt-btn"
                copied={copiedKey === "new-session-prompt"}
                onClick={() => copyText("new-session-prompt", newSessionAntigravityPrompt)}
                label="คัดลอกคำสั่ง"
                variant="primary"
              />
            }
          />
          <pre
            data-testid="new-session-antigravity-prompt"
            className="max-h-56 overflow-y-auto rounded-xl border border-line bg-black/30 p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-fg-muted"
          >
            {newSessionAntigravityPrompt}
          </pre>
        </section>

        {/* Step 4: Test */}
        <section>
          <SectionHeading
            step={4}
            title="ทดสอบการเชื่อมต่อ"
            hint={
              generatedRawToken
                ? `ยิงคำสั่งจริงไปที่ /api/mcp?project=${targetConfigProject}`
                : "สร้าง Token ในขั้นที่ 1 ก่อน แล้วจึงทดสอบได้"
            }
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="mcp-test-context-btn"
              disabled={isTestingMcp || !generatedRawToken}
              onClick={() => runLiveMcpToolCall("get_ai_context", { projectKey: targetConfigProject })}
              className="btn btn-secondary btn-sm"
            >
              {isTestingMcp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              ดึงคิวงาน (get_ai_context)
            </button>
            <button
              type="button"
              data-testid="mcp-test-converse-btn"
              disabled={isTestingMcp || !generatedRawToken}
              onClick={() => runLiveMcpToolCall("list_issues", { projectKey: targetConfigProject })}
              className="btn btn-secondary btn-sm"
            >
              <Play className="h-3.5 w-3.5" />
              ดูรายการเรื่อง (list_issues)
            </button>
          </div>
          {testOutput && (
            <pre
              data-testid="mcp-test-output"
              className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-line bg-black/40 p-3.5 font-mono text-[11px] leading-relaxed text-emerald-200"
            >
              {testOutput}
            </pre>
          )}
        </section>

        {/* Tool reference */}
        <details className="group rounded-xl border border-line bg-white/[0.02]">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-[13px] font-medium text-fg-muted select-none hover:text-fg">
            <MessageSquareCode className="h-4 w-4 text-fg-subtle" />
            <span className="flex-1">เครื่องมือ MCP ทั้งหมด ({MCP_TOOLS.length} รายการ · ล็อกตามโปรเจกต์)</span>
            <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
          </summary>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 border-t border-line px-4 py-3.5 sm:grid-cols-2">
            {MCP_TOOLS.map((t) => (
              <div key={t.name} className="min-w-0">
                <code className="font-mono text-xs text-emerald-300">{t.name}</code>
                <p className="text-xs text-fg-subtle">{t.desc}</p>
              </div>
            ))}
          </div>
        </details>

        <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
          <Wrench className="h-3.5 w-3.5" />
          เฉพาะทีมพัฒนาและผู้ดูแลโปรเจกต์เท่านั้นที่สร้าง Token ได้
        </p>
      </div>
    </Dialog>
  );
}
