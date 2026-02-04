#!/usr/bin/env node
/**
 * Koatty CLI - 安装后使用: koatty <command> 或 kt <command>
 */

import { Command } from 'commander';
import { version, description } from '../../package.json';
import { registerAddCommand } from './commands/add';
import { registerGenerateCommand } from './commands/generate';
import { registerPlanCommand } from './commands/plan';
import { registerApplyCommand } from './commands/apply';

const program = new Command();

program
  .name('koatty')
  .description(description)
  .version(version, '-v, --version', 'Output the current version');

// Register commands（推荐优先使用 add，无需先写 YAML）
registerAddCommand(program);
registerGenerateCommand(program);
registerPlanCommand(program);
registerApplyCommand(program);

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
