import { Spec } from '../types/spec';
/**
 * Spec Parser - Handles reading and parsing Spec files
 */
export declare class SpecParser {
    /**
     * Parse a YAML file into a Spec object
     * @param filePath Path to the YAML file
     */
    static parseFile(filePath: string): Spec;
    /**
     * Parse a YAML string into a Spec object
     * @param yamlString YAML encoded string
     */
    static parseYaml(yamlString: string): Spec;
}
//# sourceMappingURL=SpecParser.d.ts.map