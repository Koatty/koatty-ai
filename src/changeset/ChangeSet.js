"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeSet = void 0;
const FileChange_1 = require("./FileChange");
const id_1 = require("../utils/id");
/**
 * ChangeSet - Manages a collection of file changes
 */
class ChangeSet {
    constructor(module) {
        this.module = module;
        this.changes = [];
        this.id = (0, id_1.generateId)();
        this.timestamp = new Date().toISOString();
    }
    /**
     * Add a file change
     */
    addChange(change) {
        this.changes.push(change);
    }
    /**
     * Get all changes
     */
    getChanges() {
        return [...this.changes];
    }
    /**
     * Create a new file change
     */
    createFile(path, content, description) {
        this.addChange(new FileChange_1.FileChange('create', path, content, description));
    }
    /**
     * Create a modify file change
     */
    modifyFile(path, content, originalContent, description) {
        this.addChange(new FileChange_1.FileChange('modify', path, content, description, originalContent));
    }
    /**
     * Create a delete file change
     */
    deleteFile(path, originalContent, description) {
        this.addChange(new FileChange_1.FileChange('delete', path, undefined, description, originalContent));
    }
    /**
     * Create a JSON representation
     */
    toJSON() {
        return {
            id: this.id,
            timestamp: this.timestamp,
            module: this.module,
            changes: this.changes.map((c) => c.toJSON()),
        };
    }
    /**
     * Save ChangeSet to a file
     */
    save(targetDir) {
        const fs = require('fs'); // eslint-disable-line @typescript-eslint/no-require-imports
        const path = require('path'); // eslint-disable-line @typescript-eslint/no-require-imports
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const filePath = path.join(targetDir, `${this.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(this.toJSON(), null, 2));
        return filePath;
    }
    /**
     * Load ChangeSet from a JSON file
     */
    static load(filePath) {
        const fs = require('fs'); // eslint-disable-line @typescript-eslint/no-require-imports
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const cs = new ChangeSet(data.module);
        // Overwrite auto-generated ID and timestamp
        Object.assign(cs, { id: data.id, timestamp: data.timestamp });
        data.changes.forEach((c) => {
            cs.addChange(new FileChange_1.FileChange(c.type, c.path, c.content, c.description, c.originalContent));
        });
        return cs;
    }
}
exports.ChangeSet = ChangeSet;
//# sourceMappingURL=ChangeSet.js.map