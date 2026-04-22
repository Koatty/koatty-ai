"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceGenerator = void 0;
const BaseGenerator_1 = require("./BaseGenerator");
/**
 * Service Generator - Generates Service files
 */
class ServiceGenerator extends BaseGenerator_1.BaseGenerator {
    /**
     * Generate Service file
     */
    async generate() {
        const outputPath = this.getOutputPath('service', 'Service');
        const content = await this.render('service/service.hbs', this.spec);
        this.changeset.createFile(outputPath, content, `Generate Service for ${this.spec.module}`);
    }
}
exports.ServiceGenerator = ServiceGenerator;
//# sourceMappingURL=ServiceGenerator.js.map