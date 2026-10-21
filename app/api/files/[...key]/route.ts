import { NextResponse } from "next/server";
import { getObjectFromMinio } from "@/lib/minio";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ key: string[] }> }
) {
  try {
    const { key } = await context.params;
    const fullKey = key.map((segment) => decodeURIComponent(segment)).join("/");
    const obj = await getObjectFromMinio(fullKey);

    if (!obj.body) {
      return NextResponse.json({ error: "ไม่พบไฟล์ใน MinIO" }, { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", obj.contentType);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
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
