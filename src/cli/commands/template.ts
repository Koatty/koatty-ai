import { Command } from 'commander';
import { TemplateManager, TemplateType, MirrorSource } from '../../services/TemplateManager';
import ora from 'ora';

const VALID_TYPES: TemplateType[] = ['project', 'modules', 'component'];
const VALID_MIRRORS: MirrorSource[] = ['github', 'gitee'];

export function registerTemplateCommand(program: Command): Command {
  const template = program.command('template').description('管理 Koatty 模板缓存');

  template
    .command('update')
    .description('更新模板缓存（从远程仓库重新下载）')
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
    .action(async () => {
      const manager = new TemplateManager();

      console.log('模板状态:\n');
      for (const type of VALID_TYPES) {
        try {
          const tplPath = await manager.getTemplatePath(type);
          console.log(`  ✓ ${type}: ${tplPath}`);
        } catch {
          console.log(`  ✗ ${type}: 未找到（运行 koatty template update --type ${type} 下载）`);
        }
      }
    });

  return program;
}
