import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

/** Built files only; collecting this inventory never executes application code. */
export interface RuntimeManifest {
  version: 1;
  root: string;
  files: { file: string; sha256: string }[];
}

export function collectRuntimeManifest(projectRoot: string, outputDir: string): RuntimeManifest {
  const base = fs.realpathSync(projectRoot);
  const within = (root: string, candidate: string) => {
    const relative = path.relative(root, candidate);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error('Runtime manifest path escapes its root');
    }
    return candidate;
  };
  const root = within(base, fs.realpathSync(within(base, path.resolve(base, outputDir))));
  const files: RuntimeManifest['files'] = [];
  const visited = new Set<string>();
  const modules = new Set<string>();
  const walk = (dir: string) => {
    const real = within(root, fs.realpathSync(dir));
    if (visited.has(real)) throw new Error('Duplicate or cyclic runtime directory link');
    visited.add(real);
    for (const entry of fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const file = path.join(dir, entry.name);
      const target = within(root, fs.realpathSync(file));
      if (fs.statSync(target).isDirectory()) walk(file);
      else if (/\.(?:c?js)$/.test(entry.name)) {
        if (modules.has(target)) throw new Error('Duplicate runtime module link');
        modules.add(target);
        files.push({
          file: path.relative(root, file).split(path.sep).join('/'),
          sha256: createHash('sha256').update(fs.readFileSync(target)).digest('hex'),
        });
      }
    }
  };
  walk(root);
  return { version: 1, root: path.relative(base, root).split(path.sep).join('/'), files };
}
