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
  Pencil,
  Circle,
  MoveUpRight,
  EyeOff,
  RotateCcw,
  Check,
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

export function FileUploadZone({
  attachments,
  onChange,
  uploadedBy = "ผู้ใช้งาน",
  compact = false,
  listenGlobalPaste = false,
  onUploadingChange,
}: {
  attachments: AttachmentItem[];
  onChange: (next: AttachmentItem[]) => void;
  uploadedBy?: string;
  compact?: boolean;
  listenGlobalPaste?: boolean;
  onUploadingChange?: (busy: boolean) => void;
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
    const target = attachments.find((a) => a.id === id);
    if (target?.key) {
      fetch(`/api/files/${encodeURIComponent(target.key)}`, { method: "DELETE" }).catch(
        () => {}
      );
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
        fetch(`/api/files/${encodeURIComponent(original.key)}`, { method: "DELETE" }).catch(
          () => {}
        );
      }
      onChange(
        attachmentsRef.current.map((a) => (a.id === original.id ? replacement : a))
      );
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
              <FileText className="h-4 w-4" />
              <span>แนบไฟล์ PDF / เอกสาร / อื่นๆ (หลายไฟล์)</span>
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
                      data-testid={`annotate-image-btn-${idx}`}
                      onClick={() => setAnnotatingAttachment(img)}
                      className="absolute bottom-9 right-1.5 inline-flex h-6 items-center gap-1 rounded-md border border-rose-400/60 bg-rose-600/95 px-2 text-[10px] font-bold text-white shadow hover:bg-rose-500 cursor-pointer"
                      title="วาดวงกลม / ลูกศรชี้จุด / เบลอข้อมูลสำคัญ"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                      <span>วาดชี้จุด/เบลอ</span>
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

export function AttachmentGallery({ attachments }: { attachments: AttachmentItem[] }) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [expandedPdfId, setExpandedPdfId] = useState<string | null>(null);
  const [expandedTextId, setExpandedTextId] = useState<string | null>(null);
  const [textPreviewCache, setTextPreviewCache] = useState<Record<string, string>>({});

  const images = (attachments || []).filter(isSafeImageAttachment);
  const docs = (attachments || []).filter((a) => !isSafeImageAttachment(a));

  if (images.length === 0 && docs.length === 0) return null;

  const isPdfDoc = (doc: AttachmentItem) =>
    doc.mimeType?.toLowerCase().includes("pdf") ||
    doc.name.toLowerCase().endsWith(".pdf");

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
    <div className="space-y-3 pt-2" data-testid="attachment-gallery">
      {images.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
            <ImageIcon className="h-3.5 w-3.5 text-emerald-400" />
            <span>รูปภาพประกอบ ({images.length} รูป) • คลิกที่รูปเพื่อขยายดูภาพขนาดใหญ่</span>
          </p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {images.map((img, idx) => (
              <div
                key={img.id}
                className="group relative flex flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-950 transition hover:border-emerald-500/50"
              >
                <button
                  type="button"
                  data-testid="attachment-image-thumb"
                  onClick={() => setPreviewIndex(idx)}
                  title={`ขยายดูรูป ${img.name}`}
                  className="relative h-32 w-full overflow-hidden text-left focus:outline-none cursor-zoom-in"
                >
                  <img
                    src={fileUrl(img)}
                    alt={img.name}
                    className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 top-0 flex h-full items-center justify-center bg-slate-950/55 opacity-0 transition group-hover:opacity-100">
                    <span className="inline-flex h-7 items-center gap-1 rounded-md bg-slate-900/90 px-2.5 text-xs font-semibold text-white">
                      <Maximize2 className="h-3.5 w-3.5 text-emerald-400" /> ขยายดูรูปใหญ่
                    </span>
                  </div>
                </button>
                <div className="flex items-center justify-between gap-1 bg-slate-900/95 px-2.5 py-1.5 text-[11px]">
                  <span className="truncate text-slate-200">{img.name}</span>
                  <a
                    href={fileUrl(img)}
                    download={img.name}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 hover:bg-slate-700"
                    title="บันทึกรูปภาพลงเครื่อง"
                  >
                    <Download className="h-2.5 w-2.5" /> บันทึกรูป
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {docs.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-sky-300">
            <FileText className="h-3.5 w-3.5 text-sky-400" />
            <span>ไฟล์เอกสาร & PDF แนบ ({docs.length} ไฟล์) • เปิดดูบนหน้าจอหรือดาวน์โหลดได้ทันที</span>
          </p>
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
                  className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border font-mono text-[10px] font-bold ${
                          isPdf
                            ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                            : "border-sky-500/40 bg-sky-500/15 text-sky-300"
                        }`}
                      >
                        {isPdf ? "PDF" : <FileText className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-white">{doc.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {isPdf ? "เอกสาร PDF" : "ไฟล์เอกสารแนบ"} • {formatFileSize(doc.size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {isPdf && (
                        <button
                          type="button"
                          data-testid={`preview-pdf-inline-btn-${idx}`}
                          onClick={() =>
                            setExpandedPdfId((prev) => (prev === doc.id ? null : doc.id))
                          }
                          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition cursor-pointer ${
                            isPdfOpen
                              ? "border-amber-400 bg-amber-500/20 text-amber-200"
                              : "border-emerald-500/50 bg-emerald-600 text-white hover:bg-emerald-500"
                          }`}
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                          <span>{isPdfOpen ? "ซ่อนหน้าต่าง PDF" : "เปิดดู PDF บนหน้าจอ"}</span>
                        </button>
                      )}

                      {isText && (
                        <button
                          type="button"
                          data-testid={`preview-doc-inline-btn-${idx}`}
                          onClick={() => void toggleTextPreview(doc)}
                          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition cursor-pointer ${
                            isTextOpen
                              ? "border-amber-400 bg-amber-500/20 text-amber-200"
                              : "border-cyan-500/45 bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30"
                          }`}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>{isTextOpen ? "ซ่อนเนื้อหาไฟล์" : "เปิดอ่านเนื้อหาไฟล์"}</span>
                        </button>
                      )}

                      <a
                        href={fileUrl(doc)}
                        target="_blank"
                        rel="noreferrer"
                        data-testid={`open-doc-tab-btn-${idx}`}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-sky-400" />
                        <span>เปิดแท็บใหม่</span>
                      </a>

                      <a
                        href={fileUrl(doc)}
                        download={doc.name}
                        data-testid={`download-doc-btn-${idx}`}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/25"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>ดาวน์โหลด</span>
                      </a>
                    </div>
                  </div>

                  {/* Inline Embedded PDF Viewer */}
                  {isPdf && isPdfOpen && (
                    <div
                      data-testid={`inline-pdf-viewer-${idx}`}
                      className="overflow-hidden rounded-lg border border-emerald-500/40 bg-slate-950"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-1.5 text-[11px] text-emerald-300">
                        <span>📄 กำลังแสดงไฟล์ PDF: {doc.name}</span>
                        <a
                          href={fileUrl(doc)}
                          target="_blank"
                          rel="noreferrer"
                          className="underline hover:text-white"
                        >
                          ขยายเต็มหน้าจอ
                        </a>
                      </div>
                      <iframe
                        src={fileUrl(doc)}
                        title={doc.name}
                        sandbox=""
                        data-testid={`inline-pdf-iframe-${idx}`}
                        className="h-[440px] w-full bg-white"
                      />
                    </div>
                  )}

                  {/* Inline Text / CSV / Log Reader */}
                  {isText && isTextOpen && (
                    <pre
                      data-testid={`inline-doc-reader-${idx}`}
                      className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-cyan-500/35 bg-slate-950 p-3 font-mono text-xs text-slate-200 leading-relaxed"
                    >
                      {textPreviewCache[doc.id] || "กำลังโหลดเนื้อหาไฟล์..."}
                    </pre>
                  )}
                </div>
              );
            })}
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

type AnnotatorTool = "circle" | "arrow" | "blur";

interface AnnotationShape {
  tool: AnnotatorTool;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

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
    (
      ctx: CanvasRenderingContext2D,
      img: HTMLImageElement,
      s: AnnotationShape
    ) => {
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
      className="fixed inset-0 z-[70] flex flex-col bg-slate-950/95 backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40">
            <Pencil className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-white">
              วาดชี้จุดเกิดปัญหา / เบลอข้อมูลสำคัญบนรูปภาพ
            </h3>
            <p className="text-[11px] text-slate-400">
              เลือกเครื่องมือด้านล่างแล้วลากเมาส์บนรูปภาพได้เลย ทีมพัฒนาจะเห็นจุดที่วงไว้ทันที
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="annotator-tool-circle"
            onClick={() => setTool("circle")}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition cursor-pointer ${
              tool === "circle"
                ? "border-rose-400 bg-rose-600 text-white shadow"
                : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
          >
            <Circle className="h-3.5 w-3.5" />
            <span>1. วงกลมสีแดง (ล้อมจุดที่พัง)</span>
          </button>

          <button
            type="button"
            data-testid="annotator-tool-arrow"
            onClick={() => setTool("arrow")}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition cursor-pointer ${
              tool === "arrow"
                ? "border-rose-400 bg-rose-600 text-white shadow"
                : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
          >
            <MoveUpRight className="h-3.5 w-3.5" />
            <span>2. ลูกศรชี้จุด</span>
          </button>

          <button
            type="button"
            data-testid="annotator-tool-blur"
            onClick={() => setTool("blur")}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition cursor-pointer ${
              tool === "blur"
                ? "border-amber-400 bg-amber-600 text-white shadow"
                : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
          >
            <EyeOff className="h-3.5 w-3.5" />
            <span>3. เบลอข้อมูลลับลูกค้า</span>
          </button>

          <button
            type="button"
            data-testid="annotator-undo-btn"
            disabled={shapes.length === 0}
            onClick={() => setShapes((prev) => prev.slice(0, -1))}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>ย้อนกลับ</span>
          </button>

          <button
            type="button"
            data-testid="annotator-save-btn"
            disabled={saving}
            onClick={handleConfirmSave}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white shadow hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
          >
            <Check className="h-4 w-4" />
            <span>{saving ? "กำลังบันทึก..." : "บันทึกรูปที่วาด"}</span>
          </button>

          <button
            type="button"
            data-testid="annotator-cancel-btn"
            onClick={onClose}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs font-medium text-slate-300 hover:bg-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
            <span>ยกเลิก</span>
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
          className="max-h-[78vh] max-w-full cursor-crosshair rounded-lg border border-slate-700 bg-slate-900 shadow-2xl"
        />
      </div>
    </div>,
    document.body
  );
}
