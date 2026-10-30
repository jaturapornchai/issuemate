import { NextResponse } from "next/server";
import { assertCsrfSafe, authRequiredResponse, getCurrentUser } from "@/lib/auth";
import { assertValidType } from "@/lib/issue-service";
import { analyzeAndFormatQaIssue } from "@/lib/qa-assistant";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const csrfErr = assertCsrfSafe(req);
  if (csrfErr) return csrfErr;

  try {
    const user = await getCurrentUser();
    if (!user) return authRequiredResponse();

    const body = await req.json();
    const rawText = String(body.text || body.rawText || "").trim();
    const clarificationAnswer = body.clarificationAnswer
      ? String(body.clarificationAnswer).trim()
      : undefined;
    const projectKey = body.projectKey ? String(body.projectKey).trim() : undefined;
    const forceCreate = Boolean(body.forceCreate);
    const type = body.type ? assertValidType(body.type) : undefined;

    if (!rawText) {
      return NextResponse.json(
        { error: "กรุณาพิมพ์หรือพูดอธิบายปัญหาที่พบก่อน" },
        { status: 400 }
      );
    }

    const formatted = analyzeAndFormatQaIssue({
      rawText,
      clarificationAnswer,
      projectKey,
      forceCreate,
      type,
    });

    return NextResponse.json(formatted);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "ไม่สามารถวิเคราะห์ข้อความด้วย AI ได้";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
