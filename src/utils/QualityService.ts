import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * QualityService handles automated code quality checks (formatting, linting, type-checking).
 */
export class QualityService {
  /**
   * Format a file using Prettier.
   */
  static formatFile(filePath: string): void {
    try {
      execSync(`npx prettier --write "${filePath}"`, { stdio: 'pipe' });
    } catch (error) {
      console.warn(`⚠️ Formatting failed for ${filePath}: ${(error as any).message}`);
    }
  }

  /**
   * Lint a file using ESLint.
   */
  static lintFile(filePath: string): { success: boolean; output: string } {
    try {
      const output = execSync(`npx eslint "${filePath}" --fix`, { encoding: 'utf-8', stdio: 'pipe' });
      return { success: true, output };
    } catch (error) {
      return {
        success: false,
        output: (error as any).stdout?.toString() || (error as any).message
      };
    }
  }

  /**
   * Run TypeScript type-checking on the project.
   */
  static typeCheck(): { success: boolean; output: string } {
    try {
      const output = execSync('npx tsc --noEmit', { encoding: 'utf-8', stdio: 'pipe' });
      return { success: true, output };
    } catch (error) {
      return {
        success: false,
        output: (error as any).stdout?.toString() || (error as any).message
      };
    }
  }

  /**
   * Run format and lint on a list of files.
   */
  static processFiles(filePaths: string[]): { formatted: string[]; linted: string[]; errors: string[] } {
    const report = {
      formatted: [] as string[],
      linted: [] as string[],
      errors: [] as string[]
    };

    for (const file of filePaths) {
      if (!fs.existsSync(file)) continue;

      // 1. Format
      this.formatFile(file);
      report.formatted.push(file);

      // 2. Lint
      const lintResult = this.lintFile(file);
      if (lintResult.success) {
        report.linted.push(file);
      } else {
        report.errors.push(`Lint error in ${file}: ${lintResult.output}`);
      }
    }

    return report;
  }
}
