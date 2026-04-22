"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiddlewareGenerator = void 0;
const BaseGenerator_1 = require("./BaseGenerator");
/**
 * Middleware Generator - Generates middleware files
 */
class MiddlewareGenerator extends BaseGenerator_1.BaseGenerator {
    /**
     * Generate Middleware file
     */
    async generate() {
        const outputPath = this.getOutputPath('middleware', 'Middleware');
        const content = await this.render('middleware/middleware.hbs', this.spec);
        this.changeset.createFile(outputPath, content, `Generate Middleware for ${this.spec.module}`);
    }
}
exports.MiddlewareGenerator = MiddlewareGenerator;
//# sourceMappingURL=MiddlewareGenerator.js.map