import { NextResponse } from "next/server";
import { addIssueComment } from "@/lib/issue-service";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const body = await req.json();
    const updated = await addIssueComment(code, {
      author: body.author ? String(body.author) : "DevOps Engineer",
      role: body.role ? String(body.role) : "DevOps Team",
      body: body.body ? String(body.body) : "",
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      isResolution: Boolean(body.isResolution),
      nextStatus: body.nextStatus || undefined,
    });
    return NextResponse.json({ issue: updated }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถบันทึกความคิดเห็นได้";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
