/**
 * COR-16 regression test: `ChangeSet.save()` must accept both a directory and a
 * `*.json` file path.
 *
 * Found while verifying Phase E with the real CLI: `koatty generate:module`
 * passes `.koatty/changesets/<id>.json` to `save()`, which used to create that
 * path **as a directory**, so `koatty apply --changeset <id>` failed with
 * `EISDIR: illegal operation on a directory, read`.
 *
 * @License MIT
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ChangeSet } from '../../src/changeset/ChangeSet';

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'koatty-changeset-'));
}

describe('COR-16: ChangeSet.save path handling', () => {
  test('a directory target appends <id>.json', () => {
    const root = tempDir();
    try {
      const changeset = new ChangeSet('user');
      changeset.createFile('src/service/UserService.ts', 'export class UserService {}');

      const dir = path.join(root, '.koatty', 'changesets');
      const saved = changeset.save(dir);

      expect(saved).toBe(path.join(dir, `${changeset.id}.json`));
      expect(fs.statSync(saved).isFile()).toBe(true);
      expect(fs.statSync(dir).isDirectory()).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('a *.json target is written as a file, not a directory', () => {
    const root = tempDir();
    try {
      const changeset = new ChangeSet('user');
      changeset.createFile('test/user.test.ts', 'describe("user", () => {});');

      const filePath = path.join(root, '.koatty', 'changesets', `${changeset.id}.json`);
      const saved = changeset.save(filePath);

      expect(saved).toBe(filePath);
      expect(fs.statSync(saved).isFile()).toBe(true);
      expect(fs.readdirSync(path.dirname(filePath))).toEqual([`${changeset.id}.json`]);

      // The CLI reads it back with `koatty apply --changeset <path>`.
      const loaded = ChangeSet.load(saved);
      expect(loaded.module).toBe('user');
      expect(loaded.getChanges().map((change) => change.path)).toEqual(['test/user.test.ts']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('the CLI-style save/load round trip keeps the changeset id', () => {
    const root = tempDir();
    try {
      const changeset = new ChangeSet('article');
      changeset.createFile('src/model/ArticleModel.ts', 'export class ArticleModel {}');
      changeset.modifyFile('package.json', '{"name":"demo"}');

      const saved = changeset.save(path.join(root, `.koatty/changesets/${changeset.id}.json`));
      const raw = JSON.parse(fs.readFileSync(saved, 'utf-8')) as { id: string; changes: unknown[] };

      expect(raw.id).toBe(changeset.id);
      expect(raw.changes).toHaveLength(2);
      expect(fs.existsSync(path.join(root, '.koatty/changesets'))).toBe(true);
      expect(fs.statSync(path.join(root, '.koatty/changesets')).isDirectory()).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
