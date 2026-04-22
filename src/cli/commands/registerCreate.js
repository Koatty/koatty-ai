"use strict";
/**
 * 注册单文件模块创建命令（与旧 koatty_cli 兼容）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCreateCommands = registerCreateCommands;
const create_1 = require("./create");
function registerCreateCommands(program) {
    program
        .command('controller [name]')
        .description('创建 Controller 类（可选 -t http|grpc|websocket|graphql，默认 http）')
        .option('-t, --type <type>', 'controller 类型: http|grpc|websocket|graphql', 'http')
        .action(async (name, opts) => {
        const n = (name || '').trim();
        if (!n) {
            console.error('请提供名称，例如: koatty controller user 或 koatty controller user -t grpc');
            process.exit(1);
        }
        await (0, create_1.runCreateModule)('controller', n, { type: opts.type });
    });
    program
        .command('middleware <name>')
        .description('创建 Middleware 类')
        .action(async (name) => {
        await (0, create_1.runCreateModule)('middleware', name.trim());
    });
    program
        .command('service <name>')
        .description('创建 Service 类')
        .option('-i, --interface', '同时创建 Service 接口')
        .action(async (name, opts) => {
        await (0, create_1.runCreateModule)('service', name.trim(), { interface: opts.interface });
    });
    program
        .command('plugin <name>')
        .description('创建 Plugin 类')
        .action(async (name) => {
        await (0, create_1.runCreateModule)('plugin', name.trim());
    });
    program
        .command('aspect <name>')
        .description('创建 Aspect 切面类')
        .action(async (name) => {
        await (0, create_1.runCreateModule)('aspect', name.trim());
    });
    program
        .command('dto <name>')
        .description('创建 DTO 类')
        .action(async (name) => {
        await (0, create_1.runCreateModule)('dto', name.trim());
    });
    program
        .command('exception <name>')
        .description('创建 Exception 异常处理类')
        .action(async (name) => {
        await (0, create_1.runCreateModule)('exception', name.trim());
    });
    program
        .command('proto <name>')
        .description('创建 Proto 文件')
        .action(async (name) => {
        await (0, create_1.runCreateModule)('proto', name.trim());
    });
    program
        .command('model <name>')
        .description('创建 Model/Entity 类（TypeORM）')
        .option('-o, --orm <orm>', 'ORM: typeorm|thinkorm', 'typeorm')
        .action(async (name, opts) => {
        await (0, create_1.runCreateModule)('model', name.trim(), { orm: opts.orm });
    });
}
//# sourceMappingURL=registerCreate.js.map