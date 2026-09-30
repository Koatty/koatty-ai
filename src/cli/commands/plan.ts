import { Command } from 'commander';
import * as path from 'path';
import { GeneratorPipeline } from '../../pipeline/GeneratorPipeline';
import { OpenAPIGenerator } from '../../utils/OpenAPIGenerator';
import { resolveInside, writeInside } from '../../utils/sandbox';
import { preparePlan, savePlan } from '../../operations/plans';
import { diagnostic, OperationError, printResult, result } from '../../operations/result';

export function registerPlanCommand(program: Command) {
  return program
    .command('plan')
    .description('Preview complete changes without writing project files')
    .option('--root <path>', 'Project root')
    .option('--spec <path>', 'YAML/JSON specification file inside project')
    .option('--openapi <output>', 'Explicitly write OpenAPI JSON inside project')
    .option(
      '--save-plan',
      'Explicitly persist a signed, single-use plan for a later CLI invocation'
    )
    .option('--json', 'Machine-readable result')
    .action(async (options) => {
      try {
        if (!options.spec)
          throw new OperationError('INVALID_ARGUMENT', '--spec <path> is required');
        const root = path.resolve(options.root ?? process.cwd());
        const pipeline = new GeneratorPipeline(resolveInside(root, options.spec), {
          workingDirectory: root,
        });
        if (options.openapi) {
          if (options.savePlan)
            throw new OperationError(
              'INVALID_ARGUMENT',
              '--openapi and --save-plan cannot be combined'
            );
          writeInside(
            root,
            options.openapi,
            JSON.stringify(new OpenAPIGenerator(pipeline.getSpec()).generate(), null, 2)
          );
          printResult(result('plan', 'completed', { openapi: options.openapi }), options.json);
          return;
        }
        const plan = preparePlan(root, (await pipeline.execute()).toJSON());
        if (options.savePlan) savePlan(root, plan);
        printResult(
          result('plan', 'preview', {
            planId: options.savePlan ? plan.id : undefined,
            hash: plan.hash,
            expires: plan.expires,
            saved: !!options.savePlan,
            changeset: plan.changeset,
          }),
          options.json
        );
      } catch (error) {
        printResult(result('plan', 'failed', null, [diagnostic(error)]), options.json);
      }
    });
}
