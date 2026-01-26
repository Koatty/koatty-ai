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
  public modifyFile(
    path: string,
    content: string,
    originalContent?: string,
    description?: string
  ): void {
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

  /**
   * Save ChangeSet to a file
   */
  public save(targetDir: string): string {
    const fs = require('fs'); // eslint-disable-line @typescript-eslint/no-require-imports
    const path = require('path'); // eslint-disable-line @typescript-eslint/no-require-imports
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const filePath = path.join(targetDir, `${this.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(this.toJSON(), null, 2));
    return filePath;
  }

  /**
   * Load ChangeSet from a JSON file
   */
  public static load(filePath: string): ChangeSet {
    const fs = require('fs'); // eslint-disable-line @typescript-eslint/no-require-imports
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ChangeSetInfo;
    const cs = new ChangeSet(data.module);
    // Overwrite auto-generated ID and timestamp
    Object.assign(cs, { id: data.id, timestamp: data.timestamp });

    data.changes.forEach((c) => {
      cs.addChange(new FileChange(c.type, c.path, c.content, c.description, c.originalContent));
    });

    return cs;
  }
}
