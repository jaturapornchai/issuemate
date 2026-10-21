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
} from "./issue-service";
import { uploadBufferToMinio } from "./minio";
import type { AttachmentItem, SubtaskItem } from "./types";
import { formatTokenActorIdentity, type McpTokenPublic } from "./mcp-tokens";

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
  uploadedBy: string
): Promise<AttachmentItem[]> {
  if (!files || files.length === 0) return [];
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
    });
    uploaded.push(item);
  }
  return uploaded;
}

export function createIssueMateMcpServer(
  tokenUser?: McpTokenPublic,
  boundProjectKey?: string
): McpServer {
  const server = new McpServer({
    name: "issuemate-devops-mcp-server",
    version: "3.0.0",
  });

  const normalizedBoundProject =
    boundProjectKey && boundProjectKey !== "ALL"
      ? boundProjectKey.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
      : undefined;

  function resolveScopedProjectKey(explicitProjectKey?: string): string | undefined {
    const cleanExplicit = explicitProjectKey
      ? explicitProjectKey.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
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

  function assertIssueBelongsToProject(issueCode: string, explicitProjectKey?: string): string {
    const code = cleanIssueCode(issueCode);
    const issueProjPrefix = code.split("-")[0] || "";
    const targetProj = resolveScopedProjectKey(explicitProjectKey);
    if (targetProj && issueProjPrefix && issueProjPrefix !== targetProj) {
      throw new Error(
        `ป้องกันการทำรายการผิดโปรเจกต์: Issue #${code} อยู่ในโปรเจกต์ [${issueProjPrefix}] แต่ MCP Session นี้ระบุโปรเจกต์ [${targetProj}] เท่านั้น`
      );
    }
    return code;
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
      const [projects, stats] = await Promise.all([
        listProjects(),
        getMonitorStats(targetProj || "ALL"),
      ]);
      const filteredProjects = targetProj
        ? projects.filter((p) => p.key === targetProj)
        : projects;
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
            "2. Antigravity วิเคราะห์สาเหตุ -> เรียก submit_claude_review: ถ้าสั่งแก้จะเปลี่ยนเป็น 'ready_to_fix' พร้อมเหตุผล (reviewReason) และคำสั่งในการแก้/Deploy (fixInstructions, deployCommand); ถ้าไม่แก้จะเปลี่ยนเป็น 'wont_fix' พร้อมเหตุผล",
            "3. Antigravity ดึงรายการที่ status = 'ready_to_fix' -> เรียก claim_for_fix (เปลี่ยนเป็น 'fixing') แล้วแก้โค้ด + ทดสอบ + Deploy จากนั้นเรียก mark_deployed (เปลี่ยนเป็น 'deployed')",
          ],
          validValues: {
            status: ["open", "reviewing", "ready_to_fix", "fixing", "deployed", "wont_fix"],
            type: ["incident", "bug", "deployment", "performance", "security", "feature"],
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
        })),
        queues: {
          pendingReview: stats.openIssues + stats.reviewingIssues,
          pendingClaudeReview: stats.openIssues + stats.reviewingIssues,
          readyForAntigravityFix: stats.readyToFixIssues,
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
    },
    async (args) => {
      const code = assertIssueBelongsToProject(args.code, args.projectKey);
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
        aiSummary:
          args.decision === "fix"
            ? `Antigravity Review: สั่งแก้ (รอแก้) — ${args.reviewReason}`
            : args.decision === "wont_fix"
            ? `Antigravity Review: ไม่แก้ (Won't Fix) — ${args.reviewReason}`
            : `Antigravity กำลังรีวิว: ${args.reviewReason}`,
        actor: reviewer,
      });

      await addIssueComment(code, {
        author: reviewer,
        role: "Antigravity Agent",
        body:
          args.decision === "fix"
            ? `### ✅ ผลรีวิวจาก Antigravity: **สั่งแก้ (สถานะ: รอแก้ \`ready_to_fix\`)**\n- **สาเหตุ/เหตุผล**: ${args.reviewReason}\n- **คำสั่งในการแก้ (สำหรับ Antigravity)**:\n\`\`\`text\n${args.fixInstructions || "-"}\n\`\`\`\n${
                args.deployCommand ? `- **คำสั่ง Deploy**: \`${args.deployCommand}\`` : ""
              }`
            : `### ⛔ ผลรีวิวจาก Antigravity: **ไม่แก้ (สถานะ: \`wont_fix\`)**\n- **เหตุผลที่ไม่แก้**: ${args.reviewReason}`,
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
    "สำหรับ Antigravity: ดึง Issue ที่สถานะ 'ready_to_fix' (รอแก้) ไปเริ่มดำเนินการแก้ไขโค้ดและเตรียม Deploy (เปลี่ยนสถานะเป็น 'fixing')",
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
      const normalized = assertIssueBelongsToProject(code, projectKey);
      const resolvedAgent = formatTokenActorIdentity(tokenUser, agentName);
      const updated = await updateIssue(normalized, {
        status: "fixing",
        assignee: resolvedAgent,
        actor: resolvedAgent,
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
    "สำหรับ Antigravity: บันทึกผลการแก้ไข ทดสอบ และ Deploy ขึ้นเซิร์ฟเวอร์สำเร็จ (เปลี่ยนสถานะเป็น 'deployed' พร้อมติ๊ก Subtasks ทั้งหมด)",
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
      const normalized = assertIssueBelongsToProject(code, projectKey);
      const resolvedAgent = formatTokenActorIdentity(tokenUser, agentName);
      const existing = await getIssueByCode(normalized);
      if (!existing) {
        return {
          content: [{ type: "text", text: `ไม่พบ Issue ${normalized}` }],
          isError: true,
        };
      }

      const nextSubtasks = completeAllSubtasks
        ? (existing.subtasks || []).map((s) => ({ ...s, completed: true }))
        : existing.subtasks;

      const updated = await updateIssue(normalized, {
        status: "deployed",
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
      const projects = await listProjects();
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
        .enum(["all", "incident", "bug", "deployment", "performance", "security", "feature"])
        .optional(),
      priority: z.enum(["all", "critical", "high", "medium", "low"]).optional(),
      search: z.string().optional(),
      limit: z.number().optional(),
    },
    async (args) => {
      const targetProj = resolveScopedProjectKey(args.projectKey);
      const issues = await listIssues({
        ...args,
        projectKey: targetProj,
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
      const normalizedCode = assertIssueBelongsToProject(code, projectKey);
      const issue = await getIssueByCode(normalizedCode);
      if (!issue) {
        return {
          content: [{ type: "text", text: `ไม่พบ Issue รหัส ${code}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
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
      const targetProj = resolveScopedProjectKey(projectKey);
      const similar = await findSimilarIssues(query, targetProj);
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
        .enum(["incident", "bug", "deployment", "performance", "security", "feature"])
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

      const resolvedReporter = formatTokenActorIdentity(
        tokenUser,
        args.reporter || "AI DevOps Agent"
      );
      const uploadedFiles = await uploadInlineFiles(args.files, resolvedReporter);
      const subtaskItems: SubtaskItem[] = (args.subtasks || []).map((t) => ({
        id: crypto.randomUUID(),
        title: t.trim(),
        completed: false,
      }));

      const issue = await createIssue({
        projectKey: normalizedKey,
        title: args.title,
        description: args.description,
        status: args.status,
        type: args.type,
        priority: args.priority,
        reporter: resolvedReporter,
        department: args.department,
        assignee: args.assignee,
        labels: args.labels,
        subtasks: subtaskItems,
        attachments: uploadedFiles,
        devopsMeta: args.devopsMeta,
        reviewMeta: args.reviewMeta,
        aiSummary: args.aiSummary,
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
      const normalized = assertIssueBelongsToProject(code, projectKey);
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
              assignee: agentName,
            });
          }
        }
      }

      await updateIssue(normalized, {
        status: nextStatus,
        assignee: agentName,
        aiSummary,
        subtasks: nextSubtasks,
        reviewMeta: fixInstructions
          ? {
              ...(existing.reviewMeta || {}),
              fixInstructions,
            }
          : undefined,
        actor: agentName,
      });

      if (commentBody && commentBody.trim()) {
        await addIssueComment(normalized, {
          author: agentName,
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
      completeSubtaskNumbers: z.array(z.number()).optional(),
      reactionEmoji: z.string().optional(),
      files: z.array(InlineFileSchema).optional(),
    },
    async (args) => {
      const normalized = assertIssueBelongsToProject(args.code, args.projectKey);
      const existing = await getIssueByCode(normalized);
      if (!existing) {
        return {
          content: [{ type: "text", text: `ไม่พบ Issue รหัส ${normalized}` }],
          isError: true,
        };
      }

      const uploadedFiles = await uploadInlineFiles(args.files, args.agentName);

      let updatedSubtasks: SubtaskItem[] | undefined;
      if (args.completeSubtaskNumbers && args.completeSubtaskNumbers.length > 0 && existing.subtasks) {
        const indexSet = new Set(args.completeSubtaskNumbers.map((n) => n - 1));
        updatedSubtasks = existing.subtasks.map((st, idx) =>
          indexSet.has(idx) ? { ...st, completed: true } : st
        );
      }

      if (updatedSubtasks || args.reactionEmoji || args.newStatus || args.deployResult) {
        await updateIssue(normalized, {
          status: args.newStatus,
          subtasks: updatedSubtasks,
          reviewMeta: args.deployResult
            ? {
                ...(existing.reviewMeta || {}),
                fixedBy: args.agentName,
                fixedAt: new Date().toISOString(),
                deployResult: args.deployResult,
              }
            : undefined,
          toggleReaction: args.reactionEmoji
            ? { emoji: args.reactionEmoji, user: args.agentName }
            : undefined,
          actor: args.agentName,
        });
      }

      const updated = await addIssueComment(normalized, {
        author: args.agentName,
        role: args.role,
        body: args.message,
        attachments: uploadedFiles,
        isResolution: args.newStatus === "deployed" || args.newStatus === "wont_fix",
      });

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
      actor: z.string().optional().default("Antigravity"),
    },
    async ({ projectKey, code, ...patch }) => {
      const normalized = assertIssueBelongsToProject(code, projectKey);
      const updated = await updateIssue(normalized, patch);
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
      const targetProj = resolveScopedProjectKey(projectKey);
      const stats = await getMonitorStats(targetProj);
      return {
        content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
      };
    }
  );

  return server;
}
