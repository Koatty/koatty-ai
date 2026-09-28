/**
 * E-03 / E-04 regression tests (roadmap Phase E).
 *
 * - E-3: `koatty new` templates ship AGENTS.md / .cursor/rules/koatty.mdc / llms.txt.
 * - E-4: every generated module ships a runnable test skeleton, and generated
 *   projects get a working jest + ts-jest setup.
 *
 * The templates are rendered through the real TemplateManager so the assertions
 * cover the shipped files, not a copy.
 *
 * @License MIT
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TemplateManager } from '../../src/services/TemplateManager';
import { GeneratorPipeline } from '../../src/pipeline/GeneratorPipeline';
import { SpecParser } from '../../src/parser/SpecParser';

const PROJECT_TEMPLATE = path.join(__dirname, '..', '..', 'templates', 'project', 'default');
const INLINE_SPEC = 'module: article\nfields:\n  id:\n    type: number\n    primary: true\n';

describe('E-03: AI-facing project documentation templates', () => {
  test('the project template ships the AI docs and is fully rendered', async () => {
    const manager = new TemplateManager();
    const files = await manager.renderDirectory(PROJECT_TEMPLATE, { projectName: 'demo-app' });

    const byPath = new Map(files.map((file) => [file.path, file.content as string]));
    for (const expected of [
      'AGENTS.md',
      '.cursor/rules/koatty.mdc',
      'llms.txt',
      'jest.config.js',
      'test/smoke.test.ts',
    ]) {
      expect(byPath.has(expected)).toBe(true);
    }

    const agents = byPath.get('AGENTS.md')!;
    expect(agents).toContain('禁止事项');
    expect(agents).toContain('npx koatty manifest');
    expect(agents).toContain('npx koatty mcp');
    expect(agents).not.toContain('{{');

    const cursorRule = byPath.get('.cursor/rules/koatty.mdc')!;
    expect(cursorRule).toContain('alwaysApply: false');
    expect(cursorRule).toContain('src/**/*.ts');

    const llms = byPath.get('llms.txt')!;
    expect(llms).toContain('# demo-app');
    expect(llms).toContain('AGENTS.md');

    // Rendered docs must never contain template placeholders or config values.
    for (const file of [agents, cursorRule, llms]) {
      expect(file).not.toMatch(/\{\{\s*\w+\s*\}\}/);
    }

    const jestConfig = byPath.get('jest.config.js')!;
    expect(jestConfig).toContain("preset: 'ts-jest'");
    expect(byPath.get('test/smoke.test.ts')).toContain("describe('demo-app'");
  });
});

describe('E-04: generated modules ship a test skeleton', () => {
  let root: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'koatty-e04-'));
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'e04-fixture', scripts: {} }),
      'utf-8'
    );
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('the pipeline adds test/<module>.test.ts next to the service', async () => {
    const pipeline = new GeneratorPipeline(SpecParser.parseYaml(INLINE_SPEC), {
      workingDirectory: root,
    });
    const changeset = (await pipeline.execute()).toJSON();
    const paths = changeset.changes.map((change) => change.path);

    expect(paths).toContain('test/article.test.ts');
    expect(paths).toContain('src/service/ArticleService.ts');
    // The skeleton must not be written by a plan run.
    expect(fs.existsSync(path.join(root, 'test', 'article.test.ts'))).toBe(false);

    const skeleton = changeset.changes.find((change) => change.path === 'test/article.test.ts')!;
    expect(skeleton.type).toBe('create');
    expect(skeleton.content).toContain("import { ArticleService } from '../src/service/ArticleService'");
    expect(skeleton.content).toContain("describe('ArticleService'");
    expect(skeleton.content).toContain('exposes the generated CRUD API');
    expect(skeleton.content).not.toContain('{{');
  });

  test('the generated test skeleton is collectible by the project jest config', async () => {
    const manager = new TemplateManager();
    const files = await manager.renderDirectory(PROJECT_TEMPLATE, { projectName: 'e04-fixture' });
    const jestConfig = files.find((file) => file.path === 'jest.config.js')!;

    // roots: test/ + testMatch **/*.test.ts must match test/article.test.ts
    expect(jestConfig.content as string).toContain("'<rootDir>/test'");
    expect(jestConfig.content as string).toContain("'**/*.test.ts'");
    expect('test/article.test.ts'.endsWith('.test.ts')).toBe(true);
  });
});
