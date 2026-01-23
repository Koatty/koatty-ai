/**
 * Tests for plan and apply commands
 */

import { execSync } from 'child_process';
import * as path from 'path';

describe('Plan Command', () => {
  const cliPath = path.join(__dirname, '../dist/cli/index.js');

  it('should recognize plan command', () => {
    try {
      execSync(`node ${cliPath} plan`, { encoding: 'utf-8', stdio: 'pipe' });
    } catch (e: any) {
      expect(e.stdout.toString() || e.stderr.toString()).toContain('--spec <path> is required');
    }
  });
});

describe('Apply Command', () => {
  const cliPath = path.join(__dirname, '../dist/cli/index.js');

  it('should recognize apply command', () => {
    try {
      execSync(`node ${cliPath} apply`, { encoding: 'utf-8', stdio: 'pipe' });
    } catch (e: any) {
      expect(e.stdout.toString() || e.stderr.toString()).toContain('--spec <path> is required');
    }
  });

  it('should accept validate and commit options', () => {
    const output = execSync(`node ${cliPath} apply --help`, { encoding: 'utf-8' });
    expect(output).toContain('--no-validate');
    expect(output).toContain('--commit');
  });
});
