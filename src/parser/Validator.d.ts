import { Spec } from '../types/spec';
/**
 * Spec Validator - Validates the integrity and correctness of a Spec object
 */
export declare class Validator {
    /**
     * Validate a Spec object
     * @param spec Spec object to validate
     * @throws Error if validation fails
     */
    static validate(spec: Spec): void;
    /**
     * Validate a Field configuration
     */
    private static validateField;
    /**
     * Validate API configuration
     */
    private static validateApi;
}
//# sourceMappingURL=Validator.d.ts.map