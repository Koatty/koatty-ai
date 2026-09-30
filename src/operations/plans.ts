import * as fs from 'fs';
import * as path from 'path';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { ChangeSetInfo } from '../types/changeset';
import { resolveInside } from '../utils/sandbox';
import { applyTransaction, snapshotFile } from './transaction';
import { OperationError } from './result';

export interface DevelopmentPlan {
  schemaVersion: 1;
  id: string;
  root: string;
  expires: number;
  hash: string;
  changeset: ChangeSetInfo;
  before: Array<string | null>;
  inputs: string;
}

export function parseChangeSet(raw: unknown): ChangeSetInfo {
  const info = (typeof raw === 'string' ? JSON.parse(raw) : raw) as ChangeSetInfo;
  if (!info || typeof info.module !== 'string' || !Array.isArray(info.changes))
    throw new OperationError('INVALID_CHANGESET', 'Invalid changeset: expected module and changes');
  const paths = new Set<string>();
  for (const change of info.changes) {
    if (
      !change ||
      !['create', 'modify', 'delete'].includes(change.type) ||
      typeof change.path !== 'string' ||
      !change.path.trim()
    )
      throw new OperationError('INVALID_CHANGESET', 'Invalid changeset path or change type');
    if (path.isAbsolute(change.path))
      throw new OperationError('INVALID_CHANGESET', 'Use project-relative change paths');
    const normalized = path.normalize(change.path).split(path.sep).join('/');
    if (paths.has(normalized))
      throw new OperationError('INVALID_CHANGESET', 'Duplicate changeset path');
    if (/^(\.git|\.koatty)(\/|$)/.test(normalized))
      throw new OperationError(
        'INVALID_CHANGESET',
        'Changes to Git or plan control files are forbidden'
      );
    paths.add(normalized);
    if (change.type !== 'delete' && typeof change.content !== 'string')
      throw new OperationError('INVALID_CHANGESET', 'Create/modify content must be a string');
  }
  return info;
}

export function hashChangeSet(info: ChangeSetInfo): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        id: info.id,
        timestamp: info.timestamp,
        module: info.module,
        changes: info.changes.map((c) => ({
          type: c.type,
          path: c.path.split(path.sep).join('/'),
          content: c.content ?? null,
        })),
      })
    )
    .digest('hex');
}

/** Digests only: source/config changes invalidate plans without leaking their values. */
export function projectFingerprint(root: string): string {
  const hash = createHash('sha256');
  const walk = (relative: string): void => {
    const file = resolveInside(root, relative);
    if (!fs.existsSync(file)) {
      hash.update(`missing:${relative}\0`);
      return;
    }
    const stat = fs.statSync(file);
    if (stat.isDirectory()) {
      for (const item of fs.readdirSync(file).sort()) {
        if (item === 'node_modules' || item.startsWith('.')) continue;
        walk(path.join(relative, item));
      }
    } else if (stat.isFile()) {
      hash
        .update(`${relative}\0`)
        .update(createHash('sha256').update(fs.readFileSync(file)).digest());
    }
  };
  for (const name of [
    'package.json',
    'tsconfig.json',
    'src',
    'app',
    'config',
    'test',
    'tests',
    'scripts',
  ])
    walk(name);
  return hash.digest('hex');
}

export function preparePlan(rootPath: string, raw: unknown): DevelopmentPlan {
  const root = fs.realpathSync(rootPath);
  const info = parseChangeSet(raw);
  const before = info.changes.map((change) => {
    const snapshot = snapshotFile(root, change.path);
    if (change.type === 'create' && snapshot.digest !== null)
      throw new OperationError(
        'FILE_EXISTS',
        `Refusing to overwrite existing file: ${change.path}`,
        'Use an explicit modification with its original content.'
      );
    if (
      change.originalContent !== undefined &&
      snapshot.content?.toString('utf8') !== change.originalContent
    )
      throw new OperationError(
        'PLAN_CONFLICT',
        `Project changed since changeset: ${change.path}`,
        'Create a fresh plan.'
      );
    return snapshot.digest;
  });
  return {
    schemaVersion: 1,
    id: randomUUID(),
    root,
    expires: Date.now() + 600000,
    changeset: JSON.parse(JSON.stringify(info)),
    hash: hashChangeSet(info),
    before,
    inputs: projectFingerprint(root),
  };
}

export function checkPlan(rootPath: string, plan: DevelopmentPlan): void {
  if (
    plan.schemaVersion !== 1 ||
    plan.root !== fs.realpathSync(rootPath) ||
    plan.expires < Date.now()
  )
    throw new OperationError(
      'PLAN_EXPIRED',
      'Plan belongs to another project or expired',
      'Create a fresh plan.'
    );
  parseChangeSet(plan.changeset);
  if (hashChangeSet(plan.changeset) !== plan.hash)
    throw new OperationError('PLAN_TAMPERED', 'Changeset hash mismatch');
  if (projectFingerprint(plan.root) !== plan.inputs)
    throw new OperationError('PLAN_CONFLICT', 'Project changed since plan', 'Create a fresh plan.');
  plan.changeset.changes.forEach((change, i) => {
    if (snapshotFile(plan.root, change.path).digest !== plan.before[i])
      throw new OperationError(
        'PLAN_CONFLICT',
        'Project changed since plan',
        'Create a fresh plan.'
      );
  });
}

export function applyPlan(root: string, plan: DevelopmentPlan, dryRun = true) {
  checkPlan(root, plan);
  if (!dryRun) {
    const snapshots = plan.changeset.changes.map((c) => snapshotFile(plan.root, c.path));
    if (snapshots.some((snapshot, index) => snapshot.digest !== plan.before[index]))
      throw new OperationError(
        'PLAN_CONFLICT',
        'Project changed since plan',
        'Create a fresh plan.'
      );
    applyTransaction(plan.root, plan.changeset.changes, snapshots);
  }
  return {
    dryRun,
    planId: plan.id,
    module: plan.changeset.module,
    changes: plan.changeset.changes.map((c) => `${c.type} ${c.path}`),
    written: dryRun ? [] : plan.changeset.changes.map((c) => c.path),
  };
}

function planDirectory(root: string): string {
  return resolveInside(root, '.koatty/plans');
}
function planKey(root: string, create = false): Buffer {
  const file = resolveInside(root, '.koatty/plan-key');
  if (create) {
    fs.mkdirSync(planDirectory(root), { recursive: true });
    try {
      fs.writeFileSync(file, randomBytes(32), { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
  if (!fs.existsSync(file))
    throw new OperationError('PLAN_NOT_ISSUED', 'No locally issued plan key');
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.nlink !== 1 || stat.size !== 32)
    throw new OperationError('PLAN_TAMPERED', 'Invalid local plan key');
  return fs.readFileSync(file);
}

/** Explicit --save-plan persists a signed plan; ordinary previews remain read-only.
 * The local account/project filesystem is the trust boundary, not an OS sandbox. */
export function savePlan(root: string, plan: DevelopmentPlan): string {
  const key = planKey(root, true);
  checkPlan(root, plan);
  const payload = JSON.stringify(plan);
  const signature = createHmac('sha256', key).update(payload).digest('hex');
  fs.writeFileSync(
    resolveInside(root, `${path.relative(root, planDirectory(root))}/${plan.id}.json`),
    JSON.stringify({ payload, signature }),
    { flag: 'wx', mode: 0o600 }
  );
  return plan.id;
}

export function loadPlan(root: string, id: string): DevelopmentPlan {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new OperationError('INVALID_ARGUMENT', 'Invalid plan id');
  const file = resolveInside(root, `.koatty/plans/${id}.json`);
  if (!fs.existsSync(file))
    throw new OperationError(
      'PLAN_NOT_ISSUED',
      'Plan not issued or already consumed',
      'Create a fresh plan.'
    );
  const { payload, signature } = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (
    typeof payload !== 'string' ||
    typeof signature !== 'string' ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    throw new OperationError('PLAN_TAMPERED', 'Invalid plan signature');
  const digest = createHmac('sha256', planKey(root)).update(payload).digest();
  if (!timingSafeEqual(digest, Buffer.from(signature, 'hex')))
    throw new OperationError('PLAN_TAMPERED', 'Plan signature mismatch');
  const plan = JSON.parse(payload) as DevelopmentPlan;
  if (plan.id !== id) throw new OperationError('PLAN_TAMPERED', 'Plan identity mismatch');
  checkPlan(root, plan);
  return plan;
}

export function applySavedPlan(root: string, id: string, dryRun = true) {
  const plan = loadPlan(root, id);
  if (!dryRun) {
    // Exclusive consumption. Keep the receipt if execution fails or the process dies.
    const used = resolveInside(root, `.koatty/plans/${id}.consumed`);
    const fd = fs.openSync(used, 'wx', 0o600);
    fs.closeSync(fd);
    fs.renameSync(resolveInside(root, `.koatty/plans/${id}.json`), used);
  }
  return applyPlan(root, plan, dryRun);
}
