"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AspectGenerator = void 0;
const BaseGenerator_1 = require("./BaseGenerator");
/**
 * Aspect Generator - Generates aspect files
 */
class AspectGenerator extends BaseGenerator_1.BaseGenerator {
    /**
     * Generate Aspect file
     */
    async generate() {
        const outputPath = this.getOutputPath('aspect', 'Aspect');
        const content = await this.render('aspect/aspect.hbs', this.spec);
        this.changeset.createFile(outputPath, content, `Generate Aspect for ${this.spec.module}`);
    }
}
exports.AspectGenerator = AspectGenerator;
//# sourceMappingURL=AspectGenerator.js.map