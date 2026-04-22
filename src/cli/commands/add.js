"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAddCommand = registerAddCommand;
const tslib_1 = require("tslib");
const GeneratorPipeline_1 = require("../../pipeline/GeneratorPipeline");
const ChangeSetFormatter_1 = require("../../changeset/ChangeSetFormatter");
const prompt_1 = require("../utils/prompt");
const SpecParser_1 = require("../../parser/SpecParser");
const QualityService_1 = require("../../utils/QualityService");
const fs = tslib_1.__importStar(require("fs"));
const path = tslib_1.__importStar(require("path"));
const yaml = tslib_1.__importStar(require("yaml"));
const ora_1 = tslib_1.__importDefault(require("ora"));
function buildSpecFromInteractive(moduleName, result) {
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
            searchableFields: Object.keys(result.fields).filter((k) => !['id', 'createdAt', 'updatedAt'].includes(k)),
        },
    };
}
function specToYaml(spec) {
    const obj = {
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
function registerAddCommand(program) {
    const add = program
        .command('add')
        .alias('create')
        .description('交互式创建模块（rest/grpc/graphql）')
        .argument('<module-name>', '模块名，如 user、product')
        .option('-t, --type <type>', 'API 类型 rest|grpc|graphql，传入则跳过交互式选择')
        .action(async (moduleName, options) => {
        const name = moduleName.trim();
        if (!name) {
            console.error('请提供模块名，如: koatty add user 或 kt add user');
            process.exit(1);
        }
        const apiType = options.type && ['rest', 'grpc', 'graphql'].includes(options.type.toLowerCase())
            ? options.type.toLowerCase()
            : undefined;
        const cwd = process.cwd();
        const ymlPath = path.join(cwd, `${name}.yml`);
        let existingSpec;
        if (fs.existsSync(ymlPath)) {
            try {
                existingSpec = SpecParser_1.SpecParser.parseFile(ymlPath);
            }
            catch {
                existingSpec = undefined;
            }
        }
        const rl = (0, prompt_1.createReadlineInterface)();
        let result;
        try {
            result = await (0, prompt_1.promptForModule)(rl, name, { apiType, existingSpec });
        }
        finally {
            rl.close();
        }
        const spec = buildSpecFromInteractive(name, result);
        const spinner = (0, ora_1.default)(`正在生成模块: ${name}`).start();
        try {
            const pipeline = new GeneratorPipeline_1.GeneratorPipeline(spec);
            const changeset = await pipeline.execute();
            spinner.succeed(`模块 ${name} 生成完成`);
            // grpc/graphql: 更新 config/server.ts 的 protocol
            const apiType = spec.api?.type;
            if (apiType === 'grpc' || apiType === 'graphql') {
                const { addProtocolToServerConfig } = await Promise.resolve().then(() => tslib_1.__importStar(require('../../utils/serverConfigPatcher')));
                if (addProtocolToServerConfig(cwd, apiType)) {
                    console.log('\n📄 已更新 src/config/server.ts，已添加 protocol');
                }
            }
            console.log(ChangeSetFormatter_1.ChangeSetFormatter.format(changeset));
            const csDir = path.join(cwd, '.koatty', 'changesets');
            if (!fs.existsSync(csDir)) {
                fs.mkdirSync(csDir, { recursive: true });
            }
            const csPath = path.join(csDir, `${changeset.id}.json`);
            changeset.save(csPath);
            fs.writeFileSync(ymlPath, specToYaml(spec), 'utf-8');
            console.log(`\n📄 已保存配置: ${ymlPath}`);
            if (result.apply) {
                const { FileOperator } = await Promise.resolve().then(() => tslib_1.__importStar(require('../../utils/FileOperator')));
                const { ensureBackupInGitignore } = await Promise.resolve().then(() => tslib_1.__importStar(require('../../utils/gitignore')));
                const appliedPaths = [];
                const backupPaths = [];
                for (const change of changeset.getChanges()) {
                    const fullPath = path.join(cwd, change.path);
                    if (change.type === 'create' || change.type === 'modify') {
                        const beforeCount = backupPaths.length;
                        FileOperator.writeFile(fullPath, change.content || '', true, (bp) => backupPaths.push(bp));
                        console.log(`  ✅ ${change.type === 'create' ? '创建' : '修改'} ${change.path}`);
                        if (backupPaths.length > beforeCount) {
                            console.log(`     📦 备份: ${path.relative(cwd, backupPaths[backupPaths.length - 1])}`);
                        }
                        appliedPaths.push(fullPath);
                    }
                    else if (change.type === 'delete') {
                        FileOperator.deleteFile(fullPath);
                        console.log(`  🗑️  删除 ${change.path}`);
                    }
                }
                if (backupPaths.length > 0) {
                    ensureBackupInGitignore(cwd);
                }
                if (appliedPaths.length > 0) {
                    const formatSpinner = (0, ora_1.default)('正在格式化...').start();
                    QualityService_1.QualityService.formatFiles(appliedPaths);
                    formatSpinner.succeed('格式化完成');
                }
                console.log('\n✨ 已写入项目，可直接使用。');
            }
            else {
                console.log(`\n✨ 预览完成。变更生效请执行: koatty apply ${name}`);
            }
        }
        catch (error) {
            spinner.fail(`生成失败: ${error.message}`);
            process.exit(1);
        }
    });
    return add;
}
//# sourceMappingURL=add.js.map