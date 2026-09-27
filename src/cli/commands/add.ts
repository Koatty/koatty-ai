import { Command } from 'commander';
import { GeneratorPipeline } from '../../pipeline/GeneratorPipeline';
import { ChangeSetFormatter } from '../../changeset/ChangeSetFormatter';
import { createReadlineInterface, promptForModule } from '../utils/prompt';
import { Spec } from '../../types/spec';
import { SpecParser } from '../../parser/SpecParser';
import { QualityService } from '../../utils/QualityService';
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
      const ymlPath = path.join(cwd, `${name}.yml`);
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

        // grpc/graphql: 更新 config/server.ts 的 protocol
        const apiType = spec.api?.type;
        if (apiType === 'grpc' || apiType === 'graphql') {
          const { addProtocolToServerConfig } = await import('../../utils/serverConfigPatcher');
          if (addProtocolToServerConfig(cwd, apiType)) {
            console.log('\n📄 已更新 src/config/server.ts，已添加 protocol');
          }
        }

        console.log(ChangeSetFormatter.format(changeset));

        const csDir = path.join(cwd, '.koatty', 'changesets');
        if (!fs.existsSync(csDir)) {
          fs.mkdirSync(csDir, { recursive: true });
        }
        const csPath = path.join(csDir, `${changeset.id}.json`);
        changeset.save(csPath);

        fs.writeFileSync(ymlPath, specToYaml(spec), 'utf-8');
        console.log(`\n📄 已保存配置: ${ymlPath}`);

        if (result.apply) {
          const { FileOperator } = await import('../../utils/FileOperator');
          const { ensureBackupInGitignore } = await import('../../utils/gitignore');
          const appliedPaths: string[] = [];
          const backupPaths: string[] = [];
          for (const change of changeset.getChanges()) {
            const fullPath = path.join(cwd, change.path);
            if (change.type === 'create' || change.type === 'modify') {
              const beforeCount = backupPaths.length;
              FileOperator.writeFile(fullPath, change.content || '', true, (bp) =>
                backupPaths.push(bp)
              );
              console.log(`  ✅ ${change.type === 'create' ? '创建' : '修改'} ${change.path}`);
              if (backupPaths.length > beforeCount) {
                console.log(
                  `     📦 备份: ${path.relative(cwd, backupPaths[backupPaths.length - 1])}`
                );
              }
              appliedPaths.push(fullPath);
            } else if (change.type === 'delete') {
              FileOperator.deleteFile(fullPath);
              console.log(`  🗑️  删除 ${change.path}`);
            }
          }
          if (backupPaths.length > 0) {
            ensureBackupInGitignore(cwd);
          }
          if (appliedPaths.length > 0) {
            const formatSpinner = ora('正在格式化...').start();
            QualityService.formatFiles(appliedPaths);
            formatSpinner.succeed('格式化完成');
          }
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
