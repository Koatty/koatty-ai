import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { SqlParser, ParsedTable, UnknownSqlType } from '../parser/SqlParser';
import { Spec } from '../types/spec';
import { SpecFieldType } from '../parser/SqlTypeMap';
import { SqlDialect } from '../parser/SqlTypeMap';

/**
 * 将 ParsedTable 转为 Spec
 */
function tableToSpec(table: ParsedTable, options: Sql2YmlOptions): Spec {
  const fields = table.fields;
  const searchableFields = Object.keys(fields).filter(
    (k) => !['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at'].includes(k)
  );

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

export interface Sql2YmlOptions {
  apiType?: 'rest' | 'grpc' | 'graphql';
  auth?: boolean;
  authRoles?: string[];
  softDelete?: boolean;
  pagination?: boolean;
  outputDir?: string;
  apply?: boolean;
  dialect?: SqlDialect;
  /** 未知类型的覆盖：key 为 "tableName.columnName" */
  typeOverrides?: Record<string, SpecFieldType>;
}

const VALID_SPEC_TYPES: SpecFieldType[] = ['string', 'number', 'boolean', 'enum', 'datetime', 'text', 'json'];

/**
 * 将 CREATE TABLE SQL 转为模块 YAML 并输出
 */
export async function sql2yml(
  sqlPath: string,
  options: Sql2YmlOptions = {}
): Promise<{ tables: ParsedTable[]; ymlPaths: string[]; unknownTypes: UnknownSqlType[] }> {
  const content = fs.readFileSync(sqlPath, 'utf-8');
  const { tables, unknownTypes } = SqlParser.parseFile(content, {
    dialect: options.dialect ?? 'auto',
  });

  if (tables.length === 0) {
    throw new Error('未找到有效的 CREATE TABLE 语句');
  }

  // 应用用户指定的类型覆盖
  const overrides = options.typeOverrides ?? {};
  const stillUnknown: UnknownSqlType[] = [];
  for (const u of unknownTypes) {
    const key = `${u.tableName}.${u.columnName}`;
    const override = overrides[key];
    if (override && VALID_SPEC_TYPES.includes(override)) {
      const table = tables.find((t) => t.tableName === u.tableName);
      if (table?.fields[u.columnName]) {
        table.fields[u.columnName].type = override;
      }
    } else {
      stillUnknown.push(u);
    }
  }

  const cwd = options.outputDir || path.dirname(path.resolve(sqlPath));
  const ymlPaths: string[] = [];

  for (const table of tables) {
    const spec = tableToSpec(table, options);
    const yamlStr = yaml.stringify(
      {
        module: spec.module,
        table: spec.table,
        fields: spec.fields,
        api: spec.api,
        dto: spec.dto,
        auth: spec.auth ?? undefined,
        features: spec.features ?? undefined,
      },
      { lineWidth: 0 }
    );

    const ymlPath = path.join(cwd, `${spec.module}.yml`);
    fs.writeFileSync(ymlPath, yamlStr, 'utf-8');
    ymlPaths.push(ymlPath);
  }

  return { tables, ymlPaths, unknownTypes: stillUnknown };
}
