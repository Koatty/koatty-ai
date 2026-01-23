/**
 * Tests for CLI entry point
 */

import { execSync } from 'child_process';
import * as path from 'path';

describe('CLI Entry Point', () => {
  const cliPath = path.join(__dirname, '../dist/cli/index.js');

  it('should display version with --version flag', () => {
    const output = execSync(`node ${cliPath} --version`, { encoding: 'utf-8' });
    expect(output).toContain('0.1.0');
  });

  it('should display help with --help flag', () => {
    const output = execSync(`node ${cliPath} --help`, { encoding: 'utf-8' });
    expect(output).toContain('Intelligent scaffolding tool');
    expect(output).toContain('Usage');
  });
});
