#!/usr/bin/env node
/**
 * 开发期链接：把本仓库 node_modules/koatty_cli 指向兄弟目录 ../koatty_cli，
 * 使 koatty-ai bin 在本仓库内直接可执行（公开 API 仅存在于未发布的 koatty_cli）。
 *
 * 该链接只存在于本机 node_modules（已 gitignore），不影响 package.json：
 * 发布时 dependencies.koatty_cli 必须是可从 registry 解析的版本范围。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const target = path.join(pkgRoot, 'node_modules', 'koatty_cli');
const sibling = path.resolve(pkgRoot, '..', 'koatty_cli');

if (!fs.existsSync(path.join(sibling, 'package.json'))) {
  console.error(`[koatty_ai] sibling koatty_cli not found at ${sibling}`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.rmSync(target, { force: true, recursive: true });
fs.symlinkSync(sibling, target, 'dir');
console.log(`[koatty_ai] linked node_modules/koatty_cli -> ${sibling}`);
