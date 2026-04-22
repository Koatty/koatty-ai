"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpecParser = void 0;
const tslib_1 = require("tslib");
const fs = tslib_1.__importStar(require("fs"));
const YAML = tslib_1.__importStar(require("yaml"));
/**
 * Spec Parser - Handles reading and parsing Spec files
 */
class SpecParser {
    /**
     * Parse a YAML file into a Spec object
     * @param filePath Path to the YAML file
     */
    static parseFile(filePath) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        return this.parseYaml(content);
    }
    /**
     * Parse a YAML string into a Spec object
     * @param yamlString YAML encoded string
     */
    static parseYaml(yamlString) {
        try {
            const data = YAML.parse(yamlString);
            return data;
        }
        catch (error) {
            throw new Error(`Failed to parse YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
exports.SpecParser = SpecParser;
//# sourceMappingURL=SpecParser.js.map