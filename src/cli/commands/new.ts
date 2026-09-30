import { Command } from 'commander';
import * as path from 'path';
import { scaffoldProject } from '../../operations/scaffold';
import { diagnostic, printResult, result } from '../../operations/result';

export function registerNewCommand(program: Command) {
  for (const name of ['new', 'project']) {
    program
      .command(`${name} <project-name>`)
      .description('Create a project, MCP/Agent application or component library')
      .option('-d, --dir <path>', 'Target directory')
      .option('-t, --template <template>', 'project|mcp|agent|middleware|plugin', 'project')
      .option('--source <source>', 'Template source: bundled|cache', 'bundled')
      .option('--offline', 'Refuse template download')
      .option('--template-digest <sha256>', 'Require this exact template snapshot')
      .option('--json', 'Machine-readable generation receipt')
      .action(async (projectName, options) => {
        try {
          const data = await scaffoldProject(
            projectName,
            path.resolve(options.dir ?? projectName),
            {
              template: options.template,
              source: options.source,
              offline: options.offline,
              digest: options.templateDigest,
            }
          );
          printResult(result('new', 'applied', data), options.json);
          if (!options.json)
            console.log('Install dependencies, then run npm run build and npm test.');
        } catch (error) {
          printResult(result('new', 'failed', null, [diagnostic(error)]), options.json);
        }
      });
  }
  return program;
}
