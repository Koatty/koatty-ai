"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GITIGNORE_BACKUP_PATTERN = void 0;
exports.ensureBackupInGitignore = ensureBackupInGitignore;
const tslib_1 = require("tslib");
const fs = tslib_1.__importStar(require("fs"));
const path = tslib_1.__importStar(require("path"));
exports.GITIGNORE_BACKUP_PATTERN = '*.bak.*';
/**
 * 确保 .gitignore 包含备份文件模式，避免将 *.bak.* 提交到版本库
 */
function ensureBackupInGitignore(cwd) {
    const gitignorePath = path.join(cwd, '.gitignore');
    let content = '';
    if (fs.existsSync(gitignorePath)) {
        content = fs.readFileSync(gitignorePath, 'utf-8');
    }
    if (content.includes(exports.GITIGNORE_BACKUP_PATTERN))
        return;
    const addition = content.trim()
        ? `\n# 生成备份文件\n${exports.GITIGNORE_BACKUP_PATTERN}`
        : exports.GITIGNORE_BACKUP_PATTERN;
    fs.writeFileSync(gitignorePath, content.trimEnd() + addition + '\n', 'utf-8');
}
//# sourceMappingURL=gitignore.js.map