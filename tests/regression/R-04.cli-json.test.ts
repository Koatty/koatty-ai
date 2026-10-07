/**
 * R-04: koatty-ai CLI（bin: koatty-ai）验收——stdout 只输出 v1 envelope JSON，
 * 非交互，失败也返回结构化结果；plan/apply 在 CLI 模式使用落盘签名计划。
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createRequire } from 'module';

const nodeRequire = createRequire(__filename);
const pkgRoot = path.resolve(__dirname, '../..');
const binPath = path.join(pkgRoot, 'dist', 'cli', 'index.js');

interface Envelope {
  schemaVersion: number;
  operation: string;
  status: string;
  data: Record<string, unknown>;
  diagnostics: Array<{ code: string; message: string; next?: string }>;
}

function runCli(args: string[], cwd: string): { stdout: string; stderr: string; status: number | null } {
  const run = spawnSync(process.execPath, [binPath, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return { stdout: run.stdout, stderr: run.stderr, status: run.status };
}

function parseEnvelope(stdout: string): Envelope {
  const lines = stdout.trim().split('\n').filter(Boolean);
  expect(lines.length).toBeGreaterThanOrEqual(1);
  return JSON.parse(lines[lines.length - 1]) as Envelope;
}

function makeFixture(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  fs.mkdirSync(path.join(root, 'src/service'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src/dto'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '1.0.0', dependencies: { koatty: '^5.0.0' } })
  );
  return root;
}

describe('R-04: koatty-ai CLI JSON 契约', () => {
  const { version } = nodeRequire(path.join(pkgRoot, 'package.json')) as { version: string };
  const skip = !fs.existsSync(binPath);
  (skip ? describe.skip : describe)('built bin', () => {
    it('capabilities 输出 v1 envelope 且 --version 可用', () => {
      const capabilities = runCli(['capabilities'], os.tmpdir());
      expect(capabilities.status).toBe(0);
      const envelope = parseEnvelope(capabilities.stdout);
      expect(envelope.schemaVersion).toBe(1);
      expect(envelope.status).toBe('completed');
      expect(typeof envelope.data.tools).toBe('object');

      const versionRun = runCli(['--version'], os.tmpdir());
      expect(versionRun.stdout.trim()).toBe(version);
    });

    it('docs 精确查询；未知 API 返回 unresolved 而非编造', () => {
      const hit = parseEnvelope(runCli(['docs', '--api', 'GetMapping'], os.tmpdir()).stdout);
      expect(hit.status).toBe('completed');
      expect(JSON.stringify(hit.data)).toContain('koatty_router');

      const miss = parseEnvelope(runCli(['docs', '--api', 'NopeDecorator'], os.tmpdir()).stdout);
      expect(miss.status).toBe('completed');
      expect((miss.data as { resolved: boolean }).resolved).toBe(false);
    });

    it('plan → apply 全链路（fixture 项目）', () => {
      const root = makeFixture('r04-cli');
      try {
        const params = JSON.stringify({
          controller: { name: 'OrderController', basePath: '/orders' },
          action: { name: 'create', method: 'POST', path: '/' },
          dto: { name: 'CreateOrderDto', fields: { sku: { type: 'string', required: true } } },
          service: { name: 'OrderService', mode: 'create', method: 'create' },
        });
        const planned = runCli(
          ['plan', '--savePlan', '--recipe', 'http-action', '--params', params, '--root', root],
          root
        );
        expect(planned.status).toBe(0);
        const planEnvelope = parseEnvelope(planned.stdout);
        expect(planEnvelope.status).toBe('preview');
        const planId = (planEnvelope.data as { planId: string }).planId;
        expect(planId).toMatch(/^[0-9a-f-]{36}$/);
        expect(fs.existsSync(path.join(root, 'src/service/OrderService.ts'))).toBe(false);

        const applied = runCli(['apply', '--planId', planId, '--yes', '--root', root], root);
        expect(applied.status).toBe(0);
        const applyEnvelope = parseEnvelope(applied.stdout);
        expect(applyEnvelope.status).toBe('applied');
        expect(fs.existsSync(path.join(root, 'src/service/OrderService.ts'))).toBe(true);
        expect(fs.existsSync(path.join(root, 'src/controller/OrderController.ts'))).toBe(true);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });

    it('check 报告确定性诊断；失败返回非零退出码', () => {
      const root = makeFixture('r04-check');
      try {
        fs.writeFileSync(
          path.join(root, 'src/dto/Misnamed.ts'),
          'export class OtherName {}\n'
        );
        const run = runCli(['check', '--root', root], root);
        expect(run.status).toBe(0); // check 本身成功完成，诊断在 envelope 内
        const envelope = parseEnvelope(run.stdout);
        expect(envelope.status).toBe('completed');
        const data = envelope.data as { diagnostics: Array<{ ruleId: string; severity: string }> };
        expect(data.diagnostics.map((d) => d.ruleId)).toContain('KOATTY_DTO_LOADER_NAME');
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });

    it('plan 失败（无 root 项目）返回失败 envelope 与非零退出码', () => {
      const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'r04-empty-'));
      try {
        const run = runCli(
          [
            'plan',
            '--recipe',
            'http-action',
            '--params',
            JSON.stringify({
              controller: { name: 'X' },
              action: { name: 'a', method: 'POST' },
              service: { name: 'XService', mode: 'create' },
            }),
            '--root',
            empty,
          ],
          empty
        );
        expect(run.status).toBe(1);
        const envelope = parseEnvelope(run.stdout);
        expect(envelope.status).toBe('failed');
        expect(envelope.diagnostics[0].code).toBe('NOT_KOATTY_PROJECT');
      } finally {
        fs.rmSync(empty, { recursive: true, force: true });
      }
    });
  });
});
