/**
 * 单文件模块创建命令（与旧 koatty_cli 兼容）
 * controller, middleware, service, plugin, aspect, dto, exception, proto, model
 */

import * as fs from 'fs';
import * as path from 'path';
import { isKoattyApp } from '../../utils/koattyProject';
import {
  renderStandaloneTemplate,
  toPascal,
} from '../standaloneTemplates';

export type CreateModuleOptions = {
  type?: string; // controller: http|grpc|websocket|graphql; model: typeorm|thinkorm
  interface?: boolean; // service: 同时生成接口
  orm?: string; // model: typeorm|thinkorm
};

/**
 * 执行单文件模块创建：校验项目、渲染模板、写入文件
 */
export function runCreateModule(
  moduleType: string,
  name: string,
  options: CreateModuleOptions = {}
): void {
  if (!isKoattyApp()) {
    console.error('当前目录不是 Koatty 项目根目录。');
    console.error(`请在 Koatty 项目根目录下执行 koatty ${moduleType} <name>。`);
    process.exit(1);
  }

  const controllerType = moduleType === 'controller' ? (options.type || 'http').toLowerCase() : undefined;
  const withInterface = moduleType === 'service' && !!options.interface;

  const result = renderStandaloneTemplate(moduleType, name, {
    type: controllerType,
    interface: withInterface,
  });

  if (!result) {
    console.error(`不支持的模块类型: ${moduleType}`);
    process.exit(1);
  }

  const written: string[] = [];

  function writeFile(filePath: string, content: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(filePath)) {
      console.error(`文件已存在，跳过: ${filePath}`);
      return;
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    written.push(filePath);
  }

  writeFile(result.path, result.content);
  if (result.extra) {
    writeFile(result.extra.path, result.extra.content);
  }

  if (written.length > 0) {
    console.log(`创建成功: ${written.join(', ')}`);
    const className = path.basename(result.path, path.extname(result.path));
    if (moduleType === 'middleware') {
      console.log('\n请修改 src/config/middleware.ts：');
      console.log(`  list: [..., "${className}"]`);
      console.log(`  config: { "${className}": { /* todo */ } }`);
    }
    if (moduleType === 'plugin') {
      console.log('\n请修改 src/config/plugin.ts：');
      console.log(`  list: [..., "${className}"]`);
      console.log(`  config: { "${className}": { /* todo */ } }`);
    }
  }
}

/**
 * 批量生成 entity/model, service, controller, dto（all 命令）
 */
export function runCreateAll(moduleName: string, options: { type?: string } = {}): void {
  if (!isKoattyApp()) {
    console.error('当前目录不是 Koatty 项目根目录。');
    console.error(`请在 Koatty 项目根目录下执行 koatty all ${moduleName}。`);
    process.exit(1);
  }

  const ctlType = (options.type || 'http').toLowerCase();
  const name = moduleName.trim();
  if (!name) {
    console.error('请提供模块名，例如: koatty all user');
    process.exit(1);
  }

  const steps: Array<{ type: string; name: string; opts?: CreateModuleOptions }> = [
    { type: 'model', name, opts: { orm: 'typeorm' } },
    { type: 'service', name },
    { type: 'controller', name, opts: { type: ctlType } },
    { type: 'dto', name },
  ];

  if (ctlType === 'grpc') {
    const protoName = toPascal(name);
    const srcPath = path.join(process.cwd(), 'src');
    const protoPath = path.join(srcPath, 'proto', protoName + '.proto');
    if (!fs.existsSync(protoPath)) {
      runCreateModule('proto', name, {});
    }
  }

  for (const step of steps) {
    runCreateModule(step.type, step.name, step.opts || {});
  }

  console.log(`\n模块 [${name}] 全部创建完成。`);
}
