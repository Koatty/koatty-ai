"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileOperator = void 0;
const tslib_1 = require("tslib");
const fs = tslib_1.__importStar(require("fs"));
const path = tslib_1.__importStar(require("path"));
/**
 * 生成时间戳备份后缀（HHMMSS 6 位）
 */
function backupTimestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
}
/**
 * FileOperator handles physical file operations with safety checks and backups.
 */
class FileOperator {
    /**
     * Write content to a file, creating directories if needed.
     * If the file exists, creates a timestamped backup（如 UserService.bak.101224.ts）before overwriting.
     * @param backup 若为 true 且文件存在，则先备份
     * @param onBackup 备份完成后的回调，传入备份文件路径
     */
    static writeFile(filePath, content, backup = true, onBackup) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (backup && fs.existsSync(filePath)) {
            const ext = path.extname(filePath);
            const base = filePath.slice(0, -ext.length);
            const backupPath = `${base}.bak.${backupTimestamp()}${ext}`;
            fs.copyFileSync(filePath, backupPath);
            onBackup?.(backupPath);
        }
        fs.writeFileSync(filePath, content, 'utf-8');
    }
    /**
     * Delete a file if it exists.
     */
    static deleteFile(filePath) {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
    /**
     * Check if a file exists.
     */
    static exists(filePath) {
        return fs.existsSync(filePath);
    }
    /**
     * Read file content.
     */
    static readFile(filePath) {
        return fs.readFileSync(filePath, 'utf-8');
    }
}
exports.FileOperator = FileOperator;
//# sourceMappingURL=FileOperator.js.map