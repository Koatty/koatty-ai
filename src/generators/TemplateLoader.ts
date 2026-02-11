import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { TemplateManager, TemplateType } from '../services/TemplateManager';

/**
 * Template Loader - Handles loading and compiling Handlebars templates
 * 底层使用 TemplateManager 获取模板路径
 */
export class TemplateLoader {
  private static templateManager = new TemplateManager();
  private static helpersRegistered = false;

  /**
   * Load and compile a template file (async version)
   * @param templatePath Path to the template relative to the templates directory
   * @param templateType Template type (default: 'modules')
   */
  public static async compileTemplate(
    templatePath: string,
    templateType: TemplateType = 'modules'
  ): Promise<Handlebars.TemplateDelegate> {
    // 确保 helpers 已注册
    this.registerHelpers();

    let fullPath: string;
    if (path.isAbsolute(templatePath)) {
      fullPath = templatePath;
    } else {
      const baseDir = await this.templateManager.getTemplatePath(templateType);
      fullPath = path.join(baseDir, templatePath);
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Template not found: ${fullPath}`);
    }

    const source = fs.readFileSync(fullPath, 'utf-8');
    return Handlebars.compile(source, { noEscape: true });
  }

  /**
   * Load and compile a template file (sync version - for backward compatibility)
   * 仅用于本地已存在的模板目录，不支持远程下载
   * @param templatePath Path to the template (absolute or relative to templates/)
   * @deprecated Use async compileTemplate instead
   */
  public static compileTemplateSync(templatePath: string): Handlebars.TemplateDelegate {
    // 确保 helpers 已注册
    this.registerHelpers();

    const templatesDir = path.join(__dirname, '../../templates/modules');
    const fullPath = path.isAbsolute(templatePath)
      ? templatePath
      : path.join(templatesDir, templatePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Template not found: ${fullPath}`);
    }

    const source = fs.readFileSync(fullPath, 'utf-8');
    return Handlebars.compile(source, { noEscape: true });
  }

  /**
   * Register custom Handlebars helpers
   * 委托给 TemplateManager，避免重复注册
   * TemplateManager 构造时已注册 helpers，此处仅标记为已注册
   */
  public static registerHelpers(): void {
    if (this.helpersRegistered) {
      return;
    }
    // TemplateManager 在 static 字段初始化时已触发注册
    // (private static templateManager = new TemplateManager())
    this.helpersRegistered = true;
  }

  /**
   * Render a template file with context (async)
   * @param templatePath Template path
   * @param context Template context
   * @param templateType Template type
   */
  public static async render(
    templatePath: string,
    context: Record<string, unknown>,
    templateType: TemplateType = 'modules'
  ): Promise<string> {
    const template = await this.compileTemplate(templatePath, templateType);
    return template(context);
  }
}
