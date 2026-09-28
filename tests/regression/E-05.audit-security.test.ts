import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { callToolSafe, hashChangeSet, McpToolContext, listTools } from '../../src/mcp/tools';
import { applyTransaction, snapshotFile } from '../../src/mcp/transaction';
import { writeInside } from '../../src/utils/sandbox';

const spec = 'module: article\nfields:\n  id:\n    type: number\n    primary: true\n';
let root: string;
let ctx: McpToolContext;
const call = async (name: string, args: any, context = ctx) => {
  const result = await callToolSafe(name, args, context);
  return {
    error: !!result.isError,
    data: result.isError ? result.content[0].text : JSON.parse(result.content[0].text),
  };
};
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'e05-'));
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  ctx = { root };
});
afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

test('self-hashed unissued changeset is refused without writes', async () => {
  const changeset: any = {
    module: 'x',
    changes: [{ type: 'create', path: 'unplanned', content: 'x' }],
  };
  expect(
    (await call('koatty_apply', { changeset, hash: hashChangeSet(changeset), dryRun: false })).error
  ).toBe(true);
  expect(fs.existsSync(path.join(root, 'unplanned'))).toBe(false);
});
test('plans are connection-bound, single-use, and reject recomputed tampering', async () => {
  const { data: plan } = await call('koatty_plan', { spec });
  expect(
    (await call('koatty_apply', { ...plan, changeset: plan.changeset, hash: plan.hash }, { root }))
      .error
  ).toBe(true);
  expect(
    (await call('koatty_apply', { changeset: plan.changeset, hash: plan.hash }, { root })).error
  ).toBe(true);
  const altered = JSON.parse(JSON.stringify(plan.changeset));
  altered.changes[0].content += '// tampered';
  expect(
    (
      await call('koatty_apply', {
        changeset: altered,
        hash: hashChangeSet(altered),
        dryRun: false,
      })
    ).error
  ).toBe(true);
  expect(
    (await call('koatty_apply', { changeset: plan.changeset, hash: plan.hash })).data.dryRun
  ).toBe(true);
  expect(
    (await call('koatty_apply', { changeset: plan.changeset, hash: plan.hash, dryRun: false }))
      .error
  ).toBe(false);
  expect(
    (await call('koatty_apply', { changeset: plan.changeset, hash: plan.hash, dryRun: false }))
      .error
  ).toBe(true);
});
test('stale preimages and expired plans require a new plan', async () => {
  const { data: plan } = await call('koatty_plan', { spec });
  fs.writeFileSync(path.join(root, 'package.json'), '{"concurrent":true}');
  expect(
    (await call('koatty_apply', { changeset: plan.changeset, hash: plan.hash, dryRun: false }))
      .error
  ).toBe(true);
  expect(fs.existsSync(path.join(root, 'src'))).toBe(false);
  jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60000);
  expect((await call('koatty_apply', { changeset: plan.changeset, hash: plan.hash })).data).toMatch(
    /expired/
  );
});
test.each([0, null, 'false', {}])('invalid dryRun %p cannot write', async (dryRun) => {
  const { data: plan } = await call('koatty_plan', { spec });
  expect(
    (await call('koatty_apply', { changeset: plan.changeset, hash: plan.hash, dryRun })).error
  ).toBe(true);
  expect(fs.existsSync(path.join(root, 'src'))).toBe(false);
});
test('invalid content never truncates existing files or writes earlier changes', async () => {
  fs.writeFileSync(path.join(root, 'old'), 'KEEP');
  const changeset: any = {
    module: 'x',
    changes: [
      { type: 'create', path: 'first', content: 'x' },
      { type: 'modify', path: 'old', content: {} },
    ],
  };
  expect(
    (await call('koatty_apply', { changeset, hash: hashChangeSet(changeset), dryRun: false })).error
  ).toBe(true);
  expect(fs.readFileSync(path.join(root, 'old'), 'utf8')).toBe('KEEP');
  expect(fs.existsSync(path.join(root, 'first'))).toBe(false);
  expect(() => writeInside(root, 'old', {} as any)).toThrow();
  expect(fs.readFileSync(path.join(root, 'old'), 'utf8')).toBe('KEEP');
});
test('an intermediate I/O failure rolls back byte-exactly and removes created directories', () => {
  const old = Buffer.from([0, 255, 13, 10]);
  fs.writeFileSync(path.join(root, 'old'), old);
  const changes: any[] = [
    { type: 'modify', path: 'old', content: 'replace' },
    { type: 'create', path: 'new/sub/file', content: 'new' },
  ];
  const before = changes.map((c) => snapshotFile(root, c.path));
  const nativeFs = require('fs');
  const rename = nativeFs.renameSync;
  jest.spyOn(nativeFs, 'renameSync').mockImplementation((from: any, to: any) => {
    if (String(from).endsWith('1.after')) throw Error('disk failure');
    return rename(from, to);
  });
  expect(() => applyTransaction(root, changes, before)).toThrow('disk failure');
  expect(fs.readFileSync(path.join(root, 'old'))).toEqual(old);
  expect(fs.existsSync(path.join(root, 'new'))).toBe(false);
  expect(fs.readdirSync(root).some((f) => f.startsWith('.koatty-apply-'))).toBe(false);
});
test.each(['file', 'directory'])('docs refuses nested symlink %s', async (kind) => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'e05-out-'));
  try {
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'SENTINEL');
    fs.mkdirSync(path.join(root, 'docs/nested'), { recursive: true });
    fs.symlinkSync(
      kind === 'file' ? path.join(outside, 'secret.txt') : outside,
      path.join(root, 'docs/nested', kind === 'file' ? 'link.txt' : 'link')
    );
    const result = await call('koatty_docs', { topic: 'SENTINEL' });
    expect(result.error).toBe(true);
    expect(result.data).not.toContain('SENTINEL');
  } finally {
    fs.rmSync(outside, { recursive: true, force: true });
  }
});
test('test runner never advertises read-only or idempotent execution', () => {
  expect(listTools().find((t) => t.name === 'koatty_test')!.annotations).toMatchObject({
    readOnlyHint: false,
    idempotentHint: false,
  });
});

test('rollback preserves a concurrent edit and retains recovery material', () => {
  fs.writeFileSync(path.join(root, 'old'), 'BEFORE');
  const changes: any[] = [
    { type: 'modify', path: 'old', content: 'planned' },
    { type: 'create', path: 'next', content: 'new' },
  ];
  const before = changes.map((c) => snapshotFile(root, c.path));
  const nativeFs = require('fs');
  const rename = nativeFs.renameSync;
  jest.spyOn(nativeFs, 'renameSync').mockImplementation((from: any, to: any) => {
    if (String(from).endsWith('1.after')) {
      fs.writeFileSync(path.join(root, 'old'), 'CONCURRENT');
      throw Error('disk failure');
    }
    return rename(from, to);
  });
  expect(() => applyTransaction(root, changes, before)).toThrow(/recovery files retained/);
  expect(fs.readFileSync(path.join(root, 'old'), 'utf8')).toBe('CONCURRENT');
  const recovery = fs.readdirSync(root).find((f) => f.startsWith('.koatty-apply-'))!;
  expect(fs.readFileSync(path.join(root, recovery, '0.before'), 'utf8')).toBe('BEFORE');
});
