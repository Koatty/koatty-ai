"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelGenerator = void 0;
const BaseGenerator_1 = require("./BaseGenerator");
/**
 * Model Generator - Generates TypeORM entities
 */
class ModelGenerator extends BaseGenerator_1.BaseGenerator {
    /**
     * Generate Model file
     */
    async generate() {
        const outputPath = this.getOutputPath('model', 'Model');
        const content = await this.render('model/model.hbs', this.spec);
        this.changeset.createFile(outputPath, content, `Generate TypeORM model for ${this.spec.module}`);
    }
}
exports.ModelGenerator = ModelGenerator;
//# sourceMappingURL=ModelGenerator.js.map