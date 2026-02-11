import { Command } from 'commander';
import { GeneratorPipeline } from '../../pipeline/GeneratorPipeline';
import { ChangeSet } from '../../changeset/ChangeSet';
import { FileOperator } from '../../utils/FileOperator';
import { QualityService } from '../../utils/QualityService';
import { ensureBackupInGitignore } from '../../utils/gitignore';
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
    .argument('[module-name]', '模块名，将使用 <module>.yml 生成并应用（如 koatty add user 后执行 koatty apply user）')
    .option('--spec <path>', 'Path to YAML specification file')
    .option('--changeset <path>', 'Path to ChangeSet JSON file')
    .option('--no-validate', 'Skip quality checks (prettier, eslint, tsc)')
    .option('--commit', 'Auto commit changes to git', false)
    .action(async (moduleName: string | undefined, options: ApplyCommandOptions) => {
      const spinner = ora('Applying changes').start();
      try {
        const specPath = options.spec ?? (moduleName ? `${moduleName.trim()}.yml` : undefined);
        if (!specPath && !options.changeset) {
          spinner.fail('请指定模块名（如 koatty apply user）或使用 --spec <path> / --changeset <path>');
          process.exit(1);
        }

        let changeset: ChangeSet;
        let resolvedModuleName: string;

        // Mode 1: Apply from ChangeSet JSON file
        if (options.changeset) {
          const changesetPath = path.resolve(process.cwd(), options.changeset);
          if (!fs.existsSync(changesetPath)) {
            spinner.fail(`ChangeSet file not found at: ${changesetPath}`);
            process.exit(1);
          }
          spinner.text = `Applying changeset: ${options.changeset}`;
          changeset = ChangeSet.load(changesetPath);
          resolvedModuleName = changeset.module;
        }
        // Mode 2: Generate from Spec (YAML) and apply
        else if (specPath) {
          const resolvedSpecPath = path.resolve(process.cwd(), specPath);
          if (!fs.existsSync(resolvedSpecPath)) {
            spinner.fail(`YAML 文件不存在: ${specPath}，请先执行 koatty add ${moduleName?.trim() || 'name'}`);
            process.exit(1);
          }
          spinner.text = `Applying changes for: ${specPath}`;

          const pipeline = new GeneratorPipeline(resolvedSpecPath);
          changeset = await pipeline.execute();
          resolvedModuleName = pipeline.getSpec().module;

          // grpc/graphql: 更新 config/server.ts 的 protocol
          const apiType = pipeline.getSpec().api?.type;
          if (apiType === 'grpc' || apiType === 'graphql') {
            const { addProtocolToServerConfig } = await import('../../utils/serverConfigPatcher');
            if (addProtocolToServerConfig(process.cwd(), apiType)) {
              console.log('  📄 已更新 src/config/server.ts，已添加 protocol');
            }
          }
        } else {
          spinner.fail('请指定模块名（如 koatty apply user）或使用 --spec <path> / --changeset <path>');
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

        // Execute all changes（modify 时先备份原文件）
        let appliedCount = 0;
        const appliedFiles: string[] = [];
        const backupPaths: string[] = [];
        for (const change of changeset.getChanges()) {
          const fullPath = path.isAbsolute(change.path)
            ? change.path
            : path.join(process.cwd(), change.path);

          if (change.type === 'create' || change.type === 'modify') {
            const beforeCount = backupPaths.length;
            FileOperator.writeFile(fullPath, change.content || '', true, (bp) => backupPaths.push(bp));
            console.log(`  ✅ ${change.type === 'create' ? 'Created' : 'Modified'} ${change.path}`);
            if (backupPaths.length > beforeCount) {
              console.log(`     📦 备份: ${path.relative(process.cwd(), backupPaths[backupPaths.length - 1])}`);
            }
            appliedCount++;
            appliedFiles.push(fullPath);
          } else if (change.type === 'delete') {
            FileOperator.deleteFile(fullPath);
            console.log(`  🗑️  Deleted ${change.path}`);
            appliedCount++;
          }
        }

        if (backupPaths.length > 0) {
          ensureBackupInGitignore(process.cwd());
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
            await git.commit(`feat: generate module ${resolvedModuleName}`);
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
