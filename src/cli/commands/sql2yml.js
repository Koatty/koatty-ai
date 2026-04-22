"use strict";
/**
 * SQL 转 YAML 模块配置命令
 * 解析 CREATE TABLE 语句，生成模块 yml，并可执行 apply 生成模块
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSql2YmlCommand = registerSql2YmlCommand;
const tslib_1 = require("tslib");
const fs = tslib_1.__importStar(require("fs"));
const path = tslib_1.__importStar(require("path"));
const ora_1 = tslib_1.__importDefault(require("ora"));
const sql2yml_1 = require("../../utils/sql2yml");
const GeneratorPipeline_1 = require("../../pipeline/GeneratorPipeline");
const prompt_1 = require("../utils/prompt");
const VALID_TYPES = ['string', 'number', 'boolean', 'datetime', 'text', 'json'];
async function promptForUnknownTypes(unknownTypes) {
    const overrides = {};
    const rl = (0, prompt_1.createReadlineInterface)();
    try {
        console.log('\n⚠️  以下 SQL 类型无法识别，请手动指定 Spec 类型：');
        console.log('   可选: string | number | boolean | datetime | text | json\n');
        for (const u of unknownTypes) {
            const key = `${u.tableName}.${u.columnName}`;
            const typeInput = await (0, prompt_1.question)(rl, `${u.tableName}.${u.columnName} (${u.sqlType})`, 'string');
            const t = typeInput.toLowerCase();
            overrides[key] = VALID_TYPES.includes(t) ? t : 'string';
        }
    }
    finally {
        rl.close();
    }
    return overrides;
}
function registerSql2YmlCommand(program) {
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
        .action(async (sqlFile, options) => {
        const sqlPath = path.resolve(process.cwd(), sqlFile);
        if (!fs.existsSync(sqlPath)) {
            console.error(`❌ 文件不存在: ${sqlPath}`);
            process.exit(1);
        }
        const outputDir = options.output
            ? path.resolve(process.cwd(), options.output)
            : process.cwd();
        const spinner = (0, ora_1.default)('正在解析 SQL...').start();
        try {
            let typeOverrides;
            let result = await (0, sql2yml_1.sql2yml)(sqlPath, {
                apiType: options.api || 'rest',
                auth: !!options.auth,
                softDelete: options.softDelete !== false,
                pagination: options.pagination !== false,
                outputDir,
                apply: !!options.apply,
                dialect: options.dialect || 'auto',
            });
            if (result.unknownTypes.length > 0 && !options.yes) {
                spinner.stop();
                typeOverrides = await promptForUnknownTypes(result.unknownTypes);
                spinner.start('正在应用类型映射...');
                result = await (0, sql2yml_1.sql2yml)(sqlPath, {
                    apiType: options.api || 'rest',
                    auth: !!options.auth,
                    softDelete: options.softDelete !== false,
                    pagination: options.pagination !== false,
                    outputDir,
                    apply: !!options.apply,
                    dialect: options.dialect || 'auto',
                    typeOverrides,
                });
            }
            else if (result.unknownTypes.length > 0 && options.yes) {
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
                console.log(`  📄 ${t.tableName} -> ${path.relative(process.cwd(), ymlPath)} (模块: ${t.moduleName})`);
            }
            if (options.apply) {
                console.log('\n正在执行 apply...');
                for (const moduleName of tables.map((t) => t.moduleName)) {
                    const ymlPath = path.resolve(outputDir, `${moduleName}.yml`);
                    const spinner2 = (0, ora_1.default)(`生成模块: ${moduleName}`).start();
                    try {
                        const pipeline = new GeneratorPipeline_1.GeneratorPipeline(ymlPath, { workingDirectory: process.cwd() });
                        const changeset = await pipeline.execute();
                        const { FileOperator } = await Promise.resolve().then(() => tslib_1.__importStar(require('../../utils/FileOperator')));
                        const { ensureBackupInGitignore } = await Promise.resolve().then(() => tslib_1.__importStar(require('../../utils/gitignore')));
                        const backupPaths = [];
                        for (const change of changeset.getChanges()) {
                            const fullPath = path.join(process.cwd(), change.path);
                            if (change.type === 'create' || change.type === 'modify') {
                                const beforeCount = backupPaths.length;
                                FileOperator.writeFile(fullPath, change.content || '', true, (bp) => backupPaths.push(bp));
                                console.log(`  ✅ ${change.type === 'create' ? '创建' : '修改'} ${change.path}`);
                                if (backupPaths.length > beforeCount) {
                                    console.log(`     📦 备份: ${path.relative(process.cwd(), backupPaths[backupPaths.length - 1])}`);
                                }
                            }
                            else if (change.type === 'delete') {
                                FileOperator.deleteFile(fullPath);
                                console.log(`  🗑️  删除 ${change.path}`);
                            }
                        }
                        if (backupPaths.length > 0) {
                            ensureBackupInGitignore(process.cwd());
                        }
                        const { addProtocolToServerConfig } = await Promise.resolve().then(() => tslib_1.__importStar(require('../../utils/serverConfigPatcher')));
                        const apiType = pipeline.getSpec().api?.type;
                        if (apiType === 'grpc' || apiType === 'graphql') {
                            addProtocolToServerConfig(process.cwd(), apiType);
                        }
                        const { QualityService } = await Promise.resolve().then(() => tslib_1.__importStar(require('../../utils/QualityService')));
                        const appliedPaths = changeset
                            .getChanges()
                            .filter((c) => c.type === 'create' || c.type === 'modify')
                            .map((c) => path.join(process.cwd(), c.path));
                        if (appliedPaths.length > 0) {
                            QualityService.formatFiles(appliedPaths);
                        }
                        spinner2.succeed(`模块 ${moduleName} 生成完成`);
                    }
                    catch (err) {
                        spinner2.fail(`模块 ${moduleName} 生成失败: ${err.message}`);
                    }
                }
                console.log('\n✨ 模块生成完成。');
            }
            else {
                console.log('\n✨ 预览完成。变更生效请执行:');
                for (const t of tables) {
                    console.log(`   koatty apply ${t.moduleName}`);
                }
            }
        }
        catch (error) {
            spinner.fail(`解析失败: ${error.message}`);
            process.exit(1);
        }
    });
    return cmd;
}
//# sourceMappingURL=sql2yml.js.map