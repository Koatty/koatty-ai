import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { FileChangeInfo } from '../types/changeset';
import { resolveInside } from '../utils/sandbox';

export function snapshotFile(root: string, file: string) {
  const target = resolveInside(root, file);
  try {
    const stat = fs.lstatSync(target);
    if (!stat.isFile()) throw new Error(`Not a regular file: ${file}`);
    const content = fs.readFileSync(target);
    return { content, mode: stat.mode, digest: createHash('sha256').update(content).digest('hex') };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { content: null, mode: 0o644, digest: null };
  }
}

/** Stage before replacing files; recover all committed files on a handled I/O failure.
 * This is not a crash-atomic multi-file filesystem transaction. */
export function applyTransaction(
  root: string,
  changes: FileChangeInfo[],
  before: ReturnType<typeof snapshotFile>[]
): void {
  const staging = fs.mkdtempSync(path.join(root, '.koatty-apply-'));
  const committed: number[] = [];
  const createdDirs: string[] = [];
  let retainRecovery = false;
  try {
    changes.forEach((change, i) => {
      if (snapshotFile(root, change.path).digest !== before[i].digest)
        throw new Error('Project changed since plan');
      if (before[i].content !== null)
        fs.writeFileSync(path.join(staging, `${i}.before`), before[i].content!);
      if (change.type !== 'delete')
        fs.writeFileSync(path.join(staging, `${i}.after`), change.content!, {
          mode: before[i].mode,
        });
    });
    fs.writeFileSync(
      path.join(staging, 'recovery.json'),
      JSON.stringify(
        changes.map((c, i) => ({
          path: c.path,
          existed: before[i].content !== null,
          mode: before[i].mode,
        }))
      )
    );
    changes.forEach((change, i) => {
      const target = resolveInside(root, change.path);
      if (snapshotFile(root, change.path).digest !== before[i].digest)
        throw new Error('Project changed during apply');
      if (change.type === 'delete') {
        if (before[i].content === null) return;
        fs.unlinkSync(target);
      } else {
        const missing: string[] = [];
        let dir = path.dirname(target);
        while (!fs.existsSync(dir)) {
          missing.unshift(dir);
          dir = path.dirname(dir);
        }
        for (const item of missing) {
          fs.mkdirSync(resolveInside(root, item));
          createdDirs.push(item);
        }
        resolveInside(root, target);
        fs.renameSync(path.join(staging, `${i}.after`), target);
      }
      committed.push(i);
    });
  } catch (error) {
    const failures: string[] = [];
    for (const i of committed.reverse()) {
      try {
        const target = resolveInside(root, changes[i].path);
        const appliedDigest =
          changes[i].type === 'delete'
            ? null
            : createHash('sha256').update(changes[i].content!).digest('hex');
        if (snapshotFile(root, changes[i].path).digest !== appliedDigest)
          throw new Error('File changed after apply; preserve it for manual recovery');
        if (before[i].content === null) fs.unlinkSync(target);
        else {
          fs.renameSync(path.join(staging, `${i}.before`), target);
          fs.chmodSync(target, before[i].mode);
        }
      } catch {
        failures.push(changes[i].path);
      }
    }
    for (const dir of createdDirs.reverse()) {
      try {
        fs.rmdirSync(dir);
      } catch {
        /* preserve non-empty dirs */
      }
    }
    if (failures.length) {
      retainRecovery = true;
      throw new Error(
        `Apply failed; recovery files retained at ${path.basename(staging)} for: ${failures.join(', ')}`
      );
    }
    throw error;
  } finally {
    if (!retainRecovery) fs.rmSync(staging, { recursive: true, force: true });
  }
}
