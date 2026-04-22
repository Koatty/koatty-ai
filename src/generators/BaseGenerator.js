"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseGenerator = void 0;
const TemplateLoader_1 = require("./TemplateLoader");
/**
 * Base Generator - Base class for all code generators
 */
class BaseGenerator {
    constructor(spec, changeset) {
        this.spec = spec;
        this.changeset = changeset;
        TemplateLoader_1.TemplateLoader.registerHelpers();
    }
    /**
     * Render a template and return content (async)
     * @param templatePath Path to the template
     * @param context Template context
     */
    async render(templatePath, context) {
        const template = await TemplateLoader_1.TemplateLoader.compileTemplate(templatePath);
        return template(context);
    }
    /**
     * Get the output path for a file
     * @param subDir Subdirectory (e.g., 'model', 'dto')
     * @param suffix File suffix (e.g., 'Dto', '')
     * @param ext File extension
     */
    getOutputPath(subDir, suffix = '', ext = '.ts') {
        const pascalName = this.toPascalCase(this.spec.module);
        return `src/${subDir}/${pascalName}${suffix}${ext}`;
    }
    /**
     * Helper to convert string to PascalCase
     */
    toPascalCase(str) {
        return str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase());
    }
}
exports.BaseGenerator = BaseGenerator;
//# sourceMappingURL=BaseGenerator.js.map