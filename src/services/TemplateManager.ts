import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as Handlebars from 'handlebars';

const execAsync = promisify(exec);

/**
 * 模板类型
 */
export type TemplateType = 'project' | 'modules' | 'component';

/**
 * 镜像源类型
 */
export type MirrorSource = 'github' | 'gitee';

/**
 * TemplateManager 构造函数选项
 */
export interface TemplateManagerOptions {
  /** 缓存目录路径，默认 ~/.koatty/templates */
  cacheDir?: string;
  /** submodule 目录路径，默认 path.join(__dirname, '../../templates') */
  submoduleDir?: string;
}

/**
 * 渲染目录选项
 */
export interface RenderDirectoryOptions {
  /** 排除的文件/目录模式 */
  excludePatterns?: string[];
}

/**
 * 渲染结果项
 */
export interface RenderResult {
  /** 输出路径（相对路径） */
  path: string;
  /** 文件内容 */
  content: string | Buffer;
  /** 是否为二进制文件 */
  isBinary: boolean;
}

/**
 * 确保模板仓库可用的选项
 */
export interface EnsureTemplateRepoOptions {
  /** 指定镜像源 */
  mirror?: MirrorSource;
  /** 强制重新下载 */
  force?: boolean;
}

/**
 * 模板仓库配置
 */
interface TemplateRepoConfig {
  github: string;
  gitee: string;
}

/**
 * 二进制文件扩展名集合（这些文件不做 Handlebars 渲染，以 Buffer 复制）
 */
const BINARY_EXTENSIONS = new Set([
  '.ico',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.woff',
  '.woff2',
  '.ttf',
  '.zip',
  '.tar',
  '.gz',
  '.pdf',
]);

/**
 * 模板管理器
 * 负责从 submodule/缓存/远程获取模板，支持模板渲染
 */
export class TemplateManager {
  /** 模板仓库地址配置 */
  private static readonly TEMPLATE_REPOS: Record<TemplateType, TemplateRepoConfig> = {
    project: {
      github: 'https://github.com/koatty/koatty-ai-template-project.git',
      gitee: 'https://gitee.com/koatty/koatty-ai-template-project.git',
    },
    modules: {
      github: 'https://github.com/koatty/koatty-ai-template-modules.git',
      gitee: 'https://gitee.com/koatty/koatty-ai-template-modules.git',
    },
    component: {
      github: 'https://github.com/koatty/koatty-ai-template-component.git',
      gitee: 'https://gitee.com/koatty/koatty-ai-template-component.git',
    },
  };

  /** 缓存目录 */
  private cacheDir: string;
  /** submodule 目录 */
  private submoduleDir: string;
  /** Handlebars helpers 是否已注册 */
  private static helpersRegistered = false;

  constructor(options?: TemplateManagerOptions) {
    this.cacheDir = options?.cacheDir ?? path.join(os.homedir(), '.koatty', 'templates');
    this.submoduleDir = options?.submoduleDir ?? path.join(__dirname, '../../templates');
    // 注册 Handlebars helpers
    this.registerHelpers();
  }

  /**
   * 注册 Handlebars 自定义 helpers
   * 仅在首次实例化时注册，避免重复注册
   */
  private registerHelpers(): void {
    if (TemplateManager.helpersRegistered) {
      return;
    }

    Handlebars.registerHelper('pascalCase', (str: string) => {
      if (!str) return '';
      return str.toLowerCase().replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase());
    });

    Handlebars.registerHelper('camelCase', (str: string) => {
      if (!str) return '';
      const s = str.toLowerCase().replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase());
      return s.charAt(0).toLowerCase() + s.slice(1);
    });

    Handlebars.registerHelper('snakeCase', (str: string) => {
      if (!str) return '';
      return str
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
    });

    Handlebars.registerHelper('lowerCase', (str: string) => {
      if (!str) return '';
      return str.toLowerCase();
    });

    Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);

    Handlebars.registerHelper('json', (obj: unknown) => JSON.stringify(obj));

    TemplateManager.helpersRegistered = true;
  }

  /**
   * 检查目录是否为有效模板目录
   * @param dir 目录路径
   * @returns 如果目录存在且有非 `.` 开头文件，返回 true
   */
  public isValidTemplateDir(dir: string): boolean {
    if (!fs.existsSync(dir)) {
      return false;
    }

    try {
      const files = fs.readdirSync(dir);
      // 检查是否有非 `.` 开头的文件
      return files.length > 0 && files.some((f) => !f.startsWith('.'));
    } catch {
      return false;
    }
  }

  /**
   * 检查文件是否为二进制文件
   * @param filePath 文件路径
   * @returns 如果文件扩展名在二进制集合中，返回 true
   */
  public isBinaryFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return BINARY_EXTENSIONS.has(ext);
  }

  /**
   * 获取模板路径（三级降级：submodule → 缓存 → 远程下载）
   * @param type 模板类型
   * @returns 模板目录路径
   */
  public async getTemplatePath(type: TemplateType): Promise<string> {
    // 1. 检查 submodule 路径
    const submodulePath = this.getSubmodulePath(type);
    if (this.isValidTemplateDir(submodulePath)) {
      return submodulePath;
    }

    // 2. 检查缓存目录
    const cachePath = this.getCachePath(type);
    if (this.isValidTemplateDir(cachePath)) {
      return cachePath;
    }

    // 3. 从远程下载
    await this.downloadTemplate(type);
    return cachePath;
  }

  /**
   * 获取 submodule 路径
   * @param type 模板类型
   * @returns submodule 目录路径
   */
  private getSubmodulePath(type: TemplateType): string {
    // 对于 'modules' 类型，当前 templates/ 目录结构直接包含模板
    // 对于其他类型，路径为 templates/{type}
    if (type === 'modules') {
      return this.submoduleDir;
    }
    return path.join(this.submoduleDir, type);
  }

  /**
   * 获取缓存路径
   * @param type 模板类型
   * @returns 缓存目录路径
   */
  private getCachePath(type: TemplateType): string {
    return path.join(this.cacheDir, type);
  }

  /**
   * 检测最佳镜像源
   * 通过尝试连接 GitHub 来判断网络状况
   * @returns 最佳镜像源
   */
  public detectBestMirror(): Promise<MirrorSource> {
    return new Promise((resolve) => {
      const req = https.get('https://github.com', { timeout: 3000 }, (res) => {
        res.destroy();
        resolve('github');
      });
      req.on('error', () => resolve('gitee'));
      req.on('timeout', () => {
        req.destroy();
        resolve('gitee');
      });
    });
  }

  /**
   * 下载模板仓库
   * @param type 模板类型
   * @param mirror 指定镜像源（可选，不指定则自动检测）
   * @param onProgress 进度回调（可选）
   */
  public async downloadTemplate(
    type: TemplateType,
    mirror?: MirrorSource,
    onProgress?: (msg: string) => void
  ): Promise<void> {
    const source = mirror ?? (await this.detectBestMirror());
    const repoUrl = TemplateManager.TEMPLATE_REPOS[type][source];
    const targetDir = this.getCachePath(type);

    // 删除旧缓存
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true });
    }

    // 创建缓存目录
    fs.mkdirSync(this.cacheDir, { recursive: true });

    onProgress?.(`正在从 ${source} 下载模板 ${type}...`);

    // 异步克隆仓库
    try {
      await execAsync(`git clone --depth 1 ${repoUrl} ${targetDir}`);
    } catch {
      // 降级到另一个镜像
      const fallbackSource: MirrorSource = source === 'github' ? 'gitee' : 'github';
      const fallbackUrl = TemplateManager.TEMPLATE_REPOS[type][fallbackSource];
      onProgress?.(`${source} 连接失败，降级到 ${fallbackSource}...`);
      await execAsync(`git clone --depth 1 ${fallbackUrl} ${targetDir}`);
    }

    // 验证模板完整性
    if (!this.isValidTemplateDir(targetDir)) {
      throw new Error(`模板下载失败或内容为空: ${type}`);
    }
  }

  /**
   * 确保模板仓库可用
   * @param type 模板类型
   * @param options 选项
   * @returns 模板目录路径
   */
  public async ensureTemplateRepo(
    type: TemplateType,
    options?: EnsureTemplateRepoOptions
  ): Promise<string> {
    if (options?.force) {
      await this.downloadTemplate(type, options.mirror);
      return this.getCachePath(type);
    }

    return this.getTemplatePath(type);
  }

  /**
   * 更新所有模板缓存
   * @param mirror 指定镜像源（可选）
   * @param onProgress 进度回调（可选）
   */
  public async updateTemplates(
    mirror?: MirrorSource,
    onProgress?: (msg: string) => void
  ): Promise<void> {
    const types: TemplateType[] = ['project', 'modules', 'component'];
    for (const type of types) {
      await this.downloadTemplate(type, mirror, onProgress);
    }
  }

  /**
   * 获取缓存目录路径（供后续任务使用）
   */
  public getCacheDir(): string {
    return this.cacheDir;
  }

  /**
   * 获取 submodule 目录路径（供测试使用）
   */
  public getSubmoduleDir(): string {
    return this.submoduleDir;
  }

  /**
   * 渲染单个模板文件
   * @param templatePath 模板文件的绝对路径
   * @param context 模板上下文变量
   * @returns 渲染后的字符串内容
   */
  public renderTemplate(templatePath: string, context: Record<string, unknown>): string {
    if (!fs.existsSync(templatePath)) {
      throw new Error(`模板文件不存在: ${templatePath}`);
    }

    const source = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(source, { noEscape: true });
    return template(context);
  }

  /**
   * 渲染整个模板目录
   * 支持文本文件渲染和二进制文件原样复制
   * @param templateDir 模板目录的绝对路径
   * @param context 模板上下文变量
   * @param options 渲染选项
   * @returns 渲染结果数组
   */
  public async renderDirectory(
    templateDir: string,
    context: Record<string, unknown>,
    options?: RenderDirectoryOptions
  ): Promise<RenderResult[]> {
    const results: RenderResult[] = [];
    const excludePatterns = options?.excludePatterns ?? ['.git', 'node_modules', 'koatty.json'];

    const walk = (dir: string, baseDir: string): void => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        // 检查是否应该排除
        if (
          excludePatterns.some((p) => {
            // 精确匹配
            if (entry.name === p) return true;
            // 对于 .git 特殊处理：只匹配 .git 目录，不匹配 .gitignore 等文件
            if (p === '.git') {
              return entry.name === '.git';
            }
            // 其他模式使用子字符串匹配
            return entry.name.includes(p);
          })
        ) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
          walk(fullPath, baseDir);
        } else if (this.isBinaryFile(fullPath)) {
          // 二进制文件：原样复制（Buffer）
          const outputPath = this.renderPathVariables(relativePath, context);
          results.push({
            path: outputPath,
            content: fs.readFileSync(fullPath),
            isBinary: true,
          });
        } else {
          let outputPath = relativePath;
          let content: string;

          if (entry.name.endsWith('.hbs')) {
            // 渲染 Handlebars 模板
            outputPath = relativePath.replace(/\.hbs$/, '');
            content = this.renderTemplate(fullPath, context);
          } else {
            // 文本文件直接复制
            content = fs.readFileSync(fullPath, 'utf-8');
          }

          // 处理路径中的变量
          outputPath = this.renderPathVariables(outputPath, context);
          results.push({ path: outputPath, content, isBinary: false });
        }
      }
    };

    walk(templateDir, templateDir);
    return results;
  }

  /**
   * 渲染路径中的变量（如 {{moduleName}}/controller.ts）
   * @param filePath 文件路径
   * @param context 上下文变量
   * @returns 替换变量后的路径
   */
  private renderPathVariables(filePath: string, context: Record<string, unknown>): string {
    return filePath.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = context[key];
      return value !== undefined ? String(value) : '';
    });
  }
}
