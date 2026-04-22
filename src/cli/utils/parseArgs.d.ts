/**
 * Parameter parsing utilities
 */
/**
 * Parse JSON string from command line
 */
export declare function parseJsonArg(jsonString: string): Record<string, unknown>;
/**
 * Parse comma-separated list
 */
export declare function parseCommaSeparated(value: string): string[];
/**
 * Validate required parameter
 */
export declare function validateRequired(value: string, paramName: string): void;
/**
 * Validate file path exists
 */
export declare function validateFilePath(filePath: string): void;
//# sourceMappingURL=parseArgs.d.ts.map