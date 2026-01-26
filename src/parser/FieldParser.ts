import { Field } from '../types/spec';

/**
 * Field Parser - Handles parsing field definitions from JSON strings
 */
export class FieldParser {
  /**
   * Parse a JSON string into a Record of Fields
   * @param jsonString JSON encoded fields mapping
   */
  public static parseFields(jsonString: string): Record<string, Field> {
    try {
      const data = JSON.parse(jsonString);
      const fields: Record<string, Field> = {};

      for (const [name, config] of Object.entries(data)) {
        fields[name] = this.normalizeField(name, config);
      }

      return fields;
    } catch (error) {
      throw new Error(
        `Failed to parse fields JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Normalize field configuration
   */
  private static normalizeField(name: string, config: any): Field {
    if (typeof config === 'string') {
      return {
        name,
        type: config as any,
      };
    }

    return {
      name,
      ...config,
    };
  }
}
