"use strict";
/**
 * Parameter parsing utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJsonArg = parseJsonArg;
exports.parseCommaSeparated = parseCommaSeparated;
exports.validateRequired = validateRequired;
exports.validateFilePath = validateFilePath;
/**
 * Parse JSON string from command line
 */
function parseJsonArg(jsonString) {
    try {
        const parsed = JSON.parse(jsonString);
        if (typeof parsed !== 'object' || parsed === null) {
            throw new Error('Invalid JSON: must be an object');
        }
        return parsed;
    }
    catch (error) {
        throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Parse comma-separated list
 */
function parseCommaSeparated(value) {
    return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}
/**
 * Validate required parameter
 */
function validateRequired(value, paramName) {
    if (!value || value.trim() === '') {
        throw new Error(`Parameter '${paramName}' is required`);
    }
}
/**
 * Validate file path exists
 */
function validateFilePath(filePath) {
    const fs = require('fs'); // eslint-disable-line @typescript-eslint/no-require-imports
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }
}
//# sourceMappingURL=parseArgs.js.map