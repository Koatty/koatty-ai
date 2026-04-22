/**
 * SQL 类型到 Spec Field 类型的映射
 * 支持 MySQL、PostgreSQL、Oracle 等常见数据库
 */
export type SpecFieldType = 'string' | 'number' | 'boolean' | 'enum' | 'datetime' | 'text' | 'json';
export type SqlDialect = 'mysql' | 'postgres' | 'oracle' | 'auto';
/** 通用映射：SQL 类型（大写） -> Spec 类型 */
declare const TYPE_MAP: Record<string, SpecFieldType>;
export interface SqlTypeMapResult {
    type: SpecFieldType;
    length?: number;
    values?: string[];
    isUnknown: boolean;
}
/**
 * 将 SQL 类型转为 Spec Field 类型
 * @param sqlType 如 VARCHAR, NUMBER(10,2)
 * @param typeArg 类型参数如 255, 'a','b' 等
 */
export declare function mapSqlType(sqlType: string, typeArg: string | undefined, _dialect?: SqlDialect): SqlTypeMapResult;
export { TYPE_MAP };
//# sourceMappingURL=SqlTypeMap.d.ts.map