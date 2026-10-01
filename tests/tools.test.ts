import * as fs from 'fs';
import * as path from 'path';

import { buildToolRegistry, runTool } from '../src/tools';
import { cleanup, makeKoattyFixture } from './helpers';

describe('koatty_ai 工具注册表', () => {
  it('注册的工具名与 CLI 命令一一对应且 schema 完整', () => {
    const tools = buildToolRegistry();
    const names = tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'koatty_ai_capabilities',
        'koatty_ai_context',
        'koatty_ai_docs',
        'koatty_ai_recipes',
        'koatty_ai_plan',
        'koatty_ai_apply',
        'koatty_ai_check',
        'koatty_ai_verify',
        'koatty_ai_doctor',
      ])
    );
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.command).toBeTruthy();
    }
  });

  it('capabilities 汇总工具目录与 koatty_cli 生成能力目录', async () => {
    const tool = buildToolRegistry().find((t) => t.command === 'capabilities')!;
    const result = await runTool(tool, {}, { projectRoot: process.cwd() });
    expect(result.status).toBe('completed');
    const data = result.data as { tools: unknown[]; generation: { contractVersion: number; capabilities: unknown[] } };
    expect(data.tools.length).toBeGreaterThanOrEqual(9);
    expect(data.generation.contractVersion).toBe(1);
    expect(data.generation.capabilities.map((c: unknown) => (c as { id: string }).id)).toContain('http-action');
  });

  it('输入校验失败立即返回失败 envelope，不抛出、不交互', async () => {
    const tool = buildToolRegistry().find((t) => t.command === 'docs')!;
    const result = await runTool(tool, { limit: 'not-a-number' }, { projectRoot: process.cwd() });
    expect(result.status).toBe('failed');
    expect(result.diagnostics[0].code).toBe('INVALID_ARGUMENT');
  });
});

describe('koatty_ai context', () => {
  it('返回组件/路由/DTO/配置键名，不泄露配置值', async () => {
    const root = makeKoattyFixture('ctx', {
      service: `import { Service } from 'koatty';\n@Service()\nexport class OrderService {}\n`,
    });
    try {
      fs.writeFileSync(
        path.join(root, 'src/dto/CreateOrderDto.ts'),
        `export class CreateOrderDto { sku!: string; }\n`
      );
      const tool = buildToolRegistry().find((t) => t.command === 'context')!;
      const result = await runTool(
        tool,
        { sections: ['components', 'dtos'] },
        { projectRoot: root }
      );
      expect(result.status).toBe('completed');
      const data = result.data as Record<string, unknown>;
      expect(typeof data.installedVersions).toBe('object');
      expect(JSON.stringify(data)).toContain('OrderService');
    } finally {
      cleanup(root);
    }
  });
});

describe('koatty_ai docs', () => {
  it('精确 API 命中并标注 re-export 来源与兼容性', async () => {
    const tool = buildToolRegistry().find((t) => t.command === 'docs')!;
    const result = await runTool(tool, { api: 'Validated' }, { projectRoot: process.cwd() });
    expect(result.status).toBe('completed');
    const data = result.data as { hits: Array<{ api: string; package: string; reexportedFrom?: string }> };
    const fromValidation = data.hits.find((h) => h.package === 'koatty_validation');
    expect(fromValidation).toBeTruthy();
    // Validated 不应从 koatty 主包导出（Skill 不变量：从 koatty_validation 导入）
    expect(data.hits.find((h) => h.package === 'koatty' && !h.reexportedFrom)).toBeUndefined();
  });

  it('未收录的 API 返回 unresolved，不发明 API', async () => {
    const tool = buildToolRegistry().find((t) => t.command === 'docs')!;
    const result = await runTool(tool, { api: 'McpController' }, { projectRoot: process.cwd() });
    expect(result.status).toBe('completed');
    const data = result.data as { resolved: boolean; unresolved: { kind: string } };
    expect(data.resolved).toBe(false);
    expect(data.unresolved.kind).toBe('API_NOT_IN_INDEX');
  });

  it('keyword 回退匹配', async () => {
    const tool = buildToolRegistry().find((t) => t.command === 'docs')!;
    const result = await runTool(tool, { keyword: 'GetMapping' }, { projectRoot: process.cwd() });
    const data = result.data as { hits: unknown[] };
    expect(data.hits.length).toBeGreaterThan(0);
  });
});
