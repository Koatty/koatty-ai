import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { GeneratorPipeline } from '../../pipeline/GeneratorPipeline';
import { preparePlan, applyPlan, applySavedPlan } from '../../operations/plans';
import { verifyProject } from '../../operations/verify';
import { diagnostic, OperationError, printResult, result } from '../../operations/result';
import { resolveInside } from '../../utils/sandbox';

export function registerApplyCommand(program: Command) {
  return program
    .command('apply')
    .description('Apply a plan or changeset; preview unless --yes')
    .argument('[module-name]', 'Use <module>.yml')
    .option('--root <path>', 'Project root')
    .option('--spec <path>', 'Specification file inside project')
    .option('--changeset <path>', 'ChangeSet JSON file inside project')
    .option('--plan <id>', 'Apply a signed plan saved by plan --save-plan')
    .option('--no-validate', 'Skip type verification (receipt remains applied, not verified)')
    .option('--commit', 'Commit only these files, requiring a clean initial Git worktree', false)
    .option('--yes', 'Actually write files', false)
    .option('--json', 'Machine-readable result only on stdout', false)
    .action(async (moduleName, options) => {
      try {
        const root = path.resolve(options.root ?? process.cwd());
        const spec = options.spec ?? (moduleName ? `${moduleName.trim()}.yml` : undefined);
        if ([spec, options.changeset, options.plan].filter(Boolean).length !== 1)
          throw new OperationError(
            'INVALID_ARGUMENT',
            'Choose exactly one module/spec, changeset or plan'
          );
        let git: import('../../utils/GitService').GitService | undefined;
        if (options.commit && options.yes) {
          const { GitService } = await import('../../utils/GitService');
          git = new GitService(root);
          if (!(await git.isRepo()) || !(await git.isClean()))
            throw new OperationError('DIRTY_WORKTREE', '--commit requires a clean Git worktree');
        }
        let applied;
        if (options.plan) applied = applySavedPlan(root, options.plan, !options.yes);
        else {
          const info = options.changeset
            ? JSON.parse(fs.readFileSync(resolveInside(root, options.changeset), 'utf8'))
            : (
                await new GeneratorPipeline(resolveInside(root, spec), {
                  workingDirectory: root,
                }).execute()
              ).toJSON();
          applied = applyPlan(root, preparePlan(root, info), !options.yes);
        }
        if (applied.dryRun) {
          printResult(result('apply', 'preview', applied), options.json);
          return;
        }
        const verification = options.validate
          ? await verifyProject(root, { checks: ['types'] })
          : undefined;
        if (verification && verification.status !== 'completed') {
          printResult(
            result('apply', 'failed', { ...applied, verification }, verification.diagnostics),
            options.json
          );
          return;
        }
        if (git) await git.commit(`feat: generate module ${applied.module}`, applied.written);
        printResult(
          result('apply', verification ? 'completed' : 'applied', { ...applied, verification }),
          options.json
        );
      } catch (error) {
        printResult(result('apply', 'failed', null, [diagnostic(error)]), options.json);
      }
    });
}
