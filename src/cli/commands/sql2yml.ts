/**
 * SQL 转 YAML 模块配置命令
 * 解析 CREATE TABLE 语句，生成模块 yml，并可执行 apply 生成模块
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import ora from 'ora';
import { sql2yml } from '../../utils/sql2yml';
import { GeneratorPipeline } from '../../pipeline/GeneratorPipeline';
import { createReadlineInterface, question } from '../utils/prompt';
import { applyPlan, preparePlan } from '../../operations/plans';
import { SpecFieldType } from '../../parser/SqlTypeMap';

const VALID_TYPES = ['string', 'number', 'boolean', 'datetime', 'text', 'json'];

async function promptForUnknownTypes(
  unknownTypes: Array<{ tableName: string; columnName: string; sqlType: string }>
): Promise<Record<string, SpecFieldType>> {
  const overrides: Record<string, SpecFieldType> = {};
  const rl = createReadlineInterface();
  try {
    console.log('\n⚠️  以下 SQL 类型无法识别，请手动指定 Spec 类型：');
    console.log('   可选: string | number | boolean | datetime | text | json\n');
    for (const u of unknownTypes) {
      const key = `${u.tableName}.${u.columnName}`;
      const typeInput = await question(
        rl,
        `${u.tableName}.${u.columnName} (${u.sqlType})`,
        'string'
      );
      const t = typeInput.toLowerCase() as SpecFieldType;
      overrides[key] = VALID_TYPES.includes(t) ? t : 'string';
    }
  } finally {
    rl.close();
  }
  return overrides;
}

export function registerSql2YmlCommand(program: Command) {
  const cmd = program
    .command('sql2yml')
    .description('将 CREATE TABLE SQL 转为模块 YAML，支持 -o 输出目录、--apply 直接生成')
    .argument('<sql-file>', 'SQL 文件路径（包含 CREATE TABLE 语句）')
    .option('-o, --output <dir>', 'YAML 输出目录，默认与 SQL 同目录或当前目录')
    .option('-d, --dialect <db>', '数据库类型 mysql|postgres|oracle|auto', 'auto')
    .option('--api <type>', 'API 类型 rest|grpc|graphql', 'rest')
    .option('--auth', '启用认证')
    .option('--no-soft-delete', '禁用软删除')
    .option('--no-pagination', '禁用分页')
    .option('--apply', '生成 YAML 后立即执行 koatty apply 生成模块')
    .option('-y, --yes', '非交互模式：未知类型默认为 string，不提示')
    .action(async (sqlFile: string, options: Record<string, unknown>) => {
      const sqlPath = path.resolve(process.cwd(), sqlFile);
      if (!fs.existsSync(sqlPath)) {
        console.error(`❌ 文件不存在: ${sqlPath}`);
        process.exit(1);
      }

      const outputDir = options.output
        ? path.resolve(process.cwd(), options.output as string)
        : process.cwd();

      const spinner = ora('正在解析 SQL...').start();

      try {
        let typeOverrides: Record<string, SpecFieldType> | undefined;
        let result = await sql2yml(sqlPath, {
          apiType: (options.api as 'rest' | 'grpc' | 'graphql') || 'rest',
          auth: !!options.auth,
          softDelete: options.softDelete !== false,
          pagination: options.pagination !== false,
          outputDir,
          apply: !!options.apply,
          dialect: (options.dialect as 'mysql' | 'postgres' | 'oracle' | 'auto') || 'auto',
        });

        if (result.unknownTypes.length > 0 && !options.yes) {
          if (!process.stdin.isTTY)
            throw new Error('NON_INTERACTIVE: unknown SQL types require explicit mapping or --yes');
          spinner.stop();
          typeOverrides = await promptForUnknownTypes(result.unknownTypes);
          spinner.start('正在应用类型映射...');
          result = await sql2yml(sqlPath, {
            apiType: (options.api as 'rest' | 'grpc' | 'graphql') || 'rest',
            auth: !!options.auth,
            softDelete: options.softDelete !== false,
            pagination: options.pagination !== false,
            outputDir,
            apply: !!options.apply,
            dialect: (options.dialect as 'mysql' | 'postgres' | 'oracle' | 'auto') || 'auto',
            typeOverrides,
          });
        } else if (result.unknownTypes.length > 0 && options.yes) {
          console.log('\n⚠️  以下类型无法识别，已默认为 string：');
          for (const u of result.unknownTypes) {
            console.log(`   - ${u.tableName}.${u.columnName} (${u.sqlType})`);
          }
        }

        const { tables, ymlPaths } = result;
        spinner.succeed(`解析完成，共 ${tables.length} 个表`);

        for (let i = 0; i < tables.length; i++) {
          const t = tables[i];
          const ymlPath = ymlPaths[i];
          console.log(
            `  📄 ${t.tableName} -> ${path.relative(process.cwd(), ymlPath)} (模块: ${t.moduleName})`
          );
        }

        if (options.apply) {
          console.log('\n正在执行 apply...');
          for (const moduleName of tables.map((t) => t.moduleName)) {
            const ymlPath = path.resolve(outputDir, `${moduleName}.yml`);
            const spinner2 = ora(`生成模块: ${moduleName}`).start();
            try {
              const pipeline = new GeneratorPipeline(ymlPath, { workingDirectory: process.cwd() });
              const changeset = await pipeline.execute();
              applyPlan(process.cwd(), preparePlan(process.cwd(), changeset.toJSON()), false);

              spinner2.succeed(`模块 ${moduleName} 生成完成`);
            } catch (err) {
              spinner2.fail(`模块 ${moduleName} 生成失败: ${(err as Error).message}`);
              process.exitCode = 1;
            }
          }
          if (!process.exitCode) console.log('\n✨ 模块生成完成。');
        } else {
          console.log('\n✨ 预览完成。变更生效请执行:');
          for (const t of tables) {
            console.log(`   koatty apply ${t.moduleName}`);
          }
        }
      } catch (error) {
        spinner.fail(`解析失败: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  return cmd;
}
