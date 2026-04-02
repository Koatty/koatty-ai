import { Command } from 'commander';
import { GeneratorPipeline } from '../../pipeline/GeneratorPipeline';
import { ChangeSetFormatter } from '../../changeset/ChangeSetFormatter';
import { OpenAPIGenerator } from '../../utils/OpenAPIGenerator';
import * as fs from 'fs';
import * as path from 'path';

interface PlanCommandOptions {
  spec?: string;
  openapi?: string;
}

/**
 * Plan command - Preview changes before applying
 */
export function registerPlanCommand(program: Command) {
  const plan = program
    .command('plan')
    .description('Preview changes without applying them')
    .option('--spec <path>', 'Path to specification file (YAML/JSON)')
    .option('--openapi <output>', 'Output OpenAPI 3.1 spec to file (JSON format)')
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

        const pipeline = new GeneratorPipeline(specPath);
        const spec = pipeline.getSpec();

        if (options.openapi) {
          const openapiGenerator = new OpenAPIGenerator(spec);
          const openapiSpec = openapiGenerator.generate();
          const outputPath = path.resolve(process.cwd(), options.openapi);
          const outputDir = path.dirname(outputPath);
          
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          fs.writeFileSync(outputPath, JSON.stringify(openapiSpec, null, 2), 'utf-8');
          console.log(`OpenAPI 3.1 spec written to: ${outputPath}`);
          return;
        }

        const changeset = await pipeline.execute();

        console.log(`Plan for module: ${spec.module}`);
        console.log(`Spec file: ${options.spec}`);
        console.log('\n--- Proposed Changes ---');
        console.log(ChangeSetFormatter.format(changeset));
        console.log('\n--- End of Plan ---');
        console.log(`Run 'koatty apply --spec ${options.spec}' to apply these changes.`);
      } catch (error) {
        console.error(`Error planning changes: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  return plan;
}
