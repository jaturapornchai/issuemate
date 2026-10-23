"use client";

import React from "react";
import { X } from "lucide-react";

const SIZE_CLASS = {
  sm: "sm:max-w-md",
  md: "sm:max-w-xl",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
} as const;

/**
 * Shared modal shell: dimmed backdrop, centred panel on desktop and a
 * bottom sheet on phones. `testId` is placed on the panel itself.
 */
export function Dialog({
  onClose,
  size = "md",
  testId,
  labelledBy,
  children,
  className = "",
  placement = "center",
}: {
  onClose: () => void;
  size?: keyof typeof SIZE_CLASS;
  testId?: string;
  labelledBy?: string;
  children: React.ReactNode;
  className?: string;
  placement?: "center" | "top";
}) {
  return (
    <div
      className={`fixed inset-0 z-50 flex animate-fade-in justify-center bg-black/70 backdrop-blur-sm sm:p-6 ${
        placement === "top" ? "items-start pt-[10vh]" : "items-end sm:items-center"
      }`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        data-testid={testId}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[94dvh] w-full animate-scale-in flex-col overflow-hidden border border-line bg-overlay shadow-pop sm:max-h-[90vh] ${
          placement === "top" ? "mx-4 rounded-2xl" : "rounded-t-2xl sm:rounded-2xl"
        } ${SIZE_CLASS[size]} ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  icon,
  title,
  subtitle,
  onClose,
  closeTestId,
  titleId,
  actions,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  closeTestId?: string;
  titleId?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
      {icon && (
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-white/[0.04]">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="text-[15px] leading-snug font-semibold text-fg">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      <button
        type="button"
        data-testid={closeTestId}
        onClick={onClose}
        aria-label="ปิดหน้าต่าง"
        title="ปิด (Esc)"
        className="btn btn-ghost btn-icon btn-sm -mr-1.5"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function DialogFooter({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line bg-black/20 px-5 py-3.5 sm:px-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  step,
  title,
  hint,
  right,
}: {
  step?: number;
  title: React.ReactNode;
  hint?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {step !== undefined && (
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
            {step}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-fg">{title}</h3>
          {hint && <p className="text-xs text-fg-subtle">{hint}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function Notice({
  tone = "info",
  children,
  testId,
  icon,
  className = "",
  onDismiss,
}: {
  tone?: "info" | "success" | "warning" | "error" | "neutral";
  children: React.ReactNode;
  testId?: string;
  icon?: React.ReactNode;
  className?: string;
  onDismiss?: () => void;
}) {
  const toneClass = {
    info: "border-sky-400/20 bg-sky-400/[0.07] text-sky-100",
    success: "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-100",
    warning: "border-amber-400/25 bg-amber-400/[0.08] text-amber-100",
    error: "border-rose-400/25 bg-rose-400/[0.08] text-rose-100",
    neutral: "border-line bg-white/[0.03] text-fg-muted",
  }[tone];
  return (
    <div
      data-testid={testId}
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed ${toneClass} ${className}`}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="ปิดข้อความ"
          className="-mr-1 shrink-0 cursor-pointer rounded-md p-0.5 opacity-70 transition hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
