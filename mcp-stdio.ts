import path from "path";
import { fileURLToPath } from "url";

process.chdir(path.dirname(fileURLToPath(import.meta.url)));

async function main(): Promise<void> {
  const { createIssueMateMcpServer } = await import("./lib/mcp-server");
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const server = createIssueMateMcpServer();
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error("[issuemate-mcp] fatal:", err);
  process.exit(1);
});
