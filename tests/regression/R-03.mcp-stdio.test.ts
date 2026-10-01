/**
 * R-03: koatty-ai MCP server（stdio）验收——与 Skill+MCP 接入路径一致。
 * 通过 InMemoryTransport 对连接做黑盒断言：工具清单、envelope 契约、
 * 会话边界（连接 A 签发的计划不能被连接 B 应用）。
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createRequire } from 'module';
import * as path from 'path';

const nodeRequire = createRequire(__filename);
const pkgRoot = path.resolve(__dirname, '../..');
const { version } = nodeRequire(path.join(pkgRoot, 'package.json')) as { version: string };

// 通过库入口创建 server（等同 CLI 连接 stdio 的装配）
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createMcpServer } = nodeRequire('../../dist/index.js') as typeof import('../../src/index');

async function connect(): Promise<Client> {
  const client = new Client({ name: 'test-client', version });
  const server = createMcpServer(process.cwd(), version);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe('R-03: koatty-ai MCP server', () => {
  it('listTools 暴露 koatty_ai_* 工具且 schema 完整', async () => {
    const client = await connect();
    try {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);
      for (const expected of [
        'koatty_ai_capabilities',
        'koatty_ai_docs',
        'koatty_ai_recipes',
        'koatty_ai_plan',
        'koatty_ai_apply',
        'koatty_ai_check',
        'koatty_ai_verify',
      ]) {
        expect(names).toContain(expected);
      }
      const plan = tools.find((t) => t.name === 'koatty_ai_plan');
      expect(typeof plan?.inputSchema).toBe('object');
    } finally {
      await client.close();
    }
  });

  it('callTool 返回 v1 envelope（structuredContent）且校验失败可读', async () => {
    const client = await connect();
    try {
      const result = await client.callTool({ name: 'koatty_ai_docs', arguments: { api: 'Validated' } });
      expect(result.isError).toBeFalsy();
      const envelope = result.structuredContent as { schemaVersion: number; status: string; data: { hits: unknown[] } };
      expect(envelope.schemaVersion).toBe(1);
      expect(envelope.status).toBe('completed');
      expect(envelope.data.hits.length).toBeGreaterThan(0);

      const bad = await client.callTool({
        name: 'koatty_ai_docs',
        arguments: { limit: 'many' },
      });
      expect(bad.isError).toBe(true);
      const badEnvelope = bad.structuredContent as { status: string; diagnostics: Array<{ code: string }> };
      expect(badEnvelope.status).toBe('failed');
      expect(badEnvelope.diagnostics[0].code).toBe('INVALID_ARGUMENT');
    } finally {
      await client.close();
    }
  });

  it('计划会话边界：连接 A 签发，连接 B 不能应用', async () => {
    const clientA = await connect();
    const clientB = await connect();
    try {
      const issued = await clientA.callTool({
        name: 'koatty_ai_recipes',
        arguments: { id: 'http-action' },
      });
      const recipe = (issued.structuredContent as { data: { recipe: { example: Record<string, unknown> } } }).data.recipe;

      const planned = await clientA.callTool({
        name: 'koatty_ai_plan',
        arguments: { recipe: 'http-action', params: recipe.example },
      });
      const planId = (
        (planned.structuredContent as { data: { planId: string } }).data
      ).planId;
      expect(planId).toBeTruthy();

      const stolen = await clientB.callTool({
        name: 'koatty_ai_apply',
        arguments: { planId, yes: true },
      });
      const stolenEnvelope = stolen.structuredContent as { status: string; diagnostics: Array<{ code: string }> };
      expect(stolenEnvelope.status).toBe('failed');
      expect(stolenEnvelope.diagnostics[0].code).toBe('PLAN_NOT_ISSUED');
    } finally {
      await clientA.close();
      await clientB.close();
    }
  });
});
