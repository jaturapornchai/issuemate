import { NextResponse } from "next/server";
import {
  MAX_FILE_SIZE,
  MAX_FILES_PER_REQUEST,
  uploadBufferToMinio,
} from "@/lib/minio";
import type { AttachmentItem } from "@/lib/types";
import {
  assertCsrfSafe,
  authRequiredResponse,
  getCurrentUser,
  type AuthUser,
} from "@/lib/auth";
import { formatTokenActorIdentity, verifyMcpRequestToken } from "@/lib/mcp-tokens";

export const runtime = "nodejs";

function canUserUploadAnyFile(user: AuthUser): boolean {
  if (user.isAdmin) return true;
  const projects = user.allowedProjects || [];
  if (projects.length === 0) return false;
  const perms = Object.values(user.projectPermissions || {});
  const hasWritableProject = perms.some((p) => p !== "viewer");
  if (perms.length > 0) return hasWritableProject;
  return (user.defaultPermission || "reporter") !== "viewer";
}

export async function POST(req: Request) {
  const csrfErr = assertCsrfSafe(req, { allowMultipart: true });
  if (csrfErr) return csrfErr;

  try {
    // Browser session, or an MCP token for AI / API clients
    const user = await getCurrentUser();
    const tokenCheck = user ? null : await verifyMcpRequestToken(req);
    if (!user && !tokenCheck?.allowed) return authRequiredResponse();
    const effectiveUser = user || tokenCheck?.ownerUser;
    if (effectiveUser && !canUserUploadAnyFile(effectiveUser)) {
      return NextResponse.json(
        { error: "บัญชีของคุณมีสิทธิ์ดูอย่างเดียว ไม่สามารถอัปโหลดไฟล์ได้" },
        { status: 403 }
      );
    }
    const uploadedBy = user ? user.name : formatTokenActorIdentity(tokenCheck?.tokenRecord);
    const uploaderEmail = effectiveUser?.email || "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const files = formData.getAll("files");

      if (!files || files.length === 0) {
        return NextResponse.json({ error: "กรุณาเลือกไฟล์ที่ต้องการอัปโหลด" }, { status: 400 });
      }
      if (files.length > MAX_FILES_PER_REQUEST) {
        return NextResponse.json(
          { error: `อัปโหลดได้ไม่เกิน ${MAX_FILES_PER_REQUEST} ไฟล์ต่อครั้ง` },
          { status: 400 }
        );
      }

      const uploaded: AttachmentItem[] = [];
      for (const item of files) {
        if (!(item instanceof File)) continue;
        if (item.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: `ไฟล์ ${item.name} มีขนาดเกิน 50MB` },
            { status: 400 }
          );
        }
        const arrayBuf = await item.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const result = await uploadBufferToMinio({
          buffer,
          filename: item.name,
          mimeType: item.type || "application/octet-stream",
          uploadedBy,
          uploaderEmail,
        });
        uploaded.push(result);
      }

      return NextResponse.json({ attachments: uploaded }, { status: 201 });
    }

    // Fallback: JSON base64 upload for AI / API clients
    const body = await req.json();
    const items = Array.isArray(body.files) ? body.files : [body];
    if (items.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        { error: `อัปโหลดได้ไม่เกิน ${MAX_FILES_PER_REQUEST} ไฟล์ต่อครั้ง` },
        { status: 400 }
      );
    }
    const uploaded: AttachmentItem[] = [];

    for (const item of items) {
      if (!item || !item.base64 || !item.filename) continue;
      const base64Clean = String(item.base64).replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Clean, "base64");
      if (buffer.byteLength > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `ไฟล์ ${item.filename} มีขนาดเกิน 50MB` },
          { status: 400 }
        );
      }
      const result = await uploadBufferToMinio({
        buffer,
        filename: String(item.filename),
        mimeType: String(item.mimeType || "application/octet-stream"),
        uploadedBy,
        uploaderEmail,
      });
      uploaded.push(result);
    }

    return NextResponse.json({ attachments: uploaded }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "อัปโหลดไฟล์ไปยัง MinIO ไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
