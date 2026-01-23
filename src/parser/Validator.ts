import { Spec, Field } from '../types/spec';

/**
 * Spec Validator - Validates the integrity and correctness of a Spec object
 */
export class Validator {
  /**
   * Validate a Spec object
   * @param spec Spec object to validate
   * @throws Error if validation fails
   */
  public static validate(spec: Spec): void {
    if (!spec.module) {
      throw new Error('Validation failed: "module" name is required');
    }

    if (!spec.fields || Object.keys(spec.fields).length === 0) {
      throw new Error('Validation failed: at least one "field" is required');
    }

    for (const [name, field] of Object.entries(spec.fields)) {
      this.validateField(name, field);
    }

    if (spec.api) {
      this.validateApi(spec.api);
    }
  }

  /**
   * Validate a Field configuration
   */
  private static validateField(name: string, field: Field): void {
    const validTypes = ['string', 'number', 'boolean', 'enum', 'datetime', 'text', 'json'];
    if (!field.type || !validTypes.includes(field.type)) {
      throw new Error(`Validation failed: Invalid type "${field.type}" for field "${name}"`);
    }

    if (field.type === 'enum' && (!field.values || field.values.length === 0)) {
      throw new Error(`Validation failed: Field "${name}" of type "enum" must have "values"`);
    }
  }

  /**
   * Validate API configuration
   */
  private static validateApi(api: any): void {
    if (!api.basePath) {
      throw new Error('Validation failed: "api.basePath" is required if API is enabled');
    }

    if (api.endpoints && Array.isArray(api.endpoints)) {
      api.endpoints.forEach((endpoint: any, index: number) => {
        if (!endpoint.method || !endpoint.path || !endpoint.action) {
          throw new Error(`Validation failed: Invalid endpoint definition at index ${index}`);
        }
      });
    }
  }
}
