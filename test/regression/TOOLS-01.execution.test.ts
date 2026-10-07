import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { buildToolRegistry, runTool, loadRecipes } from '../../src/tools';
import { runChecks } from '../../src/checks/rules';
import { makeKoattyFixture, cleanup } from '../../tests/helpers';

const bin = path.resolve(__dirname, '../../dist/cli/index.js');
const tool = (command: string) => buildToolRegistry().find((t) => t.command === command)!;
const cli = (root: string, ...args: string[]) => spawnSync(process.execPath, [bin, ...args], { cwd: root, encoding: 'utf8', timeout: 30000 });

describe('TOOLS-01: real tool entrypoints and framework contracts', () => {
  let root: string;
  beforeEach(() => { root = makeKoattyFixture('tools01'); });
  afterEach(() => cleanup(root));

  test('CLI supports --json and every failure is exactly one JSON envelope', () => {
    for (const args of [['capabilities', '--json'], ['docs', '--limit', '2oops'], ['docs', '--unknown'], ['unknown']]) {
      const result = cli(root, ...args);
      const envelope = JSON.parse(result.stdout);
      expect(envelope.schemaVersion).toBe(1);
      expect(result.status).toBe(args[0] === 'capabilities' ? 0 : 1);
    }
  });

  test('recipe preview is write-free, saved plan is explicit, every recipe is callable', async () => {
    for (const recipe of loadRecipes()) {
      const result = await runTool(tool('plan'), { recipe: recipe.id, params: recipe.example }, { projectRoot: root });
      expect(result.status).toBe('preview');
      expect((result.data as { persisted: boolean }).persisted).toBe(false);
      expect(fs.existsSync(path.join(root, '.koatty'))).toBe(false);
    }
    const recipe = loadRecipes().find((r) => r.id === 'component')!;
    const issued = await runTool(tool('plan'), { recipe: recipe.id, params: recipe.example, savePlan: true }, { projectRoot: root });
    const planId = (issued.data as { planId: string }).planId;
    expect((await runTool(tool('apply'), { planId, yes: true }, { projectRoot: root })).status).toBe('applied');
    expect(fs.existsSync(path.join(root, 'src/service/BillingService.ts'))).toBe(true);
  });

  test('actual stdio process advertises output schemas and enforces connection root', async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [bin, 'mcp', '--root', root], stderr: 'pipe' });
    const client = new Client({ name: 'tools01', version: '1' });
    try {
      await client.connect(transport);
      const listed = await client.listTools();
      expect(listed.tools.every((t) => !!t.outputSchema)).toBe(true);
      const recipe = loadRecipes().find((r) => r.id === 'component')!;
      const issued = await client.callTool({ name: 'koatty_ai_plan', arguments: { recipe: recipe.id, params: recipe.example } });
      expect(issued.isError).toBe(false);
      expect(fs.existsSync(path.join(root, '.koatty'))).toBe(false);
      const planId = (issued.structuredContent as { data: { planId: string } }).data.planId;
      const applied = await client.callTool({ name: 'koatty_ai_apply', arguments: { planId, yes: true } });
      expect(applied.isError).toBe(false);
      const replay = await client.callTool({ name: 'koatty_ai_apply', arguments: { planId, yes: true } });
      expect(replay.isError).toBe(true);
      const escaped = await client.callTool({ name: 'koatty_ai_docs', arguments: { root: path.dirname(root), api: 'Service' } });
      expect(escaped.isError).toBe(true);
    } finally { await client.close(); }
  }, 30000);

  test('route prefixes, decorator aliases and non-framework decorators are distinguished', () => {
    const write = (name: string, prefix: string, pkg = 'koatty') => fs.writeFileSync(path.join(root, 'src/controller', name + '.ts'), `import {Controller as C, GetMapping as Get} from '${pkg}'; @C('${prefix}') export class ${name} { @Get('/:id') get() {} }`);
    write('One', '/one'); write('Two', '/two'); write('Other', '/one', 'another-framework');
    expect(runChecks(root).filter((d) => d.ruleId === 'KOATTY_DUP_ROUTE')).toHaveLength(0);
    write('Two', '/one');
    expect(runChecks(root).filter((d) => d.ruleId === 'KOATTY_DUP_ROUTE')).toHaveLength(2);
  });

  test('IOC aliases are detected, shadowed bindings are not; Validated positions checked', () => {
    fs.writeFileSync(path.join(root, 'src/service/Good.ts'), `import { IOC as container } from 'koatty_container'; export function use(container: any) { return container.get('x'); }`);
    expect(runChecks(root).filter((d) => d.ruleId === 'KOATTY_GLOBAL_IOC')).toHaveLength(0);
    fs.writeFileSync(path.join(root, 'src/service/Bad.ts'), `import { IOC as container } from 'koatty_container'; export const x = container.get('x');`);
    expect(runChecks(root).filter((d) => d.ruleId === 'KOATTY_GLOBAL_IOC')).toHaveLength(1);
    fs.writeFileSync(path.join(root, 'src/controller/Typed.ts'), `import {Validated as V} from 'koatty_validation'; class Dto {} export class Typed { @V({types:[Dto]}) update(id:number, dto:Dto) {} }`);
    expect(runChecks(root).filter((d) => d.ruleId === 'KOATTY_VALIDATED_PARAMETERS')).toHaveLength(1);
  });

  test('source symlinks cannot escape the project during framework checks', () => {
    fs.symlinkSync(path.dirname(root), path.join(root, 'src/outside'));
    expect(() => runChecks(root)).toThrow(/symlink/);
  });

  test('Skill install previews, is idempotent and preserves local changes', async () => {
    const ctx = {projectRoot:root};
    expect((await runTool(tool('skill'),{},ctx)).status).toBe('preview');
    expect(fs.existsSync(path.join(root,'.agents'))).toBe(false);
    expect((await runTool(tool('skill'),{yes:true},ctx)).status).toBe('applied');
    expect((await runTool(tool('skill'),{yes:true},ctx)).status).toBe('completed');
    const file = path.join(root,'.agents/skills/koatty/SKILL.md');
    fs.writeFileSync(file,'local instructions');
    const conflict = await runTool(tool('skill'),{yes:true},ctx);
    expect(conflict.diagnostics[0].code).toBe('SKILL_CONFLICT');
    expect(fs.readFileSync(file,'utf8')).toBe('local instructions');
  });

  test('docs package filter and bundled guide return useful knowledge', async () => {
    const result = await runTool(tool('docs'), { package: 'koatty_validation' }, { projectRoot: root });
    expect((result.data as { hits: unknown[] }).hits.length).toBeGreaterThan(0);
    const guide = await runTool(tool('docs'), { guide: 'http-dto' }, { projectRoot: root });
    expect((guide.data as { content: string }).content).toContain('Validated');
  });
});
