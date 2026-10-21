import { NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createIssueMateMcpServer } from "@/lib/mcp-server";
import { verifyMcpRequestToken, getMcpAuthSettings } from "@/lib/mcp-tokens";

export const runtime = "nodejs";

function ensureMcpAcceptHeader(req: Request): Request {
  const accept = req.headers.get("accept") || "";
  if (accept.includes("application/json") && accept.includes("text/event-stream")) {
    return req;
  }
  const headers = new Headers(req.headers);
  headers.set("accept", "application/json, text/event-stream");
  if (!headers.get("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Request(req.url, {
    method: req.method,
    headers,
    body: req.body,
    // @ts-expect-error Node fetch duplex option
    duplex: "half",
  });
}

export async function POST(req: Request) {
  try {
    const authCheck = await verifyMcpRequestToken(req);
    if (!authCheck.allowed) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32001,
            message: authCheck.error || "Unauthorized MCP Token",
          },
          id: null,
        },
        { status: 401 }
      );
    }

    const normalizedReq = ensureMcpAcceptHeader(req);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const mcpServer = createIssueMateMcpServer(
      authCheck.tokenRecord,
      authCheck.boundProjectKey
    );
    await mcpServer.connect(transport);
    return await transport.handleRequest(normalizedReq);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "MCP Server Error";
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32603, message },
        id: null,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const settings = await getMcpAuthSettings().catch(() => ({
    enforceTokenAuth: false,
  }));
  return NextResponse.json({
    name: "issuemate-devops-mcp-server",
    version: "3.0.0",
    protocol: "Model Context Protocol (Streamable HTTP JSON-RPC 2.0)",
    endpoints: ["/mcp", "/api/mcp"],
    tokenAuth: {
      supported: true,
      enforceTokenAuth: settings.enforceTokenAuth,
      methods: [
        "Authorization: Bearer ism_live_<token> + X-MCP-Project: <PROJECT_KEY>",
        "x-mcp-token: ism_live_<token>",
        "/mcp?project=<PROJECT_KEY>&token=ism_live_<token>",
      ],
    },
    pipeline:
      "1. open (รอรีวิว) -> 2. reviewing (Antigravity รีวิว) -> 3. ready_to_fix (รอแก้) / 6. wont_fix (ไม่แก้) -> 4. fixing (กำลังแก้/Deploy) -> 5. deployed (Deploy แล้ว)",
    tools: [
      "get_ai_context",
      "submit_claude_review",
      "claim_for_fix",
      "mark_deployed",
      "list_projects",
      "create_project",
      "list_issues",
      "get_issue",
      "find_similar_issues",
      "create_issue",
      "claim_and_plan_issue",
      "converse_on_issue",
      "update_issue_status",
      "get_monitor_summary",
    ],
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, x-mcp-token, x-mcp-project, x-project-key, mcp-session-id",
    },
  });
}

export async function DELETE() {
  return NextResponse.json({ ok: true });
}
