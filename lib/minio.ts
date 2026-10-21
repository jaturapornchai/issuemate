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

const IMAGE_MIME_PREFIXES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/svg+xml"];

export function classifyAttachmentKind(mimeType: string, filename: string): "image" | "document" {
  const lowerMime = (mimeType || "").toLowerCase();
  if (IMAGE_MIME_PREFIXES.some((p) => lowerMime.startsWith(p))) {
    return "image";
  }
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"].includes(ext)) {
    return "image";
  }
  return "document";
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9ก-๙._-]/g, "_").slice(0, 120) || "file";
}

export async function uploadBufferToMinio(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  uploadedBy?: string;
}): Promise<AttachmentItem> {
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
  };
}
