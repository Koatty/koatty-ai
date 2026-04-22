import { Project, SourceFile } from 'ts-morph';
import { ChangeSet } from '../changeset/ChangeSet';
/**
 * AstPatcher - Base class for AST modifications
 */
export declare abstract class AstPatcher {
    protected changeset: ChangeSet;
    protected project: Project;
    constructor(changeset: ChangeSet);
    /**
     * Apply modifications and add to ChangeSet
     */
    abstract patch(filePath?: string): void;
    /**
     * Load a source file, modify it, and add to changeset
     * @param filePath Path to file
     * @param modifier Callback to modify source file
     */
    protected modifyFile(filePath: string, modifier: (sourceFile: SourceFile) => void): void;
}
//# sourceMappingURL=AstPatcher.d.ts.map