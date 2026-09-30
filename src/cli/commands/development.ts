import { Command } from 'commander';
import * as path from 'path';
import { capabilities, doctor } from '../../operations/discover';
import { verifyProject, CheckName } from '../../operations/verify';
import { diagnostic, printResult, result } from '../../operations/result';

export function registerDevelopmentCommands(program: Command): void {
  program
    .command('capabilities')
    .description('Discover supported AI development operations')
    .option('--json', 'Machine-readable output')
    .action((options) => printResult(capabilities(), options.json));
  program
    .command('doctor')
    .description('Diagnose project dependencies and static contracts without starting it')
    .option('--root <path>', 'Project root')
    .option('--json', 'Machine-readable output')
    .action((options) =>
      printResult(doctor(path.resolve(options.root ?? process.cwd())), options.json)
    );
  program
    .command('verify')
    .description('Run installed project tools; never install dependencies')
    .option('--root <path>', 'Project root')
    .option('--json', 'Machine-readable output')
    .option('--checks <list>', 'Comma-separated types,test,lint,manifest', 'types,test')
    .option('--file <path>', 'One test file inside test/ or tests/')
    .option('--timeout <ms>', 'Per-check timeout, 1 to 600000 ms', '60000')
    .action(async (options) => {
      try {
        printResult(
          await verifyProject(path.resolve(options.root ?? process.cwd()), {
            checks: options.checks.split(',') as CheckName[],
            file: options.file,
            timeoutMs: Number(options.timeout),
          }),
          options.json
        );
      } catch (error) {
        printResult(result('verify', 'failed', null, [diagnostic(error)]), options.json);
      }
    });
}
