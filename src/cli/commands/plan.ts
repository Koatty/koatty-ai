import { Command } from 'commander';
import { GeneratorPipeline } from '../../pipeline/GeneratorPipeline';
import { ChangeSetFormatter } from '../../changeset/ChangeSetFormatter';
import * as fs from 'fs';
import * as path from 'path';

interface PlanCommandOptions {
  spec?: string;
}

/**
 * Plan command - Preview changes before applying
 */
export function registerPlanCommand(program: Command) {
  const plan = program
    .command('plan')
    .description('Preview changes without applying them')
    .option('--spec <path>', 'Path to specification file (YAML/JSON)')
    .action(async (options: PlanCommandOptions) => {
      try {
        if (!options.spec) {
          console.error('Error: --spec <path> is required');
          process.exit(1);
        }

        const specPath = path.resolve(process.cwd(), options.spec);
        if (!fs.existsSync(specPath)) {
          console.error(`Error: Spec file not found at ${specPath}`);
          process.exit(1);
        }

        // Step 1: Create pipeline with disable patching (preview only)
        const pipeline = new GeneratorPipeline(specPath, { enablePatching: true });

        // Step 2: Execute the pipeline
        const changeset = pipeline.execute();
        const spec = pipeline.getSpec();

        // Step 3: Display summary
        console.log(`Plan for module: ${spec.module}`);
        console.log(`Spec file: ${options.spec}`);
        console.log('\n--- Proposed Changes ---');
        console.log(ChangeSetFormatter.format(changeset));
        console.log('\n--- End of Plan ---');
        console.log(`Run 'koatty-ai apply --spec ${options.spec}' to apply these changes.`);
      } catch (error) {
        console.error(`Error planning changes: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  return plan;
}
