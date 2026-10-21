import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SUPER_ADMIN_EMAIL,
  getAllowedUser,
  getGoogleOAuthConfig,
  getPublicOrigin,
  signSessionToken,
  touchAllowedUserLogin,
  SESSION_COOKIE_NAME,
  type AuthUser,
} from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = getPublicOrigin(req);
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${origin}/?google_auth_error=${encodeURIComponent(`Google OAuth Error: ${error}`)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/?google_auth_error=${encodeURIComponent("ไม่พบ Authorization Code จาก Google")}`
    );
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("issuemate_oauth_state")?.value;
  if (savedState && state && savedState !== state) {
    return NextResponse.redirect(
      `${origin}/?google_auth_error=${encodeURIComponent("State ไม่ตรงกัน กรุณาลองเข้าสู่ระบบใหม่อีกครั้ง")}`
    );
  }

  const cfg = await getGoogleOAuthConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    return NextResponse.redirect(
      `${origin}/?google_auth_error=${encodeURIComponent("ยังไม่ได้ตั้งค่า Google OAuth Client ID/Secret")}`
    );
  }

  const redirectUri = `${origin}/api/auth/google/callback`;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      const desc = tokenJson.error_description || tokenJson.error || "Token exchange failed";
      return NextResponse.redirect(
        `${origin}/?google_auth_error=${encodeURIComponent(`แลก Token ไม่สำเร็จ: ${desc}`)}`
      );
    }

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const profile = await profileRes.json();

    if (!profileRes.ok || !profile.email) {
      return NextResponse.redirect(
        `${origin}/?google_auth_error=${encodeURIComponent("ไม่สามารถดึงข้อมูลอีเมลจากบัญชี Google ได้")}`
      );
    }

    const email = String(profile.email).trim().toLowerCase();

    // Check if this Gmail is in the Admin-approved allowed_users list
    const allowed = await getAllowedUser(email);
    if (!allowed) {
      return NextResponse.redirect(
        `${origin}/?google_auth_error=${encodeURIComponent(
          `ไม่ได้รับอนุญาต: อีเมล ${email} ยังไม่อยู่ในรายชื่อผู้มีสิทธิ์เข้าใช้งาน กรุณาติดต่อ Admin (${SUPER_ADMIN_EMAIL}) เพื่อเพิ่มอีเมลนี้ก่อน`
        )}`
      );
    }

    if (cfg.allowedDomain) {
      const domains = cfg.allowedDomain
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);
      const emailDomain = email.split("@")[1] || "";
      if (domains.length > 0 && !domains.includes(emailDomain) && !domains.includes(email)) {
        return NextResponse.redirect(
          `${origin}/?google_auth_error=${encodeURIComponent(
            `อีเมล ${email} ไม่อยู่ในโดเมนที่อนุญาต (${cfg.allowedDomain})`
          )}`
        );
      }
    }

    const displayName = String(profile.name || allowed.name || email.split("@")[0]);
    const isAdmin = allowed.role === "admin" || email === SUPER_ADMIN_EMAIL;

    const user: AuthUser = {
      id: String(profile.sub || email),
      email,
      name: displayName,
      picture: profile.picture ? String(profile.picture) : undefined,
      role: allowed.jobTitle || (isAdmin ? "Super Admin" : "DevOps Engineer"),
      isAdmin,
      allowedProjects: allowed.allowedProjects || ["ALL"],
      provider: "google",
    };

    await touchAllowedUserLogin(email, { name: displayName });

    const db = await getDb();
    await db.collection("users").updateOne(
      { email: user.email },
      {
        $set: {
          ...user,
          lastLoginAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    );

    const sessionToken = signSessionToken(user);
    const res = NextResponse.redirect(`${origin}/?login=google_success`);
    res.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
    res.cookies.delete("issuemate_oauth_state");
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดระหว่างเชื่อมต่อ Google OAuth";
    return NextResponse.redirect(`${origin}/?google_auth_error=${encodeURIComponent(msg)}`);
  }
}
