import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { scaffoldProject } from '../../src/operations/scaffold';
import { TemplateManager } from '../../src/services/TemplateManager';

/** Real generated TypeScript/Jest with installed workspace dependencies, not an npm installation test. */
describe('G-02 generated applications', () => {
  const repo = path.resolve(__dirname, '../../../..');
  let parent: string;
  beforeEach(() => {
    parent = fs.mkdtempSync(path.join(os.tmpdir(), 'koatty-recipes-'));
  });
  afterEach(() => {
    fs.rmSync(parent, { recursive: true, force: true });
  });
  function linkDependencies(root: string) {
    const modules = path.join(root, 'node_modules');
    fs.mkdirSync(modules);
    const sources = [
      'packages/koatty-ai/node_modules',
      'packages/koatty/examples/mcp-order-service/node_modules',
      'node_modules',
    ];
    for (const source of sources) {
      for (const name of fs.readdirSync(path.join(repo, source))) {
        if (name.startsWith('.')) continue;
        const target = path.join(modules, name);
        if (!fs.existsSync(target)) fs.symlinkSync(path.join(repo, source, name), target, 'dir');
      }
    }
    for (const name of fs.readdirSync(path.join(repo, 'packages'))) {
      const location = path.join(repo, 'packages', name);
      const manifest = path.join(location, 'package.json');
      if (!fs.existsSync(manifest)) continue;
      const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      const target = path.join(modules, pkg.name);
      if (!fs.existsSync(target)) fs.symlinkSync(location, target, 'dir');
    }
  }
  test('offline template digest pins output and rejects a wrong snapshot', async () => {
    const selected = await new TemplateManager().resolveTemplate('project', { offline: true });
    const first = await scaffoldProject('fixture', path.join(parent, 'one'), {
      offline: true,
      digest: selected.sha256,
    });
    const second = await scaffoldProject('fixture', path.join(parent, 'two'), {
      offline: true,
      digest: selected.sha256,
    });
    expect(first.outputSha256).toBe(second.outputSha256);
    await expect(
      scaffoldProject('fixture', path.join(parent, 'bad'), { offline: true, digest: 'bad' })
    ).rejects.toThrow(/digest/);
    expect(fs.existsSync(path.join(parent, 'bad'))).toBe(false);
  });

  test.each(['mcp', 'agent'])(
    '%s recipe compiles and its SDK client tests run',
    async (recipe) => {
      const root = path.join(parent, recipe);
      await scaffoldProject('fixture', root, { template: recipe, offline: true });
      linkDependencies(root);
      const tsc = require.resolve('typescript/bin/tsc');
      const jest = require.resolve('jest/bin/jest');
      try {
        execFileSync(
          process.execPath,
          [tsc, '-p', path.join(root, 'tsconfig.json'), '--pretty', 'false'],
          { cwd: root, stdio: 'pipe', timeout: 30000, killSignal: 'SIGKILL' }
        );
        execFileSync(process.execPath, [jest, '--runInBand', '--coverage=false'], {
          cwd: root,
          stdio: 'pipe',
          timeout: 30000,
          killSignal: 'SIGKILL',
        });
      } catch (error: any) {
        throw new Error(String(error.stdout) + String(error.stderr));
      }
    },
    120000
  );
});
