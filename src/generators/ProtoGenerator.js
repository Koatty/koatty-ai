"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtoGenerator = void 0;
const BaseGenerator_1 = require("./BaseGenerator");
/**
 * Proto Generator - Generates gRPC proto files for CRUD modules
 * 输出到 src/resource/proto/{Module}.proto
 */
class ProtoGenerator extends BaseGenerator_1.BaseGenerator {
    /**
     * Generate proto file
     */
    async generate() {
        const pascalName = this.toPascalCase(this.spec.module);
        const outputPath = `src/resource/proto/${pascalName}.proto`;
        const content = await this.render('proto/crud.hbs', this.spec);
        this.changeset.createFile(outputPath, content, `Generate gRPC proto for ${this.spec.module}`);
    }
}
exports.ProtoGenerator = ProtoGenerator;
//# sourceMappingURL=ProtoGenerator.js.map