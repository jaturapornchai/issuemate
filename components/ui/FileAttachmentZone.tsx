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
  Paperclip,
  Pencil,
  Circle,
  MoveUpRight,
  EyeOff,
  RotateCcw,
  Check,
  FileSpreadsheet,
  ChevronDown,
} from "lucide-react";
import type { AttachmentItem } from "@/lib/types";
import { formatFileSize } from "./Badges";

// Always construct file URL from server key — never trust raw client url
const fileUrl = (a: AttachmentItem) => `/api/files/${encodeURIComponent(a.key)}`;

function isSafeImageAttachment(a: AttachmentItem): boolean {
  const lowerMime = (a.mimeType || "").toLowerCase();
  const lowerName = (a.name || "").toLowerCase();
  if (lowerMime.includes("svg") || lowerName.endsWith(".svg")) return false;
  return a.kind === "image" || lowerMime.startsWith("image/");
}

function isPdfDoc(doc: AttachmentItem) {
  return doc.mimeType?.toLowerCase().includes("pdf") || doc.name.toLowerCase().endsWith(".pdf");
}

function DocIcon({ doc, className = "h-9 w-9" }: { doc: AttachmentItem; className?: string }) {
  const lower = doc.name.toLowerCase();
  if (isPdfDoc(doc)) {
    return (
      <span className={`flex shrink-0 items-center justify-center rounded-lg bg-rose-500/15 font-mono text-[10px] font-bold text-rose-300 ring-1 ring-rose-400/25 ring-inset ${className}`}>
        PDF
      </span>
    );
  }
  const isSheet = /\.(xlsx?|csv)$/.test(lower);
  const Icon = isSheet ? FileSpreadsheet : FileText;
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${
        isSheet ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/25" : "bg-sky-500/15 text-sky-300 ring-sky-400/25"
      } ${className}`}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

export function FileUploadZone({
  attachments,
  onChange,
  uploadedBy = "ผู้ใช้งาน",
  compact = false,
  listenGlobalPaste = false,
  onUploadingChange,
  hidePreview = false,
}: {
  attachments: AttachmentItem[];
  onChange: (next: AttachmentItem[]) => void;
  uploadedBy?: string;
  compact?: boolean;
  listenGlobalPaste?: boolean;
  onUploadingChange?: (busy: boolean) => void;
  hidePreview?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [annotatingAttachment, setAnnotatingAttachment] = useState<AttachmentItem | null>(null);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentsRef = useRef<AttachmentItem[]>(attachments);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    onUploadingChange?.(uploadingCount > 0);
  }, [uploadingCount, onUploadingChange]);

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
        const next = [...attachmentsRef.current, ...uploaded];
        attachmentsRef.current = next;
        onChange(next);
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
            f.name && f.name !== "image.png" ? f.name : `screenshot-${Date.now()}-${i + 1}.${ext}`,
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
    const target = attachments.find((a) => a.id === id);
    if (target?.key) {
      fetch(`/api/files/${encodeURIComponent(target.key)}`, { method: "DELETE" }).catch(() => {});
    }
    onChange(attachments.filter((a) => a.id !== id));
  };

  const handleAnnotatedSave = async (original: AttachmentItem, blob: Blob) => {
    setUploadingCount((c) => c + 1);
    setErrorMsg(null);
    try {
      const cleanBaseName = original.name.replace(/\.[^.]+$/, "");
      const annotatedFile = new File([blob], `${cleanBaseName}-annotated.png`, {
        type: "image/png",
      });
      const formData = new FormData();
      formData.append("uploadedBy", uploadedBy);
      formData.append("files", annotatedFile);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.attachments?.[0]) {
        throw new Error(data.error || "บันทึกรูปที่วาดไม่สำเร็จ");
      }
      const replacement: AttachmentItem = data.attachments[0];
      if (original.key) {
        fetch(`/api/files/${encodeURIComponent(original.key)}`, { method: "DELETE" }).catch(() => {});
      }
      onChange(attachmentsRef.current.map((a) => (a.id === original.id ? replacement : a)));
      setAnnotatingAttachment(null);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "บันทึกรูปที่วาดไม่สำเร็จ");
    } finally {
      setUploadingCount((c) => Math.max(0, c - 1));
    }
  };

  const isUploading = uploadingCount > 0;
  const imageAttachments = attachments.filter(isSafeImageAttachment);
  const docAttachments = attachments.filter((a) => !isSafeImageAttachment(a));

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    },
    onDragLeave: () => setIsDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files?.length) {
        void handleFiles(e.dataTransfer.files);
      }
    },
  };

  const hiddenInputs = (
    <>
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
    </>
  );

  return (
    <div className="space-y-3" onPaste={handlePaste}>
      {compact ? (
        <div
          tabIndex={0}
          data-testid="multi-file-dropzone"
          {...dropHandlers}
          className={`flex flex-wrap items-center gap-2 rounded-xl border border-dashed px-2.5 py-2 transition focus:outline-none ${
            isDragging ? "border-brand-400/60 bg-brand-400/[0.06]" : "border-line hover:border-line-strong"
          }`}
        >
          {hiddenInputs}
          <button
            type="button"
            data-testid="select-multiple-images-btn"
            onClick={() => imageInputRef.current?.click()}
            className="btn btn-ghost btn-xs"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            แนบรูป
          </button>
          <button
            type="button"
            data-testid="select-multiple-files-btn"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-ghost btn-xs"
          >
            <Paperclip className="h-3.5 w-3.5" />
            แนบไฟล์ / PDF
          </button>
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-fg-subtle">
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-400" />
                กำลังอัปโหลด {uploadingCount} ไฟล์…
              </>
            ) : (
              <span className="hidden sm:inline">หรือลากไฟล์มาวาง · Ctrl+V วางรูปแคปหน้าจอ</span>
            )}
          </span>
        </div>
      ) : (
        <div
          tabIndex={0}
          data-testid="multi-file-dropzone"
          {...dropHandlers}
          className={`rounded-2xl border border-dashed p-5 text-center transition focus:outline-none ${
            isDragging
              ? "border-brand-400/60 bg-brand-400/[0.06]"
              : "border-line-strong bg-white/[0.015] hover:border-white/20 hover:bg-white/[0.03]"
          }`}
        >
          {hiddenInputs}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="mx-auto mb-3 flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-line bg-white/[0.04] text-fg-muted"
          >
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
            ) : (
              <UploadCloud className="h-5 w-5" />
            )}
          </div>
          <p className="text-[13px] font-medium text-fg">
            {isUploading ? `กำลังอัปโหลด ${uploadingCount} ไฟล์…` : "ลากรูปหรือไฟล์มาวางที่นี่"}
          </p>
          <p className="mt-1 text-xs text-fg-subtle">
            หรือกด <span className="kbd">Ctrl</span> + <span className="kbd">V</span> เพื่อวางภาพแคปหน้าจอ · แนบได้หลายไฟล์ (รูป, PDF, Excel, Word)
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              data-testid="select-multiple-images-btn"
              onClick={() => imageInputRef.current?.click()}
              className="btn btn-secondary btn-sm"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              เลือกรูปภาพ
            </button>
            <button
              type="button"
              data-testid="select-multiple-files-btn"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary btn-sm"
            >
              <Paperclip className="h-3.5 w-3.5" />
              เลือกไฟล์ / PDF
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <p className="rounded-lg border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2 text-xs text-rose-200">{errorMsg}</p>
      )}

      {!hidePreview && attachments.length > 0 && (
        <div data-testid="uploaded-attachments-list" className="space-y-2.5">
          <p className="text-xs text-fg-subtle">
            แนบแล้ว {attachments.length} ไฟล์
            {imageAttachments.length > 0 && ` · รูปภาพ ${imageAttachments.length}`}
            {docAttachments.length > 0 && ` · เอกสาร ${docAttachments.length}`}
          </p>

          {imageAttachments.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
              {imageAttachments.map((img, idx) => (
                <div
                  key={img.id}
                  data-testid={`uploaded-image-card-${idx}`}
                  className="group relative overflow-hidden rounded-xl border border-line bg-black/30"
                >
                  <button
                    type="button"
                    onClick={() => setPreviewIndex(idx)}
                    className="relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden"
                    title="คลิกเพื่อขยายดูรูปใหญ่"
                  >
                    <img
                      src={fileUrl(img)}
                      alt={img.name}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  </button>

                  <button
                    type="button"
                    data-testid={`remove-attachment-${img.id}`}
                    onClick={() => removeAttachment(img.id)}
                    className="absolute top-1.5 right-1.5 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white/90 backdrop-blur transition hover:bg-rose-600"
                    title="ลบรูปนี้"
                    aria-label={`ลบรูป ${img.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>

                  <div className="flex items-center gap-1.5 border-t border-line px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-[11px] text-fg-muted" title={img.name}>
                      {img.name}
                    </span>
                    <button
                      type="button"
                      data-testid={`annotate-image-btn-${idx}`}
                      onClick={() => setAnnotatingAttachment(img)}
                      className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-md bg-rose-500/15 px-1.5 text-[11px] font-medium text-rose-200 ring-1 ring-rose-400/25 transition ring-inset hover:bg-rose-500/25"
                      title="วาดวงกลม / ลูกศรชี้จุด / เบลอข้อมูลสำคัญ"
                    >
                      <Pencil className="h-3 w-3" />
                      วาดชี้จุด
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {docAttachments.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {docAttachments.map((att, idx) => (
                <div
                  key={att.id}
                  data-testid={`uploaded-file-card-${idx}`}
                  className="flex items-center gap-2.5 rounded-xl border border-line bg-white/[0.02] px-2.5 py-2"
                >
                  <a
                    href={fileUrl(att)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-2.5"
                  >
                    <DocIcon doc={att} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-fg">{att.name}</span>
                      <span className="block text-[11px] text-fg-subtle">{formatFileSize(att.size)}</span>
                    </span>
                  </a>
                  <button
                    type="button"
                    data-testid={`remove-attachment-${att.id}`}
                    onClick={() => removeAttachment(att.id)}
                    className="btn btn-ghost btn-icon btn-xs hover:!text-rose-300"
                    title="ลบไฟล์แนบ"
                    aria-label={`ลบไฟล์ ${att.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
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

      {annotatingAttachment && (
        <ImageAnnotatorModal
          attachment={annotatingAttachment}
          onClose={() => setAnnotatingAttachment(null)}
          onSave={(blob) => void handleAnnotatedSave(annotatingAttachment, blob)}
        />
      )}
    </div>
  );
}

export function AttachmentGallery({
  attachments,
  onRemove,
}: {
  attachments: AttachmentItem[];
  onRemove?: (attachment: AttachmentItem) => void;
}) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [expandedPdfId, setExpandedPdfId] = useState<string | null>(null);
  const [expandedTextId, setExpandedTextId] = useState<string | null>(null);
  const [textPreviewCache, setTextPreviewCache] = useState<Record<string, string>>({});

  const images = (attachments || []).filter(isSafeImageAttachment);
  const docs = (attachments || []).filter((a) => !isSafeImageAttachment(a));

  if (images.length === 0 && docs.length === 0) return null;

  const isTextPreviewable = (doc: AttachmentItem) => {
    const lower = doc.name.toLowerCase();
    const mime = (doc.mimeType || "").toLowerCase();
    return (
      mime.startsWith("text/") ||
      mime.includes("json") ||
      mime.includes("csv") ||
      lower.endsWith(".txt") ||
      lower.endsWith(".csv") ||
      lower.endsWith(".md") ||
      lower.endsWith(".json") ||
      lower.endsWith(".log")
    );
  };

  const toggleTextPreview = async (doc: AttachmentItem) => {
    if (expandedTextId === doc.id) {
      setExpandedTextId(null);
      return;
    }
    setExpandedTextId(doc.id);
    if (!textPreviewCache[doc.id]) {
      try {
        const res = await fetch(fileUrl(doc));
        const txt = await res.text();
        setTextPreviewCache((prev) => ({
          ...prev,
          [doc.id]: txt.slice(0, 12000),
        }));
      } catch {
        setTextPreviewCache((prev) => ({
          ...prev,
          [doc.id]: "ไม่สามารถเปิดอ่านเนื้อหาไฟล์ได้ กรุณากดดาวน์โหลดเพื่อเปิดไฟล์",
        }));
      }
    }
  };

  return (
    <div className="space-y-3" data-testid="attachment-gallery">
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {images.map((img, idx) => (
            <div
              key={img.id}
              className="group relative overflow-hidden rounded-xl border border-line bg-black/30 transition hover:border-line-strong"
            >
              <button
                type="button"
                data-testid="attachment-image-thumb"
                onClick={() => setPreviewIndex(idx)}
                title={`ขยายดูรูป ${img.name}`}
                className="relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden focus:outline-none"
              >
                <img
                  src={fileUrl(img)}
                  alt={img.name}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-black/70 px-3 text-xs font-medium text-white backdrop-blur">
                    <Maximize2 className="h-3.5 w-3.5" /> ขยายดู
                  </span>
                </span>
              </button>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(img)}
                  className="absolute top-1.5 right-1.5 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white/90 opacity-0 backdrop-blur transition group-hover:opacity-100 hover:bg-rose-600"
                  title="ลบรูปนี้ออกจากเรื่อง"
                  aria-label={`ลบรูป ${img.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <div className="flex items-center gap-1.5 border-t border-line px-2.5 py-1.5">
                <span className="min-w-0 flex-1 truncate text-[11px] text-fg-muted" title={img.name}>
                  {img.name}
                </span>
                <a
                  href={fileUrl(img)}
                  download={img.name}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex shrink-0 items-center rounded-md p-1 text-fg-subtle transition hover:bg-white/10 hover:text-fg"
                  title="บันทึกรูปภาพลงเครื่อง"
                  aria-label={`ดาวน์โหลด ${img.name}`}
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {docs.length > 0 && (
        <div className="space-y-2">
          {docs.map((doc, idx) => {
            const isPdf = isPdfDoc(doc);
            const isText = !isPdf && isTextPreviewable(doc);
            const isPdfOpen = expandedPdfId === doc.id;
            const isTextOpen = expandedTextId === doc.id;

            return (
              <div
                key={doc.id}
                data-testid={`gallery-doc-card-${idx}`}
                className="overflow-hidden rounded-xl border border-line bg-white/[0.02]"
              >
                <div className="flex flex-wrap items-center gap-3 p-2.5 pr-3">
                  <DocIcon doc={doc} className="h-10 w-10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-fg">{doc.name}</p>
                    <p className="text-[11px] text-fg-subtle">
                      {isPdf ? "เอกสาร PDF" : "ไฟล์แนบ"} · {formatFileSize(doc.size)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {isPdf && (
                      <button
                        type="button"
                        data-testid={`preview-pdf-inline-btn-${idx}`}
                        onClick={() => setExpandedPdfId((prev) => (prev === doc.id ? null : doc.id))}
                        className={`btn btn-xs ${isPdfOpen ? "bg-white/[0.08] text-fg" : "btn-secondary"}`}
                      >
                        {isPdfOpen ? <ChevronDown className="h-3.5 w-3.5 rotate-180" /> : <Maximize2 className="h-3.5 w-3.5" />}
                        <span>{isPdfOpen ? "ซ่อน PDF" : "เปิดดู PDF"}</span>
                      </button>
                    )}

                    {isText && (
                      <button
                        type="button"
                        data-testid={`preview-doc-inline-btn-${idx}`}
                        onClick={() => void toggleTextPreview(doc)}
                        className={`btn btn-xs ${isTextOpen ? "bg-white/[0.08] text-fg" : "btn-secondary"}`}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>{isTextOpen ? "ซ่อนเนื้อหา" : "อ่านเนื้อหา"}</span>
                      </button>
                    )}

                    <a
                      href={fileUrl(doc)}
                      target="_blank"
                      rel="noreferrer"
                      data-testid={`open-doc-tab-btn-${idx}`}
                      className="btn btn-ghost btn-icon btn-xs"
                      title="เปิดในแท็บใหม่"
                      aria-label="เปิดในแท็บใหม่"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>

                    <a
                      href={fileUrl(doc)}
                      download={doc.name}
                      data-testid={`download-doc-btn-${idx}`}
                      className="btn btn-ghost btn-icon btn-xs"
                      title="ดาวน์โหลด"
                      aria-label="ดาวน์โหลด"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>

                    {onRemove && (
                      <button
                        type="button"
                        onClick={() => onRemove(doc)}
                        className="btn btn-ghost btn-icon btn-xs hover:!text-rose-300"
                        title="ลบไฟล์นี้ออกจากเรื่อง"
                        aria-label={`ลบไฟล์ ${doc.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Embedded PDF Viewer */}
                {isPdf && isPdfOpen && (
                  <div data-testid={`inline-pdf-viewer-${idx}`} className="border-t border-line bg-black/40">
                    <iframe
                      src={fileUrl(doc)}
                      title={doc.name}
                      sandbox=""
                      data-testid={`inline-pdf-iframe-${idx}`}
                      className="h-[460px] w-full bg-white"
                    />
                  </div>
                )}

                {/* Inline Text / CSV / Log Reader */}
                {isText && isTextOpen && (
                  <pre
                    data-testid={`inline-doc-reader-${idx}`}
                    className="max-h-64 overflow-y-auto border-t border-line bg-black/30 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-fg-muted"
                  >
                    {textPreviewCache[doc.id] || "กำลังโหลดเนื้อหาไฟล์…"}
                  </pre>
                )}
              </div>
            );
          })}
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
    "absolute top-1/2 inline-flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/90 shadow-lg backdrop-blur transition hover:bg-black/80";

  return createPortal(
    <div
      data-testid="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`ดูรูป ${img.name}`}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex animate-fade-in flex-col bg-black/90 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {hasMany && (
            <span data-testid="lightbox-counter" className="count">
              {index + 1} / {images.length}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{img.name}</p>
            <p className="text-[11px] text-white/50">
              {formatFileSize(img.size)} · อัปโหลดโดย {img.uploadedBy}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <a href={fileUrl(img)} download={img.name} className="btn btn-secondary btn-sm">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">ดาวน์โหลด</span>
          </a>
          <a href={fileUrl(img)} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">เปิดแท็บใหม่</span>
          </a>
          <button
            type="button"
            data-testid="lightbox-close-btn"
            onClick={onClose}
            title="ปิด (Esc)"
            aria-label="ปิด"
            className="btn btn-ghost btn-icon btn-sm text-white/80"
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
          className="max-h-full max-w-full animate-scale-in rounded-lg object-contain shadow-2xl"
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

      <p className="pb-4 text-center text-xs text-white/40">
        กด Esc หรือคลิกพื้นที่ว่างเพื่อปิด{hasMany ? " · ใช้ปุ่มลูกศร ← → เพื่อดูรูปถัดไป" : ""}
      </p>
    </div>,
    document.body
  );
}

type AnnotatorTool = "circle" | "arrow" | "blur";

interface AnnotationShape {
  tool: AnnotatorTool;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

const ANNOTATOR_TOOLS: Array<{
  key: AnnotatorTool;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "circle", label: "วงกลม", hint: "ล้อมจุดที่มีปัญหา", icon: Circle },
  { key: "arrow", label: "ลูกศร", hint: "ชี้จุดที่ต้องการให้แก้", icon: MoveUpRight },
  { key: "blur", label: "เบลอ", hint: "ซ่อนข้อมูลลับลูกค้า", icon: EyeOff },
];

export function ImageAnnotatorModal({
  attachment,
  onClose,
  onSave,
}: {
  attachment: AttachmentItem;
  onClose: () => void;
  onSave: (blob: Blob) => void;
}) {
  const [tool, setTool] = useState<AnnotatorTool>("circle");
  const [shapes, setShapes] = useState<AnnotationShape[]>([]);
  const [draftShape, setDraftShape] = useState<AnnotationShape | null>(null);
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setImgLoaded(true);
    };
    img.src = fileUrl(attachment);
  }, [attachment]);

  const drawShape = useCallback(
    (ctx: CanvasRenderingContext2D, img: HTMLImageElement, s: AnnotationShape) => {
      ctx.save();
      if (s.tool === "circle") {
        const cx = (s.startX + s.endX) / 2;
        const cy = (s.startY + s.endY) / 2;
        const rx = Math.max(8, Math.abs(s.endX - s.startX) / 2);
        const ry = Math.max(8, Math.abs(s.endY - s.startY) / 2);
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = Math.max(3, Math.round(img.width / 180));
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.tool === "arrow") {
        const headLen = Math.max(14, Math.round(img.width / 45));
        const dx = s.endX - s.startX;
        const dy = s.endY - s.startY;
        const angle = Math.atan2(dy, dx);
        ctx.strokeStyle = "#ef4444";
        ctx.fillStyle = "#ef4444";
        ctx.lineWidth = Math.max(4, Math.round(img.width / 160));
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(s.startX, s.startY);
        ctx.lineTo(s.endX, s.endY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(s.endX, s.endY);
        ctx.lineTo(
          s.endX - headLen * Math.cos(angle - Math.PI / 6),
          s.endY - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          s.endX - headLen * Math.cos(angle + Math.PI / 6),
          s.endY - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      } else if (s.tool === "blur") {
        const x = Math.min(s.startX, s.endX);
        const y = Math.min(s.startY, s.endY);
        const w = Math.max(12, Math.abs(s.endX - s.startX));
        const h = Math.max(12, Math.abs(s.endY - s.startY));
        // Pixelate / heavy blur region so sensitive customer data is unreadable
        const off = document.createElement("canvas");
        const scale = 0.08;
        off.width = Math.max(2, Math.round(w * scale));
        off.height = Math.max(2, Math.round(h * scale));
        const offCtx = off.getContext("2d");
        if (offCtx) {
          offCtx.imageSmoothingEnabled = false;
          offCtx.drawImage(img, x, y, w, h, 0, 0, off.width, off.height);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(off, 0, 0, off.width, off.height, x, y, w, h);
          ctx.strokeStyle = "rgba(148, 163, 184, 0.6)";
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, w, h);
        }
      }
      ctx.restore();
    },
    []
  );

  useEffect(() => {
    if (!imgLoaded || !imageRef.current || !canvasRef.current) return;
    const img = imageRef.current;
    const canvas = canvasRef.current;
    canvas.width = img.width || 800;
    canvas.height = img.height || 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const s of shapes) {
      drawShape(ctx, img, s);
    }
    if (draftShape) {
      drawShape(ctx, img, draftShape);
    }
  }, [imgLoaded, shapes, draftShape, drawShape]);

  const toCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toCanvasCoords(e);
    setDraftShape({ tool, startX: x, startY: y, endX: x + 24, endY: y + 24 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draftShape) return;
    const { x, y } = toCanvasCoords(e);
    setDraftShape((prev) => (prev ? { ...prev, endX: x, endY: y } : null));
  };

  const handleMouseUp = () => {
    if (!draftShape) return;
    setShapes((prev) => [...prev, draftShape]);
    setDraftShape(null);
  };

  const handleConfirmSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    canvas.toBlob((blob) => {
      setSaving(false);
      if (blob) onSave(blob);
    }, "image/png");
  };

  return createPortal(
    <div
      data-testid="image-annotator-modal"
      className="fixed inset-0 z-[70] flex animate-fade-in flex-col bg-canvas/95 backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/25 ring-inset">
            <Pencil className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-fg">วาดชี้จุดปัญหา / เบลอข้อมูลสำคัญ</h3>
            <p className="truncate text-xs text-fg-subtle">เลือกเครื่องมือ แล้วลากเมาส์บนรูปได้เลย</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-line bg-black/20 p-1">
            {ANNOTATOR_TOOLS.map((t) => {
              const Icon = t.icon;
              const active = tool === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  data-testid={`annotator-tool-${t.key}`}
                  onClick={() => setTool(t.key)}
                  title={t.hint}
                  aria-pressed={active}
                  className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition ${
                    active ? "bg-rose-500 text-white shadow" : "text-fg-muted hover:bg-white/[0.06] hover:text-fg"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            data-testid="annotator-undo-btn"
            disabled={shapes.length === 0}
            onClick={() => setShapes((prev) => prev.slice(0, -1))}
            className="btn btn-ghost btn-sm"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            ย้อนกลับ
          </button>

          <button type="button" data-testid="annotator-cancel-btn" onClick={onClose} className="btn btn-secondary btn-sm">
            ยกเลิก
          </button>

          <button
            type="button"
            data-testid="annotator-save-btn"
            disabled={saving}
            onClick={handleConfirmSave}
            className="btn btn-primary btn-sm"
          >
            <Check className="h-4 w-4" />
            {saving ? "กำลังบันทึก…" : "บันทึกรูปที่วาด"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-auto p-6">
        <canvas
          ref={canvasRef}
          data-testid="annotator-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="max-h-[78vh] max-w-full cursor-crosshair rounded-xl border border-line bg-surface shadow-pop"
        />
      </div>
    </div>,
    document.body
  );
}
