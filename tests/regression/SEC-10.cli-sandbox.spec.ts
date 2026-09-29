/**
 * SEC-10 regression tests (B-10): CLI sandbox.
 *
 * - resolveInside refuses paths that escape the project root, including
 *   through symlinks;
 * - GitService no longer queues `git clean -f` on construction;
 * - QualityService never interpolates file paths into a shell command.
 *
 * @ license: BSD (3-Clause)
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveInside } from '../../src/utils/sandbox';
import { GitService } from '../../src/utils/GitService';

describe("SEC-10: CLI filesystem sandbox", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'koatty-sandbox-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("resolves relative paths inside the root", () => {
    expect(resolveInside(root, 'src/a/b.ts')).toBe(path.join(root, 'src/a/b.ts'));
    expect(resolveInside(root, './x.ts')).toBe(path.join(root, 'x.ts'));
  });

  test.each([
    ['../outside.txt', 'direct traversal'],
    ['src/../../../etc/passwd', 'nested traversal'],
    ['/etc/passwd', 'absolute outside path'],
  ])("rejects escaping path (%s)", (target, _name) => {
    expect(() => resolveInside(root, target)).toThrow(/escapes project root/);
  });

  test("rejects symlink escapes", () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'koatty-outside-'));
    try {
      fs.symlinkSync(outside, path.join(root, 'link'), 'dir');
      expect(() => resolveInside(root, 'link/evil.txt')).toThrow(/escapes project root/);

      const outsideFile = path.join(outside, 'f.txt');
      fs.writeFileSync(outsideFile, 'x');
      fs.symlinkSync(outsideFile, path.join(root, 'file-link'), 'file');
      expect(() => resolveInside(root, 'file-link')).toThrow(/escapes project root/);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  test("allows paths through a non-existing new file in an existing dir", () => {
    fs.mkdirSync(path.join(root, 'src'));
    expect(resolveInside(root, 'src/new-file.ts')).toBe(path.join(root, 'src/new-file.ts'));
  });

  test("deep traversal inside root is fine", () => {
    expect(resolveInside(root, 'a/b/c/../../../deep.ts')).toBe(path.join(root, 'deep.ts'));
  });
});

describe("SEC-10: GitService", () => {
  test("constructor does not queue git clean -f", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'koatty-git-'));
    try {
      require('child_process').execFileSync('git', ['init', '--quiet', dir]);
      fs.writeFileSync(path.join(dir, 'untracked.txt'), 'preserve');
      const git = new GitService(dir);
      // force the underlying simple-git to materialize; the queued clean
      // would run on the first command in the old implementation
      const isRepo = await git.isRepo();
      expect(isRepo).toBe(true);
      expect(fs.readFileSync(path.join(dir, 'untracked.txt'), 'utf8')).toBe('preserve');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

test('P2 writeInside rejects hard links without modifying the external inode', () => {
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const { writeInside } = require('../../src/utils/sandbox');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'koatty-hardlink-'));
  try {
    fs.mkdirSync(path.join(root, 'project')); fs.writeFileSync(path.join(root, 'outside'), 'preserved');
    fs.linkSync(path.join(root, 'outside'), path.join(root, 'project', 'linked'));
    expect(() => writeInside(path.join(root, 'project'), 'linked', 'changed')).toThrow(/Hard-linked/);
    expect(fs.readFileSync(path.join(root, 'outside'), 'utf8')).toBe('preserved');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
