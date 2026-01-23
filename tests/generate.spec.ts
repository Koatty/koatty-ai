/**
 * Tests for generate command
 */

import { execSync } from 'child_process';
import * as path from 'path';

describe('Generate Command', () => {
  const cliPath = path.join(__dirname, '../dist/cli/index.js');

  it('should recognize generate:module command', () => {
    const output = execSync(`node ${cliPath} generate:module test --fields '{"id":"number"}'`, { encoding: 'utf-8' });
    expect(output.toLowerCase()).toContain('test');
    expect(output).toContain('Generation successful');
  });

  it('should accept options', () => {
    const output = execSync(`node ${cliPath} generate:module user --api rest --pagination --fields '{"name":"string"}'`, {
      encoding: 'utf-8',
    });
    expect(output.toLowerCase()).toContain('user');
    expect(output).toContain('Generation successful');
  });
});
