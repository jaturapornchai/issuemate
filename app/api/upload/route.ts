import { NextResponse } from "next/server";
import { uploadBufferToMinio } from "@/lib/minio";
import type { AttachmentItem } from "@/lib/types";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const uploadedBy = String(formData.get("uploadedBy") || "สมาชิกในทีม");
      const files = formData.getAll("files");

      if (!files || files.length === 0) {
        return NextResponse.json({ error: "กรุณาเลือกไฟล์ที่ต้องการอัปโหลด" }, { status: 400 });
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
        });
        uploaded.push(result);
      }

      return NextResponse.json({ attachments: uploaded }, { status: 201 });
    }

    // Fallback: JSON base64 upload for AI / API clients
    const body = await req.json();
    const items = Array.isArray(body.files) ? body.files : [body];
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
        uploadedBy: String(item.uploadedBy || "AI / API Client"),
      });
      uploaded.push(result);
    }

    return NextResponse.json({ attachments: uploaded }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "อัปโหลดไฟล์ไปยัง MinIO ไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
