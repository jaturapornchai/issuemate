import { NextResponse } from "next/server";
import {
  addAllowedUser,
  adminRequiredResponse,
  assertCsrfSafe,
  authRequiredResponse,
  bumpUserSessionVersion,
  canUserAccessProject,
  getCurrentUser,
  getGoogleOAuthConfig,
  getPublicOrigin,
  getSuperAdminEmail,
  setSuperAdminEmail,
  maskEmail,
  listAllowedUsers,
  removeAllowedUser,
  saveGoogleOAuthConfig,
  SESSION_COOKIE_NAME,
  type AllowedUserRecord,
} from "@/lib/auth";
import { listProjects } from "@/lib/issue-service";
import { APP_VERSION, DEPLOYED_AT_TH, DEPLOYED_AT_ISO } from "@/lib/version";

export const runtime = "nodejs";

function decorateAllowedUsersForAdmin(
  users: AllowedUserRecord[],
  superAdminEmail: string
) {
  return users.map((u) => ({
    ...u,
    isSuperAdmin: u.email === superAdminEmail,
  }));
}

export async function GET(req: Request) {
  const origin = getPublicOrigin(req);
  const [user, cfg, superAdminEmail] = await Promise.all([
    getCurrentUser(),
    getGoogleOAuthConfig(),
    getSuperAdminEmail(),
  ]);

  const isAdmin = Boolean(user?.isAdmin);

  const loginInfo = {
    version: APP_VERSION,
    deployedAt: DEPLOYED_AT_TH,
    deployedAtIso: DEPLOYED_AT_ISO,
    superAdminMasked: maskEmail(superAdminEmail),
    oauthConfigured: Boolean(cfg.clientId && cfg.clientSecret),
    clientIdMasked: cfg.clientId ? `${cfg.clientId.slice(0, 14)}...` : "",
    allowedDomain: isAdmin ? cfg.allowedDomain || "" : "",
    origin,
    callbackUrl: `${origin}/api/auth/google/callback`,
  };

  // Not logged in: only what the login screen needs, no member list or projects
  if (!user) {
    return NextResponse.json({
      user: null,
      superAdminEmail: maskEmail(superAdminEmail),
      allowedUsers: [],
      projects: [],
      clientId: "",
      ...loginInfo,
    });
  }

  const [allowedUsers, projects] = await Promise.all([listAllowedUsers(), listProjects()]);

  const visibleProjects = isAdmin
    ? projects
    : projects.filter((p) => canUserAccessProject(user, p.key));

  // Non-admin callers only receive their own membership row so member directory / permissions are not leaked
  const visibleAllowedUsers = (
    isAdmin ? allowedUsers : allowedUsers.filter((u) => u.email === user.email)
  ).map((u) => {
    const isSuper = u.email === superAdminEmail;
    const canSee = isAdmin || user.email === u.email;
    const emailLocalPart = u.email.split("@")[0]?.toLowerCase() || "";
    const safeName =
      canSee
        ? u.name
        : isSuper
        ? "Super Admin"
        : u.name.trim().toLowerCase() === emailLocalPart
        ? maskEmail(u.email).split("@")[0]
        : u.name;
    return {
      ...u,
      name: safeName,
      email: canSee ? u.email : maskEmail(u.email),
      addedBy: isAdmin || !u.addedBy?.includes("@") ? u.addedBy : maskEmail(u.addedBy),
      isSuperAdmin: isSuper,
    };
  });

  return NextResponse.json({
    user,
    superAdminEmail: isAdmin ? superAdminEmail : maskEmail(superAdminEmail),
    allowedUsers: visibleAllowedUsers,
    projects: visibleProjects,
    clientId: isAdmin ? cfg.clientId || "" : "",
    ...loginInfo,
  });
}

export async function POST(req: Request) {
  const csrfErr = assertCsrfSafe(req);
  if (csrfErr) return csrfErr;

  try {
    const body = await req.json();

    if (body.action === "logout") {
      const currentUser = await getCurrentUser();
      if (currentUser?.email) {
        await bumpUserSessionVersion(currentUser.email);
      }
      const res = NextResponse.json({ user: null });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    const knownActions = [
      "change_super_admin",
      "add_allowed_user",
      "update_allowed_user",
      "remove_allowed_user",
      "save_oauth_config",
    ];
    if (!knownActions.includes(body.action)) {
      return NextResponse.json(
        { error: "เข้าสู่ระบบได้ทาง Sign in with Google เท่านั้น" },
        { status: 400 }
      );
    }

    // Identity comes from the signed session only, never from body fields
    const [currentUser, superAdminEmail] = await Promise.all([
      getCurrentUser(),
      getSuperAdminEmail(),
    ]);
    if (!currentUser) return authRequiredResponse();
    if (!currentUser.isAdmin) return adminRequiredResponse();

    if (body.action === "change_super_admin") {
      if (currentUser.email !== superAdminEmail) {
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
        allowedUsers: decorateAllowedUsersForAdmin(allowedUsers, nextAdminEmail),
      });
    }

    if (body.action === "add_allowed_user" || body.action === "update_allowed_user") {
      const allowedUser = await addAllowedUser({
        email: String(body.email || ""),
        name: body.name ? String(body.name) : undefined,
        role: body.role === "admin" ? "admin" : "member",
        allowedProjects: Array.isArray(body.allowedProjects)
          ? body.allowedProjects.map(String)
          : undefined,
        defaultPermission: body.defaultPermission
          ? String(body.defaultPermission)
          : undefined,
        projectPermissions:
          body.projectPermissions && typeof body.projectPermissions === "object"
            ? (body.projectPermissions as Record<string, string>)
            : undefined,
        jobTitle: body.jobTitle ? String(body.jobTitle) : undefined,
        addedBy: currentUser.email,
      });
      const allowedUsers = await listAllowedUsers();
      return NextResponse.json({
        status: "added",
        allowedUser: {
          ...allowedUser,
          isSuperAdmin: allowedUser.email === superAdminEmail,
        },
        allowedUsers: decorateAllowedUsersForAdmin(allowedUsers, superAdminEmail),
      });
    }

    if (body.action === "remove_allowed_user") {
      const targetEmail = String(body.email || "").trim().toLowerCase();
      if (targetEmail === superAdminEmail) {
        return NextResponse.json(
          { error: "ไม่สามารถลบสิทธิ์ของ Super Admin ได้" },
          { status: 400 }
        );
      }
      await removeAllowedUser(targetEmail);
      const allowedUsers = await listAllowedUsers();
      return NextResponse.json({
        status: "removed",
        allowedUsers: decorateAllowedUsersForAdmin(allowedUsers, superAdminEmail),
      });
    }

    // save_oauth_config
    const saved = await saveGoogleOAuthConfig({
      clientId: String(body.clientId || ""),
      clientSecret: body.clientSecret ? String(body.clientSecret) : undefined,
      allowedDomain: body.allowedDomain ? String(body.allowedDomain) : "",
    });
    return NextResponse.json({ status: "saved", ...saved });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Auth action failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
