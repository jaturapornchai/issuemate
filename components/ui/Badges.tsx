"use client";

import React, { useState } from "react";
import {
  CircleDot,
  ScanSearch,
  ClipboardList,
  Wrench,
  CheckCircle2,
  CircleSlash,
  Bug,
  Sparkles,
  Flame,
  SignalHigh,
  SignalMedium,
  SignalLow,
  Siren,
  Rocket,
  Gauge,
  ShieldAlert,
  Copy,
  Check,
  MessageCircleQuestion,
  Eye,
  PenLine,
  Crown,
} from "lucide-react";
import type { IssuePriority, IssueStatus, IssueType } from "@/lib/types";
import type { ProjectPermissionLevel } from "@/lib/permissions";

type IconType = React.ComponentType<{ className?: string }>;

/* ------------------------------------------------------------------
   Tones: the only place colours for pills / dots / bars are defined
------------------------------------------------------------------- */

export type Tone =
  | "amber"
  | "violet"
  | "sky"
  | "blue"
  | "emerald"
  | "zinc"
  | "rose"
  | "red"
  | "orange"
  | "indigo";

export const TONE: Record<
  Tone,
  { pill: string; dot: string; text: string; soft: string; hex: string }
> = {
  amber: { pill: "bg-amber-400/10 text-amber-200 ring-amber-400/25", dot: "bg-amber-400", text: "text-amber-300", soft: "bg-amber-400/10", hex: "#fbbf24" },
  violet: { pill: "bg-violet-400/10 text-violet-200 ring-violet-400/25", dot: "bg-violet-400", text: "text-violet-300", soft: "bg-violet-400/10", hex: "#a78bfa" },
  sky: { pill: "bg-sky-400/10 text-sky-200 ring-sky-400/25", dot: "bg-sky-400", text: "text-sky-300", soft: "bg-sky-400/10", hex: "#38bdf8" },
  blue: { pill: "bg-blue-400/10 text-blue-200 ring-blue-400/25", dot: "bg-blue-400", text: "text-blue-300", soft: "bg-blue-400/10", hex: "#60a5fa" },
  emerald: { pill: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/25", dot: "bg-emerald-400", text: "text-emerald-300", soft: "bg-emerald-400/10", hex: "#34d399" },
  zinc: { pill: "bg-white/[0.05] text-fg-muted ring-white/10", dot: "bg-zinc-400", text: "text-zinc-300", soft: "bg-white/[0.05]", hex: "#a1a1aa" },
  rose: { pill: "bg-rose-400/10 text-rose-200 ring-rose-400/25", dot: "bg-rose-400", text: "text-rose-300", soft: "bg-rose-400/10", hex: "#fb7185" },
  red: { pill: "bg-red-500/15 text-red-200 ring-red-400/30", dot: "bg-red-500", text: "text-red-400", soft: "bg-red-500/10", hex: "#ef4444" },
  orange: { pill: "bg-orange-400/10 text-orange-200 ring-orange-400/25", dot: "bg-orange-400", text: "text-orange-300", soft: "bg-orange-400/10", hex: "#fb923c" },
  indigo: { pill: "bg-indigo-400/10 text-indigo-200 ring-indigo-400/25", dot: "bg-indigo-400", text: "text-indigo-300", soft: "bg-indigo-400/10", hex: "#818cf8" },
};

/* ------------------------------------------------------------------
   Status (6-step pipeline)
------------------------------------------------------------------- */

export const STATUS_ORDER: IssueStatus[] = [
  "open",
  "reviewing",
  "ready_to_fix",
  "fixing",
  "deployed",
  "wont_fix",
];

export const STATUS_CONFIG: Record<
  IssueStatus,
  {
    step: number;
    label: string;
    shortLabel: string;
    description: string;
    tone: Tone;
    dotColor: string;
    icon: IconType;
  }
> = {
  open: {
    step: 1,
    label: "รอตรวจสอบ",
    shortLabel: "รอตรวจสอบ",
    description: "รับเรื่องแล้ว รอทีมงานตรวจสอบ",
    tone: "amber",
    dotColor: TONE.amber.hex,
    icon: CircleDot,
  },
  reviewing: {
    step: 2,
    label: "กำลังตรวจสอบ",
    shortLabel: "กำลังตรวจสอบ",
    description: "ทีมงานกำลังหาสาเหตุหรือหาคำตอบ",
    tone: "violet",
    dotColor: TONE.violet.hex,
    icon: ScanSearch,
  },
  ready_to_fix: {
    step: 3,
    label: "รอแก้ไข",
    shortLabel: "รอแก้ไข",
    description: "ตรวจสอบแล้ว อยู่ในคิวแก้ไข",
    tone: "sky",
    dotColor: TONE.sky.hex,
    icon: ClipboardList,
  },
  fixing: {
    step: 4,
    label: "กำลังแก้ไข",
    shortLabel: "กำลังแก้ไข",
    description: "กำลังแก้ไขและอัปเดตระบบ",
    tone: "blue",
    dotColor: TONE.blue.hex,
    icon: Wrench,
  },
  deployed: {
    step: 5,
    label: "เสร็จเรียบร้อย",
    shortLabel: "เสร็จแล้ว",
    description: "แก้ไขหรือตอบคำถามเรียบร้อยแล้ว",
    tone: "emerald",
    dotColor: TONE.emerald.hex,
    icon: CheckCircle2,
  },
  wont_fix: {
    step: 6,
    label: "ปิดเรื่อง (ไม่แก้ไข)",
    shortLabel: "ไม่แก้ไข",
    description: "ปิดเรื่องโดยไม่ต้องแก้ไขระบบ",
    tone: "zinc",
    dotColor: TONE.zinc.hex,
    icon: CircleSlash,
  },
};

/* ------------------------------------------------------------------
   Type
------------------------------------------------------------------- */

export const TYPE_ORDER: IssueType[] = [
  "question",
  "bug",
  "feature",
  "incident",
  "performance",
  "security",
  "deployment",
];

export const TYPE_CONFIG: Record<
  IssueType,
  { label: string; shortLabel: string; hint: string; tone: Tone; icon: IconType }
> = {
  question: {
    label: "สอบถาม / ตั้งคำถาม",
    shortLabel: "คำถาม",
    hint: "สงสัยวิธีใช้งาน ขอคู่มือ",
    tone: "sky",
    icon: MessageCircleQuestion,
  },
  bug: {
    label: "แจ้งปัญหาการใช้งาน",
    shortLabel: "ปัญหา",
    hint: "ระบบทำงานผิด ข้อมูลไม่ถูก",
    tone: "rose",
    icon: Bug,
  },
  feature: {
    label: "ขอเพิ่มฟีเจอร์ / ปรับปรุง",
    shortLabel: "ขอฟีเจอร์",
    hint: "อยากให้มีหรือปรับปรุง",
    tone: "violet",
    icon: Sparkles,
  },
  incident: {
    label: "ด่วนมาก / ระบบเข้าไม่ได้",
    shortLabel: "ระบบล่ม",
    hint: "ใช้งานไม่ได้ทั้งระบบ",
    tone: "red",
    icon: Siren,
  },
  performance: {
    label: "ระบบช้า / ค้าง",
    shortLabel: "ระบบช้า",
    hint: "โหลดนาน หน้าจอค้าง",
    tone: "amber",
    icon: Gauge,
  },
  security: {
    label: "สิทธิ์การใช้งาน / รหัสผ่าน",
    shortLabel: "สิทธิ์/รหัสผ่าน",
    hint: "เข้าระบบไม่ได้ ขอสิทธิ์",
    tone: "orange",
    icon: ShieldAlert,
  },
  deployment: {
    label: "อัปเดตระบบ / ติดตั้ง",
    shortLabel: "อัปเดตระบบ",
    hint: "ติดตั้ง ย้ายเครื่อง อัปเดต",
    tone: "indigo",
    icon: Rocket,
  },
};

/* ------------------------------------------------------------------
   Priority
------------------------------------------------------------------- */

export const PRIORITY_ORDER: IssuePriority[] = ["critical", "high", "medium", "low"];

export const PRIORITY_CONFIG: Record<
  IssuePriority,
  { label: string; hint: string; tone: Tone; color: string; icon: IconType }
> = {
  critical: { label: "ด่วนที่สุด", hint: "กระทบงานทันที", tone: "red", color: TONE.red.hex, icon: Flame },
  high: { label: "ด่วน", hint: "ควรรีบแก้", tone: "orange", color: TONE.orange.hex, icon: SignalHigh },
  medium: { label: "ปกติ", hint: "เรื่องทั่วไป", tone: "amber", color: TONE.amber.hex, icon: SignalMedium },
  low: { label: "ไม่ด่วน", hint: "ทำเมื่อสะดวก", tone: "zinc", color: TONE.zinc.hex, icon: SignalLow },
};

/* ------------------------------------------------------------------
   Permission (UI labels without emoji; server text lives in lib/permissions)
------------------------------------------------------------------- */

export const PERMISSION_UI: Record<
  ProjectPermissionLevel,
  { label: string; shortLabel: string; tone: Tone; icon: IconType }
> = {
  question_only: { label: "ถามคำถามได้อย่างเดียว", shortLabel: "ถามได้อย่างเดียว", tone: "sky", icon: MessageCircleQuestion },
  reporter: { label: "แจ้งปัญหาและถามคำถามได้", shortLabel: "ผู้แจ้งเรื่อง", tone: "emerald", icon: PenLine },
  viewer: { label: "ดูข้อมูลอย่างเดียว", shortLabel: "ดูอย่างเดียว", tone: "zinc", icon: Eye },
  developer: { label: "ทีมแก้ไขและตอบคำถาม", shortLabel: "ทีมแก้ไข", tone: "amber", icon: Wrench },
  project_admin: { label: "ผู้ดูแลโปรเจกต์ (จัดการได้ทั้งหมด)", shortLabel: "ผู้ดูแลโปรเจกต์", tone: "violet", icon: Crown },
};

/* ------------------------------------------------------------------
   Badge components
------------------------------------------------------------------- */

export function StatusBadge({
  status,
  compact = false,
  className = "",
}: {
  status: IssueStatus;
  compact?: boolean;
  className?: string;
}) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  return (
    <span title={cfg.description} className={`pill ${TONE[cfg.tone].pill} ${className}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE[cfg.tone].dot}`} />
      <span className="truncate">{compact ? cfg.shortLabel : cfg.label}</span>
    </span>
  );
}

export function TypeBadge({
  type,
  compact = false,
  className = "",
}: {
  type: IssueType;
  compact?: boolean;
  className?: string;
}) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.bug;
  const Icon = cfg.icon;
  return (
    <span title={cfg.label} className={`pill ${TONE.zinc.pill} ${className}`}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${TONE[cfg.tone].text}`} />
      <span className="truncate">{compact ? cfg.shortLabel : cfg.label}</span>
    </span>
  );
}

export function PriorityBadge({
  priority,
  compact = false,
  className = "",
}: {
  priority: IssuePriority;
  compact?: boolean;
  className?: string;
}) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  const Icon = cfg.icon;
  const isCritical = priority === "critical";
  return (
    <span
      title={`ความเร่งด่วน: ${cfg.label} — ${cfg.hint}`}
      className={`pill ${isCritical ? TONE.red.pill : TONE.zinc.pill} ${className}`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${TONE[cfg.tone].text}`} />
      <span className="truncate">{compact ? cfg.label : `${cfg.label}`}</span>
    </span>
  );
}

export function PermissionBadge({
  permission,
  prefix,
  className = "",
  testId,
}: {
  permission: ProjectPermissionLevel;
  prefix?: string;
  className?: string;
  testId?: string;
}) {
  const cfg = PERMISSION_UI[permission];
  const Icon = cfg.icon;
  return (
    <span data-testid={testId} title={cfg.label} className={`pill ${TONE[cfg.tone].pill} ${className}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">
        {prefix}
        {cfg.shortLabel}
      </span>
    </span>
  );
}

export function StatusDot({ status, className = "" }: { status: IssueStatus; className?: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${TONE[cfg.tone].dot} ${className}`} />;
}

export function CopyCodeButton({ code, className = "" }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      data-testid={`copy-code-${code}`}
      title={copied ? "คัดลอกแล้ว" : `คลิกเพื่อคัดลอกรหัส ${code}`}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // ignore
        }
      }}
      className={`group/copy inline-flex max-w-full cursor-pointer items-center gap-1 rounded-md font-mono text-xs leading-none font-medium tabular-nums transition focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none ${
        copied ? "text-emerald-300" : "text-fg-subtle hover:text-fg"
      } ${className}`}
    >
      <span className="truncate">{code}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 opacity-0 transition group-hover/copy:opacity-70" />
      )}
    </button>
  );
}

const AVATAR_TONES = [
  "bg-emerald-500/20 text-emerald-200",
  "bg-sky-500/20 text-sky-200",
  "bg-violet-500/20 text-violet-200",
  "bg-amber-500/20 text-amber-200",
  "bg-rose-500/20 text-rose-200",
  "bg-indigo-500/20 text-indigo-200",
  "bg-teal-500/20 text-teal-200",
];

export function initialsOf(name?: string): string {
  const clean = (name || "?")
    .replace(/<[^>]*>/g, "")
    .replace(/\[[^\]]*\]|\([^)]*\)/g, "")
    .replace(/^(คุณ|นางสาว|นาย|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.|ดร\.)\s*/u, "")
    .trim();
  if (!clean) return "?";
  if (/^[a-z]/i.test(clean)) {
    const parts = clean.split(/[\s._@-]+/).filter(Boolean);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
  }
  const thaiConsonant = clean.match(/[\u0E01-\u0E2E]/);
  if (thaiConsonant) return thaiConsonant[0];
  return Array.from(clean)[0] || "?";
}

export function Avatar({
  name,
  src,
  size = "md",
  className = "",
}: {
  name?: string;
  src?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = size === "sm" ? "h-6 w-6 text-[10px]" : size === "lg" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";
  if (src) {
    return <img src={src} alt={name || ""} className={`${dims} shrink-0 rounded-full object-cover ring-1 ring-white/10 ${className}`} />;
  }
  let hash = 0;
  for (const ch of name || "") hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden="true"
      className={`${dims} inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-white/10 ${
        AVATAR_TONES[hash % AVATAR_TONES.length]
      } ${className}`}
    >
      {initialsOf(name)}
    </span>
  );
}

/* ------------------------------------------------------------------
   Formatters
------------------------------------------------------------------- */

export function formatThaiDateTime(iso?: string): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("th-TH", {
      timeZone: "Asia/Bangkok",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function formatThaiDate(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

export function formatThaiTime(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatRelativeTime(iso?: string): string {
  if (!iso) return "-";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return iso;
  const diffMin = Math.round((Date.now() - t) / 60000);
  if (diffMin < 1) return "เมื่อสักครู่";
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "เมื่อวาน";
  if (diffDay < 7) return `${diffDay} วันที่แล้ว`;
  return formatThaiDate(iso);
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
