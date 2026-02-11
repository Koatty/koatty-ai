import { Command } from 'commander';
import { TemplateManager, TemplateType, MirrorSource } from '../../services/TemplateManager';
import ora from 'ora';

const VALID_TYPES: TemplateType[] = ['project', 'modules', 'component'];
const VALID_MIRRORS: MirrorSource[] = ['github', 'gitee'];

/** 模板类型中文描述 */
const TYPE_LABELS: Record<TemplateType, string> = {
  project: '项目模板（koatty new）',
  modules: '模块模板（koatty create / add）',
  component: '组件库模板（koatty new -t middleware|plugin）',
};

/** 来源中文描述 */
const SOURCE_LABELS: Record<string, string> = {
  cache: '用户缓存',
  bundled: '内置(submodule)',
  none: '不可用',
};

export function registerTemplateCommand(program: Command): Command {
  const template = program.command('template').description('管理 Koatty 模板缓存');

  template
    .command('update')
    .description('更新模板缓存（从远程仓库重新下载到 ~/.koatty/templates/）')
    .option('-t, --type <type>', '模板类型: project|modules|component（不指定则更新全部）')
    .option('-m, --mirror <mirror>', '镜像源: github|gitee', 'github')
    .action(async (options: { type?: string; mirror?: string }) => {
      const mirror = VALID_MIRRORS.includes(options.mirror as MirrorSource)
        ? (options.mirror as MirrorSource)
        : 'github';

      const manager = new TemplateManager();
      const spinner = ora();

      if (options.type) {
        if (!VALID_TYPES.includes(options.type as TemplateType)) {
          console.error(`无效的模板类型: ${options.type}，可选: ${VALID_TYPES.join('|')}`);
          process.exit(1);
        }
        spinner.start(`正在更新模板: ${options.type}...`);
        try {
          await manager.ensureTemplateRepo(options.type as TemplateType, {
            mirror,
            force: true,
          });
          spinner.succeed(`模板已更新: ${options.type}`);
        } catch (error) {
          spinner.fail(`更新失败: ${(error as Error).message}`);
          process.exit(1);
        }
      } else {
        spinner.start('正在更新所有模板...');
        try {
          await manager.updateTemplates(mirror, (msg) => {
            spinner.text = msg;
          });
          spinner.succeed('所有模板已更新');
        } catch (error) {
          spinner.fail(`更新失败: ${(error as Error).message}`);
          process.exit(1);
        }
      }
    });

  template
    .command('status')
    .description('检查模板缓存状态')
    .action(() => {
      const manager = new TemplateManager();

      console.log('模板状态:\n');
      console.log(`  缓存目录: ${manager.getCacheDir()}`);
      console.log(`  内置目录: ${manager.getSubmoduleDir()}\n`);

      for (const type of VALID_TYPES) {
        const status = manager.getTemplateStatus(type);
        const sourceLabel = SOURCE_LABELS[status.source];
        const icon = status.source !== 'none' ? '✓' : '✗';

        console.log(`  ${icon} ${type} — ${TYPE_LABELS[type]}`);
        console.log(`    当前来源: ${sourceLabel}`);

        if (status.activePath) {
          console.log(`    使用路径: ${status.activePath}`);
        }

        if (status.cache.valid && status.cache.updatedAt) {
          console.log(`    缓存更新: ${status.cache.updatedAt.toLocaleString()}`);
        } else if (!status.cache.valid) {
          console.log(`    缓存状态: 未缓存（运行 koatty template update -t ${type} 下载）`);
        }

        if (status.bundled.valid) {
          console.log(`    内置模板: 可用 (${status.bundled.path})`);
        } else {
          console.log(`    内置模板: 不可用`);
        }

        console.log('');
      }
    });

  return program;
}
