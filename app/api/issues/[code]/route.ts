import { NextResponse } from "next/server";
import { getIssueByCode, updateIssue, deleteIssue } from "@/lib/issue-service";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const issue = await getIssueByCode(code);
    if (!issue) {
      return NextResponse.json({ error: `ไม่พบ Issue รหัส ${code}` }, { status: 404 });
    }
    return NextResponse.json({ issue });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการดึงข้อมูล Issue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const body = await req.json();
    const updated = await updateIssue(code, body);
    return NextResponse.json({ issue: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถอัปเดต Issue ได้";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const deleted = await deleteIssue(code);
    return NextResponse.json({ deleted, code });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถลบ Issue ได้";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
