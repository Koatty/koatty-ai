import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  preparePlan,
  applyPlan,
  savePlan,
  loadPlan,
  applySavedPlan,
} from '../../src/operations/plans';
import { runCheck, verifyProject } from '../../src/operations/verify';
import { collectManifest, validateManifest } from '../../src/manifest';
import { callToolSafe } from '../../src/mcp/tools';
import { Command } from 'commander';
import { registerApplyCommand } from '../../src/cli/commands/apply';
import { queryManifest } from '../../src/operations/inspect';

describe('G-01: AI development contracts', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'koatty-g01-'));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    process.exitCode = 0;
    jest.restoreAllMocks();
  });
  const change = () => ({
    id: 'test',
    timestamp: 'test',
    module: 'hello',
    changes: [{ type: 'create', path: 'src/Hello.ts', content: 'export const hello = 1;' }],
  });

  test('preview writes nothing; signed plans survive a new reader and cannot be tampered or replayed', () => {
    const plan = preparePlan(root, change());
    expect(applyPlan(root, plan).dryRun).toBe(true);
    expect(fs.readdirSync(root)).toEqual([]);
    const id = savePlan(root, plan);
    expect(loadPlan(root, id).hash).toBe(plan.hash);
    const file = path.join(root, '.koatty/plans', `${id}.json`);
    const original = fs.readFileSync(file, 'utf8');
    const tampered = JSON.parse(original);
    const payload = JSON.parse(tampered.payload);
    payload.changeset.changes[0].content = 'tampered';
    tampered.payload = JSON.stringify(payload);
    fs.writeFileSync(file, JSON.stringify(tampered));
    expect(() => loadPlan(root, id)).toThrow(/signature/);
    fs.writeFileSync(file, original);
    applySavedPlan(root, id, false);
    expect(fs.readFileSync(path.join(root, 'src/Hello.ts'), 'utf8')).toBe(
      'export const hello = 1;'
    );
    expect(() => applySavedPlan(root, id, false)).toThrow(/consumed/);
  });

  test('source changes invalidate saved plans and explicit changes never overwrite a concurrent edit', () => {
    const plan = preparePlan(root, change());
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src/Other.ts'), 'concurrent');
    expect(() => applyPlan(root, plan, false)).toThrow(/changed since plan/);
    expect(fs.existsSync(path.join(root, 'src/Hello.ts'))).toBe(false);
    fs.writeFileSync(path.join(root, 'src/Hello.ts'), 'user code');
    expect(() => preparePlan(root, change())).toThrow(/overwrite/);
    expect(() =>
      preparePlan(root, {
        ...change(),
        changes: [{ type: 'modify', path: 'src/Hello.ts', content: 'new', originalContent: 'old' }],
      })
    ).toThrow(/changed/);
  });

  test('missing installed tools fail without invoking npx or accepting zero checks', async () => {
    expect((await runCheck(root, 'test')).code).toBe('DEPENDENCY_MISSING');
    expect((await verifyProject(root)).status).toBe('failed');
    await expect(verifyProject(root, { checks: [] })).rejects.toThrow();
  });

  test('CLI apply reports written but failed verification, with a failing exit code', async () => {
    fs.writeFileSync(path.join(root, 'change.json'), JSON.stringify(change()));
    const output: string[] = [];
    jest.spyOn(process.stdout, 'write').mockImplementation((text: any) => {
      output.push(String(text));
      return true;
    });
    const command = new Command();
    registerApplyCommand(command);
    await command.parseAsync([
      'node',
      'koatty',
      'apply',
      '--root',
      root,
      '--changeset',
      'change.json',
      '--yes',
      '--json',
    ]);
    const receipt = JSON.parse(output.join(''));
    expect(process.exitCode).toBe(1);
    expect(receipt.status).toBe('failed');
    expect(receipt.data.written).toContain('src/Hello.ts');
    expect(receipt.data.verification.data.passed).toBe(false);
  });

  test('MCP emits structured failure and stable dependency diagnostics', async () => {
    const reply = await callToolSafe('koatty_verify', { checks: ['test'] }, { root });
    expect(reply.isError).toBe(true);
    expect((reply.structuredContent as any).status).toBe('failed');
    expect((reply.structuredContent as any).diagnostics[0].code).toBe('DEPENDENCY_MISSING');
  });

  test('manifest queries are bounded and framework documentation is available without project docs', async () => {
    const manifest = collectManifest(
      path.resolve(__dirname, '../../../koatty/examples/mcp-order-service')
    );
    const page = queryManifest(manifest, { section: 'tools', limit: 1 }) as any;
    expect(page.items).toHaveLength(1);
    expect(page.nextOffset).toBe(1);
    expect((queryManifest(manifest, { section: 'tools', name: 'refund' }) as any).matched).toBe(1);
    expect(() => queryManifest(manifest, { section: 'tools', limit: 201 })).toThrow();
    expect(() => queryManifest(manifest, { name: 'refund' })).toThrow();
    const reply = await callToolSafe(
      'koatty_docs',
      { scope: 'framework', topic: 'checkpoint' },
      { root }
    );
    expect(reply.isError).not.toBe(true);
    expect((reply.structuredContent as any).data.matched).toBeGreaterThan(0);
  });

  test('discovers real reference MCP tools and records dynamic declaration gaps', () => {
    const reference = collectManifest(
      path.resolve(__dirname, '../../../koatty/examples/mcp-order-service')
    );
    expect(validateManifest(reference)).toEqual([]);
    expect(reference.mcp?.tools.map((tool) => tool.name)).toEqual([
      'order_list',
      'order_query',
      'order_refund',
    ]);
    expect(reference.mcp?.resources[0].uri).toBe('order://{orderNo}');
    expect(reference.mcp?.tools.find((tool) => tool.name === 'order_refund')).toMatchObject({
      requireApproval: true,
      scopes: ['order:refund'],
      dto: 'RefundDto',
    });
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(
      path.join(root, 'src/Tools.ts'),
      `import {Tool as Action} from 'koatty_mcp';
      @Service() class Tools { @Action(config.secret) dynamic() {} @Action({name:'fixed',scopes: config.scopes}) fixed() {} }`
    );
    const manifest = collectManifest(root);
    expect(manifest.mcp?.coverage).toBe('partial');
    expect(manifest.unresolved.some((item) => item.kind === 'mcp.options')).toBe(true);
    expect(JSON.stringify(manifest)).not.toContain('config.secret');
  });
});
