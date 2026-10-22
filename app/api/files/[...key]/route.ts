import { NextResponse } from "next/server";
import { deleteObjectsFromMinio, getObjectFromMinio } from "@/lib/minio";
import {
  assertCsrfSafe,
  authRequiredResponse,
  getCurrentUser,
  validateUserProjectAction,
} from "@/lib/auth";
import { verifyMcpRequestToken } from "@/lib/mcp-tokens";
import { getDb } from "@/lib/mongodb";
import type { IssueRecord } from "@/lib/types";

export const runtime = "nodejs";

// Types the browser may render inline; anything else (html, svg, js...) is forced to download
// so an uploaded file can never run script on this origin (stored XSS)
const INLINE_TYPES = /^(image\/(png|jpeg|gif|webp|bmp|avif)|application\/pdf|text\/(plain|csv)|video\/[\w.+-]+|audio\/[\w.+-]+)(;|$)/i;

export async function GET(
  req: Request,
  context: { params: Promise<{ key: string[] }> }
) {
  try {
    const user = await getCurrentUser();
    const tokenCheck = user ? null : await verifyMcpRequestToken(req);
    if (!user && !tokenCheck?.allowed) return authRequiredResponse();
    const effectiveUser = user || tokenCheck?.ownerUser;
    if (!effectiveUser) return authRequiredResponse();

    const { key } = await context.params;
    const fullKey = key.map((segment) => decodeURIComponent(segment)).join("/");

    // Verify project-level view authorization on the owning issue if attached
    const db = await getDb();
    const ownerIssue = await db.collection<IssueRecord>("issues").findOne(
      {
        $or: [
          { "attachments.key": fullKey },
          { "comments.attachments.key": fullKey },
        ],
      },
      { projection: { projectKey: 1 } }
    );

    if (ownerIssue) {
      if (
        tokenCheck?.boundProjectKey &&
        tokenCheck.boundProjectKey.toUpperCase() !== ownerIssue.projectKey.toUpperCase()
      ) {
        return NextResponse.json({ error: "ไม่พบไฟล์ใน MinIO" }, { status: 404 });
      }
      const perm = validateUserProjectAction(effectiveUser, ownerIssue.projectKey, "view");
      if (!perm.allowed) {
        return NextResponse.json({ error: "ไม่พบไฟล์ใน MinIO" }, { status: 404 });
      }
    }

    const obj = await getObjectFromMinio(fullKey);

    if (!obj.body) {
      return NextResponse.json({ error: "ไม่พบไฟล์ใน MinIO" }, { status: 404 });
    }

    // If not yet attached to any issue, only the uploader or an Admin may fetch it
    if (!ownerIssue && !effectiveUser.isAdmin) {
      const uploaderEmail = decodeURIComponent(obj.metadata?.uploaderemail || "")
        .trim()
        .toLowerCase();
      if (uploaderEmail && uploaderEmail !== effectiveUser.email.toLowerCase()) {
        return NextResponse.json({ error: "ไม่พบไฟล์ใน MinIO" }, { status: 404 });
      }
    }

    const headers = new Headers();
    const inline = INLINE_TYPES.test(obj.contentType);
    headers.set("Content-Type", inline ? obj.contentType : "application/octet-stream");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Cache-Control", "private, max-age=31536000, immutable");
    if (!inline) {
      const filename = fullKey.split("/").pop() || "download";
      headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    }
    if (obj.contentLength !== undefined) {
      headers.set("Content-Length", String(obj.contentLength));
    }

    return new Response(obj.body as BodyInit, {
      status: 200,
      headers,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถดึงไฟล์จาก MinIO ได้";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ key: string[] }> }
) {
  const csrfErr = assertCsrfSafe(req);
  if (csrfErr) return csrfErr;

  try {
    const user = await getCurrentUser();
    const tokenCheck = user ? null : await verifyMcpRequestToken(req);
    if (!user && !tokenCheck?.allowed) return authRequiredResponse();
    const effectiveUser = user || tokenCheck?.ownerUser;
    if (!effectiveUser) return authRequiredResponse();

    const { key } = await context.params;
    const fullKey = key.map((segment) => decodeURIComponent(segment)).join("/");

    const db = await getDb();
    const ownerIssue = await db.collection<IssueRecord>("issues").findOne(
      {
        $or: [
          { "attachments.key": fullKey },
          { "comments.attachments.key": fullKey },
        ],
      },
      { projection: { projectKey: 1 } }
    );

    if (ownerIssue && !effectiveUser.isAdmin) {
      return NextResponse.json(
        { error: "เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถลบไฟล์ที่ผูกกับรายการแล้วโดยตรงได้" },
        { status: 403 }
      );
    }

    if (!effectiveUser.isAdmin) {
      const obj = await getObjectFromMinio(fullKey);
      const uploaderEmail = decodeURIComponent(obj.metadata?.uploaderemail || "")
        .trim()
        .toLowerCase();
      if (uploaderEmail && uploaderEmail !== effectiveUser.email.toLowerCase()) {
        return NextResponse.json({ error: "ไม่พบไฟล์ใน MinIO" }, { status: 404 });
      }
    }

    await deleteObjectsFromMinio([fullKey]);
    return NextResponse.json({ deleted: true, key: fullKey });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถลบไฟล์จาก MinIO ได้";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
