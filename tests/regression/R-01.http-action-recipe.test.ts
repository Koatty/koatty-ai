import * as fs from 'fs';
import * as path from 'path';

import { buildToolRegistry, runTool, loadRecipes, getRecipe } from '../../src/tools';
import { cleanup, makeKoattyFixture } from '../helpers';

const EXAMPLE_PARAMS = getRecipe('http-action').example as Record<string, unknown>;

function toolFor(command: string) {
  const tool = buildToolRegistry().find((t) => t.command === command);
  if (!tool) throw new Error(`tool not found: ${command}`);
  return tool;
}

describe('R-01: http-action recipe 契约', () => {
  it('recipe 目录只包含已实现能力，引用的 skill 文件真实存在', () => {
    const recipes = loadRecipes();
    expect(recipes.map((r) => r.id)).toContain('http-action');
    const pkgRoot = path.resolve(__dirname, '../..');
    for (const recipe of recipes) {
      expect(recipe.koattyCliApi).toBe('renderHttpActionApi');
      for (const ref of recipe.references) {
        expect(fs.existsSync(path.join(pkgRoot, ref))).toBe(true);
      }
      expect(typeof recipe.example).toBe('object');
      expect(recipe.pending.length).toBeGreaterThan(0);
    }
  });

  it('示例参数通过 inputSchema 并生成签名计划（含待实现项），不落盘', async () => {
    const root = makeKoattyFixture('r01-plan', { service: undefined });
    try {
      const result = await runTool(
        toolFor('plan'),
        { recipe: 'http-action', params: EXAMPLE_PARAMS },
        { projectRoot: root }
      );
      expect(result.status).toBe('preview');
      const data = result.data as {
        planId: string;
        persisted: boolean;
        notes: string[];
        outputs: Array<{ path: string }>;
      };
      expect(data.planId).toMatch(/^[0-9a-f-]{36}$/);
      expect(data.persisted).toBe(true); // CLI 无会话：落盘签名计划
      expect(data.notes.join('\n')).toContain('待实现');
      expect(data.outputs.map((o) => o.path)).toContain('src/service/OrderService.ts');
      // 计划预览不写业务文件
      expect(fs.existsSync(path.join(root, 'src/service/OrderService.ts'))).toBe(false);
    } finally {
      cleanup(root);
    }
  });

  it('apply --yes 落盘；缺少 yes 只预览；计划单次消费', async () => {
    const root = makeKoattyFixture('r01-apply', { service: undefined });
    try {
      const issued = await runTool(
        toolFor('plan'),
        { recipe: 'http-action', params: EXAMPLE_PARAMS },
        { projectRoot: root }
      );
      const planId = (issued.data as { planId: string }).planId;

      const preview = await runTool(toolFor('apply'), { planId }, { projectRoot: root });
      expect(preview.status).toBe('preview');
      expect(fs.existsSync(path.join(root, 'src/service/OrderService.ts'))).toBe(false);

      const applied = await runTool(toolFor('apply'), { planId, yes: true }, { projectRoot: root });
      expect(applied.status).toBe('applied');
      expect(fs.existsSync(path.join(root, 'src/service/OrderService.ts'))).toBe(true);
      expect(fs.existsSync(path.join(root, 'src/controller/OrderController.ts'))).toBe(true);
      // 单次消费：同一 planId 二次 apply 拒绝
      const replay = await runTool(toolFor('apply'), { planId, yes: true }, { projectRoot: root });
      expect(replay.status).toBe('failed');
      expect(replay.diagnostics[0].code).toBe('PLAN_NOT_ISSUED');
    } finally {
      cleanup(root);
    }
  });

  it('引用模式校验服务与方法；GET+DTO 组合拒绝', async () => {
    const root = makeKoattyFixture('r01-ref', {
      service: `import { Service } from 'koatty';\n@Service()\nexport class OrderService {\n  async create(input: unknown) { return input; }\n}\n`,
    });
    try {
      const params = {
        controller: { name: 'OrderController', basePath: '/orders' },
        action: { name: 'create', method: 'POST', path: '/' },
        dto: {
          name: 'CreateOrderDto',
          fields: { sku: { type: 'string', required: true } },
        },
        service: { name: 'OrderService', mode: 'reference', method: 'create' },
      };
      const result = await runTool(
        toolFor('plan'),
        { recipe: 'http-action', params },
        { projectRoot: root }
      );
      expect(result.status).toBe('preview');
      const data = result.data as { resolved: { service: { file: string } } };
      expect(data.resolved.service.file).toBe('src/service/OrderService.ts');

      const rejected = await runTool(
        toolFor('plan'),
        {
          recipe: 'http-action',
          params: { ...params, service: { name: 'OrderService', mode: 'reference', method: 'refund' } },
        },
        { projectRoot: root }
      );
      expect(rejected.diagnostics[0].code).toBe('SERVICE_METHOD_MISSING');

      const combo = await runTool(
        toolFor('plan'),
        {
          recipe: 'http-action',
          params: { ...params, action: { name: 'list', method: 'GET', path: '/' } },
        },
        { projectRoot: root }
      );
      expect(combo.diagnostics[0].code).toBe('UNSUPPORTED_COMBINATION');
    } finally {
      cleanup(root);
    }
  });

  it('未知 recipe 与参数 schema 违规立即拒绝', async () => {
    const root = makeKoattyFixture('r01-unknown');
    try {
      const unknown = await runTool(
        toolFor('plan'),
        { recipe: 'deploy-to-prod' },
        { projectRoot: root }
      );
      expect(unknown.diagnostics[0].code).toBe('RECIPE_NOT_FOUND');
      const bad = await runTool(
        toolFor('plan'),
        { recipe: 'http-action', params: { nope: true } },
        { projectRoot: root }
      );
      expect(bad.diagnostics[0].code).toBe('INVALID_RECIPE_INPUT');
    } finally {
      cleanup(root);
    }
  });
});
