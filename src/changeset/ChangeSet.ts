import { FileChange } from './FileChange';
import { ChangeSetInfo } from '../types/changeset';
import { generateId } from '../utils/id';

/**
 * ChangeSet - Manages a collection of file changes
 */
export class ChangeSet {
  private changes: FileChange[] = [];
  public readonly id: string;
  public readonly timestamp: string;

  constructor(public readonly module: string) {
    this.id = generateId();
    this.timestamp = new Date().toISOString();
  }

  /**
   * Add a file change
   */
  public addChange(change: FileChange): void {
    this.changes.push(change);
  }

  /**
   * Get all changes
   */
  public getChanges(): FileChange[] {
    return [...this.changes];
  }

  /**
   * Create a new file change
   */
  public createFile(path: string, content: string, description?: string): void {
    this.addChange(new FileChange('create', path, content, description));
  }

  /**
   * Create a modify file change
   */
  public modifyFile(path: string, content: string, originalContent?: string, description?: string): void {
    this.addChange(new FileChange('modify', path, content, description, originalContent));
  }

  /**
   * Create a delete file change
   */
  public deleteFile(path: string, originalContent?: string, description?: string): void {
    this.addChange(new FileChange('delete', path, undefined, description, originalContent));
  }

  /**
   * Create a JSON representation
   */
  public toJSON(): ChangeSetInfo {
    return {
      id: this.id,
      timestamp: this.timestamp,
      module: this.module,
      changes: this.changes.map((c) => c.toJSON()),
    };
  }
}
