/**
 * Tests for plan and apply commands
 */

import { execSync } from 'child_process';
import * as path from 'path';

describe('Plan Command', () => {
  const cliPath = path.join(__dirname, '../dist/cli/index.js');

  it('should recognize plan command', () => {
    const output = execSync(`node ${cliPath} plan --spec test.yml`, { encoding: 'utf-8' });
    expect(output).toContain('Plan command executed');
    expect(output).toContain('test.yml');
  });
});

describe('Apply Command', () => {
  const cliPath = path.join(__dirname, '../dist/cli/index.js');

  it('should recognize apply command', () => {
    const output = execSync(`node ${cliPath} apply --spec test.yml`, { encoding: 'utf-8' });
    expect(output).toContain('Apply command executed');
    expect(output).toContain('test.yml');
  });

  it('should accept validate and commit options', () => {
    const output = execSync(`node ${cliPath} apply --spec test.yml --validate --commit`, {
      encoding: 'utf-8',
    });
    expect(output).toContain('Validate: true');
    expect(output).toContain('Auto-commit: true');
  });
});
