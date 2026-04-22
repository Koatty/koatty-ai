/**
 * FileOperator handles physical file operations with safety checks and backups.
 */
export declare class FileOperator {
    /**
     * Write content to a file, creating directories if needed.
     * If the file exists, creates a timestamped backup（如 UserService.bak.101224.ts）before overwriting.
     * @param backup 若为 true 且文件存在，则先备份
     * @param onBackup 备份完成后的回调，传入备份文件路径
     */
    static writeFile(filePath: string, content: string, backup?: boolean, onBackup?: (backupPath: string) => void): void;
    /**
     * Delete a file if it exists.
     */
    static deleteFile(filePath: string): void;
    /**
     * Check if a file exists.
     */
    static exists(filePath: string): boolean;
    /**
     * Read file content.
     */
    static readFile(filePath: string): string;
}
//# sourceMappingURL=FileOperator.d.ts.map