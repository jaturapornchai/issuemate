import { NextResponse } from "next/server";
import { addIssueComment, getIssueByCode } from "@/lib/issue-service";
import {
  MAX_FILES_PER_REQUEST,
  sanitizeClientAttachments,
  uploadBufferToMinio,
} from "@/lib/minio";
import {
  assertCsrfSafe,
  authRequiredResponse,
  getCurrentUser,
  validateUserProjectAction,
} from "@/lib/auth";
import type { AttachmentItem } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const csrfErr = assertCsrfSafe(req);
  if (csrfErr) return csrfErr;

  try {
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

    // Identity comes from the signed session only (body.actorEmail is ignored)
    const check = validateUserProjectAction(user, existing.projectKey, "comment");
    if (!check.allowed) {
      return NextResponse.json(
        { error: check.reason, permission: check.permission },
        { status: 403 }
      );
    }
    // Closing/resolving through a comment is a status change: developer/project_admin only
    if (body.nextStatus || body.isResolution) {
      const statusCheck = validateUserProjectAction(user, existing.projectKey, "change_status");
      if (!statusCheck.allowed) {
        return NextResponse.json(
          { error: statusCheck.reason, permission: statusCheck.permission },
          { status: 403 }
        );
      }
    }

    const author = user.name || user.email;

    const attachments: AttachmentItem[] = sanitizeClientAttachments(
      body.attachments,
      author
    );

    // Support inline files (PDF, images, CSV, text manuals) when answering questions
    if (Array.isArray(body.files)) {
      if (body.files.length > MAX_FILES_PER_REQUEST) {
        return NextResponse.json(
          { error: `แนบไฟล์ได้ไม่เกิน ${MAX_FILES_PER_REQUEST} ไฟล์ต่อครั้ง` },
          { status: 400 }
        );
      }
      for (const f of body.files) {
        if (!f || !f.filename) continue;
        const buf = f.base64
          ? Buffer.from(String(f.base64).replace(/^data:[^;]+;base64,/, ""), "base64")
          : Buffer.from(String(f.contentText || ""), "utf8");
        const uploaded = await uploadBufferToMinio({
          buffer: buf,
          filename: String(f.filename),
          mimeType: String(
            f.mimeType ||
              (String(f.filename).toLowerCase().endsWith(".pdf")
                ? "application/pdf"
                : f.contentText
                ? "text/plain; charset=utf-8"
                : "application/octet-stream")
          ),
          uploadedBy: author,
          uploaderEmail: user.email,
        });
        attachments.push(uploaded);
      }
    }

    const updated = await addIssueComment(code, {
      author,
      role: user.role || "ทีมงาน",
      body: body.body ? String(body.body) : "",
      attachments,
      isResolution: Boolean(body.isResolution),
      nextStatus: body.nextStatus || undefined,
      wontFixCategory: body.wontFixCategory || undefined,
    });
    return NextResponse.json({ issue: updated }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถบันทึกข้อความตอบกลับได้";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
