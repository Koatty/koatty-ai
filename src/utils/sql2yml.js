"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sql2yml = sql2yml;
const tslib_1 = require("tslib");
const fs = tslib_1.__importStar(require("fs"));
const path = tslib_1.__importStar(require("path"));
const yaml = tslib_1.__importStar(require("yaml"));
const SqlParser_1 = require("../parser/SqlParser");
/**
 * 将 ParsedTable 转为 Spec
 */
function tableToSpec(table, options) {
    const fields = table.fields;
    const searchableFields = Object.keys(fields).filter((k) => !['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at'].includes(k));
    return {
        module: table.moduleName,
        table: table.tableName,
        fields,
        api: {
            type: options.apiType || 'rest',
            basePath: `/${table.moduleName}`,
            endpoints: [],
        },
        dto: { create: true, update: true, query: true },
        auth: options.auth ? { enabled: true, defaultRoles: options.authRoles || ['user'] } : undefined,
        features: {
            softDelete: options.softDelete ?? true,
            pagination: options.pagination ?? true,
            search: true,
            searchableFields,
        },
    };
}
const VALID_SPEC_TYPES = ['string', 'number', 'boolean', 'enum', 'datetime', 'text', 'json'];
/**
 * 将 CREATE TABLE SQL 转为模块 YAML 并输出
 */
async function sql2yml(sqlPath, options = {}) {
    const content = fs.readFileSync(sqlPath, 'utf-8');
    const { tables, unknownTypes } = SqlParser_1.SqlParser.parseFile(content, {
        dialect: options.dialect ?? 'auto',
    });
    if (tables.length === 0) {
        throw new Error('No valid CREATE TABLE statements found');
    }
    // 应用用户指定的类型覆盖
    const overrides = options.typeOverrides ?? {};
    const stillUnknown = [];
    for (const u of unknownTypes) {
        const key = `${u.tableName}.${u.columnName}`;
        const override = overrides[key];
        if (override && VALID_SPEC_TYPES.includes(override)) {
            const table = tables.find((t) => t.tableName === u.tableName);
            if (table?.fields[u.columnName]) {
                table.fields[u.columnName].type = override;
            }
        }
        else {
            stillUnknown.push(u);
        }
    }
    const cwd = options.outputDir || path.dirname(path.resolve(sqlPath));
    const ymlPaths = [];
    for (const table of tables) {
        const spec = tableToSpec(table, options);
        const yamlStr = yaml.stringify({
            module: spec.module,
            table: spec.table,
            fields: spec.fields,
            api: spec.api,
            dto: spec.dto,
            auth: spec.auth ?? undefined,
            features: spec.features ?? undefined,
        }, { lineWidth: 0 });
        const ymlPath = path.join(cwd, `${spec.module}.yml`);
        fs.writeFileSync(ymlPath, yamlStr, 'utf-8');
        ymlPaths.push(ymlPath);
    }
    return { tables, ymlPaths, unknownTypes: stillUnknown };
}
//# sourceMappingURL=sql2yml.js.map