import { simpleGit, SimpleGit, CleanOptions } from 'simple-git';

/**
 * GitService handles Git operations for the project.
 */
export class GitService {
  private git: SimpleGit;

  constructor(private workingDir: string = process.cwd()) {
    this.git = simpleGit(workingDir).clean(CleanOptions.FORCE);
  }

  /**
   * Check if the directory is a git repository.
   */
  async isRepo(): Promise<boolean> {
    try {
      return await this.git.checkIsRepo();
    } catch {
      return false;
    }
  }

  /**
   * Check if the working tree is clean.
   */
  async isClean(): Promise<boolean> {
    const status = await this.git.status();
    return status.isClean();
  }

  /**
   * Initialize a git repository.
   */
  async init(): Promise<void> {
    await this.git.init();
  }

  /**
   * Add all files and commit with a message.
   */
  async commit(message: string): Promise<void> {
    await this.git.add('.');
    await this.git.commit(message);
  }

  /**
   * Get the current branch name.
   */
  async getCurrentBranch(): Promise<string> {
    const status = await this.git.status();
    return status.current || 'unknown';
  }
}
