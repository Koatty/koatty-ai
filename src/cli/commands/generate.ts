import { Command } from 'commander';
import { GeneratorPipeline, PipelineOptions } from '../../pipeline/GeneratorPipeline';
import { ChangeSetFormatter } from '../../changeset/ChangeSetFormatter';
import * as fs from 'fs';
import * as path from 'path';
import ora from 'ora';

interface GenerateCommandOptions {
  fields?: string;
  config?: string;
  api?: string;
  auth?: string | boolean;
  softDelete?: boolean;
  pagination?: boolean;
  search?: string;
}

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
    .action(async (moduleName: string, options: GenerateCommandOptions) => {
      const spinner = ora(`Generating module: ${moduleName}`).start();
      try {
        // Step 1: Build spec from CLI options
        const pipelineOptions: PipelineOptions = {
          specFilePath: options.config,
          inlineFieldsJson: options.fields,
          apiType: options.api as 'rest' | 'graphql',
          auth: options.auth,
          softDelete: options.softDelete,
          pagination: options.pagination,
          searchFields: options.search,
        };

        const spec = GeneratorPipeline.buildSpecFromOptions(moduleName, pipelineOptions);

        // Step 2: Merge inline fields if provided
        if (options.fields) {
          const tempPipeline = new GeneratorPipeline(spec);
          tempPipeline.mergeOptions(pipelineOptions);
          Object.assign(spec, tempPipeline.getSpec());
        }

        // Step 3: If config file is provided, load and merge it
        if (options.config) {
          const configPath = path.resolve(process.cwd(), options.config);
          const configPipeline = new GeneratorPipeline(configPath);
          const configSpec = configPipeline.getSpec();
          Object.assign(spec, configSpec);
        }

        // Step 3: Create pipeline and execute
        const pipeline = new GeneratorPipeline(spec);
        const changeset = pipeline.execute();

        // Step 4: Preview the changes
        spinner.succeed(`Generation logic completed for ${moduleName}`);
        console.log(ChangeSetFormatter.format(changeset));

        console.log('\n✨ Generation successful! (Ready to apply)');
        console.log(`Run 'koatty apply --changeset ${changeset.id}' to commit changes to disk.`);

        // Step 5: Save changeset for later apply
        const csDir = path.join(process.cwd(), '.koatty/changesets');
        if (!fs.existsSync(csDir)) {
          fs.mkdirSync(csDir, { recursive: true });
        }
        const csPath = path.join(csDir, `${changeset.id}.json`);
        changeset.save(csPath);
        console.log(`\nChangeSet saved to: ${csPath}`);
      } catch (error) {
        spinner.fail(`Generation failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  return generate;
}
