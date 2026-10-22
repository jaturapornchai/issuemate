"use client";

import React, { useState } from "react";
import {
  CircleDot,
  Eye,
  Wrench,
  CheckCircle2,
  XCircle,
  Bug,
  Sparkles,
  Flame,
  ArrowUpCircle,
  MinusCircle,
  ArrowDownCircle,
  Siren,
  Rocket,
  Gauge,
  ShieldAlert,
  ClipboardCheck,
  Copy,
  Check,
  HelpCircle,
} from "lucide-react";
import type { IssuePriority, IssueStatus, IssueType } from "@/lib/types";

export const STATUS_CONFIG: Record<
  IssueStatus,
  {
    step: number;
    label: string;
    shortLabel: string;
    description: string;
    badgeClass: string;
    bg: string;
    dot: string;
    color: string;
    dotColor: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  open: {
    step: 1,
    label: "1. รอตรวจสอบ",
    shortLabel: "รอตรวจสอบ",
    description: "รับเรื่องแล้ว รอตรวจสอบหรือตอบคำถาม",
    badgeClass: "border-amber-500/40 bg-amber-500/15 text-amber-300",
    bg: "border-amber-500/40 bg-amber-500/15",
    dot: "bg-amber-400",
    color: "text-amber-300",
    dotColor: "#f59e0b",
    icon: CircleDot,
  },
  reviewing: {
    step: 2,
    label: "2. กำลังตรวจสอบ",
    shortLabel: "กำลังตรวจสอบ",
    description: "กำลังตรวจสอบสาเหตุหรือหาคำตอบ",
    badgeClass: "border-purple-500/40 bg-purple-500/15 text-purple-300",
    bg: "border-purple-500/40 bg-purple-500/15",
    dot: "bg-purple-400",
    color: "text-purple-300",
    dotColor: "#a855f7",
    icon: Eye,
  },
  ready_to_fix: {
    step: 3,
    label: "3. รอดำเนินการแก้ไข",
    shortLabel: "รอแก้ไข",
    description: "ตรวจสอบแล้ว รอดำเนินการแก้ไข",
    badgeClass: "border-cyan-500/45 bg-cyan-500/20 text-cyan-200",
    bg: "border-cyan-500/45 bg-cyan-500/20",
    dot: "bg-cyan-400",
    color: "text-cyan-200",
    dotColor: "#06b6d4",
    icon: ClipboardCheck,
  },
  fixing: {
    step: 4,
    label: "4. กำลังแก้ไข / อัปเดตระบบ",
    shortLabel: "กำลังแก้ไข",
    description: "กำลังแก้ไขโปรแกรมและอัปเดตระบบ",
    badgeClass: "border-sky-500/40 bg-sky-500/15 text-sky-300",
    bg: "border-sky-500/40 bg-sky-500/15",
    dot: "bg-sky-400",
    color: "text-sky-300",
    dotColor: "#0ea5e9",
    icon: Wrench,
  },
  deployed: {
    step: 5,
    label: "5. เรียบร้อยแล้ว (อัปเดตแล้ว)",
    shortLabel: "เรียบร้อยแล้ว",
    description: "แก้ไขและอัปเดตระบบเรียบร้อยแล้ว",
    badgeClass: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
    bg: "border-emerald-500/40 bg-emerald-500/15",
    dot: "bg-emerald-400",
    color: "text-emerald-300",
    dotColor: "#10b981",
    icon: CheckCircle2,
  },
  wont_fix: {
    step: 6,
    label: "6. ปิดเรื่อง / ไม่ต้องแก้ไข",
    shortLabel: "ไม่ต้องแก้ไข",
    description: "ตอบคำถามแล้ว หรือไม่ต้องแก้ไขระบบ",
    badgeClass: "border-rose-500/40 bg-rose-500/15 text-rose-300",
    bg: "border-rose-500/40 bg-rose-500/15",
    dot: "bg-rose-400",
    color: "text-rose-300",
    dotColor: "#f43f5e",
    icon: XCircle,
  },
};

export const TYPE_CONFIG: Record<
  IssueType,
  {
    label: string;
    badgeClass: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  question: {
    label: "สอบถาม / ตั้งคำถาม",
    badgeClass: "border-cyan-500/45 bg-cyan-500/15 text-cyan-200",
    icon: HelpCircle,
  },
  bug: {
    label: "แจ้งปัญหาการใช้งาน",
    badgeClass: "border-rose-500/35 bg-rose-500/15 text-rose-300",
    icon: Bug,
  },
  feature: {
    label: "ขอเพิ่มฟีเจอร์ / ปรับปรุง",
    badgeClass: "border-emerald-500/35 bg-emerald-500/15 text-emerald-300",
    icon: Sparkles,
  },
  incident: {
    label: "ด่วนมาก / ระบบเข้าไม่ได้",
    badgeClass: "border-red-500/50 bg-red-500/20 text-red-200",
    icon: Siren,
  },
  performance: {
    label: "ระบบช้า / ค้าง",
    badgeClass: "border-amber-500/40 bg-amber-500/15 text-amber-300",
    icon: Gauge,
  },
  security: {
    label: "สิทธิ์การใช้งาน / รหัสผ่าน",
    badgeClass: "border-orange-500/40 bg-orange-500/15 text-orange-300",
    icon: ShieldAlert,
  },
  deployment: {
    label: "อัปเดตระบบ / ติดตั้ง",
    badgeClass: "border-violet-500/40 bg-violet-500/15 text-violet-300",
    icon: Rocket,
  },
};

export const PRIORITY_CONFIG: Record<
  IssuePriority,
  {
    label: string;
    badgeClass: string;
    color: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  critical: {
    label: "ด่วนที่สุด",
    badgeClass: "border-red-500/40 bg-red-500/20 text-red-300",
    color: "#ef4444",
    icon: Flame,
  },
  high: {
    label: "ด่วน",
    badgeClass: "border-orange-500/35 bg-orange-500/15 text-orange-300",
    color: "#f97316",
    icon: ArrowUpCircle,
  },
  medium: {
    label: "ปกติ",
    badgeClass: "border-yellow-500/35 bg-yellow-500/15 text-yellow-300",
    color: "#eab308",
    icon: MinusCircle,
  },
  low: {
    label: "ทั่วไป / ไม่ด่วน",
    badgeClass: "border-slate-600 bg-slate-800/80 text-slate-300",
    color: "#94a3b8",
    icon: ArrowDownCircle,
  },
};

export function StatusBadge({ status, compact = false }: { status: IssueStatus; compact?: boolean }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  const Icon = cfg.icon;
  return (
    <span
      title={cfg.label}
      className={`inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium leading-none whitespace-nowrap ${cfg.badgeClass}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{compact ? cfg.shortLabel : cfg.label}</span>
    </span>
  );
}

export function TypeBadge({ type, compact = false }: { type: IssueType; compact?: boolean }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.bug;
  const Icon = cfg.icon;
  return (
    <span
      title={cfg.label}
      className={`inline-flex h-6 max-w-full items-center gap-1.5 rounded-md border px-2 text-xs font-medium leading-none whitespace-nowrap ${cfg.badgeClass}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{compact ? shortLabel(cfg.label) : cfg.label}</span>
    </span>
  );
}

export function PriorityBadge({ priority, compact = false }: { priority: IssuePriority; compact?: boolean }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  const Icon = cfg.icon;
  return (
    <span
      title={cfg.label}
      className={`inline-flex h-6 max-w-full items-center gap-1.5 rounded-md border px-2 text-xs font-medium leading-none whitespace-nowrap ${cfg.badgeClass}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{compact ? shortLabel(cfg.label) : cfg.label}</span>
    </span>
  );
}

function shortLabel(label: string): string {
  return label.replace(/\s*\(.*\)$/, "");
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
      className={`group/copy inline-flex max-w-full items-center gap-1 rounded-md border font-mono font-bold leading-none whitespace-nowrap transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
        copied
          ? "border-emerald-400/60 bg-emerald-500/25 text-emerald-200"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:border-emerald-400/60 hover:bg-emerald-500/20"
      } ${className}`}
    >
      <span className="truncate">{code}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 opacity-50 group-hover/copy:opacity-100" />
      )}
    </button>
  );
}

export function formatThaiDateTime(iso?: string): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
