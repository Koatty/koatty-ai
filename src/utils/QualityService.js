"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityService = void 0;
const tslib_1 = require("tslib");
const child_process_1 = require("child_process");
const fs = tslib_1.__importStar(require("fs"));
const path = tslib_1.__importStar(require("path"));
const FORMATABLE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.json'];
/**
 * QualityService handles automated code quality checks (formatting, linting, type-checking).
 */
class QualityService {
    /**
     * Format multiple files. Only files with formatable extensions (.ts, .tsx, .js, .jsx, .json)
     * are processed; others are skipped.
     */
    static formatFiles(filePaths) {
        const toFormat = filePaths.filter((p) => fs.existsSync(p) && FORMATABLE_EXT.includes(path.extname(p)));
        for (const fp of toFormat) {
            this.formatFile(fp);
        }
    }
    /**
     * Format a file using Prettier.
     */
    static formatFile(filePath) {
        try {
            (0, child_process_1.execSync)(`npx prettier --write "${filePath}"`, { stdio: 'pipe' });
        }
        catch (error) {
            console.warn(`⚠️ Formatting failed for ${filePath}: ${error.message}`);
        }
    }
    /**
     * Lint a file using ESLint.
     */
    static lintFile(filePath) {
        try {
            const output = (0, child_process_1.execSync)(`npx eslint "${filePath}" --fix`, {
                encoding: 'utf-8',
                stdio: 'pipe',
            });
            return { success: true, output };
        }
        catch (error) {
            return {
                success: false,
                output: error.stdout?.toString() || error.message,
            };
        }
    }
    /**
     * Run TypeScript type-checking on the project.
     */
    static typeCheck() {
        try {
            const output = (0, child_process_1.execSync)('npx tsc --noEmit', { encoding: 'utf-8', stdio: 'pipe' });
            return { success: true, output };
        }
        catch (error) {
            return {
                success: false,
                output: error.stdout?.toString() || error.message,
            };
        }
    }
    /**
     * Run format and lint on a list of files.
     */
    static processFiles(filePaths) {
        const report = {
            formatted: [],
            linted: [],
            errors: [],
        };
        for (const file of filePaths) {
            if (!fs.existsSync(file))
                continue;
            // 1. Format
            this.formatFile(file);
            report.formatted.push(file);
            // 2. Lint
            const lintResult = this.lintFile(file);
            if (lintResult.success) {
                report.linted.push(file);
            }
            else {
                report.errors.push(`Lint error in ${file}: ${lintResult.output}`);
            }
        }
        return report;
    }
}
exports.QualityService = QualityService;
//# sourceMappingURL=QualityService.js.map