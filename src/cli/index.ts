#!/usr/bin/env node

/**
 * Koatty AI CLI Entry Point
 */

import { Command } from 'commander';
import { version, description } from '../../package.json';
import { registerGenerateCommand } from './commands/generate';
import { registerPlanCommand } from './commands/plan';
import { registerApplyCommand } from './commands/apply';

const program = new Command();

program
  .name('koatty-ai')
  .description(description)
  .version(version, '-v, --version', 'Output the current version');

// Register commands
registerGenerateCommand(program);
registerPlanCommand(program);
registerApplyCommand(program);

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

