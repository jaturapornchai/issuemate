import { NextResponse } from "next/server";
import {
  listProjects,
  createProject,
  deleteProjectByKey,
  normalizeProjectKey,
  setProjectAiAutoApproval,
} from "@/lib/issue-service";
import {
  adminRequiredResponse,
  assertCsrfSafe,
  authRequiredResponse,
  canUserAccessProject,
  getCurrentUser,
  validateUserProjectAction,
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

// Toggle a project's AI auto mode (Admin / project_admin only)
export async function PATCH(req: Request) {
  const csrfErr = assertCsrfSafe(req);
  if (csrfErr) return csrfErr;

  try {
    const user = await getCurrentUser();
    if (!user) return authRequiredResponse();
    const body = await req.json();
    const key = normalizeProjectKey(String(body.key || ""));
    if (!key) {
      return NextResponse.json({ error: "กรุณาระบุรหัสโปรเจกต์" }, { status: 400 });
    }
    if (typeof body.aiAutoApproval !== "boolean") {
      return NextResponse.json(
        { error: "กรุณาระบุ aiAutoApproval เป็น true หรือ false" },
        { status: 400 }
      );
    }
    const check = validateUserProjectAction(user, key, "approve_ai_fix");
    if (!check.allowed) {
      return NextResponse.json({ error: check.reason, permission: check.permission }, { status: 403 });
    }
    const project = await setProjectAiAutoApproval(key, body.aiAutoApproval, {
      name: user.name,
      email: user.email,
    });
    return NextResponse.json({ project });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถบันทึกการตั้งค่าได้";
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
