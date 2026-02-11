/**
 * 单文件模块创建命令（与旧 koatty_cli 兼容）
 * controller, middleware, service, plugin, aspect, dto, exception, proto, model
 */

import * as fs from 'fs';
import * as path from 'path';
import { isKoattyApp } from '../../utils/koattyProject';
import { TemplateLoader } from '../../generators/TemplateLoader';
import { QualityService } from '../../utils/QualityService';

export type CreateModuleOptions = {
  type?: string; // controller: http|grpc|websocket|graphql; model: typeorm|thinkorm
  interface?: boolean; // service: 同时生成接口
  orm?: string; // model: typeorm|thinkorm
};

/**
 * Controller 协议类型与模板路径映射
 */
const CONTROLLER_TYPE_MAP: Record<string, string> = {
  http: 'controller/simple.hbs',
  grpc: 'controller/simple.hbs', // 暂时使用相同模板
  websocket: 'controller/simple.hbs',
  graphql: 'controller/simple.hbs',
};

/**
 * 模块类型与模板路径映射
 */
const MODULE_TYPE_MAP: Record<string, string> = {
  controller: 'controller/simple.hbs',
  service: 'service/simple.hbs',
  middleware: 'middleware/middleware.hbs',
  dto: 'dto/simple.hbs',
  model: 'model/simple.hbs',
  aspect: 'aspect/aspect.hbs',
  exception: 'exception/exception.hbs',
  proto: 'proto/proto.hbs',
  plugin: 'plugin/plugin.hbs',
};

/**
 * 转换为 PascalCase
 */
function toPascal(s: string): string {
  return s.replace(/(?:^|[-/])(\w)/g, (_, c) => (c ? c.toUpperCase() : ''));
}

/**
 * 转换为 camelCase
 */
function toCamel(s: string): string {
  const p = toPascal(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

/**
 * 构建模板上下文
 */
function buildContext(
  moduleType: string,
  name: string,
  options?: CreateModuleOptions
): Record<string, unknown> {
  const baseName = name.split('/').pop() || name;
  const skipSuffix = moduleType === 'model' || moduleType === 'proto';
  const className = toPascal(baseName) + (skipSuffix ? '' : toPascal(moduleType));
  const moduleName = baseName.toLowerCase();

  return {
    // 新版标准变量（Handlebars 格式）
    className,
    moduleName,
    module: moduleName,
    subPath: '..',
    // 兼容旧变量（旧模板格式）
    _CLASS_NAME: className,
    _NEW: baseName,
    _SUB_PATH: '..',
    _CAMEL_NAME: toCamel(baseName) + toPascal(moduleType),
  };
}

/**
 * 执行单文件模块创建：校验项目、渲染模板、写入文件
 */
export async function runCreateModule(
  moduleType: string,
  name: string,
  options: CreateModuleOptions = {}
): Promise<void> {
  if (!isKoattyApp()) {
    console.error('当前目录不是 Koatty 项目根目录。');
    console.error(`请在 Koatty 项目根目录下执行 koatty ${moduleType} <name>。`);
    process.exit(1);
  }

  // 确定模板路径
  let templatePath: string;
  if (moduleType === 'controller' && options?.type) {
    const ctrlType = options.type.toLowerCase();
    templatePath = CONTROLLER_TYPE_MAP[ctrlType] || CONTROLLER_TYPE_MAP.http;
  } else {
    templatePath = MODULE_TYPE_MAP[moduleType];
  }

  if (!templatePath) {
    console.error(`不支持的模块类型: ${moduleType}`);
    process.exit(1);
  }

  // 构建上下文
  const context = buildContext(moduleType, name, options);
  const baseName = name.split('/').pop() || name;

  // 渲染模板
  let content: string;
  try {
    content = await TemplateLoader.render(templatePath, context, 'modules');
  } catch (error) {
    console.error(`渲染模板失败: ${error}`);
    process.exit(1);
  }

  // 确定输出路径
  const appPath = path.join(process.cwd(), 'src');
  let outDir: string;
  let fileName: string;
  let ext = '.ts';

  if (moduleType === 'model') {
    outDir = 'entity';
    fileName = `${context.className}Entity`;
  } else if (moduleType === 'proto') {
    outDir = 'resource/proto';
    fileName = String(context.moduleName);
    ext = '.proto';
  } else {
    outDir = moduleType;
    fileName = String(context.className);
  }
  const outPath = path.join(appPath, outDir, `${fileName}${ext}`);

  // 写入文件
  const written: string[] = [];

  function writeFile(filePath: string, fileContent: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(filePath)) {
      console.error(`文件已存在，跳过: ${filePath}`);
      return;
    }
    fs.writeFileSync(filePath, fileContent, 'utf-8');
    written.push(filePath);
  }

  writeFile(outPath, content);

  // 处理 service interface 选项
  if (moduleType === 'service' && options?.interface) {
    const ifaceName = `I${context.className}`;
    const ifaceContent = `/*\n * @Description: Service 接口\n */\n\nexport interface ${ifaceName} {\n  // todo\n}\n`;
    const ifacePath = path.join(appPath, 'service', `${ifaceName}.ts`);
    writeFile(ifacePath, ifaceContent);
  }

  if (written.length > 0) {
    QualityService.formatFiles(written);
    console.log(`创建成功: ${written.join(', ')}`);
    const className = path.basename(outPath, path.extname(outPath));
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
export async function runCreateAll(
  moduleName: string,
  options: { type?: string } = {}
): Promise<void> {
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

  for (const step of steps) {
    await runCreateModule(step.type, step.name, step.opts || {});
  }

  console.log(`\n模块 [${name}] 全部创建完成。`);
}
