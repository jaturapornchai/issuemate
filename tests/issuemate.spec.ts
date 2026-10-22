import crypto from "crypto";
import fs from "fs";
import path from "path";
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

// Dummy 1x1 PNG Base64
const DUMMY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function readEnv(name: string): string | undefined {
  if (process.env[name]) return process.env[name]!.trim();
  for (const file of [".env.local", ".env"]) {
    try {
      const content = fs.readFileSync(path.join(process.cwd(), file), "utf-8");
      const match = content.match(new RegExp(`^${name}=(.+)$`, "m"));
      if (match?.[1]) return match[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      // file not present
    }
  }
  return undefined;
}

const TEST_ADMIN_EMAIL = (readEnv("SUPER_ADMIN_EMAIL") || "admin@example.com").toLowerCase();
const SESSION_SECRET = readEnv("SESSION_SECRET") || "issuemate-dev-session-key";

// Same format as lib/auth.ts signSessionToken (what the Google OAuth callback sets).
// The server re-derives isAdmin/permissions from allowed_users, so only the email matters.
function signedSession(email: string, secret = SESSION_SECRET, extra: Record<string, unknown> = {}) {
  const now = Date.now();
  const payload = Buffer.from(
    JSON.stringify({
      id: `user-${email}`,
      email,
      provider: "google",
      iat: now,
      exp: now + 30 * 24 * 60 * 60 * 1000,
      ...extra,
    }),
    "utf8"
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

const as = (email: string) => ({ Cookie: `issuemate_session=${signedSession(email)}` });
const ADMIN = as(TEST_ADMIN_EMAIL);

async function loginBrowserAs(page: Page, email: string, baseURL: string) {
  await page.context().clearCookies();
  await page.context().addCookies([
    { name: "issuemate_session", value: signedSession(email), url: baseURL },
  ]);
}

function mcpCall(name: string, args: Record<string, unknown>, id = 1) {
  return { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } };
}

async function mcpTool(
  request: APIRequestContext,
  token: string,
  projectKey: string,
  name: string,
  args: Record<string, unknown>
) {
  const res = await request.post(`/api/mcp?project=${projectKey}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: mcpCall(name, args),
  });
  return { status: res.status(), json: res.status() === 200 ? await res.json() : null };
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  page.on("response", (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  return errors;
}

test.describe("IssueMate v3: Masked Admin Gmail + Multi-Project Member Permissions + MCP Project Creation & Guard", () => {
  const uniqueSuffix = Date.now().toString().slice(-4);
  const testProjectKey = `TST${uniqueSuffix}`;

  test("0. Auth Guard: no Google session = no access, body emails are never trusted", async ({
    request,
  }) => {
    const memberEmail = `guard.${uniqueSuffix}@gmail.com`;

    // 0.1 Every data API refuses anonymous callers
    for (const url of [
      "/api/issues",
      "/api/issues/ISM-1",
      "/api/issues/similar?q=test",
      "/api/projects",
      "/api/monitor",
      "/api/mcp/tokens",
      "/api/files/issuemate%2Fnone.png",
    ]) {
      expect((await request.get(url)).status(), `GET ${url}`).toBe(401);
    }
    const anonWrites: Array<[string, string, unknown]> = [
      ["POST", "/api/seed", {}],
      ["POST", "/api/projects", { key: "HACK", name: "hack" }],
      ["POST", "/api/issues", { projectKey: "POS", title: "anon", type: "bug" }],
      ["POST", "/api/issues/ISM-1/comments", { body: "anon" }],
      ["POST", "/api/upload", { filename: "a.txt", base64: "YQ==" }],
      ["POST", "/api/mcp/tokens", { projectKey: "POS" }],
      ["DELETE", "/api/mcp/tokens?id=x", undefined],
      ["DELETE", "/api/projects?key=NOPE0000", undefined],
    ];
    for (const [method, url, data] of anonWrites) {
      const res = await request.fetch(url, { method, data });
      expect(res.status(), `${method} ${url}`).toBe(401);
    }

    // 0.2 Email-only login is gone, and adminEmail in the body grants nothing
    const emailLogin = await request.post("/api/auth/me", {
      data: { email: TEST_ADMIN_EMAIL, name: "Pretend Admin" },
    });
    expect(emailLogin.status()).toBe(400);
    expect(emailLogin.headers()["set-cookie"]).toBeUndefined();

    const spoofedAdmin = await request.post("/api/auth/me", {
      data: { action: "add_allowed_user", adminEmail: TEST_ADMIN_EMAIL, email: memberEmail },
    });
    expect(spoofedAdmin.status()).toBe(401);
    const spoofedOAuth = await request.post("/api/auth/me", {
      data: { action: "save_oauth_config", adminEmail: TEST_ADMIN_EMAIL, clientId: "evil" },
    });
    expect(spoofedOAuth.status()).toBe(401);

    // 0.3 Forged cookies: wrong secret, or a valid signature for an email that is not allowed
    const forged = await request.get("/api/issues", {
      headers: {
        Cookie: `issuemate_session=${signedSession(TEST_ADMIN_EMAIL, "guessed-secret", { isAdmin: true })}`,
      },
    });
    expect(forged.status()).toBe(401);
    const notAllowed = await request.get("/api/issues", {
      headers: as(`stranger.${uniqueSuffix}@gmail.com`),
    });
    expect(notAllowed.status()).toBe(401);

    // 0.4 MCP endpoint requires a token
    const anonMcp = await request.post("/api/mcp", { data: mcpCall("list_projects", {}) });
    expect(anonMcp.status()).toBe(401);
    const badToken = await request.post("/api/mcp", {
      headers: { Authorization: "Bearer ism_live_0000000000000000000000000000000000000000" },
      data: mcpCall("list_projects", {}),
    });
    expect(badToken.status()).toBe(401);

    // 0.5 A logged-in Member is still not an Admin
    const added = await request.post("/api/auth/me", {
      headers: ADMIN,
      data: {
        action: "add_allowed_user",
        email: memberEmail,
        name: "Guard Member",
        role: "member",
        allowedProjects: ["POS"],
        defaultPermission: "reporter",
      },
    });
    expect(added.status()).toBe(200);
    const MEMBER = as(memberEmail);
    try {
      const me = await (await request.get("/api/auth/me", { headers: MEMBER })).json();
      expect(me.user.email).toBe(memberEmail);
      expect(me.user.isAdmin).toBe(false);

      expect(
        (await request.post("/api/projects", { headers: MEMBER, data: { key: "HACK", name: "x" } })).status()
      ).toBe(403);
      expect((await request.delete("/api/projects?key=NOPE0000", { headers: MEMBER })).status()).toBe(403);
      expect((await request.post("/api/seed", { headers: MEMBER, data: {} })).status()).toBe(403);
      expect(
        (
          await request.post("/api/auth/me", {
            headers: MEMBER,
            data: { action: "add_allowed_user", email: `x.${uniqueSuffix}@gmail.com`, role: "admin" },
          })
        ).status()
      ).toBe(403);
      expect(
        (
          await request.post("/api/mcp/tokens", {
            headers: MEMBER,
            data: { action: "update_settings", enforceTokenAuth: false },
          })
        ).status()
      ).toBe(400);

      // Projects outside the member's list are hidden
      const projects = await (await request.get("/api/projects", { headers: MEMBER })).json();
      expect(
        projects.projects.every((p: { key: string }) => p.key === "POS")
      ).toBeTruthy();
      expect(
        (await request.get("/api/monitor?projectKey=HRMS", { headers: MEMBER })).status()
      ).toBe(403);

      // 0.6 Uploaded HTML is never rendered inline (stored XSS guard)
      const up = await request.post("/api/upload", {
        headers: MEMBER,
        data: {
          filename: "evil.html",
          mimeType: "text/html",
          base64: Buffer.from("<script>alert(1)</script>").toString("base64"),
        },
      });
      expect(up.status()).toBe(201);
      const fileUrl = (await up.json()).attachments[0].url as string;
      expect((await request.get(fileUrl)).status()).toBe(401);
      const served = await request.get(fileUrl, { headers: MEMBER });
      expect(served.status()).toBe(200);
      expect(served.headers()["content-disposition"]).toContain("attachment");
      expect(served.headers()["content-type"]).toBe("application/octet-stream");
      expect(served.headers()["x-content-type-options"]).toBe("nosniff");
      await request.delete(fileUrl, { headers: ADMIN });
    } finally {
      await request.post("/api/auth/me", {
        headers: ADMIN,
        data: { action: "remove_allowed_user", email: memberEmail },
      });
    }

    // 0.7 A removed member's (still validly signed) cookie stops working immediately
    expect((await request.get("/api/issues", { headers: MEMBER })).status()).toBe(401);
  });

  test("1. Multi-Project Member Gmail + MCP create_project Confirmation Gate + Project-Bound Token", async ({
    request,
  }) => {
    // 1.1 Verify unauthenticated GET /api/auth/me masks Admin Gmail (`***`) so personal email is never exposed
    const meRes = await request.get("/api/auth/me");
    const meJson = await meRes.json();
    expect(meJson.superAdminMasked).toContain("***");
    expect(meJson.superAdminEmail).toContain("***");
    // Anonymous callers get no member list at all (so nothing to unmask)
    expect(meJson.user).toBeNull();
    expect(meJson.allowedUsers).toEqual([]);

    // 1.2 Admin adds a Member Gmail with MULTIPLE specific projects (`allowedProjects: [testProjectKey, "POS"]`)
    const tempAllowedEmail = `devops.${uniqueSuffix}@gmail.com`;
    const MEMBER = as(tempAllowedEmail);
    const addGmailRes = await request.post("/api/auth/me", {
      headers: ADMIN,
      data: {
        action: "add_allowed_user",
        email: tempAllowedEmail,
        name: "DevOps Multi-Project Member",
        role: "member",
        allowedProjects: [testProjectKey, "POS"],
        defaultPermission: "developer",
      },
    });
    expect(addGmailRes.status()).toBe(200);
    const addGmailJson = await addGmailRes.json();
    const addedMember = addGmailJson.allowedUsers.find(
      (u: { email: string }) => u.email === tempAllowedEmail
    );
    expect(addedMember).toBeTruthy();
    expect(addedMember.allowedProjects).toEqual([testProjectKey, "POS"]);

    // Member CANNOT generate an MCP Token for an unauthorized project ("HRMS"), for ALL projects,
    // or for somebody else's Gmail
    const forbiddenProjTokenRes = await request.post("/api/mcp/tokens", {
      headers: MEMBER,
      data: { name: "Antigravity", projectKey: "HRMS" },
    });
    expect(forbiddenProjTokenRes.status()).toBe(400);
    const allTokenRes = await request.post("/api/mcp/tokens", {
      headers: MEMBER,
      data: { name: "Antigravity", projectKey: "ALL" },
    });
    expect(allTokenRes.status()).toBe(400);
    const otherOwnerRes = await request.post("/api/mcp/tokens", {
      headers: MEMBER,
      data: { name: "Antigravity", projectKey: testProjectKey, ownerEmail: TEST_ADMIN_EMAIL },
    });
    expect(otherOwnerRes.status()).toBe(403);

    // Member CAN generate a token for their own project
    const memberTokenRes = await request.post("/api/mcp/tokens", {
      headers: MEMBER,
      data: { name: "Antigravity", projectKey: testProjectKey },
    });
    expect(memberTokenRes.status()).toBe(201);
    const memberTokenData = await memberTokenRes.json();
    expect(memberTokenData.token.ownerEmail).toBe(tempAllowedEmail);
    const memberToken = memberTokenData.rawToken as string;
    const memberTokenId = memberTokenData.token.id as string;

    // 1.3 Verify generating an MCP Token WITHOUT projectKey is rejected (prevents cross-project mistakes)
    const missingProjTokenRes = await request.post("/api/mcp/tokens", {
      headers: ADMIN,
      data: { name: "Antigravity" },
    });
    expect(missingProjTokenRes.status()).toBe(400);

    // 1.4 Generate a Project-Bound + Gmail-Bound MCP Token for `testProjectKey`
    const tokenRes = await request.post("/api/mcp/tokens", {
      headers: ADMIN,
      data: {
        name: "Antigravity",
        projectKey: testProjectKey,
        ownerEmail: TEST_ADMIN_EMAIL,
        ownerName: "Super Admin",
        agentRole: "antigravity_fixer",
      },
    });
    expect(tokenRes.status()).toBe(201);
    const tokenData = await tokenRes.json();
    expect(tokenData.rawToken).toMatch(/^ism_live_[a-f0-9]+$/);
    expect(tokenData.token.projectKey).toBe(testProjectKey);
    const rawMcpToken = tokenData.rawToken as string;
    const tokenId = tokenData.token.id as string;

    try {
      // Member sees only their own tokens and cannot revoke the Admin's
      const memberList = await (await request.get("/api/mcp/tokens", { headers: MEMBER })).json();
      expect(
        memberList.tokens.every((t: { ownerEmail: string }) => t.ownerEmail === tempAllowedEmail)
      ).toBeTruthy();
      expect(
        (await request.delete(`/api/mcp/tokens?id=${tokenId}`, { headers: MEMBER })).status()
      ).toBe(404);

      // A member token cannot create projects (Admin only)
      const memberCreateProj = await mcpTool(request, memberToken, testProjectKey, "create_project", {
        key: testProjectKey,
        name: "x",
        description: "x",
        confirmedByUser: true,
      });
      expect(memberCreateProj.json.result.isError).toBeTruthy();

      // 1.5 Verify cross-project call via URL query `?project=WRONGPROJ` is rejected
      const wrongProjHttpRes = await request.post(`/mcp?project=WRONGPROJ`, {
        headers: {
          Authorization: `Bearer ${rawMcpToken}`,
        },
        data: mcpCall("get_ai_context", {}, 99),
      });
      expect([401, 403]).toContain(wrongProjHttpRes.status());

      // 1.6 Call `create_project` WITHOUT `confirmedByUser: true` -> must return `confirmation_required` and NOT create yet
      const unconfirmedProjRes = await request.post(`/api/mcp?project=${testProjectKey}`, {
        headers: {
          Authorization: `Bearer ${rawMcpToken}`,
        },
        data: mcpCall(
          "create_project",
          { key: testProjectKey, name: `โปรเจกต์ทดสอบ ${testProjectKey}` },
          10
        ),
      });
      expect(unconfirmedProjRes.status()).toBe(200);
      const unconfirmedPayload = JSON.parse(
        (await unconfirmedProjRes.json()).result.content[0].text
      );
      expect(unconfirmedPayload.status).toBe("confirmation_required");
      expect(Array.isArray(unconfirmedPayload.questionsToAskUser)).toBeTruthy();

      // 1.7 Call `create_project` WITH `confirmedByUser: true` and full details -> creates project!
      const confirmedProjRes = await request.post(`/api/mcp?project=${testProjectKey}`, {
        headers: {
          Authorization: `Bearer ${rawMcpToken}`,
        },
        data: mcpCall(
          "create_project",
          {
            key: testProjectKey,
            name: `โปรเจกต์ทดสอบ ${testProjectKey}`,
            description: "ระบบทดสอบที่ผู้ใช้ยืนยันรายละเอียดครบถ้วนแล้ว",
            color: "#10b981",
            confirmedByUser: true,
          },
          11
        ),
      });
      expect(confirmedProjRes.status()).toBe(200);
      const confirmedPayload = JSON.parse(
        (await confirmedProjRes.json()).result.content[0].text
      );
      expect(confirmedPayload.status).toBe("created");
      expect(confirmedPayload.project.key).toBe(testProjectKey);

      // 1.8 Call `get_ai_context` with matching project
      const ctxRes = await request.post(`/mcp?project=${testProjectKey}`, {
        headers: {
          Authorization: `Bearer ${rawMcpToken}`,
          "X-MCP-Project": testProjectKey,
        },
        data: mcpCall("get_ai_context", { projectKey: testProjectKey }, 1),
      });
      expect(ctxRes.status()).toBe(200);
      const ctxParsed = JSON.parse((await ctxRes.json()).result.content[0].text);
      expect(ctxParsed.boundProjectKey).toBe(testProjectKey);
      expect(ctxParsed.authenticatedUser.email).toBe(TEST_ADMIN_EMAIL);

      // 1.9 Verify MCP tool call attempting to create an issue in ANOTHER project is blocked
      const crossProjToolRes = await request.post(`/api/mcp?project=${testProjectKey}`, {
        headers: {
          Authorization: `Bearer ${rawMcpToken}`,
        },
        data: mcpCall(
          "create_issue",
          { projectKey: "OTHERPROJ", title: "สร้างผิดโปรเจกต์ต้องถูกบล็อก" },
          2
        ),
      });
      expect(crossProjToolRes.status()).toBe(200);
      const crossProjJson = await crossProjToolRes.json();
      expect(crossProjJson.result.isError).toBeTruthy();
      expect(crossProjJson.result.content[0].text).toContain(testProjectKey);

      // 1.10 Create a new Issue in `testProjectKey` via MCP with multiple files
      const createRes = await request.post(`/api/mcp?project=${testProjectKey}`, {
        headers: {
          Authorization: `Bearer ${rawMcpToken}`,
        },
        data: mcpCall(
          "create_issue",
          {
            projectKey: testProjectKey,
            title: "ทดสอบแจ้งปัญหาพร้อมแนบหลายรูปหลายไฟล์",
            description: "รายละเอียดปัญหาสำหรับทดสอบ",
            type: "bug",
            priority: "high",
            files: [
              {
                filename: "error-detail.txt",
                contentText: "Sample error log line 1",
                mimeType: "text/plain",
              },
              {
                filename: "screen-1.png",
                base64: DUMMY_PNG_BASE64,
                mimeType: "image/png",
              },
            ],
          },
          3
        ),
      });
      expect(createRes.status()).toBe(200);
      const createdPayload = JSON.parse((await createRes.json()).result.content[0].text);
      const issueCode = createdPayload.issue.code;
      expect(createdPayload.issue.projectKey).toBe(testProjectKey);
      expect(createdPayload.issue.status).toBe("open");
      expect(createdPayload.issue.attachments).toHaveLength(2);

      // 1.11 Antigravity reviews (`submit_claude_review` -> `ready_to_fix`)
      const reviewRes = await request.post(
        `/mcp?project=${testProjectKey}&token=${encodeURIComponent(rawMcpToken)}`,
        {
          data: mcpCall(
            "submit_claude_review",
            {
              code: issueCode,
              decision: "fix",
              reviewReason: "ตรวจสอบสาเหตุแล้ว",
              fixInstructions: "แก้ไขไฟล์ที่เกี่ยวข้อง",
            },
            4
          ),
        }
      );
      expect(reviewRes.status()).toBe(200);
      const reviewedData = JSON.parse((await reviewRes.json()).result.content[0].text);
      expect(reviewedData.newStatus).toBe("ready_to_fix");

      // 1.12 Token rights follow the owner's CURRENT permission: downgrade to viewer -> read ok, writes blocked
      const devUpdate = await mcpTool(request, memberToken, testProjectKey, "update_issue_status", {
        code: issueCode,
        status: "fixing",
      });
      expect(devUpdate.json.result.isError).toBeFalsy();

      const downgrade = await request.post("/api/auth/me", {
        headers: ADMIN,
        data: {
          action: "update_allowed_user",
          email: tempAllowedEmail,
          name: "DevOps Multi-Project Member",
          role: "member",
          allowedProjects: [testProjectKey, "POS"],
          defaultPermission: "viewer",
        },
      });
      expect(downgrade.status()).toBe(200);

      const viewerRead = await mcpTool(request, memberToken, testProjectKey, "get_issue", {
        code: issueCode,
      });
      expect(viewerRead.json.result.isError).toBeFalsy();
      const viewerWrite = await mcpTool(request, memberToken, testProjectKey, "update_issue_status", {
        code: issueCode,
        status: "deployed",
      });
      expect(viewerWrite.json.result.isError).toBeTruthy();

      // Removing the member revokes their token at once
      await request.post("/api/auth/me", {
        headers: ADMIN,
        data: { action: "remove_allowed_user", email: tempAllowedEmail },
      });
      const removedCall = await mcpTool(request, memberToken, testProjectKey, "get_issue", {
        code: issueCode,
      });
      expect([401, 403]).toContain(removedCall.status);
    } finally {
      await request.delete(`/api/mcp/tokens?id=${tokenId}`, { headers: ADMIN });
      await request.delete(`/api/mcp/tokens?id=${memberTokenId}`, { headers: ADMIN });
      await request.post("/api/auth/me", {
        headers: ADMIN,
        data: { action: "remove_allowed_user", email: tempAllowedEmail },
      });
      await request.delete(`/api/projects?key=${testProjectKey}`, { headers: ADMIN });
    }
  });

  test("2. UI E2E: Admin Multi-Project Member Selector + Admin Add Project + Multi-File Issue Upload", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    const errors = watchErrors(page);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    // Create a temporary project for UI testing so we never touch existing user projects
    await request.post("/api/projects", {
      headers: ADMIN,
      data: {
        key: testProjectKey,
        name: `ระบบทดสอบ ${testProjectKey}`,
        color: "#10b981",
      },
    });

    try {
      // 2.0 Logged out: only Sign in with Google is offered, no data is loaded
      await page.goto("/");
      const loginModal = page.getByTestId("google-login-modal");
      await expect(loginModal).toBeVisible();
      await expect(page.getByTestId("google-oauth-redirect-btn")).toBeVisible();
      await expect(page.getByTestId("login-gmail-input")).toHaveCount(0);
      await expect(page.getByTestId("admin-project-manager-section")).toHaveCount(0);
      await expect(page.getByTestId(`project-item-${testProjectKey}`)).toHaveCount(0);

      await loginBrowserAs(page, TEST_ADMIN_EMAIL, baseURL!);
      await page.goto("/");
      await expect(page.getByTestId("issues-table")).toBeVisible();
      await expect(page.getByTestId(`project-item-${testProjectKey}`)).toBeVisible({
        timeout: 15000,
      });

      // 2.1 Verify Admin Modal has:
      // - Masked Admin Gmail (`***`)
      // - Multi-Project Permission Selector for Gmail Members (`admin-member-projects-selector`)
      // - Admin Project Manager (`admin-project-manager-section`)
      await page.getByTestId("open-google-login-btn").click();
      const googleModal = page.getByTestId("google-login-modal");
      await expect(googleModal).toBeVisible();
      await expect(googleModal).toContainText("***");

      // Multi-project selector for members
      const projSelector = page.getByTestId("admin-member-projects-selector");
      await expect(projSelector).toBeVisible();
      await page.getByTestId(`toggle-member-project-${testProjectKey}`).click();
      await expect(projSelector).toContainText(testProjectKey);

      // Admin Project Manager inside Admin Modal
      await expect(page.getByTestId("admin-project-manager-section")).toBeVisible();
      await expect(page.getByTestId("admin-project-key-input")).toBeVisible();
      await expect(page.getByTestId("admin-create-project-btn")).toBeVisible();

      await page.getByTestId("google-tab-guide").click();
      await expect(page.getByTestId("change-super-admin-section")).toBeVisible();
      await expect(page.getByTestId("change-super-admin-section")).toContainText(
        "SUPER_ADMIN_EMAIL"
      );
      await page.getByTestId("close-google-modal-btn").click();

      // 2.2 Open the simplified Create Issue Modal
      await page.getByTestId("new-issue-btn").click();
      const createModal = page.getByTestId("create-issue-modal");
      await expect(createModal).toBeVisible();

      await page.getByTestId("issue-project-select").selectOption(testProjectKey);
      await page
        .getByTestId("issue-title-input")
        .fill("แจ้งปัญหาหน้าจอใบกำกับภาษี (แนบ 3 รูป + 2 ไฟล์)");
      await page
        .getByTestId("issue-desc-input")
        .fill("ทดสอบแนบรูปภาพหลายรูปและแนบไฟล์เอกสารหลายไฟล์พร้อมกัน");

      // Attach 3 images at once via `image-upload-input`
      const pngBuf = Buffer.from(DUMMY_PNG_BASE64, "base64");
      await page.getByTestId("image-upload-input").setInputFiles([
        { name: "screenshot-1.png", mimeType: "image/png", buffer: pngBuf },
        { name: "screenshot-2.png", mimeType: "image/png", buffer: pngBuf },
        { name: "screenshot-3.png", mimeType: "image/png", buffer: pngBuf },
      ]);

      await expect(page.getByTestId("uploaded-image-card-0")).toBeVisible();
      await expect(page.getByTestId("uploaded-image-card-2")).toBeVisible();

      // Attach 2 document files at once via `file-upload-input`
      await page.getByTestId("file-upload-input").setInputFiles([
        {
          name: "invoice-data.csv",
          mimeType: "text/csv",
          buffer: Buffer.from("id,amount\n1,1500.00\n", "utf-8"),
        },
        {
          name: "error-report.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("Stack trace details...", "utf-8"),
        },
      ]);

      await expect(page.getByTestId("uploaded-file-card-0")).toBeVisible();
      await expect(page.getByTestId("uploaded-file-card-1")).toBeVisible();
      await expect(page.getByTestId("submit-create-issue-btn")).toContainText("แนบ 5 ไฟล์");

      await page.getByTestId("submit-create-issue-btn").click();

      // 2.3 Verify Drawer opens automatically and displays the 5 attachments
      const drawer = page.getByTestId("issue-detail-drawer");
      await expect(drawer).toBeVisible();
      await expect(drawer).toContainText("รูปภาพและไฟล์แนบ (5 รายการ)");
      await page.getByTestId("close-drawer-btn").click();

      // 2.4 Open MCP Guide Modal & verify Project Selector + New Session Antigravity Prompt
      await page.getByTestId("open-mcp-guide-btn").click();
      const mcpModal = page.getByTestId("ai-mcp-modal");
      await expect(mcpModal).toBeVisible();
      await expect(page.getByTestId("mcp-token-always-required")).toBeVisible();
      await expect(page.getByTestId("mcp-token-project-select")).toBeVisible();
      await page.getByTestId("mcp-token-project-select").selectOption(testProjectKey);
      await expect(page.getByTestId("new-session-antigravity-prompt")).toContainText(
        `projectKey="${testProjectKey}"`
      );
      await expect(page.getByTestId("mcp-http-config-box")).toContainText(
        `?project=${testProjectKey}`
      );
      await page.getByTestId("close-mcp-modal-btn").click();

      // 2.5 Verify 100% table width with zero horizontal overflow
      for (const width of [1440, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        const m = await page.getByTestId("issues-table").evaluate((t) => {
          const wrap = t.parentElement as HTMLElement;
          return { scroll: wrap.scrollWidth, client: wrap.clientWidth };
        });
        expect(m.scroll, `horizontal scroll at ${width}px`).toBeLessThanOrEqual(m.client + 1);
      }

      expect(errors).toEqual([]);
    } finally {
      await request.delete(`/api/projects?key=${testProjectKey}`, { headers: ADMIN });
    }
  });

  test("3. Last Project Memory + Question Issue Type + Granular Per-Project User Permissions + Answer with Inline PDF & Image Preview", async ({
    page,
    request,
    baseURL,
  }) => {
    const projA = `PRJA${uniqueSuffix}`;
    const projB = `PRJB${uniqueSuffix}`;
    const questionOnlyEmail = `asker.${uniqueSuffix}@gmail.com`;
    const ASKER = as(questionOnlyEmail);

    await request.post("/api/projects", {
      headers: ADMIN,
      data: { key: projA, name: `โปรเจกต์ถามคำถาม ${projA}`, color: "#ec4899" },
    });
    await request.post("/api/projects", {
      headers: ADMIN,
      data: { key: projB, name: `โปรเจกต์ดูอย่างเดียว ${projB}`, color: "#06b6d4" },
    });

    try {
      // 3.1 Configure granular per-project permissions for `questionOnlyEmail`:
      // - projA: "question_only" (can ONLY ask questions, cannot report bugs/incidents)
      // - projB: "viewer" (read-only, cannot create issues or post comments)
      const addPermUserRes = await request.post("/api/auth/me", {
        headers: ADMIN,
        data: {
          action: "add_allowed_user",
          email: questionOnlyEmail,
          name: "พนักงานฝ่ายบัญชี (ถามได้อย่างเดียว)",
          role: "member",
          allowedProjects: [projA, projB],
          defaultPermission: "question_only",
          projectPermissions: {
            [projA]: "question_only",
            [projB]: "viewer",
          },
        },
      });
      expect(addPermUserRes.status()).toBe(200);
      const addPermJson = await addPermUserRes.json();
      const savedUser = addPermJson.allowedUsers.find(
        (u: { email: string }) => u.email === questionOnlyEmail
      );
      expect(savedUser.projectPermissions[projA]).toBe("question_only");
      expect(savedUser.projectPermissions[projB]).toBe("viewer");

      // 3.2 API Permission Enforcement (identity = session cookie):
      // - Attempting to create a `bug` in `projA` as `questionOnlyEmail` MUST return 403
      const blockedBugRes = await request.post("/api/issues", {
        headers: ASKER,
        data: {
          projectKey: projA,
          title: "พยายามแจ้ง Bug ทั้งที่มีสิทธิ์แค่ถามคำถาม",
          type: "bug",
        },
      });
      expect(blockedBugRes.status()).toBe(403);

      // - Attempting to create ANY issue in `projB` (where user is `viewer`) MUST return 403
      const blockedViewerRes = await request.post("/api/issues", {
        headers: ASKER,
        data: {
          projectKey: projB,
          title: "พยายามตั้งคำถามในโปรเจกต์ที่มีสิทธิ์ดูอย่างเดียว",
          type: "question",
        },
      });
      expect(blockedViewerRes.status()).toBe(403);

      // - Creating a `question` in `projA` as `questionOnlyEmail` MUST succeed (201)
      const allowedQuestionRes = await request.post("/api/issues", {
        headers: ASKER,
        data: {
          projectKey: projA,
          title: "สอบถามวิธีพิมพ์รายงานภาษีซื้อประจำเดือนเป็น PDF",
          description: "รบกวนขอคู่มือ PDF และรูปตัวอย่างหน้าจอสำหรับพิมพ์รายงานภาษีซื้อครับ",
          type: "question",
          priority: "medium",
        },
      });
      expect(allowedQuestionRes.status()).toBe(201);
      const question = (await allowedQuestionRes.json()).issue;

      // - Monitor for a scoped member lists exactly their projects (array scope regression)
      const askerMonitor = await (await request.get("/api/monitor", { headers: ASKER })).json();
      expect(
        askerMonitor.stats.byProject.map((p: { key: string }) => p.key).sort()
      ).toEqual([projA, projB].sort());

      // - question_only cannot close their own question via a comment (status change)
      const selfResolve = await request.post(`/api/issues/${question.code}/comments`, {
        headers: ASKER,
        data: { body: "ปิดเอง", isResolution: true, nextStatus: "deployed" },
      });
      expect(selfResolve.status()).toBe(403);
      // - the comment author is always the session user, never a body field
      const plainComment = await request.post(`/api/issues/${question.code}/comments`, {
        headers: ASKER,
        data: { body: "ขอบคุณครับ", author: "ปลอมชื่อ Admin", actorEmail: TEST_ADMIN_EMAIL },
      });
      expect(plainComment.status()).toBe(201);
      const lastComment = (await plainComment.json()).issue.comments.at(-1);
      expect(lastComment.author).not.toBe("ปลอมชื่อ Admin");

      // 3.3 UI E2E: Last Active Project Memory (`localStorage` + URL `?project=`)
      await loginBrowserAs(page, TEST_ADMIN_EMAIL, baseURL!);
      await page.goto("/");
      await expect(page.getByTestId(`project-item-${projA}`)).toBeVisible({
        timeout: 15000,
      });

      // Select `projA` in Sidebar -> should remember in localStorage & URL
      await page.getByTestId(`project-item-${projA}`).click();
      await expect(page).toHaveURL(new RegExp(`project=${projA}`));
      const storedProj = await page.evaluate(() => ({
        last: window.localStorage.getItem("issuemate:lastProjectKey"),
        specific: window.localStorage.getItem("issuemate:lastSpecificProjectKey"),
      }));
      expect(storedProj.last).toBe(projA);
      expect(storedProj.specific).toBe(projA);

      // Reload page without query string -> must automatically restore `projA` from localStorage!
      await page.goto("/");
      await expect(page.getByTestId("header-project-select")).toHaveValue(projA);
      await expect(page.getByTestId("remembered-project-banner")).toContainText(projA);

      // 3.4 UI E2E: Sign in as `questionOnlyEmail` (Google session) and verify `question_only` UI mode
      await loginBrowserAs(page, questionOnlyEmail, baseURL!);
      await page.goto("/");
      await expect(page.getByTestId("header-project-select")).toHaveValue(projA);

      // In `projA`, `questionOnlyEmail` has `question_only` permission:
      // `open-create-issue-btn` (report bug) is hidden, while `quick-ask-question-btn` is visible
      await expect(page.getByTestId("quick-ask-question-btn")).toBeVisible();
      await expect(page.getByTestId("open-create-issue-btn")).toHaveCount(0);

      // Open Ask Question modal -> verify remembered project banner + question-only notice
      await page.getByTestId("quick-ask-question-btn").click();
      await expect(
        page.getByTestId("create-issue-remembered-project-banner")
      ).toContainText(projA);
      await expect(page.getByTestId("question-only-permission-notice")).toBeVisible();
      await page.getByTestId("close-create-issue-modal-btn").click();

      // Switch to `projB` where user is `viewer` -> sidebar shows viewer-only notice
      await page.getByTestId(`project-item-${projB}`).click();
      await expect(page.getByTestId("sidebar-viewer-only-notice")).toBeVisible();

      // Members never see Admin-only panels
      await page.getByTestId("open-google-login-btn").click();
      await expect(page.getByTestId("admin-project-manager-section")).toHaveCount(0);

      // Logout -> data disappears and only Sign in with Google remains
      await page.getByTestId("logout-btn").click();
      await expect(page.getByTestId(`project-item-${projA}`)).toHaveCount(0);
      await page.reload();
      await expect(page.getByTestId("google-oauth-redirect-btn")).toBeVisible();

      // 3.5 Answer the user's question as Admin with a PDF + Image file and resolve in 1 click!
      await loginBrowserAs(page, TEST_ADMIN_EMAIL, baseURL!);
      await page.goto("/");
      await page.getByTestId(`project-item-${projA}`).click();
      await page.getByTestId("filter-type-question-pill").click();

      const questionRow = page
        .locator('[data-testid^="issue-row-"]')
        .filter({ hasText: "สอบถามวิธีพิมพ์รายงานภาษีซื้อประจำเดือนเป็น PDF" })
        .first();
      await expect(questionRow).toBeVisible();
      await questionRow.click();

      const drawer = page.getByTestId("issue-detail-drawer");
      await expect(drawer).toBeVisible();

      // Fill answer and attach a PDF file + PNG image in the reply box
      await page
        .getByTestId("comment-body-input")
        .fill(
          "ส่งไฟล์คู่มือ PDF วิธีพิมพ์รายงานภาษีซื้อ พร้อมรูปภาพประกอบขั้นตอนให้เรียบร้อยแล้วครับ สามารถกดเปิดดู PDF ในหน้าจอนี้ได้เลย"
        );

      const dummyPdfBuffer = Buffer.from(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n%%EOF\n",
        "utf-8"
      );
      const pngBuf = Buffer.from(DUMMY_PNG_BASE64, "base64");

      const replyForm = page.getByTestId("reply-answer-form");
      await replyForm.getByTestId("file-upload-input").setInputFiles([
        {
          name: "vat-report-guide.pdf",
          mimeType: "application/pdf",
          buffer: dummyPdfBuffer,
        },
      ]);
      await expect(replyForm.getByTestId("uploaded-file-card-0")).toContainText(
        "vat-report-guide.pdf"
      );

      await replyForm.getByTestId("image-upload-input").setInputFiles([
        {
          name: "vat-screen-step1.png",
          mimeType: "image/png",
          buffer: pngBuf,
        },
      ]);
      await expect(replyForm.getByTestId("uploaded-image-card-0")).toContainText(
        "vat-screen-step1.png"
      );

      // Click "ส่งคำตอบพร้อมไฟล์แนบ & ปิดเรื่องว่าเรียบร้อย"
      await page.getByTestId("send-answer-resolve-btn").click();

      // Verify response feedback banners appear on comment submission!
      await expect(page.getByTestId("comment-feedback-banner")).toContainText("สำเร็จ");
      await expect(page.getByTestId("drawer-feedback-banner")).toContainText("สำเร็จ");
      await expect(page.getByTestId("global-action-feedback")).toContainText("เรียบร้อยแล้ว");
      await expect(page.getByTestId("app-version-deploy-info")).toContainText("v3.2.0");

      // Verify Official Resolution Badge appears and inline PDF viewer opens right inside the drawer!
      const resolution = page.locator('[data-testid^="comment-resolution-badge-"]').first();
      await expect(resolution).toBeVisible();
      const openPdfBtn = drawer.locator('[data-testid^="preview-pdf-inline-btn-"]').first();
      await expect(openPdfBtn).toBeVisible();
      await openPdfBtn.click();

      await expect(drawer.locator('[data-testid^="inline-pdf-viewer-"]').first()).toBeVisible();
      await expect(drawer.locator('[data-testid^="inline-pdf-iframe-"]').first()).toBeVisible();
    } finally {
      await request.post("/api/auth/me", {
        headers: ADMIN,
        data: { action: "remove_allowed_user", email: questionOnlyEmail },
      });
      await request.delete(`/api/projects?key=${projA}`, { headers: ADMIN });
      await request.delete(`/api/projects?key=${projB}`, { headers: ADMIN });
    }
  });

  test("4. Easy for Tester, Rich for Dev: Chat/Voice Input + AI Politeness Check + Auto-Environment Capture + Canvas Annotator + 1-Click Dev Action Bar", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    const errors = watchErrors(page);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const projKey = `QA${uniqueSuffix}`;

    await request.post("/api/projects", {
      headers: ADMIN,
      data: { key: projKey, name: `โปรเจกต์ทดสอบ QA ${projKey}`, color: "#06b6d4" },
    });

    try {
      // 4.1 API check: POST /api/ai/format-issue with vague input -> needsClarification: true
      const vagueRes = await request.post("/api/ai/format-issue", {
        headers: ADMIN,
        data: { text: "เว็บพังเข้าไม่ได้", projectKey: projKey },
      });
      expect(vagueRes.status()).toBe(200);
      const vagueJson = await vagueRes.json();
      expect(vagueJson.needsClarification).toBe(true);
      expect(typeof vagueJson.clarifyingQuestion).toBe("string");
      expect(vagueJson.quickReplyOptions.length).toBeGreaterThanOrEqual(2);

      // 4.2 API check: POST /api/ai/format-issue with clear context -> needsClarification: false + full structured JSON
      const clearRes = await request.post("/api/ai/format-issue", {
        headers: ADMIN,
        data: {
          text: "หน้าจอออกใบกำกับภาษี กดปุ่มบันทึกแล้วยอด VAT คำนวณผิดเป็น 0 บาท ระบบขึ้นแจ้งเตือน Error 500 ด่วนมาก",
          projectKey: projKey,
        },
      });
      expect(clearRes.status()).toBe(200);
      const clearJson = await clearRes.json();
      expect(clearJson.needsClarification).toBe(false);
      expect(clearJson.issue.title).toContain("[Bug]");
      expect(clearJson.issue.severity).toBe("critical");
      expect(Array.isArray(clearJson.issue.stepsToReproduce)).toBe(true);
      expect(Array.isArray(clearJson.issue.qaRetestChecklist)).toBe(true);
      expect(clearJson.issue.gitBranchSlug).toMatch(/^fix\//);

      // 4.3 UI E2E: Login & open Create Issue Modal
      await loginBrowserAs(page, TEST_ADMIN_EMAIL, baseURL!);
      await page.goto("/");
      await expect(page.getByTestId(`project-item-${projKey}`)).toBeVisible({ timeout: 15000 });
      await page.getByTestId(`project-item-${projKey}`).click();
      await page.getByTestId("new-issue-btn").click();

      const createModal = page.getByTestId("create-issue-modal");
      await expect(createModal).toBeVisible();
      await expect(page.getByTestId("easy-tester-chat-section")).toBeVisible();
      await expect(page.getByTestId("voice-speech-btn")).toBeVisible();
      await expect(page.getByTestId("voice-lang-toggle")).toBeVisible();
      await expect(page.getByTestId("auto-env-capture-indicator")).toBeVisible();

      // Mode Toggle: Simple <-> Technical
      await page.getByTestId("mode-technical-btn").click();
      await expect(page.getByTestId("technical-mode-env-preview")).toBeVisible();
      await page.getByTestId("mode-simple-btn").click();

      // 4.4 Feature 4 in UI: Type vague text "เว็บพังเข้าไม่ได้" -> AI Politeness Check asks clarifying question + quick-reply buttons
      await page.getByTestId("chat-issue-input").fill("เว็บพังเข้าไม่ได้");
      await page.getByTestId("ai-structure-issue-btn").click();
      await expect(page.getByTestId("ai-clarification-box")).toBeVisible();
      await expect(page.getByTestId("ai-clarifying-question")).toBeVisible();
      await expect(page.getByTestId("ai-quick-reply-0")).toBeVisible();

      // Click a Quick Reply option -> automatically structures the issue with Severity Badge!
      await page.getByTestId("ai-quick-reply-0").click();
      await expect(page.getByTestId("ai-structured-preview")).toBeVisible();
      await expect(page.getByTestId("ai-severity-badge")).toBeVisible();

      // 4.5 Feature 2 in UI: Upload an image and open the HTML5 Canvas Image Annotator (Circle, Arrow, Blur)
      const pngBuf = Buffer.from(DUMMY_PNG_BASE64, "base64");
      await page.getByTestId("image-upload-input").setInputFiles([
        { name: "broken-btn.png", mimeType: "image/png", buffer: pngBuf },
      ]);
      await expect(page.getByTestId("uploaded-image-card-0")).toBeVisible();
      await page.getByTestId("annotate-image-btn-0").click();

      const annotatorModal = page.getByTestId("image-annotator-modal");
      await expect(annotatorModal).toBeVisible();
      await expect(page.getByTestId("annotator-tool-circle")).toBeVisible();
      await expect(page.getByTestId("annotator-tool-arrow")).toBeVisible();
      await expect(page.getByTestId("annotator-tool-blur")).toBeVisible();

      // Select Arrow tool & Save annotated canvas back to MinIO
      await page.getByTestId("annotator-tool-arrow").click();
      await page.getByTestId("annotator-save-btn").click();
      await expect(annotatorModal).toHaveCount(0);

      // Submit the issue
      await page.getByTestId("submit-create-issue-btn").click();

      // 4.6 Feature 3 & Feature 5 in IssueDetailDrawer:
      // - Collapsible Device & Environment Info (<details>)
      // - One-Click Dev Action Bar (Copy Git Branch Command + Copy Checklist for PR)
      const drawer = page.getByTestId("issue-detail-drawer");
      await expect(drawer).toBeVisible();
      await expect(page.getByTestId("one-click-dev-action-bar")).toBeVisible();
      await expect(page.getByTestId("copy-git-branch-btn")).toBeVisible();
      await expect(page.getByTestId("copy-pr-checklist-btn")).toBeVisible();
      await expect(page.getByTestId("dev-git-branch-code")).toContainText("git checkout -b fix/issue-");

      await page.getByTestId("copy-git-branch-btn").click();
      await expect(page.getByTestId("copy-git-branch-btn")).toContainText("คัดลอก");

      await page.getByTestId("copy-pr-checklist-btn").click();
      await expect(page.getByTestId("copy-pr-checklist-btn")).toContainText("คัดลอก");

      const envCollapsible = page.getByTestId("device-env-details-block");
      await expect(envCollapsible).toBeVisible();
      await expect(envCollapsible).toContainText("Device & Environment Info");

      expect(errors).toEqual([]);
    } finally {
      await request.delete(`/api/projects?key=${projKey}`, { headers: ADMIN });
    }
  });
});
