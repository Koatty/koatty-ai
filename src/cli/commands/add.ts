import { Command } from 'commander';
import { GeneratorPipeline } from '../../pipeline/GeneratorPipeline';
import { ChangeSetFormatter } from '../../changeset/ChangeSetFormatter';
import { createReadlineInterface, promptForModule } from '../utils/prompt';
import { Spec } from '../../types/spec';
import { SpecParser } from '../../parser/SpecParser';
import { applyPlan, preparePlan } from '../../operations/plans';
import { resolveInside, writeInside } from '../../utils/sandbox';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import ora from 'ora';

interface AddCommandOptions {
  /** API 类型，传入则跳过交互式问答中的 API 类型选择 */
  type?: string;
}

function buildSpecFromInteractive(
  moduleName: string,
  result: Awaited<ReturnType<typeof promptForModule>>
): Spec {
  return {
    module: moduleName,
    table: `${moduleName.toLowerCase()}s`,
    fields: result.fields,
    api: {
      type: result.apiType,
      basePath: result.basePath,
      endpoints: [],
    },
    dto: { create: true, update: true, query: true },
    auth: result.auth
      ? { enabled: true, defaultRoles: result.authRoles.length ? result.authRoles : ['user'] }
      : undefined,
    features: {
      softDelete: result.softDelete,
      pagination: result.pagination,
      search: true,
      searchableFields: Object.keys(result.fields).filter(
        (k) => !['id', 'createdAt', 'updatedAt'].includes(k)
      ),
    },
  };
}

function specToYaml(spec: Spec): string {
  const obj: Record<string, unknown> = {
    module: spec.module,
    table: spec.table,
    fields: spec.fields,
    api: spec.api,
    dto: spec.dto,
    auth: spec.auth ?? undefined,
    features: spec.features ?? undefined,
  };
  return yaml.stringify(obj, { lineWidth: 0 });
}

export function registerAddCommand(program: Command) {
  const add = program
    .command('add')
    .alias('create')
    .description('交互式创建模块（rest/grpc/graphql）')
    .argument('<module-name>', '模块名，如 user、product')
    .option('-t, --type <type>', 'API 类型 rest|grpc|graphql，传入则跳过交互式选择')
    .action(async (moduleName: string, options: AddCommandOptions) => {
      if (!process.stdin.isTTY) {
        console.error(
          'NON_INTERACTIVE: use plan --spec <path> --json, then apply --plan <id> --yes'
        );
        process.exitCode = 1;
        return;
      }
      const name = moduleName.trim();
      if (!name) {
        console.error('请提供模块名，如: koatty add user 或 kt add user');
        process.exit(1);
      }

      const apiType =
        options.type && ['rest', 'grpc', 'graphql'].includes(options.type.toLowerCase())
          ? (options.type.toLowerCase() as 'rest' | 'grpc' | 'graphql')
          : undefined;

      const cwd = process.cwd();
      const ymlPath = resolveInside(cwd, `${name}.yml`);
      let existingSpec: Spec | undefined;
      if (fs.existsSync(ymlPath)) {
        try {
          existingSpec = SpecParser.parseFile(ymlPath);
        } catch {
          existingSpec = undefined;
        }
      }

      const rl = createReadlineInterface();
      let result: Awaited<ReturnType<typeof promptForModule>>;
      try {
        result = await promptForModule(rl, name, { apiType, existingSpec });
      } finally {
        rl.close();
      }

      const spec = buildSpecFromInteractive(name, result);

      const spinner = ora(`正在生成模块: ${name}`).start();
      try {
        const pipeline = new GeneratorPipeline(spec);
        const changeset = await pipeline.execute();
        spinner.succeed(`模块 ${name} 生成完成`);

        console.log(ChangeSetFormatter.format(changeset));

        const csDir = resolveInside(cwd, '.koatty/changesets');
        if (!fs.existsSync(csDir)) {
          fs.mkdirSync(csDir, { recursive: true });
        }
        const csPath = path.join(csDir, `${changeset.id}.json`);
        changeset.save(csPath);

        writeInside(cwd, ymlPath, specToYaml(spec));
        console.log(`\n📄 已保存配置: ${ymlPath}`);

        if (result.apply) {
          applyPlan(cwd, preparePlan(cwd, changeset.toJSON()), false);
          console.log('\n✨ 已写入项目，可直接使用。');
        } else {
          console.log(`\n✨ 预览完成。变更生效请执行: koatty apply ${name}`);
        }
      } catch (error) {
        spinner.fail(`生成失败: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  return add;
}
