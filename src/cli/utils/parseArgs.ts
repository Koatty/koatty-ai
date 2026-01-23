/**
 * Parameter parsing utilities
 */

/**
 * Parse JSON string from command line
 */
export function parseJsonArg(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse comma-separated list
 */
export function parseCommaSeparated(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter((item) => item.length > 0);
}

/**
 * Validate required parameter
 */
export function validateRequired(value: any, paramName: string): void {
  if (!value) {
    throw new Error(`Parameter '${paramName}' is required`);
  }
}

/**
 * Validate file path exists
 */
export function validateFilePath(filePath: string): void {
  const fs = require('fs');
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
}
