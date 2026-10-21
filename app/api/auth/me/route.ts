import { NextResponse } from "next/server";
import {
  addAllowedUser,
  getAllowedUser,
  getCurrentUser,
  getGoogleOAuthConfig,
  getPublicOrigin,
  getSuperAdminEmail,
  setSuperAdminEmail,
  maskEmail,
  listAllowedUsers,
  removeAllowedUser,
  saveGoogleOAuthConfig,
  signSessionToken,
  touchAllowedUserLogin,
  SESSION_COOKIE_NAME,
  type AuthUser,
} from "@/lib/auth";
import { listProjects } from "@/lib/issue-service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = getPublicOrigin(req);
  const [user, cfg, allowedUsers, superAdminEmail, projects] = await Promise.all([
    getCurrentUser(),
    getGoogleOAuthConfig(),
    listAllowedUsers(),
    getSuperAdminEmail(),
    listProjects(),
  ]);

  const isAuthenticatedAdmin =
    Boolean(user?.isAdmin) || user?.email === superAdminEmail;

  // Mask emails and Super Admin personal name when not logged in as Admin
  const publicAllowedUsers = allowedUsers.map((u) => {
    const isSuper = u.email === superAdminEmail;
    return {
      ...u,
      name:
        isAuthenticatedAdmin || user?.email === u.email
          ? u.name
          : isSuper
          ? "Super Admin"
          : u.name,
      email: isAuthenticatedAdmin || user?.email === u.email ? u.email : maskEmail(u.email),
      addedBy:
        isAuthenticatedAdmin || !u.addedBy?.includes("@")
          ? u.addedBy
          : maskEmail(u.addedBy),
      isSuperAdmin: isSuper,
    };
  });

  return NextResponse.json({
    user,
    superAdminEmail: isAuthenticatedAdmin ? superAdminEmail : maskEmail(superAdminEmail),
    superAdminMasked: maskEmail(superAdminEmail),
    allowedUsers: publicAllowedUsers,
    projects,
    oauthConfigured: Boolean(cfg.clientId && cfg.clientSecret),
    clientIdMasked: cfg.clientId ? `${cfg.clientId.slice(0, 14)}...` : "",
    clientId: isAuthenticatedAdmin ? cfg.clientId || "" : "",
    allowedDomain: cfg.allowedDomain || "",
    origin,
    callbackUrl: `${origin}/api/auth/google/callback`,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.action === "logout") {
      const res = NextResponse.json({ user: null });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    const [currentUser, superAdminEmail] = await Promise.all([
      getCurrentUser(),
      getSuperAdminEmail(),
    ]);

    const callerAdminEmail = String(body.adminEmail || "")
      .trim()
      .toLowerCase();
    const isCallerAdmin =
      Boolean(currentUser?.isAdmin) ||
      currentUser?.email === superAdminEmail ||
      (callerAdminEmail && callerAdminEmail === superAdminEmail);

    if (body.action === "change_super_admin") {
      if (!isCallerAdmin) {
        return NextResponse.json(
          {
            error: "เฉพาะผู้ดูแลระบบสูงสุด (Super Admin) เท่านั้นที่สามารถเปลี่ยนอีเมล Admin ได้",
          },
          { status: 403 }
        );
      }
      const nextAdminEmail = await setSuperAdminEmail(
        String(body.newAdminEmail || ""),
        body.newAdminName ? String(body.newAdminName) : undefined
      );
      const allowedUsers = await listAllowedUsers();
      return NextResponse.json({
        status: "super_admin_updated",
        superAdminEmail: nextAdminEmail,
        superAdminMasked: maskEmail(nextAdminEmail),
        allowedUsers,
      });
    }

    if (body.action === "add_allowed_user" || body.action === "update_allowed_user") {
      if (!isCallerAdmin) {
        return NextResponse.json(
          {
            error: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเพิ่มหรือแก้ไขสิทธิ์ Gmail ผู้ใช้งานได้",
          },
          { status: 403 }
        );
      }
      const allowedUser = await addAllowedUser({
        email: String(body.email || ""),
        name: body.name ? String(body.name) : undefined,
        role: body.role === "admin" ? "admin" : "member",
        allowedProjects: Array.isArray(body.allowedProjects)
          ? body.allowedProjects.map(String)
          : undefined,
        jobTitle: body.jobTitle ? String(body.jobTitle) : undefined,
        addedBy: currentUser?.email || superAdminEmail,
      });
      const allowedUsers = await listAllowedUsers();
      return NextResponse.json({
        status: "added",
        allowedUser,
        allowedUsers,
      });
    }

    if (body.action === "remove_allowed_user") {
      if (!isCallerAdmin) {
        return NextResponse.json(
          {
            error: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบสิทธิ์ผู้ใช้งานได้",
          },
          { status: 403 }
        );
      }
      const targetEmail = String(body.email || "").trim().toLowerCase();
      await removeAllowedUser(targetEmail);
      const allowedUsers = await listAllowedUsers();
      return NextResponse.json({
        status: "removed",
        allowedUsers,
      });
    }

    if (body.action === "save_oauth_config") {
      const saved = await saveGoogleOAuthConfig({
        clientId: String(body.clientId || ""),
        clientSecret: body.clientSecret ? String(body.clientSecret) : undefined,
        allowedDomain: body.allowedDomain ? String(body.allowedDomain) : "",
      });
      return NextResponse.json({ status: "saved", ...saved });
    }

    // Login with Gmail (must be in allowed_users managed by Admin)
    const email = String(body.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "กรุณาระบุอีเมล Gmail ที่ได้รับอนุญาตเพื่อเข้าสู่ระบบ" },
        { status: 400 }
      );
    }

    const allowed = await getAllowedUser(email);
    if (!allowed) {
      return NextResponse.json(
        {
          error: `อีเมล ${email} ยังไม่ได้รับอนุญาตให้เข้าใช้งาน กรุณาให้ผู้ดูแลระบบ (Admin) เพิ่มอีเมลนี้ก่อน`,
        },
        { status: 403 }
      );
    }

    const name = String(body.name || allowed.name || email.split("@")[0]).trim();
    const role = String(
      body.role ||
        allowed.jobTitle ||
        (allowed.role === "admin" ? "Super Admin" : "DevOps Engineer")
    ).trim();
    const isAdmin = allowed.role === "admin" || email === superAdminEmail;

    await touchAllowedUserLogin(email, { name });

    const user: AuthUser = {
      id: `user-${email}`,
      email,
      name,
      role,
      isAdmin,
      allowedProjects: allowed.allowedProjects || ["ALL"],
      provider: body.provider === "google" ? "google" : "devops",
    };

    const token = signSessionToken(user);
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Auth action failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
