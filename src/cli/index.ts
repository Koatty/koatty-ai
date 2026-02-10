#!/usr/bin/env node
/**
 * Koatty CLI - 安装后使用: koatty <command> 或 kt <command>
 */

import { Command } from 'commander';
import { version, description } from '../../package.json';
import { registerNewCommand } from './commands/new';
import { registerAddCommand } from './commands/add';
import { registerGenerateCommand } from './commands/generate';
import { registerPlanCommand } from './commands/plan';
import { registerApplyCommand } from './commands/apply';
import { registerCreateCommands } from './commands/registerCreate';
import { registerTemplateCommand } from './commands/template';

const program = new Command();

program
  .name('koatty')
  .description(description)
  .version(version, '-v, --version', 'Output the current version');

// Register commands：new/project -> create*(单文件) -> add -> plan -> apply -> generate:module
registerNewCommand(program);
registerCreateCommands(program);
registerAddCommand(program);
registerGenerateCommand(program);
registerPlanCommand(program);
registerApplyCommand(program);
registerTemplateCommand(program);

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
