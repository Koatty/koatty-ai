import { Field } from '../types/spec';
/**
 * Field Parser - Handles parsing field definitions from JSON strings
 */
export declare class FieldParser {
    /**
     * Parse a JSON string into a Record of Fields
     * @param jsonString JSON encoded fields mapping
     */
    static parseFields(jsonString: string): Record<string, Field>;
    /**
     * Normalize field configuration
     */
    private static normalizeField;
}
//# sourceMappingURL=FieldParser.d.ts.map