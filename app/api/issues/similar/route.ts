import { NextResponse } from "next/server";
import { findSimilarIssues } from "@/lib/issue-service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const projectKey = searchParams.get("projectKey") || undefined;
    const similar = await findSimilarIssues(q, projectKey);
    return NextResponse.json({ similar });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถค้นหารายการที่คล้ายกันได้";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
