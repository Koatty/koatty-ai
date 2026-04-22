"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileChange = void 0;
/**
 * FileChange - Represents a single file operation
 */
class FileChange {
    constructor(type, path, content, description, originalContent) {
        this.type = type;
        this.path = path;
        this.content = content;
        this.description = description;
        this.originalContent = originalContent;
    }
    /**
     * Create a JSON representation
     */
    toJSON() {
        return {
            type: this.type,
            path: this.path,
            content: this.content,
            originalContent: this.originalContent,
            description: this.description,
        };
    }
}
exports.FileChange = FileChange;
//# sourceMappingURL=FileChange.js.map