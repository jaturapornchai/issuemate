import { NextResponse } from "next/server";
import crypto from "crypto";
import { listIssues, createIssue, normalizeProjectKey } from "@/lib/issue-service";
import {
  MAX_FILES_PER_REQUEST,
  sanitizeClientAttachments,
  uploadBufferToMinio,
} from "@/lib/minio";
import {
  assertCsrfSafe,
  authRequiredResponse,
  getCurrentUser,
  projectScopeFor,
  validateUserProjectAction,
} from "@/lib/auth";
import type {
  AttachmentItem,
  IssuePriority,
  IssueStatusFilter,
  IssueType,
  SubtaskItem,
} from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return authRequiredResponse();
    const { searchParams } = new URL(req.url);
    const rawProjectKey = searchParams.get("projectKey") || undefined;
    if (rawProjectKey && rawProjectKey.toUpperCase() !== "ALL") {
      const normalized = normalizeProjectKey(rawProjectKey);
      const check = validateUserProjectAction(user, normalized, "view");
      if (!check.allowed) {
        return NextResponse.json({ error: check.reason }, { status: 403 });
      }
    }
    const scope = projectScopeFor(user, rawProjectKey ? normalizeProjectKey(rawProjectKey) : undefined);
    if (scope === null) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงโปรเจกต์นี้" }, { status: 403 });
    }
    if (Array.isArray(scope) && scope.length === 0) {
      return NextResponse.json({ issues: [] });
    }

    const status = (searchParams.get("status") as IssueStatusFilter) || undefined;
    const type = (searchParams.get("type") as IssueType | "all") || undefined;
    const priority = (searchParams.get("priority") as IssuePriority | "all") || undefined;
    const assignee = searchParams.get("assignee") || undefined;
    const label = searchParams.get("label") || undefined;
    const search = searchParams.get("search") || undefined;
    const sortBy = searchParams.get("sortBy") || undefined;
    const sortDir = (searchParams.get("sortDir") as "asc" | "desc") || undefined;

    const issues = await listIssues({
      projectKey: scope,
      status,
      type,
      priority,
      assignee,
      label,
      search,
      sortBy,
      sortDir,
    });
    return NextResponse.json({ issues });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถดึงรายการ Issues ได้";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const csrfErr = assertCsrfSafe(req);
  if (csrfErr) return csrfErr;

  try {
    // Identity comes from the signed session only (actorEmail/reporterEmail/reporter in the body are ignored)
    const effectiveUser = await getCurrentUser();
    if (!effectiveUser) return authRequiredResponse();
    const body = await req.json();
    // Same normalization createIssue applies, so the key we authorize is the key we store
    const projectKey = normalizeProjectKey(String(body.projectKey || ""));
    if (!projectKey) {
      return NextResponse.json({ error: "กรุณาระบุโปรเจกต์ (projectKey)" }, { status: 400 });
    }
    const issueType: IssueType = body.type || "bug";

    const check = validateUserProjectAction(
      effectiveUser,
      projectKey,
      "create_issue",
      issueType
    );
    if (!check.allowed) {
      return NextResponse.json(
        { error: check.reason, permission: check.permission },
        { status: 403 }
      );
    }
    // Pipeline fields at creation time are a status change: developer/project_admin only
    const canManage = validateUserProjectAction(
      effectiveUser,
      projectKey,
      "change_status"
    ).allowed;

    const reporter = effectiveUser.name || effectiveUser.email || "ผู้แจ้งเรื่อง";

    const attachments: AttachmentItem[] = sanitizeClientAttachments(
      body.attachments,
      reporter
    );

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
            f.mimeType || (f.contentText ? "text/plain; charset=utf-8" : "application/octet-stream")
          ),
          uploadedBy: reporter,
          uploaderEmail: effectiveUser.email,
        });
        attachments.push(uploaded);
      }
    }

    const subtasks: SubtaskItem[] = Array.isArray(body.subtasks)
      ? body.subtasks
          .map((s: unknown) => {
            if (typeof s === "string") {
              return { id: crypto.randomUUID(), title: s.trim(), completed: false };
            }
            const obj = s as Partial<SubtaskItem>;
            return {
              id: obj.id || crypto.randomUUID(),
              title: String(obj.title || "").trim(),
              completed: Boolean(obj.completed),
              assignee: obj.assignee ? String(obj.assignee) : undefined,
            };
          })
          .filter((s: SubtaskItem) => s.title.length > 0)
      : [];

    const issue = await createIssue({
      projectKey,
      title: String(body.title || ""),
      description: body.description ? String(body.description) : "",
      status: canManage ? body.status : undefined,
      type: body.type,
      priority: body.priority,
      reporter,
      reporterEmail: effectiveUser.email,
      department: body.department ? String(body.department) : "DevOps & SRE Team",
      assignee: canManage && body.assignee ? String(body.assignee) : undefined,
      labels: Array.isArray(body.labels) ? body.labels.map(String) : [],
      milestone: body.milestone ? String(body.milestone) : undefined,
      dueDate: body.dueDate ? String(body.dueDate) : undefined,
      attachments,
      subtasks,
      relatedCodes: Array.isArray(body.relatedCodes) ? body.relatedCodes.map(String) : [],
      devopsMeta: canManage ? body.devopsMeta || undefined : undefined,
      reviewMeta: canManage ? body.reviewMeta || undefined : undefined,
      aiSummary: canManage && body.aiSummary ? String(body.aiSummary) : undefined,
    });
    return NextResponse.json({ issue }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถสร้าง Issue ได้";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
