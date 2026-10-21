import fs from "fs";
import path from "path";
import { test, expect, type Page } from "@playwright/test";

// Dummy 1x1 PNG Base64
const DUMMY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function getConfiguredAdminEmail(): string {
  if (process.env.SUPER_ADMIN_EMAIL) {
    return process.env.SUPER_ADMIN_EMAIL.trim().toLowerCase();
  }
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/^SUPER_ADMIN_EMAIL=(.+)$/m);
    if (match?.[1]) return match[1].trim().toLowerCase();
  } catch {
    // fallback if .env.local not present
  }
  return "admin@example.com";
}

const TEST_ADMIN_EMAIL = getConfiguredAdminEmail();

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

  test("1. Multi-Project Member Gmail + MCP create_project Confirmation Gate + Project-Bound Token", async ({
    request,
  }) => {
    // 1.1 Verify unauthenticated GET /api/auth/me masks Admin Gmail (`***`) so personal email is never exposed
    const meRes = await request.get("/api/auth/me");
    const meJson = await meRes.json();
    expect(meJson.superAdminMasked).toContain("***");
    expect(meJson.superAdminEmail).toContain("***");
    expect(
      meJson.allowedUsers.every((u: { email: string }) => u.email.includes("***"))
    ).toBeTruthy();

    // Unauthorized Gmail cannot login
    const unauthLoginRes = await request.post("/api/auth/me", {
      data: {
        email: "unapproved.hacker@gmail.com",
        name: "Unauthorized User",
      },
    });
    expect(unauthLoginRes.status()).toBe(403);

    // 1.2 Admin adds a Member Gmail with MULTIPLE specific projects (`allowedProjects: [testProjectKey, "POS"]`)
    const tempAllowedEmail = `devops.${uniqueSuffix}@gmail.com`;
    const addGmailRes = await request.post("/api/auth/me", {
      data: {
        action: "add_allowed_user",
        adminEmail: TEST_ADMIN_EMAIL,
        email: tempAllowedEmail,
        name: "DevOps Multi-Project Member",
        role: "member",
        allowedProjects: [testProjectKey, "POS"],
      },
    });
    expect(addGmailRes.status()).toBe(200);
    const addGmailJson = await addGmailRes.json();
    const addedMember = addGmailJson.allowedUsers.find(
      (u: { email: string }) => u.email === tempAllowedEmail
    );
    expect(addedMember).toBeTruthy();
    expect(addedMember.allowedProjects).toEqual([testProjectKey, "POS"]);

    // Member CANNOT generate an MCP Token for an unauthorized project ("HRMS")
    const forbiddenProjTokenRes = await request.post("/api/mcp/tokens", {
      data: {
        name: "Antigravity",
        projectKey: "HRMS",
        ownerEmail: tempAllowedEmail,
      },
    });
    expect(forbiddenProjTokenRes.status()).toBe(400);

    // Remove the temporary allowed Gmail
    const removeGmailRes = await request.post("/api/auth/me", {
      data: {
        action: "remove_allowed_user",
        adminEmail: TEST_ADMIN_EMAIL,
        email: tempAllowedEmail,
      },
    });
    expect(removeGmailRes.status()).toBe(200);

    // 1.3 Verify generating an MCP Token WITHOUT projectKey is rejected (prevents cross-project mistakes)
    const missingProjTokenRes = await request.post("/api/mcp/tokens", {
      data: {
        name: "Antigravity",
        ownerEmail: TEST_ADMIN_EMAIL,
      },
    });
    expect(missingProjTokenRes.status()).toBe(400);

    // 1.4 Generate a Project-Bound + Gmail-Bound MCP Token for `testProjectKey`
    const tokenRes = await request.post("/api/mcp/tokens", {
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
      // 1.5 Verify cross-project call via URL query `?project=WRONGPROJ` is rejected
      const wrongProjHttpRes = await request.post(`/mcp?project=WRONGPROJ`, {
        headers: {
          Authorization: `Bearer ${rawMcpToken}`,
        },
        data: {
          jsonrpc: "2.0",
          id: 99,
          method: "tools/call",
          params: {
            name: "get_ai_context",
            arguments: {},
          },
        },
      });
      expect([401, 403]).toContain(wrongProjHttpRes.status());

      // 1.6 Call `create_project` WITHOUT `confirmedByUser: true` -> must return `confirmation_required` and NOT create yet
      const unconfirmedProjRes = await request.post(`/api/mcp?project=${testProjectKey}`, {
        headers: {
          Authorization: `Bearer ${rawMcpToken}`,
        },
        data: {
          jsonrpc: "2.0",
          id: 10,
          method: "tools/call",
          params: {
            name: "create_project",
            arguments: {
              key: testProjectKey,
              name: `โปรเจกต์ทดสอบ ${testProjectKey}`,
            },
          },
        },
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
        data: {
          jsonrpc: "2.0",
          id: 11,
          method: "tools/call",
          params: {
            name: "create_project",
            arguments: {
              key: testProjectKey,
              name: `โปรเจกต์ทดสอบ ${testProjectKey}`,
              description: "ระบบทดสอบที่ผู้ใช้ยืนยันรายละเอียดครบถ้วนแล้ว",
              color: "#10b981",
              confirmedByUser: true,
            },
          },
        },
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
        data: {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "get_ai_context",
            arguments: { projectKey: testProjectKey },
          },
        },
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
        data: {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "create_issue",
            arguments: {
              projectKey: "OTHERPROJ",
              title: "สร้างผิดโปรเจกต์ต้องถูกบล็อก",
            },
          },
        },
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
        data: {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "create_issue",
            arguments: {
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
          },
        },
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
          data: {
            jsonrpc: "2.0",
            id: 4,
            method: "tools/call",
            params: {
              name: "submit_claude_review",
              arguments: {
                code: issueCode,
                decision: "fix",
                reviewReason: "ตรวจสอบสาเหตุแล้ว",
                fixInstructions: "แก้ไขไฟล์ที่เกี่ยวข้อง",
              },
            },
          },
        }
      );
      expect(reviewRes.status()).toBe(200);
      const reviewedData = JSON.parse((await reviewRes.json()).result.content[0].text);
      expect(reviewedData.newStatus).toBe("ready_to_fix");
    } finally {
      await request.delete(`/api/mcp/tokens?id=${tokenId}`);
      await request.delete(`/api/projects?key=${testProjectKey}`);
    }
  });

  test("2. UI E2E: Admin Multi-Project Member Selector + Admin Add Project + Multi-File Issue Upload", async ({
    page,
    context,
    request,
  }) => {
    const errors = watchErrors(page);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    // Create a temporary project for UI testing so we never touch existing user projects
    await request.post("/api/projects", {
      data: {
        key: testProjectKey,
        name: `ระบบทดสอบ ${testProjectKey}`,
        color: "#10b981",
      },
    });

    try {
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
      await request.delete(`/api/projects?key=${testProjectKey}`);
    }
  });
});
