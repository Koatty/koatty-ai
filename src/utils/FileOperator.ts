import * as fs from 'fs';
import * as path from 'path';
import { resolveInside, writeInside } from './sandbox';

function existingParent(filePath: string): string {
  let parent = path.dirname(path.resolve(filePath));
  while (true) {
    try {
      if (fs.lstatSync(parent).isSymbolicLink())
        throw new Error('Symlink write directory is forbidden');
      return parent;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      parent = path.dirname(parent);
    }
  }
}

/**
 * 生成时间戳备份后缀（HHMMSS 6 位）
 */
function backupTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
}

/**
 * FileOperator handles physical file operations with safety checks and backups.
 */
export class FileOperator {
  /**
   * Write content to a file, creating directories if needed.
   * If the file exists, creates a timestamped backup（如 UserService.bak.101224.ts）before overwriting.
   * @param backup 若为 true 且文件存在，则先备份
   * @param onBackup 备份完成后的回调，传入备份文件路径
   */
  static writeFile(
    filePath: string,
    content: string,
    backup: boolean = true,
    onBackup?: (backupPath: string) => void,
    projectRoot?: string
  ): void {
    projectRoot ??= existingParent(filePath);
    filePath = resolveInside(projectRoot, filePath);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (backup && fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const base = ext ? filePath.slice(0, -ext.length) : filePath;
      const backupPath = resolveInside(projectRoot, `${base}.bak.${backupTimestamp()}${ext}`);
      fs.copyFileSync(filePath, backupPath, fs.constants.COPYFILE_EXCL);
      onBackup?.(backupPath);
    }

    writeInside(projectRoot, filePath, content);
  }

  /**
   * Delete a file if it exists.
   */
  static deleteFile(filePath: string, projectRoot?: string): void {
    projectRoot ??= existingParent(filePath);
    filePath = resolveInside(projectRoot, filePath);
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
