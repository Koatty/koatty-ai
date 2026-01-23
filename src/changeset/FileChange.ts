import { FileChangeInfo, FileChangeType } from '../types/changeset';

/**
 * FileChange - Represents a single file operation
 */
export class FileChange {
  constructor(
    public readonly type: FileChangeType,
    public readonly path: string,
    public readonly content?: string,
    public readonly description?: string,
    public readonly originalContent?: string
  ) { }

  /**
   * Create a JSON representation
   */
  public toJSON(): FileChangeInfo {
    return {
      type: this.type,
      path: this.path,
      content: this.content,
      originalContent: this.originalContent,
      description: this.description,
    };
  }
}
