import * as path from 'path';
import * as fs from 'fs';

/** Resolve a write target. Symlinks below the project root, including dangling
 * links, are rejected. A symlink used to name the root itself is supported.
 * Unknown filesystem errors fail closed. */
export function resolveInside(root: string, target: string): string {
  root = path.resolve(root);
  const abs = path.resolve(root, target);
  const rel = path.relative(root, abs);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`Path escapes project root: ${target}`);
  }
  const realRoot = fs.realpathSync.native(root);
  let probe = realRoot;
  for (const part of rel.split(path.sep).filter(Boolean)) {
    probe = path.join(probe, part);
    try {
      if (fs.lstatSync(probe).isSymbolicLink()) {
        throw new Error(`Path escapes project root (symlink writes are forbidden): ${target}`);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') break;
      throw err;
    }
  }
  return abs;
}

/** Recheck at the write boundary and never follow a leaf symlink. */
export function writeInside(root: string, target: string, content: string): void {
  if (typeof content !== 'string') throw new Error('File content must be a string');
  const abs = resolveInside(root, target);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  resolveInside(root, abs);
  const fd = fs.openSync(
    abs,
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_NOFOLLOW,
    0o644
  );
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error(`Not a regular file: ${target}`);
    fs.ftruncateSync(fd, 0);
    fs.writeFileSync(fd, content, 'utf8');
  } finally {
    fs.closeSync(fd);
  }
}
