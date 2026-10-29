import crypto from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  listProjects,
  createProject,
  listIssues,
  getIssueByCode,
  findSimilarIssues,
  createIssue,
  updateIssue,
  addIssueComment,
  getMonitorStats,
  normalizeProjectKey,
  getProjectByKey,
  assertValidWontFixCategory,
} from "./issue-service";
import { MAX_FILES_PER_REQUEST, uploadBufferToMinio } from "./minio";
import type { AiFixApproval, AttachmentItem, IssueStatus, SubtaskItem, WontFixCategory } from "./types";
import { WONT_FIX_CATEGORIES } from "./types";
import {
  AI_GATED_STATUSES,
  aiApprovalDisplayState,
  aiStatusChangeBlockedReason,
  autoModeApprovalRecord,
  getAiFixPermission,
} from "./ai-approval";
import { formatTokenActorIdentity, type McpTokenPublic } from "./mcp-tokens";
import {
  canUserAccessProject,
  projectScopeFor,
  validateUserProjectAction,
  type AuthUser,
} from "./auth";

type IssueAction = "view" | "comment" | "change_status";

const WontFixCategorySchema = z
  .enum(Object.keys(WONT_FIX_CATEGORIES) as [WontFixCategory, ...WontFixCategory[]])
  .optional()
  .describe(
    `หมวดเหตุผลที่ไม่แก้ไข — บังคับทุกครั้งที่ปิดเรื่องเป็น wont_fix: ${Object.entries(WONT_FIX_CATEGORIES)
      .map(([k, v]) => `${k} = ${v}`)
      .join(", ")}`
  );

function cleanIssueCode(raw: string): string {
  return raw.trim().replace(/^#/, "").toUpperCase();
}

const InlineFileSchema = z.object({
  filename: z.string().describe("ชื่อไฟล์ เช่น error-trace.log, explain-plan.txt, screenshot.png"),
  contentText: z.string().optional().describe("เนื้อหาไฟล์แบบข้อความ (สำหรับ .txt, .md, .json, .log, .sql)"),
  base64: z.string().optional().describe("ข้อมูลไฟล์แบบ Base64 (สำหรับรูปภาพ .png, .jpg หรือ PDF)"),
  mimeType: z.string().optional().describe("MIME Type เช่น text/plain, image/png, application/pdf"),
});

async function uploadInlineFiles(
  files: Array<z.infer<typeof InlineFileSchema>> | undefined,
  uploadedBy: string,
  uploaderEmail?: string
): Promise<AttachmentItem[]> {
  if (!files || files.length === 0) return [];
  if (files.length > MAX_FILES_PER_REQUEST) {
    throw new Error(`แนบไฟล์ผ่าน MCP ได้ไม่เกิน ${MAX_FILES_PER_REQUEST} ไฟล์ต่อครั้ง`);
  }
  const uploaded: AttachmentItem[] = [];
  for (const f of files) {
    if (!f.filename) continue;
    const buf = f.base64
      ? Buffer.from(f.base64.replace(/^data:[^;]+;base64,/, ""), "base64")
      : Buffer.from(f.contentText || "", "utf8");
    const mime =
      f.mimeType || (f.contentText ? "text/plain; charset=utf-8" : "application/octet-stream");
    const item = await uploadBufferToMinio({
      buffer: buf,
      filename: f.filename,
      mimeType: mime,
      uploadedBy,
      uploaderEmail,
    });
    uploaded.push(item);
  }
  return uploaded;
}

export function createIssueMateMcpServer(
  tokenUser?: McpTokenPublic,
  boundProjectKey?: string,
  /** Token owner from verifyMcpRequestToken; undefined only for the trusted local stdio server */
  owner?: AuthUser
): McpServer {
  const server = new McpServer({
    name: "issuemate-devops-mcp-server",
    version: "3.0.0",
  });

  const normalizedBoundProject =
    boundProjectKey && boundProjectKey !== "ALL"
      ? normalizeProjectKey(boundProjectKey)
      : undefined;

  function resolveScopedProjectKey(explicitProjectKey?: string): string | undefined {
    const cleanExplicit = explicitProjectKey
      ? explicitProjectKey.trim().toUpperCase() === "ALL"
        ? "ALL"
        : normalizeProjectKey(explicitProjectKey)
      : undefined;

    if (normalizedBoundProject) {
      if (
        cleanExplicit &&
        cleanExplicit !== "ALL" &&
        cleanExplicit !== normalizedBoundProject
      ) {
        throw new Error(
          `ป้องกันการสั่งงานผิดโปรเจกต์: MCP นี้ผูกไว้กับโปรเจกต์ [${normalizedBoundProject}] เท่านั้น ไม่สามารถทำรายการในโปรเจกต์ [${cleanExplicit}] ได้`
        );
      }
      return normalizedBoundProject;
    }

    return cleanExplicit && cleanExplicit !== "ALL" ? cleanExplicit : undefined;
  }

  function assertNotReviewerOnly(toolName: string) {
    if (tokenUser?.agentRole === "claude_reviewer") {
      throw new Error(
        `Token นี้มีบทบาทเป็น "claude_reviewer" (สำหรับรีวิวเท่านั้น) ไม่สามารถเรียกใช้ ${toolName} เพื่อแก้ไขหรือ Deploy ได้`
      );
    }
  }

  // Same per-project rules as the web API, checked against the token owner's current rights
  function requireAccess(projectKey: string, action: IssueAction | "create_issue", issueType?: string) {
    if (!owner) return;
    const check = validateUserProjectAction(owner, projectKey, action, issueType);
    if (!check.allowed) throw new Error(check.reason || "ไม่มีสิทธิ์ทำรายการนี้");
  }

  // List/summary scope limited to projects the owner may view
  function listScope(explicitProjectKey?: string): string | string[] | undefined {
    const target = resolveScopedProjectKey(explicitProjectKey);
    if (!owner) return target;
    const scope = projectScopeFor(owner, target);
    if (scope === null) throw new Error(`ไม่มีสิทธิ์เข้าถึงโปรเจกต์ [${target}]`);
    return scope;
  }

  async function assertIssueBelongsToProject(
    issueCode: string,
    explicitProjectKey: string | undefined,
    action: IssueAction
  ): Promise<string> {
    const code = cleanIssueCode(issueCode);
    const issueProjPrefix = code.split("-")[0] || "";
    const targetProj = resolveScopedProjectKey(explicitProjectKey);
    if (targetProj && issueProjPrefix && issueProjPrefix !== targetProj) {
      throw new Error(
        `ป้องกันการทำรายการผิดโปรเจกต์: Issue #${code} อยู่ในโปรเจกต์ [${issueProjPrefix}] แต่ MCP Session นี้ระบุโปรเจกต์ [${targetProj}] เท่านั้น`
      );
    }
    if (owner) {
      const issue = await getIssueByCode(code);
      if (issue) requireAccess(issue.projectKey, action, issue.type);
    }
    return code;
  }

  // Admin approval gate: AI may move an issue into fixing/deployed only after an admin approved it
  // in the web UI (or the project's auto mode is on). Returns the record to stamp for auto mode.
  async function requireAiFixApproval(
    code: string,
    nextStatus: IssueStatus | undefined
  ): Promise<AiFixApproval | undefined> {
    if (!nextStatus || !AI_GATED_STATUSES.includes(nextStatus)) return undefined;
    const issue = await getIssueByCode(code);
    if (!issue) throw new Error(`ไม่พบ Issue ${code}`);
    const project = await getProjectByKey(issue.projectKey);
    const blocked = aiStatusChangeBlockedReason(issue, nextStatus, project);
    if (blocked) throw new Error(blocked);
    const perm = getAiFixPermission(issue, project);
    return perm.allowed && perm.via === "auto_mode" && project
      ? autoModeApprovalRecord(project)
      : undefined;
  }

  // 1. get_ai_context
  server.tool(
    "get_ai_context",
    "ดึงข้อมูลภาพรวมระบบ IssueMate ของโปรเจกต์ที่ระบุ (คิวรอ Antigravity รีวิว, คิวรอแก้และ Deploy, รายชื่อโปรเจกต์ และค่า Status/Type ที่ใช้ได้)",
    {
      projectKey: z
        .string()
        .optional()
        .describe("รหัสโปรเจกต์ที่กำลังทำงาน เช่น SMLAIACC (ระบุเพื่อล็อกเฉพาะโปรเจกต์นี้ กันพลาด)"),
    },
    async (args) => {
      const targetProj = resolveScopedProjectKey(args.projectKey);
      const scope = listScope(args.projectKey);
      const [projects, stats, readyToFix] = await Promise.all([
        listProjects(),
        getMonitorStats(scope || "ALL"),
        listIssues({ projectKey: scope, status: "ready_to_fix", limit: 50 }),
      ]);
      const projectByKey = new Map(projects.map((p) => [p.key, p]));
      const filteredProjects = projects.filter(
        (p) => (!targetProj || p.key === targetProj) && (!owner || canUserAccessProject(owner, p.key))
      );
      const contextPayload = {
        boundProjectKey: targetProj || "ALL",
        authenticatedUser: tokenUser
          ? {
              userId: tokenUser.ownerEmail,
              email: tokenUser.ownerEmail,
              ownerName: tokenUser.ownerName,
              tokenName: tokenUser.name,
              projectKey: tokenUser.projectKey || targetProj || "ALL",
              agentRole: tokenUser.agentRole,
            }
          : null,
        guideForAi: {
          projectSafetyRule: targetProj
            ? `MCP Session นี้ล็อกไว้กับโปรเจกต์ [${targetProj}] เท่านั้น ห้ามดึงหรือแก้ไข Issue ของโปรเจกต์อื่นเด็ดขาด`
            : "กรุณาระบุ projectKey ทุกครั้งที่เรียก MCP Tool เพื่อป้องกันการทำรายการข้ามโปรเจกต์",
          pipelineWorkflow: [
            "1. แจ้งปัญหาใหม่ -> status = 'open' (รอ Antigravity ดึงไปรีวิว)",
            "2. Antigravity วิเคราะห์สาเหตุ -> เรียก submit_claude_review: ถ้าสั่งแก้จะเปลี่ยนเป็น 'ready_to_fix' พร้อมเหตุผล (reviewReason) และคำสั่งในการแก้/Deploy (fixInstructions, deployCommand); ถ้าไม่แก้จะเปลี่ยนเป็น 'wont_fix' พร้อมเหตุผล และต้องระบุหมวด wontFixCategory ทุกครั้ง",
            "3. รอผู้ดูแล (Admin) อนุมัติให้ AI แก้ไขในหน้าเว็บ — ดู aiFixAllowed ใน readyToFixQueue (หรือโปรเจกต์เปิดโหมดอัตโนมัติ)",
            "4. เฉพาะเรื่องที่ aiFixAllowed = true เท่านั้น -> เรียก claim_for_fix (เปลี่ยนเป็น 'fixing') แล้วแก้โค้ด + ทดสอบ + Deploy จากนั้นเรียก mark_deployed (เปลี่ยนเป็น 'deployed')",
          ],
          aiFixApprovalRule:
            "ห้ามแก้โค้ดหรือ Deploy เรื่องที่ยังไม่ได้รับอนุมัติจากผู้ดูแล (aiFixAllowed = false) — ระบบจะปฏิเสธ claim_for_fix / mark_deployed / การเปลี่ยนสถานะเป็น fixing หรือ deployed จนกว่าจะได้รับอนุมัติ เรื่องประเภทคำถาม (question) ตอบและปิดเรื่องได้โดยไม่ต้องรออนุมัติ เรื่องที่ผู้ดูแลกด 'ไม่อนุมัติ' ห้ามแก้แม้โปรเจกต์เปิดโหมดอัตโนมัติ",
          validValues: {
            status: ["open", "reviewing", "ready_to_fix", "fixing", "deployed", "wont_fix"],
            type: ["question", "incident", "bug", "deployment", "performance", "security", "feature"],
            priority: ["critical", "high", "medium", "low"],
          },
        },
        projects: filteredProjects.map((p) => ({
          key: p.key,
          name: p.name,
          repoOrServer: p.repoOrServer,
          openCount: p.openCount,
          readyToFixCount: p.readyToFixCount,
          totalCount: p.totalCount,
          aiAutoMode: Boolean(p.aiAutoApproval?.enabled),
        })),
        readyToFixQueue: readyToFix.map((issue) => {
          const project = projectByKey.get(issue.projectKey);
          const perm = getAiFixPermission(issue, project);
          return {
            code: issue.code,
            title: issue.title,
            priority: issue.priority,
            aiFixAllowed: perm.allowed,
            approval: aiApprovalDisplayState(issue, project),
            ...(perm.allowed ? {} : { blockedReason: perm.message }),
          };
        }),
        queues: {
          pendingReview: stats.openIssues + stats.reviewingIssues,
          pendingClaudeReview: stats.openIssues + stats.reviewingIssues,
          readyForAntigravityFix: stats.readyToFixIssues,
          awaitingAdminApproval: stats.awaitingAiApprovalCount,
          fixingButNotApprovedForDeploy: stats.awaitingAiApprovalFixingCount,
          currentlyFixing: stats.fixingIssues,
          deployedCount: stats.deployedIssues,
          wontFixCount: stats.wontFixIssues,
        },
        statsSummary: {
          totalIssues: stats.totalIssues,
          criticalOpenCount: stats.criticalOpenCount,
          overdueCount: stats.overdueCount,
        },
      };
      return {
        content: [{ type: "text", text: JSON.stringify(contextPayload, null, 2) }],
      };
    }
  );

  // 2. submit_claude_review (Antigravity Review Decision)
  server.tool(
    "submit_claude_review",
    "สำหรับ Antigravity: บันทึกผลการรีวิววิเคราะห์ปัญหา เลือกตัดสินใจว่า 'fix' (เปลี่ยนสถานะเป็น ready_to_fix รอแก้) หรือ 'wont_fix' (ไม่แก้) พร้อมระบุเหตุผล (reviewReason) และคำสั่งในการแก้/Deploy (fixInstructions, deployCommand)",
    {
      projectKey: z
        .string()
        .optional()
        .describe("รหัสโปรเจกต์ เช่น SMLAIACC (เพื่อป้องกันการรีวิวผิดโปรเจกต์)"),
      code: z.string().describe("รหัส Issue เช่น SMLAIACC-1 หรือ DEVOPS-1"),
      decision: z
        .enum(["fix", "wont_fix", "pending"])
        .describe("'fix' = สั่งแก้ (เปลี่ยนสถานะเป็น ready_to_fix), 'wont_fix' = ไม่แก้ (เปลี่ยนสถานะเป็น wont_fix)"),
      reviewedBy: z.string().optional().describe("ชื่อผู้รีวิว เช่น Antigravity"),
      reviewReason: z
        .string()
        .describe("เหตุผลการตัดสินใจ / สาเหตุของปัญหา (Root Cause หรือเหตุผลที่ไม่แก้)"),
      fixInstructions: z
        .string()
        .optional()
        .describe("คำสั่งในการแก้อย่างละเอียดสำหรับ Antigravity"),
      targetFiles: z
        .array(z.string())
        .optional()
        .describe("รายชื่อไฟล์หรือ Service ที่ต้องแก้ไข เช่น ['app/api/issues/route.ts']"),
      deployCommand: z
        .string()
        .optional()
        .describe("คำสั่งทดสอบและ Deploy เช่น 'npx tsc --noEmit && npx playwright test'"),
      subtasks: z
        .array(z.string())
        .optional()
        .describe("รายการ Checklist งานย่อยสำหรับ Antigravity (ถ้าต้องการตั้งใหม่)"),
      wontFixCategory: WontFixCategorySchema,
    },
    async (args) => {
      const code = await assertIssueBelongsToProject(args.code, args.projectKey, "change_status");
      const reviewer = formatTokenActorIdentity(
        tokenUser,
        args.reviewedBy || "Antigravity"
      );
      const nextStatus =
        args.decision === "fix"
          ? "ready_to_fix"
          : args.decision === "wont_fix"
          ? "wont_fix"
          : "reviewing";

      const patchSubtasks: SubtaskItem[] | undefined =
        args.subtasks && args.subtasks.length > 0
          ? args.subtasks.map((title) => ({
              id: crypto.randomUUID(),
              title: title.trim(),
              completed: false,
              assignee: "Antigravity",
            }))
          : undefined;

      const updated = await updateIssue(code, {
        status: nextStatus,
        assignee:
          args.decision === "fix" ? "Antigravity" : reviewer,
        reviewMeta: {
          decision: args.decision,
          reviewedBy: reviewer,
          reviewedAt: new Date().toISOString(),
          reviewReason: args.reviewReason,
          fixInstructions: args.fixInstructions,
          targetFiles: args.targetFiles,
          deployCommand: args.deployCommand,
        },
        subtasks: patchSubtasks,
        wontFixCategory: args.wontFixCategory,
        aiSummary:
          args.decision === "fix"
            ? `Antigravity Review: สั่งแก้ (รอแก้) — ${args.reviewReason}`
            : args.decision === "wont_fix"
            ? `Antigravity Review: ไม่แก้ (Won't Fix) — ${args.reviewReason}`
            : `Antigravity กำลังรีวิว: ${args.reviewReason}`,
        actor: reviewer,
      });

      const reviewProject = await getProjectByKey(updated.projectKey);
      const fixPermission = getAiFixPermission(updated, reviewProject);
      const approvalLine =
        args.decision === "fix" && !fixPermission.allowed
          ? "\n- ⏳ **รอผู้ดูแลอนุมัติให้ AI แก้ไข** ก่อนเริ่มแก้โค้ด"
          : "";

      await addIssueComment(code, {
        author: reviewer,
        role: "Antigravity Agent",
        body:
          args.decision === "fix"
            ? `### ✅ ผลรีวิวจาก Antigravity: **สั่งแก้ (สถานะ: รอแก้ \`ready_to_fix\`)**\n- **สาเหตุ/เหตุผล**: ${args.reviewReason}\n- **คำสั่งในการแก้ (สำหรับ Antigravity)**:\n\`\`\`text\n${args.fixInstructions || "-"}\n\`\`\`\n${
                args.deployCommand ? `- **คำสั่ง Deploy**: \`${args.deployCommand}\`` : ""
              }${approvalLine}`
            : args.decision === "wont_fix"
            ? `### ⛔ ผลรีวิวจาก Antigravity: **ไม่แก้ (สถานะ: \`wont_fix\`)**\n- **หมวด**: ${updated.wontFixCategory ? WONT_FIX_CATEGORIES[updated.wontFixCategory] : "-"}\n- **เหตุผลที่ไม่แก้**: ${args.reviewReason}`
            : `### 🔍 Antigravity กำลังรีวิว (สถานะ: \`reviewing\`)\n- **บันทึกการวิเคราะห์เบื้องต้น**: ${args.reviewReason}`,
        isResolution: args.decision === "wont_fix",
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "review_recorded",
                code: updated.code,
                newStatus: updated.status,
                decision: args.decision,
                reviewMeta: updated.reviewMeta,
                aiFixAllowed: fixPermission.allowed,
                nextStep:
                  args.decision !== "fix"
                    ? undefined
                    : fixPermission.allowed
                      ? "ได้รับอนุมัติแล้ว — เรียก claim_for_fix เพื่อเริ่มแก้ไขได้"
                      : "รอผู้ดูแลอนุมัติให้ AI แก้ไขในหน้าเว็บ — ห้ามเริ่มแก้โค้ดจนกว่า aiFixAllowed จะเป็น true",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 3. claim_for_fix (and alias claim_and_plan_issue for Antigravity)
  server.tool(
    "claim_for_fix",
    "สำหรับ Antigravity: ดึง Issue ที่สถานะ 'ready_to_fix' (รอแก้) ไปเริ่มดำเนินการแก้ไขโค้ดและเตรียม Deploy (เปลี่ยนสถานะเป็น 'fixing') — ใช้ได้เฉพาะเรื่องที่ผู้ดูแลอนุมัติให้ AI แก้ไขแล้ว (หรือโปรเจกต์เปิดโหมดอัตโนมัติ)",
    {
      projectKey: z
        .string()
        .optional()
        .describe("รหัสโปรเจกต์ เช่น SMLAIACC (เพื่อป้องกันการรับงานผิดโปรเจกต์)"),
      code: z.string().describe("รหัส Issue เช่น SMLAIACC-1"),
      agentName: z.string().default("Antigravity"),
      planNote: z.string().optional().describe("แผนการแก้ไขและ Deploy เบื้องต้น"),
    },
    async ({ projectKey, code, agentName, planNote }) => {
      assertNotReviewerOnly("claim_for_fix");
      const normalized = await assertIssueBelongsToProject(code, projectKey, "change_status");
      const resolvedAgent = formatTokenActorIdentity(tokenUser, agentName);
      const autoApproval = await requireAiFixApproval(normalized, "fixing");
      const updated = await updateIssue(normalized, {
        status: "fixing",
        expectedStatus: "ready_to_fix",
        assignee: resolvedAgent,
        actor: resolvedAgent,
        aiFixApproval: autoApproval,
        reviewMeta: {
          fixedBy: resolvedAgent,
        },
      });
      if (planNote && planNote.trim()) {
        await addIssueComment(normalized, {
          author: resolvedAgent,
          role: "Antigravity Agent",
          body: `🔧 **เริ่มดำเนินการแก้ไขและเตรียม Deploy**:\n${planNote.trim()}`,
        });
      }
      return {
        content: [{ type: "text", text: JSON.stringify(updated, null, 2) }],
      };
    }
  );

  // 4. mark_deployed (for Antigravity after fixing & deploying)
  server.tool(
    "mark_deployed",
    "สำหรับ Antigravity: บันทึกผลการแก้ไข ทดสอบ และ Deploy ขึ้นเซิร์ฟเวอร์สำเร็จ (เปลี่ยนสถานะเป็น 'deployed' พร้อมติ๊ก Subtasks ทั้งหมด) — ใช้ได้เฉพาะเรื่องที่ผู้ดูแลอนุมัติให้ AI แก้ไขแล้ว",
    {
      projectKey: z
        .string()
        .optional()
        .describe("รหัสโปรเจกต์ เช่น SMLAIACC (เพื่อป้องกันการบันทึกผิดโปรเจกต์)"),
      code: z.string().describe("รหัส Issue เช่น SMLAIACC-1"),
      agentName: z.string().default("Antigravity"),
      deployResult: z
        .string()
        .describe("สรุปผลการแก้ไข ผลรัน Playwright Test และ URL/Server ที่ Deploy สำเร็จ"),
      completeAllSubtasks: z.boolean().optional().default(true),
    },
    async ({ projectKey, code, agentName, deployResult, completeAllSubtasks }) => {
      assertNotReviewerOnly("mark_deployed");
      const normalized = await assertIssueBelongsToProject(code, projectKey, "change_status");
      const resolvedAgent = formatTokenActorIdentity(tokenUser, agentName);
      const existing = await getIssueByCode(normalized);
      if (!existing) {
        return {
          content: [{ type: "text", text: `ไม่พบ Issue ${normalized}` }],
          isError: true,
        };
      }

      const autoApproval = await requireAiFixApproval(normalized, "deployed");
      const nextSubtasks = completeAllSubtasks
        ? (existing.subtasks || []).map((s) => ({ ...s, completed: true }))
        : existing.subtasks;

      const updated = await updateIssue(normalized, {
        status: "deployed",
        expectedStatus: "fixing",
        aiFixApproval: autoApproval,
        assignee: resolvedAgent,
        subtasks: nextSubtasks,
        reviewMeta: {
          fixedBy: resolvedAgent,
          fixedAt: new Date().toISOString(),
          deployResult,
        },
        aiSummary: `Deployed สำเร็จโดย ${resolvedAgent}: ${deployResult}`,
        actor: resolvedAgent,
      });

      await addIssueComment(normalized, {
        author: resolvedAgent,
        role: "AI Fix & Deploy Agent",
        body: `🚀 **แก้ไขและ Deploy สำเร็จ (\`deployed\`)**:\n${deployResult}`,
        isResolution: true,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(updated, null, 2) }],
      };
    }
  );

  // 5. list_projects
  server.tool(
    "list_projects",
    "ดึงรายการโปรเจกต์ DevOps ทั้งหมดในระบบ พร้อมจำนวน Issue ที่รอรีวิวและรอแก้",
    {},
    async () => {
      const projects = (await listProjects()).filter(
        (p) =>
          (!normalizedBoundProject || p.key === normalizedBoundProject) &&
          (!owner || canUserAccessProject(owner, p.key))
      );
      return {
        content: [{ type: "text", text: JSON.stringify(projects, null, 2) }],
      };
    }
  );

  // 6. create_project
  server.tool(
    "create_project",
    "สร้างโปรเจกต์ใหม่ในระบบ IssueMate (กฎเหล็ก: AI ต้องถามรหัสย่อ key, ชื่อโปรเจกต์ name, คำอธิบาย description และขอคำยืนยันจากผู้ใช้งานให้เรียบร้อยก่อน จึงจะส่ง confirmedByUser=true เพื่อสร้างจริงได้)",
    {
      key: z
        .string()
        .describe(
          "รหัสย่อโปรเจกต์ 2-10 ตัวอักษรภาษาอังกฤษพิมพ์ใหญ่/ตัวเลข เช่น SMLAIACC, POS, HRMS (ต้องถามผู้ใช้ก่อน)"
        ),
      name: z
        .string()
        .describe("ชื่อเต็มของโปรเจกต์ เช่น SML Ai Account (ต้องถามผู้ใช้ก่อน)"),
      description: z
        .string()
        .optional()
        .describe("คำอธิบายระบบงานหรือขอบเขตของโปรเจกต์ (ต้องถามผู้ใช้ให้เรียบร้อยก่อน)"),
      repoOrServer: z
        .string()
        .optional()
        .describe("เซิร์ฟเวอร์ โดเมน หรือ Repo เช่น issue.dedezoom.com (ถ้ามี)"),
      color: z
        .string()
        .optional()
        .describe("สีประจำโปรเจกต์ เช่น #10b981, #3b82f6, #f59e0b"),
      confirmedByUser: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "ต้องตั้งเป็น true เท่านั้น หลังจากที่ AI ได้ถามชื่อโปรเจกต์ รหัสย่อ คำอธิบาย และได้รับคำยืนยันจากผู้ใช้งานเรียบร้อยแล้ว"
        ),
    },
    async (args) => {
      if (owner && !owner.isAdmin) {
        throw new Error("สร้างโปรเจกต์ได้เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น");
      }
      const cleanKey = args.key
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      const cleanName = args.name.trim();
      const cleanDesc = (args.description || "").trim();

      if (
        normalizedBoundProject &&
        cleanKey &&
        cleanKey !== normalizedBoundProject
      ) {
        return {
          content: [
            {
              type: "text",
              text: `ป้องกันการสร้างโปรเจกต์ผิดพลาด: MCP Session นี้ผูกไว้กับโปรเจกต์ [${normalizedBoundProject}] เท่านั้น ไม่สามารถสร้างโปรเจกต์ [${cleanKey}] ข้ามโปรเจกต์ได้`,
            },
          ],
          isError: true,
        };
      }

      const existingProjects = await listProjects();
      const existing = existingProjects.find((p) => p.key === cleanKey);
      if (existing) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "already_exists",
                  message: `โปรเจกต์ [${cleanKey}] (${existing.name}) มีอยู่ในระบบแล้ว สามารถใช้งานได้ทันที`,
                  project: existing,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (!args.confirmedByUser || !cleanKey || !cleanName || !cleanDesc) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "confirmation_required",
                  message:
                    "กรุณาถามและยืนยันรายละเอียดโปรเจกต์กับผู้ใช้งานให้ครบถ้วนก่อน ระบบจึงจะสร้างโปรเจกต์ให้",
                  questionsToAskUser: [
                    `1. รหัสย่อโปรเจกต์ (Project Key 2-10 ตัวอักษร): ยืนยันใช้รหัส "${cleanKey || "เช่น NEWPROJ"}" หรือไม่?`,
                    `2. ชื่อโปรเจกต์ (Project Name): ยืนยันชื่อ "${cleanName || "กรุณาระบุชื่อโปรเจกต์"}" หรือไม่?`,
                    `3. คำอธิบายโปรเจกต์ (Description): "${cleanDesc || "กรุณาถามคำอธิบายสั้นๆ ของโปรเจกต์จากผู้ใช้งาน"}"`,
                    "4. ยืนยันให้สร้างโปรเจกต์นี้ในระบบ IssueMate เลยหรือไม่?",
                  ],
                  proposedProject: {
                    key: cleanKey,
                    name: cleanName,
                    description: cleanDesc || null,
                    repoOrServer: args.repoOrServer || null,
                    color: args.color || "#10b981",
                  },
                  instructionForAi:
                    "ห้ามสร้างโปรเจกต์โดยเดาเอง ให้แสดงรายละเอียดข้างต้นถามผู้ใช้งานก่อน เมื่อผู้ใช้งานตอบตกลงและให้คำอธิบายครบแล้ว จึงเรียก create_project ซ้ำโดยส่ง confirmedByUser: true และระบุ description ให้ครบถ้วน",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const created = await createProject({
        key: cleanKey,
        name: cleanName,
        description: cleanDesc,
        repoOrServer: args.repoOrServer,
        color: args.color || "#10b981",
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "created",
                message: `สร้างโปรเจกต์ [${created.key}] ${created.name} สำเร็จเรียบร้อยแล้ว`,
                project: created,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 7. list_issues
  server.tool(
    "list_issues",
    "ค้นหาและดึงรายการ Issues เฉพาะโปรเจกต์ที่ระบุ (กรองตาม projectKey และ status เช่น 'open' สำหรับคิวรอรีวิว หรือ 'ready_to_fix' สำหรับคิวรอแก้และ Deploy)",
    {
      projectKey: z
        .string()
        .optional()
        .describe("รหัสโปรเจกต์ เช่น SMLAIACC (จำเป็นต้องตรงกับโปรเจกต์ของ MCP Token)"),
      status: z
        .enum([
          "all",
          "pending_review",
          "active",
          "overdue",
          "open",
          "reviewing",
          "ready_to_fix",
          "fixing",
          "deployed",
          "wont_fix",
        ])
        .optional(),
      type: z
        .enum(["all", "question", "incident", "bug", "deployment", "performance", "security", "feature"])
        .optional(),
      priority: z.enum(["all", "critical", "high", "medium", "low"]).optional(),
      search: z.string().optional(),
      limit: z.number().optional(),
      aiApproval: z
        .enum(["all", "awaiting", "approved"])
        .optional()
        .describe("'approved' = เฉพาะเรื่องที่ผู้ดูแลอนุมัติให้ AI แก้แล้ว, 'awaiting' = รอผู้ดูแลอนุมัติ"),
    },
    async (args) => {
      const issues = await listIssues({
        ...args,
        projectKey: listScope(args.projectKey),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(issues, null, 2) }],
      };
    }
  );

  // 8. get_issue
  server.tool(
    "get_issue",
    "ดึงรายละเอียดเชิงลึกของ Issue ตามรหัส (รวม reviewMeta, คำสั่งแก้ fixInstructions, deployCommand, ไฟล์แนบ MinIO, Subtasks และ Comments)",
    {
      projectKey: z
        .string()
        .optional()
        .describe("รหัสโปรเจกต์ เช่น SMLAIACC (เพื่อป้องกันการดึงผิดโปรเจกต์)"),
      code: z.string().describe("รหัส Issue เช่น SMLAIACC-1"),
    },
    async ({ projectKey, code }) => {
      const normalizedCode = await assertIssueBelongsToProject(code, projectKey, "view");
      const issue = await getIssueByCode(normalizedCode);
      if (!issue) {
        return {
          content: [{ type: "text", text: `ไม่พบ Issue รหัส ${code}` }],
          isError: true,
        };
      }
      const project = await getProjectByKey(issue.projectKey);
      const perm = getAiFixPermission(issue, project);
      const payload = {
        ...issue,
        aiFixAllowed: perm.allowed,
        ...(perm.allowed ? {} : { aiFixBlockedReason: perm.message }),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      };
    }
  );

  // 9. find_similar_issues
  server.tool(
    "find_similar_issues",
    "ค้นหา Issue ที่คล้ายกันภายในโปรเจกต์เพื่อป้องกันการแจ้งซ้ำ",
    {
      query: z.string(),
      projectKey: z.string().optional().describe("รหัสโปรเจกต์ เช่น SMLAIACC"),
    },
    async ({ query, projectKey }) => {
      const similar = await findSimilarIssues(query, listScope(projectKey));
      return {
        content: [{ type: "text", text: JSON.stringify({ count: similar.length, similar }, null, 2) }],
      };
    }
  );

  // 10. create_issue
  server.tool(
    "create_issue",
    "สร้าง Issue ใหม่ในโปรเจกต์ที่ระบุ (แนบไฟล์ Log/รูปภาพเข้า MinIO ได้ทันที)",
    {
      projectKey: z
        .string()
        .optional()
        .describe("รหัสโปรเจกต์ เช่น SMLAIACC (หากผูกไว้กับ MCP Token แล้วจะใช้ค่าที่ผูกไว้โดยอัตโนมัติ)"),
      projectName: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      status: z
        .enum(["open", "reviewing", "ready_to_fix", "fixing", "deployed", "wont_fix"])
        .optional()
        .default("open"),
      type: z
        .enum(["question", "incident", "bug", "deployment", "performance", "security", "feature"])
        .optional()
        .default("bug"),
      priority: z.enum(["critical", "high", "medium", "low"]).optional().default("high"),
      reporter: z.string().optional().default("Antigravity"),
      department: z.string().optional().default("DevOps & SRE Team"),
      assignee: z.string().optional(),
      labels: z.array(z.string()).optional(),
      subtasks: z.array(z.string()).optional(),
      devopsMeta: z
        .object({
          environment: z.string().optional(),
          serviceName: z.string().optional(),
          incidentSeverity: z.string().optional(),
          runbookOrCommit: z.string().optional(),
          targetServerOrDomain: z.string().optional(),
        })
        .optional(),
      reviewMeta: z
        .object({
          decision: z.enum(["pending", "fix", "wont_fix"]).optional(),
          reviewedBy: z.string().optional(),
          reviewReason: z.string().optional(),
          fixInstructions: z.string().optional(),
          targetFiles: z.array(z.string()).optional(),
          deployCommand: z.string().optional(),
        })
        .optional(),
      aiSummary: z.string().optional(),
      wontFixCategory: WontFixCategorySchema,
      files: z.array(InlineFileSchema).optional(),
    },
    async (args) => {
      const scopedProj = resolveScopedProjectKey(args.projectKey);
      if (!scopedProj) {
        throw new Error(
          "กรุณาระบุ projectKey (เช่น SMLAIACC) เพื่อป้องกันการสร้าง Issue ผิดโปรเจกต์"
        );
      }
      const normalizedKey = scopedProj;
      const existingProjects = await listProjects();
      if (!existingProjects.some((p) => p.key === normalizedKey)) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "project_not_found_confirmation_required",
                  message: `ยังไม่มีโปรเจกต์รหัส [${normalizedKey}] ในระบบ IssueMate — กรุณาถามชื่อโปรเจกต์ รหัสย่อ และคำอธิบายจากผู้ใช้งานให้เรียบร้อยก่อน แล้วเรียก tool create_project (โดยส่ง confirmedByUser: true) เพื่อสร้างโปรเจกต์ก่อนแจ้งปัญหา`,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      requireAccess(normalizedKey, "create_issue", args.type);
      // Workflow fields (status/devopsMeta/reviewMeta) need developer/project_admin, like the web API
      const canManage =
        !owner || validateUserProjectAction(owner, normalizedKey, "change_status").allowed;
      if (canManage && args.status) {
        const blocked = aiStatusChangeBlockedReason(
          { code: "(เรื่องใหม่)", type: args.type, aiFixApproval: undefined },
          args.status,
          await getProjectByKey(normalizedKey)
        );
        // ตรวจก่อนอัปโหลดไฟล์ จะได้ไม่มีไฟล์ค้างใน MinIO ถ้าสร้างไม่สำเร็จ
        if (args.status === "wont_fix") assertValidWontFixCategory(args.wontFixCategory);
        if (blocked) {
          throw new Error(
            `${blocked} — สร้างเรื่องใหม่ได้ในสถานะ open หรือ ready_to_fix แล้วรอผู้ดูแลอนุมัติ`
          );
        }
      }
      const resolvedReporter = formatTokenActorIdentity(
        tokenUser,
        args.reporter || "AI DevOps Agent"
      );
      const uploadedFiles = await uploadInlineFiles(
        args.files,
        resolvedReporter,
        tokenUser?.ownerEmail
      );
      const subtaskItems: SubtaskItem[] = (args.subtasks || []).map((t) => ({
        id: crypto.randomUUID(),
        title: t.trim(),
        completed: false,
      }));

      const issue = await createIssue({
        projectKey: normalizedKey,
        title: args.title,
        description: args.description,
        status: canManage ? args.status : undefined,
        type: args.type,
        priority: args.priority,
        reporter: resolvedReporter,
        reporterEmail: tokenUser?.ownerEmail,
        department: args.department,
        assignee: canManage ? args.assignee : undefined,
        labels: args.labels,
        subtasks: subtaskItems,
        attachments: uploadedFiles,
        devopsMeta: canManage ? args.devopsMeta : undefined,
        reviewMeta: canManage ? args.reviewMeta : undefined,
        aiSummary: canManage ? args.aiSummary : undefined,
        wontFixCategory: canManage ? args.wontFixCategory : undefined,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ status: "created", issue }, null, 2),
          },
        ],
      };
    }
  );

  // 11. claim_and_plan_issue
  server.tool(
    "claim_and_plan_issue",
    "ให้ Antigravity รับผิดชอบ Issue พร้อมบันทึกแผนงานหรือคำสั่งแก้ไข",
    {
      projectKey: z.string().optional().describe("รหัสโปรเจกต์ เช่น SMLAIACC"),
      code: z.string(),
      agentName: z.string(),
      aiSummary: z.string(),
      nextStatus: z
        .enum(["reviewing", "ready_to_fix", "fixing"])
        .optional()
        .default("fixing"),
      fixInstructions: z.string().optional(),
      subtasksToAdd: z.array(z.string()).optional(),
      commentBody: z.string().optional(),
    },
    async ({ projectKey, code, agentName, aiSummary, nextStatus, fixInstructions, subtasksToAdd, commentBody }) => {
      assertNotReviewerOnly("claim_and_plan_issue");
      const normalized = await assertIssueBelongsToProject(code, projectKey, "change_status");
      const resolvedAgent = formatTokenActorIdentity(tokenUser, agentName);
      const existing = await getIssueByCode(normalized);
      if (!existing) {
        return {
          content: [{ type: "text", text: `ไม่พบ Issue รหัส ${normalized}` }],
          isError: true,
        };
      }

      const nextSubtasks: SubtaskItem[] = [...(existing.subtasks || [])];
      if (subtasksToAdd && subtasksToAdd.length > 0) {
        for (const title of subtasksToAdd) {
          if (title.trim()) {
            nextSubtasks.push({
              id: crypto.randomUUID(),
              title: title.trim(),
              completed: false,
              assignee: resolvedAgent,
            });
          }
        }
      }

      const autoApproval = await requireAiFixApproval(normalized, nextStatus);
      await updateIssue(normalized, {
        status: nextStatus,
        assignee: resolvedAgent,
        aiSummary,
        aiFixApproval: autoApproval,
        subtasks: nextSubtasks,
        reviewMeta: fixInstructions
          ? {
              fixInstructions,
            }
          : undefined,
        actor: resolvedAgent,
      });

      if (commentBody && commentBody.trim()) {
        await addIssueComment(normalized, {
          author: resolvedAgent,
          role: "Antigravity Agent",
          body: commentBody.trim(),
        });
      }

      const finalIssue = await getIssueByCode(normalized);
      return {
        content: [{ type: "text", text: JSON.stringify(finalIssue, null, 2) }],
      };
    }
  );

  // 12. converse_on_issue
  server.tool(
    "converse_on_issue",
    "ให้ Antigravity โต้ตอบใน Issue, แนบไฟล์เข้า MinIO, ติ๊ก Subtask และเปลี่ยนสถานะ",
    {
      projectKey: z.string().optional().describe("รหัสโปรเจกต์ เช่น SMLAIACC"),
      code: z.string(),
      agentName: z.string(),
      role: z.string().optional().default("Antigravity Agent"),
      message: z.string(),
      newStatus: z
        .enum(["open", "reviewing", "ready_to_fix", "fixing", "deployed", "wont_fix"])
        .optional(),
      deployResult: z.string().optional(),
      wontFixCategory: WontFixCategorySchema,
      completeSubtaskNumbers: z.array(z.number()).optional(),
      reactionEmoji: z.string().optional(),
      files: z.array(InlineFileSchema).optional(),
    },
    async (args) => {
      const changesWork = Boolean(
        args.newStatus || args.deployResult || args.completeSubtaskNumbers?.length
      );
      const hasMessageOrFiles = Boolean(
        args.message.trim() || (args.files && args.files.length > 0)
      );
      if (!hasMessageOrFiles && !changesWork && !args.reactionEmoji) {
        throw new Error("กรุณาระบุข้อความ (message) แนบไฟล์ หรือระบุการเปลี่ยนแปลงสถานะ");
      }
      const normalized = await assertIssueBelongsToProject(
        args.code,
        args.projectKey,
        changesWork ? "change_status" : "comment"
      );
      const agentName = formatTokenActorIdentity(tokenUser, args.agentName);
      const reactionUser = tokenUser?.ownerEmail || agentName;
      const existing = await getIssueByCode(normalized);
      if (!existing) {
        return {
          content: [{ type: "text", text: `ไม่พบ Issue รหัส ${normalized}` }],
          isError: true,
        };
      }

      // Check the approval gate before any side effect (file uploads, comments)
      const autoApproval = await requireAiFixApproval(normalized, args.newStatus);
      if (args.newStatus === "wont_fix" && existing.status !== "wont_fix") {
        assertValidWontFixCategory(args.wontFixCategory);
      }
      const uploadedFiles = await uploadInlineFiles(
        args.files,
        agentName,
        tokenUser?.ownerEmail
      );

      let updatedSubtasks: SubtaskItem[] | undefined;
      if (args.completeSubtaskNumbers && args.completeSubtaskNumbers.length > 0 && existing.subtasks) {
        const indexSet = new Set(args.completeSubtaskNumbers.map((n) => n - 1));
        updatedSubtasks = existing.subtasks.map((st, idx) =>
          indexSet.has(idx) ? { ...st, completed: true } : st
        );
      }

      let updated = existing;
      if (updatedSubtasks || args.reactionEmoji || args.newStatus || args.deployResult) {
        updated = await updateIssue(normalized, {
          status: args.newStatus,
          wontFixCategory: args.wontFixCategory,
          aiFixApproval: autoApproval,
          subtasks: updatedSubtasks,
          reviewMeta: args.deployResult
            ? {
                fixedBy: agentName,
                fixedAt: new Date().toISOString(),
                deployResult: args.deployResult,
              }
            : undefined,
          toggleReaction: args.reactionEmoji
            ? { emoji: args.reactionEmoji, user: reactionUser }
            : undefined,
          actor: agentName,
        });
      }

      if (hasMessageOrFiles) {
        updated = await addIssueComment(normalized, {
          author: agentName,
          role: "Antigravity Agent",
          body: args.message,
          attachments: uploadedFiles,
          isResolution: args.newStatus === "deployed" || args.newStatus === "wont_fix",
        });
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "conversed",
                code: updated.code,
                currentStatus: updated.status,
                totalComments: updated.comments.length,
                subtasksProgress: `${(updated.subtasks || []).filter((s) => s.completed).length}/${
                  (updated.subtasks || []).length
                }`,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 13. update_issue_status
  server.tool(
    "update_issue_status",
    "อัปเดตสถานะของ Issue, ผู้รับผิดชอบ, เหตุผลรีวิว หรือคำสั่งแก้",
    {
      projectKey: z.string().optional().describe("รหัสโปรเจกต์ เช่น SMLAIACC"),
      code: z.string(),
      status: z
        .enum(["open", "reviewing", "ready_to_fix", "fixing", "deployed", "wont_fix"])
        .optional(),
      priority: z.enum(["critical", "high", "medium", "low"]).optional(),
      assignee: z.string().optional(),
      aiSummary: z.string().optional(),
      wontFixCategory: WontFixCategorySchema,
      actor: z.string().optional().default("Antigravity"),
    },
    async ({ projectKey, code, ...patch }) => {
      const normalized = await assertIssueBelongsToProject(code, projectKey, "change_status");
      const autoApproval = await requireAiFixApproval(normalized, patch.status);
      const updated = await updateIssue(normalized, {
        ...patch,
        aiFixApproval: autoApproval,
        actor: formatTokenActorIdentity(tokenUser, patch.actor),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(updated, null, 2) }],
      };
    }
  );

  // 14. get_monitor_summary
  server.tool(
    "get_monitor_summary",
    "ดึงสถิติ Monitor Dashboard ของโปรเจกต์ที่ระบุ (คิวรอรีวิว, คิวรอแก้, กำลังแก้/Deploy, Deploy แล้ว, ไม่แก้)",
    {
      projectKey: z.string().optional().describe("รหัสโปรเจกต์ เช่น SMLAIACC"),
    },
    async ({ projectKey }) => {
      const stats = await getMonitorStats(listScope(projectKey));
      return {
        content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
      };
    }
  );

  return server;
}
