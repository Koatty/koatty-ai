/**
 * Parameter parsing utilities
 */

/**
 * Parse JSON string from command line
 */
export function parseJsonArg(jsonString: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(jsonString);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Invalid JSON: must be an object');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse comma-separated list
 */
export function parseCommaSeparated(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Validate required parameter
 */
export function validateRequired(value: string, paramName: string): void {
  if (!value || value.trim() === '') {
    throw new Error(`Parameter '${paramName}' is required`);
  }
}

/**
 * Validate file path exists
 */
export function validateFilePath(filePath: string): void {
  const fs = require('fs'); // eslint-disable-line @typescript-eslint/no-require-imports
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
}
