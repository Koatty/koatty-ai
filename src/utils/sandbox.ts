/**
 * @Description: Filesystem sandbox for CLI write operations (SEC-10 / B-10)
 * @License: BSD (3-Clause)
 */
import * as path from 'path';
import * as fs from 'fs';

/**
 * Resolve `target` against `root` and refuse anything that escapes the
 * project root — including via symlinks.
 *
 * @param root absolute project root (the sandbox boundary)
 * @param target user- or AI-supplied path, absolute or relative
 * @returns the absolute resolved path (guaranteed inside `root`)
 * @throws Error when the path escapes the root, directly or through a symlink
 */
export function resolveInside(root: string, target: string): string {
  const abs = path.resolve(root, target);
  const rel = path.relative(root, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Path escapes project root: ${target}`);
  }

  // symlink escape check: resolve the real path of the deepest existing
  // ancestor and make sure it still lands inside the (real) root
  try {
    const realRoot = fs.realpathSync.native(root);
    let probe = abs;
    while (probe !== path.dirname(probe) && !fs.existsSync(probe)) {
      probe = path.dirname(probe);
    }
    if (fs.existsSync(probe)) {
      const realProbe = fs.realpathSync.native(probe);
      const real = realProbe + abs.slice(probe.length);
      const relReal = path.relative(realRoot, real);
      if (relReal.startsWith('..') || path.isAbsolute(relReal)) {
        throw new Error(`Path escapes project root (symlink): ${target}`);
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Path escapes project root')) {
      throw err;
    }
    // root may not exist yet (fresh project); path checks above still apply
  }

  return abs;
}
