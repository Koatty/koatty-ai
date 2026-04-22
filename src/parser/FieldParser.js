"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldParser = void 0;
/**
 * Field Parser - Handles parsing field definitions from JSON strings
 */
class FieldParser {
    /**
     * Parse a JSON string into a Record of Fields
     * @param jsonString JSON encoded fields mapping
     */
    static parseFields(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            const fields = {};
            for (const [name, config] of Object.entries(data)) {
                fields[name] = this.normalizeField(name, config);
            }
            return fields;
        }
        catch (error) {
            throw new Error(`Failed to parse fields JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Normalize field configuration
     */
    static normalizeField(name, config) {
        if (typeof config === 'string') {
            return {
                name,
                type: config,
            };
        }
        return {
            name,
            ...config,
        };
    }
}
exports.FieldParser = FieldParser;
//# sourceMappingURL=FieldParser.js.map