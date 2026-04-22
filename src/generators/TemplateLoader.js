"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateLoader = void 0;
const tslib_1 = require("tslib");
const fs = tslib_1.__importStar(require("fs"));
const path = tslib_1.__importStar(require("path"));
const Handlebars = tslib_1.__importStar(require("handlebars"));
const TemplateManager_1 = require("../services/TemplateManager");
/**
 * Template Loader - Handles loading and compiling Handlebars templates
 * 底层使用 TemplateManager 获取模板路径
 */
class TemplateLoader {
    /**
     * Load and compile a template file (async version)
     * @param templatePath Path to the template relative to the templates directory
     * @param templateType Template type (default: 'modules')
     */
    static async compileTemplate(templatePath, templateType = 'modules') {
        // 确保 helpers 已注册
        this.registerHelpers();
        let fullPath;
        if (path.isAbsolute(templatePath)) {
            fullPath = templatePath;
        }
        else {
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
    static compileTemplateSync(templatePath) {
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
    static registerHelpers() {
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
    static async render(templatePath, context, templateType = 'modules') {
        const template = await this.compileTemplate(templatePath, templateType);
        return template(context);
    }
}
exports.TemplateLoader = TemplateLoader;
TemplateLoader.templateManager = new TemplateManager_1.TemplateManager();
TemplateLoader.helpersRegistered = false;
//# sourceMappingURL=TemplateLoader.js.map