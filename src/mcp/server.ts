/**
 * `koatty mcp` server wiring (roadmap Phase E, item E-2).
 *
 * The server speaks MCP over stdio so Cursor / Claude Code can attach to a
 * Koatty project. Only the tools declared in ./tools are exposed; no shell
 * tool, no filesystem access outside the project root.
 *
 * @License MIT
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  CallToolResult,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { callToolSafe, listTools, McpToolContext } from './tools';

export const MCP_SERVER_NAME = 'koatty';

/**
 * Create (but do not connect) the MCP server for a project root. Tests connect
 * it to an in-memory transport pair; the CLI connects it to stdio.
 */
export function createMcpServer(root: string, version = '0.0.0'): Server {
  const ctx: McpToolContext = { root };
  const server = new Server({ name: MCP_SERVER_NAME, version }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: listTools() }));

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request, extra): Promise<CallToolResult> =>
      callToolSafe(
        request.params.name,
        (request.params.arguments ?? {}) as Record<string, unknown>,
        { ...ctx, session: ctx, signal: extra.signal }
      )
  );

  return server;
}

/** Connect a server for `root` to stdio (stdout is the protocol channel). */
export async function startStdioServer(root: string, version = '0.0.0'): Promise<Server> {
  const server = createMcpServer(root, version);
  await server.connect(new StdioServerTransport());
  return server;
}
