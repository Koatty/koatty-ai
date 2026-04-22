import { Field } from '../types/spec';
import { SqlDialect } from './SqlTypeMap';
export interface ParsedTable {
    tableName: string;
    moduleName: string;
    fields: Record<string, Field>;
}
export interface UnknownSqlType {
    tableName: string;
    columnName: string;
    sqlType: string;
}
export interface ParseResult {
    tables: ParsedTable[];
    unknownTypes: UnknownSqlType[];
}
/**
 * 解析 CREATE TABLE SQL，提取表名和字段定义
 */
export declare class SqlParser {
    /**
     * 解析 SQL 文件内容，支持多个 CREATE TABLE
     */
    static parseFile(content: string, options?: {
        dialect?: SqlDialect;
    }): ParseResult;
    /** 提取匹配括号内的内容 */
    private static extractParenContent;
    /**
     * 表名转模块名：users -> user, profiles -> profile, addresses -> address
     */
    private static tableToModuleName;
    private static toCamelCase;
    /**
     * 解析列定义
     */
    private static parseColumns;
    private static splitColumnDefs;
    /**
     * SQL 类型转 Spec Field
     */
    private static sqlTypeToField;
}
//# sourceMappingURL=SqlParser.d.ts.map