import { NextResponse } from "next/server";
import { findSimilarIssues } from "@/lib/issue-service";
import { authRequiredResponse, getCurrentUser, projectScopeFor } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return authRequiredResponse();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const scope = projectScopeFor(user, searchParams.get("projectKey"));
    if (scope === null) {
      return NextResponse.json({ error: "คุณไม่มีสิทธิ์เข้าถึงโปรเจกต์นี้" }, { status: 403 });
    }
    const similar = await findSimilarIssues(q, scope);
    return NextResponse.json({ similar });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถค้นหารายการที่คล้ายกันได้";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
