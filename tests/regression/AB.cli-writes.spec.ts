import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveInside } from '../../src/utils/sandbox';
import { ensureBackupInGitignore } from '../../src/utils/gitignore';
import { FileOperator } from '../../src/utils/FileOperator';
import { addProtocolToServerConfig } from '../../src/utils/serverConfigPatcher';

describe('AB-01/02: all CLI writes stay inside the project', () => {
  let dir: string, root: string, outside: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'koatty-ab-cli-'));
    root = path.join(dir, 'project'); outside = path.join(dir, 'outside');
    fs.mkdirSync(root); fs.mkdirSync(outside);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
  test('rejects a dangling leaf symlink', () => {
    const external = path.join(outside, 'new.txt');
    fs.symlinkSync(external, path.join(root, 'link'));
    expect(() => resolveInside(root, 'link')).toThrow();
    expect(fs.existsSync(external)).toBe(false);
  });
  test('rejects a dangling ancestor symlink', () => {
    fs.symlinkSync(path.join(outside, 'missing'), path.join(root, 'link'));
    expect(() => resolveInside(root, 'link/new.txt')).toThrow();
  });
  test('legitimate dot-dot prefixed filenames are allowed', () => {
    expect(resolveInside(root, '..notes')).toBe(path.join(root, '..notes'));
  });
  test('gitignore helper refuses an external symlink', () => {
    const external = path.join(outside, 'ignore'); fs.writeFileSync(external, 'untouched');
    fs.symlinkSync(external, path.join(root, '.gitignore'));
    expect(() => ensureBackupInGitignore(root)).toThrow();
    expect(fs.readFileSync(external, 'utf8')).toBe('untouched');
  });
  test('protocol patch helper enforces its own boundary', () => {
    fs.mkdirSync(path.join(root, 'src/config'), { recursive: true });
    const external = path.join(outside, 'server.ts'); fs.writeFileSync(external, 'export default { protocol: "http" };');
    fs.symlinkSync(external, path.join(root, 'src/config/server.ts'));
    expect(() => addProtocolToServerConfig(root, 'graphql')).toThrow();
    expect(fs.readFileSync(external, 'utf8')).toContain('protocol: "http"');
  });
  test('extensionless backups stay beside the target, independent of cwd', () => {
    const target = path.join(root, '.env');
    fs.writeFileSync(target, 'original');
    let backup = '';
    FileOperator.writeFile(target, 'replacement', true, p => { backup = p; }, root);
    expect(path.dirname(backup)).toBe(root);
    expect(path.basename(backup)).toMatch(/^\.env\.bak\.\d{6}$/);
    expect(fs.readFileSync(backup, 'utf8')).toBe('original');
  });
  test('backup target cannot follow an external symlink', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 28, 12, 34, 56).getTime());
    try {
      const target = path.join(root, 'a.ts'), external = path.join(outside, 'backup');
      fs.writeFileSync(target, 'original'); fs.writeFileSync(external, 'untouched');
      fs.symlinkSync(external, path.join(root, 'a.bak.123456.ts'));
      expect(() => FileOperator.writeFile(target, 'replacement', true)).toThrow();
      expect(fs.readFileSync(external, 'utf8')).toBe('untouched');
      expect(fs.readFileSync(target, 'utf8')).toBe('original');
    } finally { jest.useRealTimers(); }
  });
});
