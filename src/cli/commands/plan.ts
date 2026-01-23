import { Command } from 'commander';
import { SpecParser } from '../../parser/SpecParser';
import { ModuleGenerator } from '../../generators/ModuleGenerator';
import { ChangeSet } from '../../changeset/ChangeSet';
import { ChangeSetFormatter } from '../../changeset/ChangeSetFormatter';
import { ModuleRegistrar } from '../../patcher/ModuleRegistrar';
import { RouteRegistrar } from '../../patcher/RouteRegistrar';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Plan command - Preview changes before applying
 */
export function registerPlanCommand(program: Command) {
  const plan = program
    .command('plan')
    .description('Preview changes without applying them')
    .option('--spec <path>', 'Path to specification file (YAML/JSON)')
    .action(async (options: any) => {
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

        const spec = SpecParser.parseFile(specPath);
        const changeset = new ChangeSet(spec.module);

        // 1. Generate core files
        const generator = new ModuleGenerator(spec, changeset);
        generator.generate();

        // 2. Add AST patches if project files exist
        const controllerName = `${spec.module}Controller`;
        const serviceName = `${spec.module}Service`;
        const registrar = new ModuleRegistrar(changeset, spec.module, controllerName, serviceName);
        const routeRegistrar = new RouteRegistrar(changeset, spec.module, controllerName);

        const appModulePath = path.join(process.cwd(), 'src/AppModule.ts');
        const routerPath = path.join(process.cwd(), 'src/config/router.ts');

        if (fs.existsSync(appModulePath)) {
          registrar.patch(appModulePath);
        }
        if (fs.existsSync(routerPath)) {
          routeRegistrar.patch(routerPath);
        }

        // 3. Display summary
        console.log(`Plan for module: ${spec.module}`);
        console.log(`Spec file: ${options.spec}`);
        console.log('\n--- Proposed Changes ---');
        console.log(ChangeSetFormatter.format(changeset));
        console.log('\n--- End of Plan ---');
        console.log(`Run 'koatty-ai apply --spec ${options.spec}' to apply these changes.`);

      } catch (error) {
        console.error(`Error planning changes: ${(error as any).message}`);
        process.exit(1);
      }
    });

  return plan;
}
