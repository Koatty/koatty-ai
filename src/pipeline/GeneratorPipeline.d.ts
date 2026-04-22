import { Spec } from '../types/spec';
import { ChangeSet } from '../changeset/ChangeSet';
export interface PipelineOptions {
    specFilePath?: string;
    inlineFieldsJson?: string;
    apiType?: 'rest' | 'graphql';
    auth?: string | boolean;
    softDelete?: boolean;
    pagination?: boolean;
    searchFields?: string;
}
export interface PipelineConfig {
    workingDirectory?: string;
}
/**
 * GeneratorPipeline - Encapsulates the entire generation workflow
 *
 * This class provides a unified interface for:
 * 1. Loading and validating specs (from file or CLI options)
 * 2. Generating code via generators
 * 3. Applying AST patches to existing project files
 * 4. Returning a complete ChangeSet
 */
export declare class GeneratorPipeline {
    private spec;
    private changeset;
    private config;
    private workingDirectory;
    constructor(specOrConfig: Spec | string, config?: PipelineConfig);
    /**
     * Build a Spec from CLI options and module name
     */
    static buildSpecFromOptions(moduleName: string, options: PipelineOptions): Spec;
    /**
     * Merge CLI options with an existing spec
     */
    mergeOptions(options: PipelineOptions): void;
    /**
     * Load spec from a file (YAML or JSON)
     */
    private loadSpecFromFile;
    /**
     * Validate the current spec
     */
    validateSpec(): void;
    /**
     * Execute full generation pipeline
     */
    execute(): Promise<ChangeSet>;
    /**
     * Get the generated ChangeSet
     */
    getChangeSet(): ChangeSet;
    /**
     * Get the Spec object
     */
    getSpec(): Spec;
}
//# sourceMappingURL=GeneratorPipeline.d.ts.map