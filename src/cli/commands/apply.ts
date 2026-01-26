import { Command } from 'commander';
import { GeneratorPipeline } from '../../pipeline/GeneratorPipeline';
import { ChangeSet } from '../../changeset/ChangeSet';
import { FileOperator } from '../../utils/FileOperator';
import { QualityService } from '../../utils/QualityService';
import * as path from 'path';
import * as fs from 'fs';
import ora from 'ora';

interface ApplyCommandOptions {
  spec?: string;
  changeset?: string;
  validate?: boolean;
  commit?: boolean;
}

export function registerApplyCommand(program: Command) {
  const apply = program
    .command('apply')
    .description('Apply generated changes to the project')
    .option('--spec <path>', 'Path to YAML specification file')
    .option('--changeset <path>', 'Path to ChangeSet JSON file')
    .option('--no-validate', 'Skip quality checks (prettier, eslint, tsc)')
    .option('--commit', 'Auto commit changes to git', false)
    .action(async (options: ApplyCommandOptions) => {
      const spinner = ora('Applying changes').start();
      try {
        if (!options.spec && !options.changeset) {
          spinner.fail('Either --spec <path> or --changeset <path> is required');
          process.exit(1);
        }

        let changeset: ChangeSet;
        let moduleName: string;

        // Mode 1: Apply from ChangeSet JSON file
        if (options.changeset) {
          const changesetPath = path.resolve(process.cwd(), options.changeset);
          if (!fs.existsSync(changesetPath)) {
            spinner.fail(`ChangeSet file not found at: ${changesetPath}`);
            process.exit(1);
          }
          spinner.text = `Applying changeset: ${options.changeset}`;
          changeset = ChangeSet.load(changesetPath);
          moduleName = changeset.module;
        }
        // Mode 2: Generate from Spec and apply
        else if (options.spec) {
          const specPath = path.resolve(process.cwd(), options.spec);
          spinner.text = `Applying changes for: ${options.spec}`;

          const pipeline = new GeneratorPipeline(specPath);
          changeset = pipeline.execute();
          moduleName = pipeline.getSpec().module;
        } else {
          spinner.fail('Either --spec <path> or --changeset <path> is required');
          process.exit(1);
        }

        // Git Pre-check
        if (options.commit) {
          const { GitService } = await import('../../utils/GitService');
          const git = new GitService();
          if ((await git.isRepo()) && !(await git.isClean())) {
            console.warn('  ⚠️ Git working directory is not clean. Proceeding anyway...');
          }
        }

        // Execute all changes
        let appliedCount = 0;
        const appliedFiles: string[] = [];
        for (const change of changeset.getChanges()) {
          const fullPath = path.isAbsolute(change.path)
            ? change.path
            : path.join(process.cwd(), change.path);

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

        // Quality checks (if requested)
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

        // Git Commit (if requested)
        if (options.commit) {
          const { GitService } = await import('../../utils/GitService');
          const git = new GitService();

          if (await git.isRepo()) {
            spinner.start('Committing changes to Git...');
            await git.commit(`feat: generate module ${moduleName}`);
            spinner.succeed('Changes committed successfully.');
          }
        }
      } catch (error) {
        spinner.fail(`Error applying changes: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  return apply;
}
