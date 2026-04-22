/**
 * QualityService handles automated code quality checks (formatting, linting, type-checking).
 */
export declare class QualityService {
    /**
     * Format multiple files. Only files with formatable extensions (.ts, .tsx, .js, .jsx, .json)
     * are processed; others are skipped.
     */
    static formatFiles(filePaths: string[]): void;
    /**
     * Format a file using Prettier.
     */
    static formatFile(filePath: string): void;
    /**
     * Lint a file using ESLint.
     */
    static lintFile(filePath: string): {
        success: boolean;
        output: string;
    };
    /**
     * Run TypeScript type-checking on the project.
     */
    static typeCheck(): {
        success: boolean;
        output: string;
    };
    /**
     * Run format and lint on a list of files.
     */
    static processFiles(filePaths: string[]): {
        formatted: string[];
        linted: string[];
        errors: string[];
    };
}
//# sourceMappingURL=QualityService.d.ts.map