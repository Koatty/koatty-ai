import { ChangeSet } from '../changeset/ChangeSet';
import { Spec } from '../types/spec';
/**
 * Base Generator - Base class for all code generators
 */
export declare abstract class BaseGenerator {
    protected spec: Spec;
    protected changeset: ChangeSet;
    constructor(spec: Spec, changeset: ChangeSet);
    /**
     * Generate code and add to ChangeSet
     */
    abstract generate(): Promise<void> | void;
    /**
     * Render a template and return content (async)
     * @param templatePath Path to the template
     * @param context Template context
     */
    protected render(templatePath: string, context: any): Promise<string>;
    /**
     * Get the output path for a file
     * @param subDir Subdirectory (e.g., 'model', 'dto')
     * @param suffix File suffix (e.g., 'Dto', '')
     * @param ext File extension
     */
    protected getOutputPath(subDir: string, suffix?: string, ext?: string): string;
    /**
     * Helper to convert string to PascalCase
     */
    protected toPascalCase(str: string): string;
}
//# sourceMappingURL=BaseGenerator.d.ts.map