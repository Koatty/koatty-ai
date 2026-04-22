"use strict";
/**
 * ID Generation Utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
/**
 * Generate a simple unique ID
 */
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
//# sourceMappingURL=id.js.map