import type { AiFixApproval, IssueRecord, IssueStatus, ProjectRecord } from "./types";

/** Statuses an AI agent may only move an issue into after admin approval */
export const AI_GATED_STATUSES: IssueStatus[] = ["fixing", "deployed"];

export type AiFixPermission =
  | { allowed: true; via: "approved" | "auto_mode" | "question" }
  | { allowed: false; reason: "rejected" | "pending"; message: string };

/**
 * May an AI agent fix (claim / deploy) this issue?
 * - Questions can always be answered and closed by AI (no code change).
 * - An explicit admin rejection always wins, even when the project is in auto mode.
 * - Otherwise the issue needs an explicit approval, or the project's auto mode.
 */
export function getAiFixPermission(
  issue: Pick<IssueRecord, "code" | "type" | "aiFixApproval">,
  project?: Pick<ProjectRecord, "aiAutoApproval"> | null
): AiFixPermission {
  if (issue.type === "question") return { allowed: true, via: "question" };
  const status = issue.aiFixApproval?.status;
  if (status === "rejected") {
    const by = issue.aiFixApproval?.decidedBy ? ` โดย ${issue.aiFixApproval.decidedBy}` : "";
    const note = issue.aiFixApproval?.note ? ` (หมายเหตุ: ${issue.aiFixApproval.note})` : "";
    return {
      allowed: false,
      reason: "rejected",
      message: `ผู้ดูแลไม่อนุมัติให้ AI แก้ไขเรื่อง ${issue.code}${by}${note} — ห้ามแก้โค้ดหรือ Deploy เรื่องนี้`,
    };
  }
  if (status === "approved") return { allowed: true, via: "approved" };
  if (project?.aiAutoApproval?.enabled) return { allowed: true, via: "auto_mode" };
  return {
    allowed: false,
    reason: "pending",
    message: `เรื่อง ${issue.code} ยังไม่ได้รับอนุมัติจากผู้ดูแล (Admin) ให้ AI แก้ไขอัตโนมัติ — ห้ามแก้โค้ดหรือ Deploy ให้รอผู้ดูแลกด "อนุมัติให้ AI แก้ไข" ในหน้าเว็บ (หรือเปิดโหมดอัตโนมัติของโปรเจกต์) ก่อน`,
  };
}

/** Is an AI status change into `nextStatus` blocked for this issue? Returns the error message or null. */
export function aiStatusChangeBlockedReason(
  issue: Pick<IssueRecord, "code" | "type" | "aiFixApproval">,
  nextStatus: IssueStatus | undefined,
  project?: Pick<ProjectRecord, "aiAutoApproval"> | null
): string | null {
  if (!nextStatus || !AI_GATED_STATUSES.includes(nextStatus)) return null;
  const perm = getAiFixPermission(issue, project);
  return perm.allowed ? null : perm.message;
}

/** Approval record written onto an issue when AI proceeds under the project's auto mode */
export function autoModeApprovalRecord(
  project: Pick<ProjectRecord, "aiAutoApproval">
): AiFixApproval {
  return {
    status: "approved",
    auto: true,
    decidedBy: project.aiAutoApproval?.changedBy || "โหมดอัตโนมัติ",
    decidedByEmail: project.aiAutoApproval?.changedByEmail,
    decidedAt: new Date().toISOString(),
    note: "อนุมัติโดยโหมดอัตโนมัติของโปรเจกต์",
  };
}

/** Effective approval state shown in the UI */
export function aiApprovalDisplayState(
  issue: Pick<IssueRecord, "type" | "aiFixApproval">,
  project?: Pick<ProjectRecord, "aiAutoApproval"> | null
): "not_required" | "approved" | "rejected" | "auto" | "pending" {
  if (issue.type === "question") return "not_required";
  const status = issue.aiFixApproval?.status;
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (project?.aiAutoApproval?.enabled) return "auto";
  return "pending";
}
