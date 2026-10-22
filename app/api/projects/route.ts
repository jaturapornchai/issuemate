import { NextResponse } from "next/server";
import {
  listProjects,
  createProject,
  deleteProjectByKey,
  normalizeProjectKey,
} from "@/lib/issue-service";
import {
  adminRequiredResponse,
  assertCsrfSafe,
  authRequiredResponse,
  canUserAccessProject,
  getCurrentUser,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return authRequiredResponse();
    const projects = (await listProjects()).filter((p) => canUserAccessProject(user, p.key));
    return NextResponse.json({ projects });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถดึงรายการโปรเจกต์ได้";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const csrfErr = assertCsrfSafe(req);
  if (csrfErr) return csrfErr;

  try {
    const user = await getCurrentUser();
    if (!user) return authRequiredResponse();
    if (!user.isAdmin) return adminRequiredResponse();
    const body = await req.json();
    const created = await createProject({
      key: String(body.key || ""),
      name: String(body.name || ""),
      description: body.description ? String(body.description) : "",
      repoOrServer: body.repoOrServer ? String(body.repoOrServer) : undefined,
      color: body.color ? String(body.color) : "#10b981",
      icon: body.icon ? String(body.icon) : "Server",
    });
    return NextResponse.json({ project: created }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถสร้างโปรเจกต์ได้";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const csrfErr = assertCsrfSafe(req);
  if (csrfErr) return csrfErr;

  try {
    const user = await getCurrentUser();
    if (!user) return authRequiredResponse();
    if (!user.isAdmin) return adminRequiredResponse();
    const { searchParams } = new URL(req.url);
    const key = normalizeProjectKey(searchParams.get("key") || "");
    if (!key) {
      return NextResponse.json({ error: "กรุณาระบุรหัสโปรเจกต์" }, { status: 400 });
    }
    await deleteProjectByKey(key);
    return NextResponse.json({ deleted: key });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถลบโปรเจกต์ได้";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
