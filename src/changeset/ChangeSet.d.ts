import { FileChange } from './FileChange';
import { ChangeSetInfo } from '../types/changeset';
/**
 * ChangeSet - Manages a collection of file changes
 */
export declare class ChangeSet {
    readonly module: string;
    private changes;
    readonly id: string;
    readonly timestamp: string;
    constructor(module: string);
    /**
     * Add a file change
     */
    addChange(change: FileChange): void;
    /**
     * Get all changes
     */
    getChanges(): FileChange[];
    /**
     * Create a new file change
     */
    createFile(path: string, content: string, description?: string): void;
    /**
     * Create a modify file change
     */
    modifyFile(path: string, content: string, originalContent?: string, description?: string): void;
    /**
     * Create a delete file change
     */
    deleteFile(path: string, originalContent?: string, description?: string): void;
    /**
     * Create a JSON representation
     */
    toJSON(): ChangeSetInfo;
    /**
     * Save ChangeSet to a file
     */
    save(targetDir: string): string;
    /**
     * Load ChangeSet from a JSON file
     */
    static load(filePath: string): ChangeSet;
}
//# sourceMappingURL=ChangeSet.d.ts.map