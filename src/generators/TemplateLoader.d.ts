import * as Handlebars from 'handlebars';
import { TemplateType } from '../services/TemplateManager';
/**
 * Template Loader - Handles loading and compiling Handlebars templates
 * 底层使用 TemplateManager 获取模板路径
 */
export declare class TemplateLoader {
    private static templateManager;
    private static helpersRegistered;
    /**
     * Load and compile a template file (async version)
     * @param templatePath Path to the template relative to the templates directory
     * @param templateType Template type (default: 'modules')
     */
    static compileTemplate(templatePath: string, templateType?: TemplateType): Promise<Handlebars.TemplateDelegate>;
    /**
     * Load and compile a template file (sync version - for backward compatibility)
     * 仅用于本地已存在的模板目录，不支持远程下载
     * @param templatePath Path to the template (absolute or relative to templates/)
     * @deprecated Use async compileTemplate instead
     */
    static compileTemplateSync(templatePath: string): Handlebars.TemplateDelegate;
    /**
     * Register custom Handlebars helpers
     * 委托给 TemplateManager，避免重复注册
     * TemplateManager 构造时已注册 helpers，此处仅标记为已注册
     */
    static registerHelpers(): void;
    /**
     * Render a template file with context (async)
     * @param templatePath Template path
     * @param context Template context
     * @param templateType Template type
     */
    static render(templatePath: string, context: Record<string, unknown>, templateType?: TemplateType): Promise<string>;
}
//# sourceMappingURL=TemplateLoader.d.ts.map