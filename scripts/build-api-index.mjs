#!/usr/bin/env node
/**
 * 维护者脚本：从 monorepo 内已构建的框架包 dist 声明生成版本化 API 索引
 * （knowledge/api-index.json）。只记录事实（导出符号与版本），使用场景与
 * 限制由维护者写在 skills/koatty/references/ 中，不从类型签名臆造语义。
 *
 * 用法：在 koatty-ai 子仓库内 `npm run api-index`（需要兄弟框架包已构建）。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const packagesDir = path.resolve(pkgRoot, '..');

const ENTRY_SKIP = new Set(['koatty_cli', 'koatty_ai']);

function listExports(dtsPath) {
  if (!fs.existsSync(dtsPath)) return null;
  const source = fs.readFileSync(dtsPath, 'utf8');
  const names = new Set();
  const patterns = [
    /export\s+declare\s+(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/g,
    /export\s+declare\s+(?:const|let|var|function)\s+([A-Za-z0-9_$]+)/g,
    /export\s+declare\s+(?:interface|type|enum)\s+([A-Za-z0-9_$]+)/g,
    /export\s+\{([^}]+)\}/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source))) {
      for (const part of match[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (name && /^[A-Za-z0-9_$]+$/.test(name)) names.add(name);
      }
    }
  }
  // 解析 export * from "<pkg>"：主聚合包（如 koatty）的绝大多数 API 来自 re-export
  const reexportSources = [];
  const star = /export\s+\*\s+from\s+["']([^"']+)["']/g;
  let starMatch;
  while ((starMatch = star.exec(source))) reexportSources.push(starMatch[1]);
  return { names: [...names].sort(), reexportSources };
}

const index = { generatedAt: new Date().toISOString().slice(0, 10), packages: {} };
const dirs = fs
  .readdirSync(packagesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith('koatty'))
  .map((d) => d.name)
  .sort();

const raw = new Map();
for (const dir of dirs) {
  const pkgFile = path.join(packagesDir, dir, 'package.json');
  if (!fs.existsSync(pkgFile)) continue;
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  } catch {
    continue;
  }
  if (ENTRY_SKIP.has(pkg.name) || pkg.private) continue;
  const dts = path.join(packagesDir, dir, 'dist', 'index.d.ts');
  const parsed = listExports(dts);
  raw.set(pkg.name, { dir, version: pkg.version, parsed });
}

// 递归展开 re-export（export * from），记录每个导出的最终来源包
function resolveExports(name, seen = new Set()) {
  if (seen.has(name)) return new Map();
  seen.add(name);
  const entry = raw.get(name);
  if (!entry?.parsed) return new Map();
  const merged = new Map(); // export name -> origin package (null = 本包声明)
  for (const n of entry.parsed.names) if (!merged.has(n)) merged.set(n, null);
  for (const source of entry.parsed.reexportSources) {
    for (const [n, originOf] of resolveExports(source, seen)) {
      if (merged.has(n)) continue;
      merged.set(n, originOf ?? source);
    }
  }
  return merged;
}

for (const [name, entry] of raw) {
  const merged = resolveExports(name);
  index.packages[name] = {
    version: entry.version,
    sourceDir: entry.dir,
    declaration: entry.parsed ? 'dist/index.d.ts' : 'dist/index.d.ts missing (build the package first)',
    exports: [...merged.keys()].sort(),
    reexportedFrom: Object.fromEntries(
      [...merged.entries()].filter(([, origin]) => origin !== null)
    ),
  };
}

const outFile = path.join(pkgRoot, 'knowledge', 'api-index.json');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(index, null, 2) + '\n');
const count = Object.keys(index.packages).length;
const exported = Object.values(index.packages).reduce((n, p) => n + (p.exports?.length ?? 0), 0);
console.log(`[koatty_ai] api-index: ${count} packages, ${exported} exports -> knowledge/api-index.json`);
