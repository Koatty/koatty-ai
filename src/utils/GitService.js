"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitService = void 0;
const simple_git_1 = require("simple-git");
/**
 * GitService handles Git operations for the project.
 */
class GitService {
    constructor(workingDir = process.cwd()) {
        this.workingDir = workingDir;
        this.git = (0, simple_git_1.simpleGit)(workingDir).clean(simple_git_1.CleanOptions.FORCE);
    }
    /**
     * Check if the directory is a git repository.
     */
    async isRepo() {
        try {
            return await this.git.checkIsRepo();
        }
        catch {
            return false;
        }
    }
    /**
     * Check if the working tree is clean.
     */
    async isClean() {
        const status = await this.git.status();
        return status.isClean();
    }
    /**
     * Initialize a git repository.
     */
    async init() {
        await this.git.init();
    }
    /**
     * Add all files and commit with a message.
     */
    async commit(message) {
        await this.git.add('.');
        await this.git.commit(message);
    }
    /**
     * Get the current branch name.
     */
    async getCurrentBranch() {
        const status = await this.git.status();
        return status.current || 'unknown';
    }
}
exports.GitService = GitService;
//# sourceMappingURL=GitService.js.map