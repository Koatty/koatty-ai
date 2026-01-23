import * as fs from 'fs';
import * as path from 'path';

/**
 * FileOperator handles physical file operations with safety checks and backups.
 */
export class FileOperator {
  /**
   * Write content to a file, creating directories if needed.
   * If the file exists, it creates a backup before overwriting.
   */
  static writeFile(filePath: string, content: string, backup: boolean = true): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (backup && fs.existsSync(filePath)) {
      const backupPath = `${filePath}.bak`;
      fs.copyFileSync(filePath, backupPath);
    }

    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Delete a file if it exists.
   */
  static deleteFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * Check if a file exists.
   */
  static exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * Read file content.
   */
  static readFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
  }
}
