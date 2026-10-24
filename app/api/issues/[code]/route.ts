import { NextResponse } from "next/server";
import { getIssueByCode, updateIssue, deleteIssue } from "@/lib/issue-service";
import type { AiFixApproval } from "@/lib/types";
import { sanitizeClientAttachments } from "@/lib/minio";
import {
  assertCsrfSafe,
  authRequiredResponse,
  getCurrentUser,
  validateUserProjectAction,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return authRequiredResponse();
    const { code } = await context.params;
    const issue = await getIssueByCode(code);
    if (!issue) {
      return NextResponse.json({ error: `ไม่พบรายการรหัส ${code}` }, { status: 404 });
    }
    const check = validateUserProjectAction(user, issue.projectKey, "view");
    if (!check.allowed) {
      return NextResponse.json({ error: `ไม่พบรายการรหัส ${code}` }, { status: 404 });
    }
    return NextResponse.json({ issue });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการดึงข้อมูล";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const csrfErr = assertCsrfSafe(req);
  if (csrfErr) return csrfErr;

  try {
    // Identity comes from the signed session only (body.actorEmail is ignored)
    const user = await getCurrentUser();
    if (!user) return authRequiredResponse();
    const { code } = await context.params;
    const body = await req.json();
    const existing = await getIssueByCode(code);
    if (!existing) {
      return NextResponse.json({ error: `ไม่พบรายการรหัส ${code}` }, { status: 404 });
    }

    const viewCheck = validateUserProjectAction(user, existing.projectKey, "view");
    if (!viewCheck.allowed) {
      return NextResponse.json({ error: `ไม่พบรายการรหัส ${code}` }, { status: 404 });
    }

    const isVoteOrReaction =
      Boolean(body.toggleUpvoteBy) ||
      Boolean(body.toggleReaction) ||
      Boolean(body.toggleCommentReaction);
    const otherFields = Object.keys(body).filter(
      (k) => !["toggleUpvoteBy", "toggleReaction", "toggleCommentReaction", "actor", "actorEmail"].includes(k)
    );

    // Votes/reactions need comment rights; anything else is an edit that needs developer/project_admin
    const check = validateUserProjectAction(
      user,
      existing.projectKey,
      isVoteOrReaction && otherFields.length === 0 ? "comment" : "change_status"
    );
    if (!check.allowed) {
      return NextResponse.json(
        { error: check.reason, permission: check.permission },
        { status: 403 }
      );
    }

    // AI fix approval: only Admin / project_admin, recorded with the session identity
    let approvalPatch: AiFixApproval | null | undefined;
    if (body.aiFixApproval !== undefined) {
      const approveCheck = validateUserProjectAction(user, existing.projectKey, "approve_ai_fix");
      if (!approveCheck.allowed) {
        return NextResponse.json(
          { error: approveCheck.reason, permission: approveCheck.permission },
          { status: 403 }
        );
      }
      const nextStatus = body.aiFixApproval?.status;
      if (!["approved", "rejected", "pending"].includes(nextStatus)) {
        return NextResponse.json(
          { error: "สถานะการอนุมัติต้องเป็น approved, rejected หรือ pending" },
          { status: 400 }
        );
      }
      const note = String(body.aiFixApproval?.note || "").trim().slice(0, 500);
      approvalPatch =
        nextStatus === "pending"
          ? null
          : {
              status: nextStatus,
              decidedBy: user.name,
              decidedByEmail: user.email,
              decidedAt: new Date().toISOString(),
              ...(note ? { note } : {}),
            };
    }

    const patch = { ...body, actor: user.name };
    delete patch.actorEmail;
    delete patch.aiFixApproval;
    if (approvalPatch !== undefined) patch.aiFixApproval = approvalPatch;
    if (patch.attachments !== undefined) {
      patch.attachments = sanitizeClientAttachments(patch.attachments, user.name);
    }
    if (patch.addAttachments !== undefined) {
      patch.addAttachments = sanitizeClientAttachments(patch.addAttachments, user.name);
    }
    // Votes and reactions are always cast as the logged-in user
    if (body.toggleUpvoteBy) patch.toggleUpvoteBy = user.email;
    if (body.toggleReaction) patch.toggleReaction = { ...body.toggleReaction, user: user.name };
    if (body.toggleCommentReaction) {
      patch.toggleCommentReaction = { ...body.toggleCommentReaction, user: user.name };
    }

    const updated = await updateIssue(code, patch);
    return NextResponse.json({ issue: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถแก้ไขรายการได้";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const csrfErr = assertCsrfSafe(req);
  if (csrfErr) return csrfErr;

  try {
    const user = await getCurrentUser();
    if (!user) return authRequiredResponse();
    const { code } = await context.params;
    const existing = await getIssueByCode(code);
    if (!existing) {
      return NextResponse.json({ error: `ไม่พบรายการรหัส ${code}` }, { status: 404 });
    }
    const viewCheck = validateUserProjectAction(user, existing.projectKey, "view");
    if (!viewCheck.allowed) {
      return NextResponse.json({ error: `ไม่พบรายการรหัส ${code}` }, { status: 404 });
    }
    const check = validateUserProjectAction(user, existing.projectKey, "delete_issue");
    if (!check.allowed) {
      return NextResponse.json(
        { error: check.reason, permission: check.permission },
        { status: 403 }
      );
    }
    const deleted = await deleteIssue(code);
    return NextResponse.json({ deleted, code });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถลบรายการได้";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
