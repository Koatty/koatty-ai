/**
 * 注册单文件模块创建命令（与旧 koatty_cli 兼容）
 */

import { Command } from 'commander';
import { runCreateModule } from './create';

export function registerCreateCommands(program: Command): void {
  program
    .command('controller [name]')
    .description('创建 Controller 类（可选 -t http|grpc|websocket|graphql，默认 http）')
    .option('-t, --type <type>', 'controller 类型: http|grpc|websocket|graphql', 'http')
    .action(async (name: string | undefined, opts: { type?: string }) => {
      const n = (name || '').trim();
      if (!n) {
        console.error('请提供名称，例如: koatty controller user 或 koatty controller user -t grpc');
        process.exit(1);
      }
      await runCreateModule('controller', n, { type: opts.type });
    });

  program
    .command('middleware <name>')
    .description('创建 Middleware 类')
    .action(async (name: string) => {
      await runCreateModule('middleware', name.trim());
    });

  program
    .command('service <name>')
    .description('创建 Service 类')
    .option('-i, --interface', '同时创建 Service 接口')
    .action(async (name: string, opts: { interface?: boolean }) => {
      await runCreateModule('service', name.trim(), { interface: opts.interface });
    });

  program
    .command('plugin <name>')
    .description('创建 Plugin 类')
    .action(async (name: string) => {
      await runCreateModule('plugin', name.trim());
    });

  program
    .command('aspect <name>')
    .description('创建 Aspect 切面类')
    .action(async (name: string) => {
      await runCreateModule('aspect', name.trim());
    });

  program
    .command('dto <name>')
    .description('创建 DTO 类')
    .action(async (name: string) => {
      await runCreateModule('dto', name.trim());
    });

  program
    .command('exception <name>')
    .description('创建 Exception 异常处理类')
    .action(async (name: string) => {
      await runCreateModule('exception', name.trim());
    });

  program
    .command('proto <name>')
    .description('创建 Proto 文件')
    .action(async (name: string) => {
      await runCreateModule('proto', name.trim());
    });

  program
    .command('model <name>')
    .description('创建 Model/Entity 类（TypeORM）')
    .option('-o, --orm <orm>', 'ORM: typeorm|thinkorm', 'typeorm')
    .action(async (name: string, opts: { orm?: string }) => {
      await runCreateModule('model', name.trim(), { orm: opts.orm });
    });
}
