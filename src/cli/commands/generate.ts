/**
 * Generate module command
 */

import { Command } from 'commander';

export function registerGenerateCommand(program: Command) {
  const generate = program
    .command('generate:module')
    .alias('g:m')
    .description('Generate a complete CRUD module')
    .argument('<module-name>', 'Name of the module to generate')
    .option('--fields <json>', 'Field definitions in JSON format')
    .option('--config <path>', 'Path to YAML configuration file')
    .option('--api <type>', 'API type (rest|graphql)', 'rest')
    .option('--auth [roles]', 'Enable authentication with optional roles')
    .option('--soft-delete', 'Enable soft delete support')
    .option('--pagination', 'Enable pagination support')
    .option('--search <fields>', 'Comma-separated list of searchable fields')
    .action(async (moduleName: string, options: any) => {
      console.log(`Generating module: ${moduleName}`);
      console.log('Options:', options);
      console.log('Command skeleton ready - implementation in later tasks');
    });

  return generate;
}
