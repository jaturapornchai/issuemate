import type { AiFixApproval, IssueRecord, IssueStatus, ProjectRecord, ReviewAndFixMeta } from "./types";

/** Statuses an AI agent may only move an issue into after admin approval */
export const AI_GATED_STATUSES: IssueStatus[] = ["fixing", "deployed"];

type GateIssue = Pick<IssueRecord, "code" | "type" | "aiFixApproval"> & {
  status?: IssueStatus;
  reviewMeta?: Pick<ReviewAndFixMeta, "decision">;
};

export type AiFixPermission =
  | { allowed: true; via: "approved" | "auto_mode" | "question" }
  | { allowed: false; reason: "rejected" | "pending"; message: string };

/**
 * May an AI agent fix (claim / deploy) this issue?
 * - Questions are for answering only; if a bug is found from a question, AI must answer the user
 *   and leave the issue in ready_to_fix waiting for an explicit admin approval (even in project auto mode).
 * - An explicit admin rejection always wins, even when the project is in auto mode.
 * - Otherwise the issue needs an explicit approval, or (for non-question issues) the project's auto mode.
 * - A closed issue's approval belongs to the finished round (updateIssue clears it on reopen),
 *   so it must not let AI jump a deployed / wont_fix issue straight back to fixing.
 */
export function getAiFixPermission(
  issue: GateIssue,
  project?: Pick<ProjectRecord, "aiAutoApproval"> | null
): AiFixPermission {
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
  const closed = issue.status === "deployed" || issue.status === "wont_fix";
  if (status === "approved" && !closed) return { allowed: true, via: "approved" };
  if (issue.type === "question") {
    return {
      allowed: false,
      reason: "pending",
      message: `เรื่อง ${issue.code} เป็นหมวดคำถาม (question) — ให้ตอบคำถามผู้ใช้อย่างเดียว ห้ามแก้โค้ดหรือ Deploy เอง (หากพบบั๊กจากคำถาม ให้ส่งคำตอบพร้อมตั้งเป็น ready_to_fix แล้วรอผู้ดูแลกด "อนุมัติให้ AI แก้ไข" ในหน้าเว็บก่อน)`,
    };
  }
  if (project?.aiAutoApproval?.enabled) return { allowed: true, via: "auto_mode" };
  return {
    allowed: false,
    reason: "pending",
    message: `เรื่อง ${issue.code} ยังไม่ได้รับอนุมัติจากผู้ดูแล (Admin) ให้ AI แก้ไขอัตโนมัติ — ห้ามแก้โค้ดหรือ Deploy ให้รอผู้ดูแลกด "อนุมัติให้ AI แก้ไข" ในหน้าเว็บ (หรือเปิดโหมดอัตโนมัติของโปรเจกต์) ก่อน`,
  };
}

/** Is an AI status change into `nextStatus` blocked for this issue? Returns the error message or null. */
export function aiStatusChangeBlockedReason(
  issue: GateIssue,
  nextStatus: IssueStatus | undefined,
  project?: Pick<ProjectRecord, "aiAutoApproval"> | null
): string | null {
  if (!nextStatus || !AI_GATED_STATUSES.includes(nextStatus)) return null;
  // Answering and closing a question (open/reviewing -> deployed) involves no code change
  if (
    issue.type === "question" &&
    nextStatus === "deployed" &&
    (issue.status === "open" || issue.status === "reviewing")
  ) {
    return null;
  }
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
  issue: Pick<IssueRecord, "type" | "aiFixApproval"> & {
    status?: IssueStatus;
    reviewMeta?: Pick<ReviewAndFixMeta, "decision">;
  },
  project?: Pick<ProjectRecord, "aiAutoApproval"> | null
): "not_required" | "approved" | "rejected" | "auto" | "pending" {
  const status = issue.aiFixApproval?.status;
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (issue.type === "question") {
    if (
      issue.status === "ready_to_fix" ||
      issue.status === "fixing" ||
      issue.reviewMeta?.decision === "fix"
    ) {
      return "pending";
    }
    return "not_required";
  }
  if (project?.aiAutoApproval?.enabled) return "auto";
  return "pending";
}
