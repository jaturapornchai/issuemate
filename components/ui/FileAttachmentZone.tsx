"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Trash2,
  Download,
  ExternalLink,
  Loader2,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  X,
  ClipboardPaste,
  Paperclip,
  Plus,
} from "lucide-react";
import type { AttachmentItem } from "@/lib/types";
import { formatFileSize } from "./Badges";

const fileUrl = (a: AttachmentItem) => a.url || `/api/files/${encodeURIComponent(a.key)}`;

export function FileUploadZone({
  attachments,
  onChange,
  uploadedBy = "ผู้ใช้งาน",
  compact = false,
  listenGlobalPaste = false,
}: {
  attachments: AttachmentItem[];
  onChange: (next: AttachmentItem[]) => void;
  uploadedBy?: string;
  compact?: boolean;
  listenGlobalPaste?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentsRef = useRef<AttachmentItem[]>(attachments);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      setUploadingCount((c) => c + files.length);
      setErrorMsg(null);
      try {
        const formData = new FormData();
        formData.append("uploadedBy", uploadedBy);
        for (const file of files) {
          formData.append("files", file);
        }

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "อัปโหลดไฟล์ไม่สำเร็จ");
        }

        const uploaded: AttachmentItem[] = data.attachments || [];
        onChange([...attachmentsRef.current, ...uploaded]);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการอัปโหลด");
      } finally {
        setUploadingCount((c) => Math.max(0, c - files.length));
        if (imageInputRef.current) imageInputRef.current.value = "";
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [onChange, uploadedBy]
  );

  const extractClipboardFiles = (items?: DataTransferItemList | null): File[] => {
    if (!items) return [];
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) {
          const ext = f.type.split("/")[1] || "png";
          const namedFile = new File(
            [f],
            f.name && f.name !== "image.png"
              ? f.name
              : `screenshot-${Date.now()}-${i + 1}.${ext}`,
            { type: f.type || "image/png" }
          );
          files.push(namedFile);
        }
      }
    }
    return files;
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = extractClipboardFiles(e.clipboardData?.items);
    if (files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      void handleFiles(files);
    }
  };

  useEffect(() => {
    if (!listenGlobalPaste) return;
    const onWinPaste = (e: ClipboardEvent) => {
      const files = extractClipboardFiles(e.clipboardData?.items);
      if (files.length > 0) {
        e.preventDefault();
        void handleFiles(files);
      }
    };
    window.addEventListener("paste", onWinPaste);
    return () => window.removeEventListener("paste", onWinPaste);
  }, [listenGlobalPaste, handleFiles]);

  const removeAttachment = (id: string) => {
    onChange(attachments.filter((a) => a.id !== id));
  };

  const isUploading = uploadingCount > 0;
  const imageAttachments = attachments.filter(
    (a) => a.kind === "image" || a.mimeType?.startsWith("image/")
  );
  const docAttachments = attachments.filter(
    (a) => a.kind !== "image" && !a.mimeType?.startsWith("image/")
  );

  return (
    <div className="space-y-3" onPaste={handlePaste}>
      <div
        tabIndex={0}
        data-testid="multi-file-dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files?.length) {
            void handleFiles(e.dataTransfer.files);
          }
        }}
        className={`rounded-xl border-2 border-dashed transition focus:border-emerald-400 focus:outline-none ${
          isDragging
            ? "border-emerald-400 bg-emerald-500/15"
            : "border-emerald-500/35 bg-slate-950/80 hover:border-emerald-500/60"
        } ${compact ? "p-3" : "p-4"}`}
      >
        {/* Hidden Input 1: Multiple Images */}
        <input
          ref={imageInputRef}
          type="file"
          multiple
          data-testid="image-upload-input"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files?.length) {
              void handleFiles(e.target.files);
            }
          }}
          className="hidden"
        />

        {/* Hidden Input 2: Multiple Any Files */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          data-testid="file-upload-input"
          onChange={(e) => {
            if (e.target.files?.length) {
              void handleFiles(e.target.files);
            }
          }}
          className="hidden"
        />

        <div className="flex flex-col gap-3">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <UploadCloud className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white">
                {isUploading
                  ? `กำลังอัปโหลด ${uploadingCount} ไฟล์...`
                  : "คลิกเลือกไฟล์, ลากวางหลายไฟล์พร้อมกัน หรือกด Ctrl+V วางภาพแคปหน้าจอได้ทันที"}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                แนบรูปภาพได้หลายรูป (PNG, JPG, WEBP) และแนบไฟล์เอกสารได้หลายไฟล์ (PDF, Excel, Word, CSV, ZIP, TXT) ไม่จำกัดจำนวน
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="select-multiple-images-btn"
              onClick={() => imageInputRef.current?.click()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-bold text-white shadow hover:bg-emerald-500 cursor-pointer"
            >
              <ImageIcon className="h-4 w-4" />
              <span>เลือกรูปภาพ (หลายรูป)</span>
            </button>

            <button
              type="button"
              data-testid="select-multiple-files-btn"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-3.5 text-xs font-bold text-sky-200 hover:bg-sky-500/25 cursor-pointer"
            >
              <Paperclip className="h-4 w-4" />
              <span>แนบไฟล์ (หลายไฟล์)</span>
            </button>

            <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 text-[11px] font-medium text-slate-300">
              <ClipboardPaste className="h-3.5 w-3.5 text-emerald-400" /> กด Ctrl+V วางรูปแคปหน้าจอได้เรื่อยๆ
            </span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {errorMsg}
        </p>
      )}

      {/* Attached Summary & Preview Grid */}
      {attachments.length > 0 && (
        <div
          data-testid="uploaded-attachments-list"
          className="rounded-xl border border-slate-800 bg-slate-950/90 p-3.5 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
              <span>
                ไฟล์ที่แนบแล้วทั้งหมด {attachments.length} รายการ (รูปภาพ {imageAttachments.length} รูป • ไฟล์{" "}
                {docAttachments.length} ไฟล์)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
              >
                <Plus className="h-3 w-3" /> เพิ่มรูปอีก
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-sky-500/40 bg-sky-500/10 px-2.5 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/20 cursor-pointer"
              >
                <Plus className="h-3 w-3" /> เพิ่มไฟล์อีก
              </button>
            </div>
          </div>

          {/* 1. Image Thumbnail Grid */}
          {imageAttachments.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
              {imageAttachments.map((img, idx) => {
                const url = fileUrl(img);
                return (
                  <div
                    key={img.id}
                    data-testid={`uploaded-image-card-${idx}`}
                    className="group relative flex flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900"
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewIndex(idx)}
                      className="relative h-28 w-full overflow-hidden bg-slate-950 text-left cursor-zoom-in"
                      title="คลิกเพื่อขยายดูรูปใหญ่"
                    >
                      <img
                        src={url}
                        alt={img.name}
                        className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                      />
                      <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        <Maximize2 className="h-2.5 w-2.5 text-emerald-400" /> ขยาย
                      </span>
                    </button>

                    <button
                      type="button"
                      data-testid={`remove-attachment-${img.id}`}
                      onClick={() => removeAttachment(img.id)}
                      className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-600/90 text-white shadow hover:bg-rose-500 cursor-pointer"
                      title="ลบรูปนี้"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>

                    <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-[11px]">
                      <span className="truncate font-medium text-slate-200">{img.name}</span>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {formatFileSize(img.size)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2. Document / Other Files List */}
          {docAttachments.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {docAttachments.map((att, idx) => {
                const url = fileUrl(att);
                return (
                  <div
                    key={att.id}
                    data-testid={`uploaded-file-card-${idx}`}
                    className="flex items-center justify-between gap-2.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"
                  >
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-w-0 flex-1 items-center gap-2.5 hover:text-sky-300"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-sky-400">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-slate-200">{att.name}</p>
                        <p className="text-[11px] text-slate-400">
                          ไฟล์แนบ • {formatFileSize(att.size)}
                        </p>
                      </div>
                    </a>
                    <button
                      type="button"
                      data-testid={`remove-attachment-${att.id}`}
                      onClick={() => removeAttachment(att.id)}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-rose-500/15 hover:text-rose-300 cursor-pointer"
                      title="ลบไฟล์แนบ"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {previewIndex !== null && imageAttachments[previewIndex] && (
        <ImageLightbox
          images={imageAttachments}
          index={previewIndex}
          onChangeIndex={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </div>
  );
}

export function AttachmentGallery({ attachments }: { attachments: AttachmentItem[] }) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const images = (attachments || []).filter(
    (a) => a.kind === "image" || a.mimeType?.startsWith("image/")
  );
  const docs = (attachments || []).filter(
    (a) => a.kind !== "image" && !a.mimeType?.startsWith("image/")
  );

  if (images.length === 0 && docs.length === 0) return null;

  return (
    <div className="space-y-3 pt-2">
      {images.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-300">
            <ImageIcon className="h-3.5 w-3.5 text-emerald-400" />
            <span>รูปภาพประกอบ ({images.length} รูป) • คลิกเพื่อขยาย</span>
          </p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {images.map((img, idx) => (
              <button
                type="button"
                key={img.id}
                data-testid="attachment-image-thumb"
                onClick={() => setPreviewIndex(idx)}
                title={`ขยายดูรูป ${img.name}`}
                className="group relative overflow-hidden rounded-lg border border-slate-800 bg-slate-950 text-left transition hover:border-emerald-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
              >
                <img
                  src={fileUrl(img)}
                  alt={img.name}
                  className="h-28 w-full object-cover transition duration-200 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 top-0 flex h-28 items-center justify-center bg-slate-950/60 opacity-0 transition group-hover:opacity-100">
                  <span className="inline-flex h-7 items-center gap-1 rounded-md bg-slate-900/90 px-2.5 text-xs font-medium text-white">
                    <Maximize2 className="h-3.5 w-3.5 text-emerald-400" /> ขยายดูรูป
                  </span>
                </div>
                <div className="truncate bg-slate-900/95 px-2 py-1 text-[11px] text-slate-300">
                  {img.name}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {docs.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-300">
            <FileText className="h-3.5 w-3.5 text-sky-400" />
            <span>เอกสารแนบ ({docs.length} ไฟล์)</span>
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {docs.map((doc) => (
              <a
                key={doc.id}
                href={fileUrl(doc)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2.5 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 transition hover:border-sky-500/50 hover:bg-slate-800/80"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-sky-400" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-200">{doc.name}</p>
                    <p className="text-[11px] text-slate-400">{formatFileSize(doc.size)}</p>
                  </div>
                </div>
                <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded bg-slate-800 px-2 text-[11px] text-sky-300">
                  <Download className="h-3 w-3" /> เปิด/ดาวน์โหลด
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {previewIndex !== null && images[previewIndex] && (
        <ImageLightbox
          images={images}
          index={previewIndex}
          onChangeIndex={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </div>
  );
}

export function ImageLightbox({
  images,
  index,
  onChangeIndex,
  onClose,
}: {
  images: AttachmentItem[];
  index: number;
  onChangeIndex: (i: number) => void;
  onClose: () => void;
}) {
  const img = images[index];
  const hasMany = images.length > 1;
  const go = useCallback(
    (step: number) => onChangeIndex((index + step + images.length) % images.length),
    [index, images.length, onChangeIndex]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && hasMany) go(1);
      else if (e.key === "ArrowLeft" && hasMany) go(-1);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [go, hasMany, onClose]);

  const navBtn =
    "absolute top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-600 bg-slate-900/85 text-slate-100 shadow-lg transition hover:border-emerald-400 hover:text-emerald-300 cursor-pointer";

  return createPortal(
    <div
      data-testid="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`ดูรูป ${img.name}`}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex flex-col bg-black/90 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/90 px-4"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {hasMany && (
            <span
              data-testid="lightbox-counter"
              className="inline-flex h-6 shrink-0 items-center rounded-full bg-slate-800 px-2.5 font-mono text-xs leading-none text-slate-200"
            >
              {index + 1} / {images.length}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-tight text-slate-100">{img.name}</p>
            <p className="text-[11px] leading-tight text-slate-400">
              {formatFileSize(img.size)} • อัปโหลดโดย {img.uploadedBy}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={fileUrl(img)}
            download={img.name}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5" /> ดาวน์โหลด
          </a>
          <a
            href={fileUrl(img)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            <ExternalLink className="h-3.5 w-3.5" /> เปิดแท็บใหม่
          </a>
          <button
            type="button"
            data-testid="lightbox-close-btn"
            onClick={onClose}
            title="ปิด (Esc)"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-6">
        <img
          src={fileUrl(img)}
          alt={img.name}
          data-testid="lightbox-image"
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-lg bg-slate-950 object-contain shadow-2xl"
        />
        {hasMany && (
          <>
            <button
              type="button"
              data-testid="lightbox-prev-btn"
              title="รูปก่อนหน้า (←)"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              className={`${navBtn} left-4`}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              data-testid="lightbox-next-btn"
              title="รูปถัดไป (→)"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              className={`${navBtn} right-4`}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      <p className="pb-3 text-center text-[11px] text-slate-500">
        กด Esc หรือคลิกพื้นที่ว่างเพื่อปิด{hasMany ? " • ใช้ปุ่มลูกศร ← → เพื่อเลื่อนดูรูปถัดไป" : ""}
      </p>
    </div>,
    document.body
  );
}
