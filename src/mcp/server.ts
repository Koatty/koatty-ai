/**
 * `koatty-ai mcp` server：同一 Tools 的 MCP 适配。
 *
 * - 工具名使用 koatty_ai_* 前缀，与 koatty_cli 传统 MCP（koatty_*）不冲突；
 * - 计划的会话边界 = MCP 连接（session 对象），连接内签发的计划不能被其他连接应用；
 * - structuredContent 携带完整 v1 envelope，文本内容是同一 JSON 的字符串。
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  CallToolResult,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { buildToolRegistry, runTool } from '../tools';
import { aiOperationResultSchema } from '../result';

export const MCP_SERVER_NAME = 'koatty_ai';

export function createMcpServer(root: string, version = '0.0.0'): Server {
  const session = { id: root };
  const server = new Server({ name: MCP_SERVER_NAME, version }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: buildToolRegistry().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: aiOperationResultSchema,
      annotations: tool.annotations,
    })),
  }));

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request, extra): Promise<CallToolResult> => {
      const tool = buildToolRegistry().find((t) => t.name === request.params.name);
      if (!tool) {
        return {
          content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
          isError: true,
        };
      }
      const result = await runTool(
        tool,
        (request.params.arguments ?? {}) as Record<string, unknown>,
        { projectRoot: root, session, signal: extra.signal }
      );
      const text = JSON.stringify(result);
      return {
        content: [{ type: 'text', text }],
        structuredContent: result as unknown as Record<string, unknown>,
        isError: result.status === 'failed' || result.status === 'cancelled',
      } as CallToolResult;
    }
  );

  return server;
}

/** Connect a server for `root` to stdio (stdout is the protocol channel). */
export async function startStdioServer(root: string, version = '0.0.0'): Promise<Server> {
  const server = createMcpServer(root, version);
  await server.connect(new StdioServerTransport());
  return server;
}
