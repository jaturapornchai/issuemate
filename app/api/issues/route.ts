import { NextResponse } from "next/server";
import crypto from "crypto";
import { listIssues, createIssue } from "@/lib/issue-service";
import { uploadBufferToMinio } from "@/lib/minio";
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
    const { searchParams } = new URL(req.url);
    const projectKey = searchParams.get("projectKey") || undefined;
    const status = (searchParams.get("status") as IssueStatusFilter) || undefined;
    const type = (searchParams.get("type") as IssueType | "all") || undefined;
    const priority = (searchParams.get("priority") as IssuePriority | "all") || undefined;
    const assignee = searchParams.get("assignee") || undefined;
    const label = searchParams.get("label") || undefined;
    const search = searchParams.get("search") || undefined;
    const sortBy = searchParams.get("sortBy") || undefined;
    const sortDir = (searchParams.get("sortDir") as "asc" | "desc") || undefined;

    const issues = await listIssues({
      projectKey,
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
  try {
    const body = await req.json();
    const reporter = body.reporter ? String(body.reporter) : "DevOps Engineer";

    const attachments: AttachmentItem[] = Array.isArray(body.attachments)
      ? [...body.attachments]
      : [];

    if (Array.isArray(body.files)) {
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
      projectKey: String(body.projectKey || ""),
      title: String(body.title || ""),
      description: body.description ? String(body.description) : "",
      status: body.status,
      type: body.type,
      priority: body.priority,
      reporter,
      department: body.department ? String(body.department) : "DevOps & SRE Team",
      assignee: body.assignee ? String(body.assignee) : undefined,
      labels: Array.isArray(body.labels) ? body.labels.map(String) : [],
      milestone: body.milestone ? String(body.milestone) : undefined,
      dueDate: body.dueDate ? String(body.dueDate) : undefined,
      attachments,
      subtasks,
      relatedCodes: Array.isArray(body.relatedCodes) ? body.relatedCodes.map(String) : [],
      devopsMeta: body.devopsMeta || undefined,
      reviewMeta: body.reviewMeta || undefined,
      aiSummary: body.aiSummary ? String(body.aiSummary) : undefined,
    });
    return NextResponse.json({ issue }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถสร้าง Issue ได้";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
