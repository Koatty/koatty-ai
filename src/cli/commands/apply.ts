import { Command } from 'commander';
import { SpecParser } from '../../parser/SpecParser';
import { ModuleGenerator } from '../../generators/ModuleGenerator';
import { ChangeSet } from '../../changeset/ChangeSet';
import { FileOperator } from '../../utils/FileOperator';
import { ModuleRegistrar } from '../../patcher/ModuleRegistrar';
import { RouteRegistrar } from '../../patcher/RouteRegistrar';
import { QualityService } from '../../utils/QualityService';
import * as path from 'path';
import * as fs from 'fs';
const ora = require('ora');

export function registerApplyCommand(program: Command) {
  const apply = program
    .command('apply')
    .description('Apply generated changes to the project')
    .option('--spec <path>', 'Path to YAML configuration file')
    .option('--no-validate', 'Skip quality checks (prettier, eslint, tsc)')
    .option('--commit', 'Auto commit changes to git', false)
    .action(async (options) => {
      const spinner = ora('Applying changes').start();
      try {
        if (!options.spec) {
          spinner.fail('--spec <path> is required');
          process.exit(1);
        }

        const specPath = path.resolve(process.cwd(), options.spec);
        spinner.text = `Applying changes for: ${options.spec}`;

        // Git Pre-check
        if (options.commit) {
          const { GitService } = require('../../utils/GitService');
          const git = new GitService();
          if (await git.isRepo() && !(await git.isClean())) {
            console.warn('  ⚠️ Git working directory is not clean. Proceeding anyway...');
          }
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

        if (fs.existsSync(appModulePath)) registrar.patch(appModulePath);
        if (fs.existsSync(routerPath)) routeRegistrar.patch(routerPath);

        // 3. Execute all changes
        let appliedCount = 0;
        const appliedFiles: string[] = [];
        for (const change of changeset.getChanges()) {
          const fullPath = path.isAbsolute(change.path) ? change.path : path.join(process.cwd(), change.path);

          if (change.type === 'create' || change.type === 'modify') {
            FileOperator.writeFile(fullPath, change.content || '');
            console.log(`  ✅ ${change.type === 'create' ? 'Created' : 'Modified'} ${change.path}`);
            appliedCount++;
            appliedFiles.push(fullPath);
          } else if (change.type === 'delete') {
            FileOperator.deleteFile(fullPath);
            console.log(`  🗑️  Deleted ${change.path}`);
            appliedCount++;
          }
        }

        // 4. Quality checks (if requested)
        if (options.validate && appliedFiles.length > 0) {
          spinner.text = 'Running quality checks...';
          const report = QualityService.processFiles(appliedFiles);

          if (report.errors.length > 0) {
            spinner.warn(`Found ${report.errors.length} lint/quality issues.`);
          }

          spinner.text = 'Running type-check...';
          const typeCheck = QualityService.typeCheck();
          if (!typeCheck.success) {
            spinner.warn('Type-check failed.');
          }
        }

        spinner.succeed(`Successfully applied ${appliedCount} changes.`);

        // 5. Git Commit (if requested)
        if (options.commit) {
          const { GitService } = require('../../utils/GitService');
          const git = new GitService();

          if (await git.isRepo()) {
            spinner.start('Committing changes to Git...');
            await git.commit(`feat: generate module ${spec.module}`);
            spinner.succeed('Changes committed successfully.');
          }
        }

      } catch (error) {
        spinner.fail(`Error applying changes: ${(error as any).message}`);
        process.exit(1);
      }
    });

  return apply;
}
