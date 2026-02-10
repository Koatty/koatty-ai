import { Command } from 'commander';
import { GeneratorPipeline } from '../../pipeline/GeneratorPipeline';
import { ChangeSetFormatter } from '../../changeset/ChangeSetFormatter';
import { getDefaultFieldsForModule, parseFieldShortSpec } from '../utils/defaultSpecs';
import { createReadlineInterface, promptForModule } from '../utils/prompt';
import { Spec } from '../../types/spec';
import { runCreateAll } from './create';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import ora from 'ora';

interface AddCommandOptions {
  yes?: boolean;
  fields?: string;
  apply?: boolean;
  saveSpec?: boolean;
  api?: string;
  auth?: string | boolean;
  softDelete?: boolean;
  pagination?: boolean;
  /** 仅搭建骨架：entity、service、controller、dto（原 all 能力） */
  scaffold?: boolean;
  /** scaffold 时 controller 类型：http|grpc|websocket|graphql */
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
      type: 'rest',
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
    .description('智能创建模块（无需先写 YAML，支持交互式与默认配置）')
    .argument('<module-name>', '模块名，如 user、product')
    .option('-y, --yes', '使用该模块的推荐默认字段，不交互')
    .option('--fields <spec>', '字段简写，如 "name:string username:string required email:string"')
    .option('--apply', '生成后直接写入项目（等同再执行 apply）')
    .option('--save-spec', '将本次配置保存为 <module>.yml')
    .option('--api <type>', 'API 类型 rest|graphql', 'rest')
    .option('--auth [roles]', '启用认证，可选角色逗号分隔')
    .option('--soft-delete', '启用软删除')
    .option('--pagination', '启用分页')
    .option('--scaffold', '仅搭建骨架：entity、service、controller、dto（不生成完整 CRUD）')
    .option('-t, --type <type>', 'scaffold 时 controller 类型: http|grpc|websocket|graphql', 'http')
    .action(async (moduleName: string, options: AddCommandOptions) => {
      const name = moduleName.trim();
      if (!name) {
        console.error('请提供模块名，如: koatty add user 或 kt add user');
        process.exit(1);
      }

      if (options.scaffold) {
        runCreateAll(name, { type: options.type });
        return;
      }

      let spec: Spec;
      let saveSpec = options.saveSpec ?? false;

      if (options.yes) {
        const fields = getDefaultFieldsForModule(name);
        spec = {
          module: name,
          table: `${name.toLowerCase()}s`,
          fields,
          api: { type: 'rest', basePath: `/${name.toLowerCase()}`, endpoints: [] },
          dto: { create: true, update: true, query: true },
          auth: options.auth
            ? { enabled: true, defaultRoles: typeof options.auth === 'string' ? options.auth.split(',') : ['user'] }
            : undefined,
          features: {
            softDelete: options.softDelete ?? true,
            pagination: options.pagination ?? true,
            search: true,
            searchableFields: Object.keys(fields).filter((k) => !['id', 'createdAt', 'updatedAt'].includes(k)),
          },
        };
      } else if (options.fields) {
        const fields = parseFieldShortSpec(options.fields);
        if (Object.keys(fields).length === 0) {
          console.error('--fields 解析失败，请用格式: name:string email:string');
          process.exit(1);
        }
        spec = {
          module: name,
          table: `${name.toLowerCase()}s`,
          fields,
          api: { type: 'rest', basePath: `/${name.toLowerCase()}`, endpoints: [] },
          dto: { create: true, update: true, query: true },
          auth: options.auth
            ? { enabled: true, defaultRoles: typeof options.auth === 'string' ? options.auth.split(',') : ['user'] }
            : undefined,
          features: {
            softDelete: options.softDelete ?? false,
            pagination: options.pagination ?? true,
            search: true,
            searchableFields: Object.keys(fields).filter((k) => !['id', 'createdAt', 'updatedAt'].includes(k)),
          },
        };
      } else {
        const rl = createReadlineInterface();
        try {
          const result = await promptForModule(rl, name);
          saveSpec = result.saveSpec;
          spec = buildSpecFromInteractive(name, result);
        } finally {
          rl.close();
        }
      }

      const spinner = ora(`正在生成模块: ${name}`).start();
      try {
        const pipeline = new GeneratorPipeline(spec);
        const changeset = pipeline.execute();
        spinner.succeed(`模块 ${name} 生成完成`);

        console.log(ChangeSetFormatter.format(changeset));

        const cwd = process.cwd();
        const csDir = path.join(cwd, '.koatty', 'changesets');
        if (!fs.existsSync(csDir)) {
          fs.mkdirSync(csDir, { recursive: true });
        }
        const csPath = path.join(csDir, `${changeset.id}.json`);
        changeset.save(csPath);

        if (saveSpec) {
          const ymlPath = path.join(cwd, `${name}.yml`);
          fs.writeFileSync(ymlPath, specToYaml(spec), 'utf-8');
          console.log(`\n📄 已保存配置: ${ymlPath}`);
        }

        if (options.apply) {
          const { FileOperator } = await import('../../utils/FileOperator');
          for (const change of changeset.getChanges()) {
            const fullPath = path.join(cwd, change.path);
            if (change.type === 'create' || change.type === 'modify') {
              FileOperator.writeFile(fullPath, change.content || '');
              console.log(`  ✅ ${change.type === 'create' ? '创建' : '修改'} ${change.path}`);
            } else if (change.type === 'delete') {
              FileOperator.deleteFile(fullPath);
              console.log(`  🗑️  删除 ${change.path}`);
            }
          }
          console.log('\n✨ 已写入项目，可直接使用。');
        } else {
          console.log(`\n✨ 预览完成。写入项目请执行: koatty apply --changeset ${csPath}`);
          console.log(`   或下次使用: koatty add ${name} --apply`);
        }
      } catch (error) {
        spinner.fail(`生成失败: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  return add;
}
