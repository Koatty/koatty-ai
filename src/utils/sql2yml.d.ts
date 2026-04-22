import { ParsedTable, UnknownSqlType } from '../parser/SqlParser';
import { SpecFieldType } from '../parser/SqlTypeMap';
import { SqlDialect } from '../parser/SqlTypeMap';
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
/**
 * 将 CREATE TABLE SQL 转为模块 YAML 并输出
 */
export declare function sql2yml(sqlPath: string, options?: Sql2YmlOptions): Promise<{
    tables: ParsedTable[];
    ymlPaths: string[];
    unknownTypes: UnknownSqlType[];
}>;
//# sourceMappingURL=sql2yml.d.ts.map