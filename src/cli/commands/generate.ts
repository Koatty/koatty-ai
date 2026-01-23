import { Command } from 'commander';
import { SpecParser } from '../../parser/SpecParser';
import { Validator } from '../../parser/Validator';
import { FieldParser } from '../../parser/FieldParser';
import { ModuleGenerator } from '../../generators/ModuleGenerator';
import { ChangeSet } from '../../changeset/ChangeSet';
import { ChangeSetFormatter } from '../../changeset/ChangeSetFormatter';
import { ModuleRegistrar } from '../../patcher/ModuleRegistrar';
import { RouteRegistrar } from '../../patcher/RouteRegistrar';
import * as path from 'path';
const ora = require('ora');

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
      const spinner = ora(`Generating module: ${moduleName}`).start();
      try {
        let spec: any = {
          module: moduleName,
          fields: {},
          api: options.api ? {
            type: options.api,
            basePath: `/${moduleName.toLowerCase()}`,
          } : undefined,
          dto: {
            create: true,
            update: true,
            query: true,
          },
          features: {
            softDelete: !!options.softDelete,
            pagination: !!options.pagination,
            searchableFields: options.search ? options.search.split(',') : [],
          }
        };

        // 1. Load from config if provided
        if (options.config) {
          const configPath = path.resolve(process.cwd(), options.config);
          const parsedSpec = SpecParser.parseFile(configPath);
          spec = { ...spec, ...parsedSpec };
        }

        // 2. Parse inline fields
        if (options.fields) {
          const inlineFields = FieldParser.parseFields(options.fields);
          spec.fields = { ...spec.fields, ...inlineFields };
        }

        // 3. Handle auth roles
        if (options.auth) {
          spec.auth = {
            enabled: true,
            roles: typeof options.auth === 'string' ? options.auth.split(',') : [],
          };
        }

        // 4. Validate Spec
        try {
          Validator.validate(spec);
        } catch (err) {
          console.error(`\n❌ Validation failed: ${(err as any).message}`);
          process.exit(1);
        }

        // 5. Generate changes
        const changeset = new ChangeSet(moduleName);
        const generator = new ModuleGenerator(spec, changeset);
        generator.generate();

        // 6. AST Patching
        const controllerName = `${moduleName}Controller`;
        const serviceName = `${moduleName}Service`;

        const registrar = new ModuleRegistrar(changeset, moduleName, controllerName, serviceName);
        const routeRegistrar = new RouteRegistrar(changeset, moduleName, controllerName);

        // Check if files exist before patching
        const appModulePath = path.join(process.cwd(), 'src/AppModule.ts');
        const routerPath = path.join(process.cwd(), 'src/config/router.ts');

        // Note: For now we just record the intent in changeset. 
        // In 'generate' command, we usually apply directly if no 'plan' is requested.
        // But the task says 'generate:module' implementation.

        // Register in ChangeSet (these call modifyFile internally which adds to CS)
        const fs = require('fs');
        if (fs.existsSync(appModulePath)) {
          try {
            registrar.patch(appModulePath);
          } catch (e) {
            console.warn(`⚠️ Could not patch AppModule.ts: ${(e as any).message}`);
          }
        }

        if (fs.existsSync(routerPath)) {
          try {
            routeRegistrar.patch(routerPath);
          } catch (e) {
            console.warn(`⚠️ Could not patch router.ts: ${(e as any).message}`);
          }
        }

        // 7. Preview
        spinner.succeed(`Generation logic completed for ${moduleName}`);
        console.log(ChangeSetFormatter.format(changeset));

        console.log('\n✨ Generation successful! (Ready to apply)');
        console.log(`Run 'koatty-ai apply --spec <path>' to commit changes to disk.`);

        // Save changeset for later 'apply'
        const csDir = path.join(process.cwd(), '.koatty/changesets');
        if (!fs.existsSync(csDir)) {
          fs.mkdirSync(csDir, { recursive: true });
        }
        const csPath = path.join(csDir, `${changeset.id}.json`);
        changeset.save(csPath);
        console.log(`\nChangeSet saved to: ${csPath}`);

      } catch (error) {
        spinner.fail(`Generation failed: ${(error as any).message}`);
        process.exit(1);
      }
    });

  return generate;
}
