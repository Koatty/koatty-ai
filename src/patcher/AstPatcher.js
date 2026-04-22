"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AstPatcher = void 0;
const ts_morph_1 = require("ts-morph");
/**
 * AstPatcher - Base class for AST modifications
 */
class AstPatcher {
    constructor(changeset) {
        this.changeset = changeset;
        this.project = new ts_morph_1.Project({
            compilerOptions: {
                experimentalDecorators: true,
            },
        });
    }
    /**
     * Load a source file, modify it, and add to changeset
     * @param filePath Path to file
     * @param modifier Callback to modify source file
     */
    modifyFile(filePath, modifier) {
        const fs = require('fs'); // eslint-disable-line @typescript-eslint/no-require-imports
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        const originalContent = fs.readFileSync(filePath, 'utf-8');
        const sourceFile = this.project.createSourceFile(filePath, originalContent, {
            overwrite: true,
        });
        modifier(sourceFile);
        const newContent = sourceFile.getText();
        if (newContent !== originalContent) {
            this.changeset.modifyFile(filePath, newContent, originalContent, `AST patch: ${this.constructor.name}`);
            fs.writeFileSync(filePath, newContent);
        }
    }
}
exports.AstPatcher = AstPatcher;
//# sourceMappingURL=AstPatcher.js.map