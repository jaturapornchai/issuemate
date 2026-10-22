import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import crypto from "crypto";
import type { AttachmentItem } from "./types";

const rawMinioEndpoint = process.env.MINIO_ENDPOINT || "http://127.0.0.1:9100";
const MINIO_ENDPOINT = rawMinioEndpoint.startsWith("http")
  ? rawMinioEndpoint
  : `http://${rawMinioEndpoint}:${process.env.MINIO_PORT || "9100"}`;
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || "";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || "";
const MINIO_BUCKET = process.env.MINIO_BUCKET || "issuemate-files";
const MINIO_REGION = process.env.MINIO_REGION || "us-east-1";

interface GlobalMinio {
  s3?: S3Client;
  bucketReady?: boolean;
}

const globalForMinio = globalThis as unknown as GlobalMinio;

export function getS3Client(): S3Client {
  if (!globalForMinio.s3) {
    globalForMinio.s3 = new S3Client({
      endpoint: MINIO_ENDPOINT,
      region: MINIO_REGION,
      credentials: {
        accessKeyId: MINIO_ACCESS_KEY,
        secretAccessKey: MINIO_SECRET_KEY,
      },
      forcePathStyle: true,
    });
  }
  return globalForMinio.s3;
}

export async function ensureBucket(): Promise<string> {
  const s3 = getS3Client();
  if (!globalForMinio.bucketReady) {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }));
      globalForMinio.bucketReady = true;
    } catch {
      await s3.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET }));
      globalForMinio.bucketReady = true;
    }
  }
  return MINIO_BUCKET;
}

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
export const MAX_FILES_PER_REQUEST = 10;
export const VALID_MINIO_KEY_REGEX = /^\d{8}\/[0-9a-f-]{36}-[^/]+$/i;

// Exclude image/svg+xml so SVG is treated as a downloadable document and never rendered inline
const IMAGE_MIME_PREFIXES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

export function classifyAttachmentKind(mimeType: string, filename: string): "image" | "document" {
  const lowerMime = (mimeType || "").toLowerCase();
  if (lowerMime.includes("svg")) return "document";
  if (IMAGE_MIME_PREFIXES.some((p) => lowerMime.startsWith(p))) {
    return "image";
  }
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext)) {
    return "image";
  }
  return "document";
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9ก-๙._-]/g, "_").slice(0, 120) || "file";
}

export function sanitizeClientAttachments(
  rawList: unknown,
  fallbackUploadedBy: string
): AttachmentItem[] {
  if (!Array.isArray(rawList)) return [];
  const sanitized: AttachmentItem[] = [];
  for (const raw of rawList.slice(0, MAX_FILES_PER_REQUEST * 2)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const key = String(item.key || "").trim();
    if (!VALID_MINIO_KEY_REGEX.test(key)) {
      throw new Error(`รหัสไฟล์แนบ (MinIO Key) ไม่ถูกต้องหรือไม่ได้อัปโหลดผ่านระบบ: ${key || "empty"}`);
    }
    const name = String(item.name || key.split("/").pop() || "file").slice(0, 200);
    const mimeType = String(item.mimeType || "application/octet-stream").slice(0, 120);
    const size = Math.max(0, Number(item.size) || 0);
    const uploadedAt =
      typeof item.uploadedAt === "string" && item.uploadedAt
        ? item.uploadedAt
        : new Date().toISOString();
    const uploadedBy =
      typeof item.uploadedBy === "string" && item.uploadedBy.trim()
        ? item.uploadedBy.trim().slice(0, 120)
        : fallbackUploadedBy;
    sanitized.push({
      id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID(),
      key,
      name,
      mimeType,
      size,
      kind: classifyAttachmentKind(mimeType, name),
      uploadedAt,
      uploadedBy,
      // Always derive URL on the server from key — never trust client-supplied url (prevents javascript: XSS)
      url: `/api/files/${encodeURIComponent(key)}`,
    });
  }
  return sanitized;
}

export async function uploadBufferToMinio(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  uploadedBy?: string;
  uploaderEmail?: string;
}): Promise<AttachmentItem> {
  if (params.buffer.byteLength > MAX_FILE_SIZE) {
    throw new Error(`ไฟล์ ${params.filename} มีขนาดเกิน 50MB`);
  }
  const s3 = getS3Client();
  const bucket = await ensureBucket();

  const id = crypto.randomUUID();
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const safeName = sanitizeFilename(params.filename);
  const key = `${datePrefix}/${id}-${safeName}`;
  const contentType = params.mimeType || "application/octet-stream";

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: params.buffer,
      ContentType: contentType,
      Metadata: {
        originalname: encodeURIComponent(params.filename),
        uploadedby: encodeURIComponent(params.uploadedBy || ""),
        uploaderemail: encodeURIComponent((params.uploaderEmail || "").trim().toLowerCase()),
      },
    })
  );

  const kind = classifyAttachmentKind(contentType, params.filename);

  return {
    id,
    key,
    name: params.filename,
    mimeType: contentType,
    size: params.buffer.byteLength,
    kind,
    uploadedAt: new Date().toISOString(),
    uploadedBy: params.uploadedBy || "สมาชิกในทีม",
    url: `/api/files/${encodeURIComponent(key)}`,
  };
}

export async function deleteObjectsFromMinio(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const s3 = getS3Client();
  const bucket = await ensureBucket();
  // DeleteObjects accepts at most 1000 keys per request
  for (let i = 0; i < keys.length; i += 1000) {
    const res = await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
      })
    );
    if (res.Errors?.length) {
      console.error("[minio] delete errors:", res.Errors.map((e) => `${e.Key}: ${e.Code}`).join(", "));
    }
  }
}

export async function getObjectFromMinio(key: string): Promise<{
  body: ReadableStream | Uint8Array | null;
  contentType: string;
  contentLength?: number;
  metadata?: Record<string, string>;
}> {
  const s3 = getS3Client();
  const bucket = await ensureBucket();
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  const byteArray = res.Body ? await res.Body.transformToByteArray() : null;
  return {
    body: byteArray,
    contentType: res.ContentType || "application/octet-stream",
    contentLength: res.ContentLength,
    metadata: res.Metadata,
  };
}
