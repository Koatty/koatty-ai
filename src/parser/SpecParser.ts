import * as fs from 'fs';
import * as YAML from 'yaml';
import { Spec } from '../types/spec';

/**
 * Spec Parser - Handles reading and parsing Spec files
 */
export class SpecParser {
  /**
   * Parse a YAML file into a Spec object
   * @param filePath Path to the YAML file
   */
  public static parseFile(filePath: string): Spec {
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
  public static parseYaml(yamlString: string): Spec {
    try {
      const data = YAML.parse(yamlString);
      return data as Spec;
    } catch (error) {
      throw new Error(`Failed to parse YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
