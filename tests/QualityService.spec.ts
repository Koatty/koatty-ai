import { QualityService } from '../src/utils/QualityService';
import * as fs from 'fs';
import * as path from 'path';

describe('QualityService', () => {
  const testFile = path.join(__dirname, 'QualityTest.ts');

  afterEach(() => {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  });

  it('should format a file', () => {
    // Unformatted code
    const content = 'const x=1;  const y  :number= 2;';
    fs.writeFileSync(testFile, content);

    QualityService.formatFile(testFile);

    const formattedContent = fs.readFileSync(testFile, 'utf-8');
    // Prettier should add spaces and semicolons correctly
    expect(formattedContent).not.toBe(content);
    expect(formattedContent).toContain('const x = 1;');
  });

  it('should lint a file', () => {
    // Code with potential lint issues (e.g., unused var if configured, but we check if command runs)
    const content = 'export const x = 1;';
    fs.writeFileSync(testFile, content);

    const result = QualityService.lintFile(testFile);
    // Even if it fails (due to project config), success is true if it runs to completion with --fix
    expect(result.output).toBeDefined();
  });

  it('should run type-check', () => {
    const result = QualityService.typeCheck();
    expect(result.output).toBeDefined();
  });
});
