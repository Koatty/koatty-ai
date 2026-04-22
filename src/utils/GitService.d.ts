/**
 * GitService handles Git operations for the project.
 */
export declare class GitService {
    private workingDir;
    private git;
    constructor(workingDir?: string);
    /**
     * Check if the directory is a git repository.
     */
    isRepo(): Promise<boolean>;
    /**
     * Check if the working tree is clean.
     */
    isClean(): Promise<boolean>;
    /**
     * Initialize a git repository.
     */
    init(): Promise<void>;
    /**
     * Add all files and commit with a message.
     */
    commit(message: string): Promise<void>;
    /**
     * Get the current branch name.
     */
    getCurrentBranch(): Promise<string>;
}
//# sourceMappingURL=GitService.d.ts.map