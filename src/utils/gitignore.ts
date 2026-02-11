import * as fs from 'fs';
import * as path from 'path';

export const GITIGNORE_BACKUP_PATTERN = '*.bak.*';

/**
 * 确保 .gitignore 包含备份文件模式，避免将 *.bak.* 提交到版本库
 */
export function ensureBackupInGitignore(cwd: string): void {
  const gitignorePath = path.join(cwd, '.gitignore');
  let content = '';
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf-8');
  }
  if (content.includes(GITIGNORE_BACKUP_PATTERN)) return;
  const addition = content.trim()
    ? `\n# 生成备份文件\n${GITIGNORE_BACKUP_PATTERN}`
    : GITIGNORE_BACKUP_PATTERN;
  fs.writeFileSync(gitignorePath, content.trimEnd() + addition + '\n', 'utf-8');
}
