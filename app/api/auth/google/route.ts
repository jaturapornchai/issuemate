import { NextResponse } from "next/server";
import crypto from "crypto";
import { getGoogleOAuthConfig, getPublicOrigin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = getPublicOrigin(req);
  const cfg = await getGoogleOAuthConfig();

  if (!cfg.clientId || !cfg.clientSecret) {
    return NextResponse.redirect(
      `${origin}/?google_auth_error=${encodeURIComponent(
        "ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (คลิกปุ่มตั้งค่า Google Login เพื่อใส่ค่าได้ทันที)"
      )}`
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = `${origin}/api/auth/google/callback`;

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", cfg.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("access_type", "online");
  authUrl.searchParams.set("prompt", "select_account");
  authUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set("issuemate_oauth_state", state, {
    httpOnly: true,
    path: "/",
    maxAge: 600,
    sameSite: "lax",
  });
  return res;
}
