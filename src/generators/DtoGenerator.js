"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DtoGenerator = void 0;
const BaseGenerator_1 = require("./BaseGenerator");
/**
 * DTO Generator - Generates Create, Update, and Query DTOs
 */
class DtoGenerator extends BaseGenerator_1.BaseGenerator {
    /**
     * Generate DTO file
     */
    async generate() {
        const outputPath = this.getOutputPath('dto', 'Dto');
        const content = await this.render('dto/dto.hbs', this.spec);
        this.changeset.createFile(outputPath, content, `Generate DTOs for ${this.spec.module}`);
    }
}
exports.DtoGenerator = DtoGenerator;
//# sourceMappingURL=DtoGenerator.js.map