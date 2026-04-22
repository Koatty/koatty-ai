import { FileChangeInfo, FileChangeType } from '../types/changeset';
/**
 * FileChange - Represents a single file operation
 */
export declare class FileChange {
    readonly type: FileChangeType;
    readonly path: string;
    readonly content?: string | undefined;
    readonly description?: string | undefined;
    readonly originalContent?: string | undefined;
    constructor(type: FileChangeType, path: string, content?: string | undefined, description?: string | undefined, originalContent?: string | undefined);
    /**
     * Create a JSON representation
     */
    toJSON(): FileChangeInfo;
}
//# sourceMappingURL=FileChange.d.ts.map