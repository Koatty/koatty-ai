/**
 * Tests for generate command
 */

import { execSync } from 'child_process';
import * as path from 'path';

describe('Generate Command', () => {
  const cliPath = path.join(__dirname, '../dist/cli/index.js');

  it('should recognize generate:module command', () => {
    const output = execSync(`node ${cliPath} generate:module test`, { encoding: 'utf-8' });
    expect(output).toContain('Generating module: test');
    expect(output).toContain('Command skeleton ready');
  });

  it('should accept options', () => {
    const output = execSync(`node ${cliPath} generate:module user --api rest --pagination`, {
      encoding: 'utf-8',
    });
    expect(output).toContain('Generating module: user');
    expect(output).toContain('pagination');
  });
});
