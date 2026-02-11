/**
 * SQL 类型到 Spec Field 类型的映射
 * 支持 MySQL、PostgreSQL、Oracle 等常见数据库
 */

export type SpecFieldType = 'string' | 'number' | 'boolean' | 'enum' | 'datetime' | 'text' | 'json';
export type SqlDialect = 'mysql' | 'postgres' | 'oracle' | 'auto';

/** 通用映射：SQL 类型（大写） -> Spec 类型 */
const TYPE_MAP: Record<string, SpecFieldType> = {
  // 整数 - MySQL / 通用
  INT: 'number',
  INTEGER: 'number',
  BIGINT: 'number',
  SMALLINT: 'number',
  TINYINT: 'number',
  MEDIUMINT: 'number',
  // PostgreSQL
  SERIAL: 'number',
  BIGSERIAL: 'number',
  SMALLSERIAL: 'number',
  SERIAL4: 'number',
  SERIAL8: 'number',
  OID: 'number',
  // Oracle
  NUMBER: 'number',
  NUMERIC: 'number',
  // 浮点
  DECIMAL: 'number',
  FLOAT: 'number',
  DOUBLE: 'number',
  REAL: 'number',
  MONEY: 'number', // PostgreSQL
  // 布尔
  BOOLEAN: 'boolean',
  BOOL: 'boolean',
  BIT: 'boolean',
  // 日期时间
  DATETIME: 'datetime',
  DATETIME2: 'datetime',
  DATETIMEOFFSET: 'datetime',
  SMALLDATETIME: 'datetime',
  TIMESTAMP: 'datetime',
  TIMESTAMPTZ: 'datetime',
  DATE: 'datetime',
  TIME: 'datetime',
  INTERVAL: 'string',
  // JSON
  JSON: 'json',
  JSONB: 'json',
  // 枚举 (MySQL)
  ENUM: 'enum',
  // 字符串 - MySQL / 通用
  VARCHAR: 'string',
  CHAR: 'string',
  NVARCHAR: 'string',
  NCHAR: 'string',
  CHARACTER: 'string',
  // Oracle
  VARCHAR2: 'string',
  NVARCHAR2: 'string',
  LONG: 'string',
  RAW: 'string',
  VARBINARY2: 'string',
  // 长文本
  CLOB: 'text',
  NCLOB: 'text',
  TEXT: 'text',
  LONGTEXT: 'text',
  MEDIUMTEXT: 'text',
  TINYTEXT: 'text',
  NTEXT: 'text',
  // 二进制（作 string）
  BLOB: 'string',
  BINARY: 'string',
  VARBINARY: 'string',
  XML: 'text',
  XMLTYPE: 'text',
  // PostgreSQL 特有
  UUID: 'string',
  INET: 'string',
  CIDR: 'string',
  MACADDR: 'string',
};

/** CHARACTER VARYING (PostgreSQL) */
TYPE_MAP['VARYING'] = 'string';
TYPE_MAP['CHARACTER VARYING'] = 'string';

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
export function mapSqlType(
  sqlType: string,
  typeArg: string | undefined,
  _dialect: SqlDialect = 'auto'
): SqlTypeMapResult {
  const baseType = sqlType.toUpperCase().replace(/\(.*$/, '').trim();
  // 处理 CHARACTER VARYING
  const normalized = baseType.includes(' ') ? baseType : baseType;
  const mapped = TYPE_MAP[baseType] ?? TYPE_MAP[normalized];

  if (mapped) {
    let length: number | undefined;
    let values: string[] | undefined;

    if (mapped === 'enum' && typeArg) {
      values = (typeArg.match(/'([^']*)'/g) || []).map((s) => s.replace(/^'|'$/g, ''));
    } else if ((mapped === 'string' || mapped === 'text') && typeArg) {
      const n = parseInt(String(typeArg).split(',')[0] || '', 10);
      if (!isNaN(n)) length = n;
    }

    return { type: mapped, length, values, isUnknown: false };
  }

  return {
    type: 'string',
    isUnknown: true,
  };
}

export { TYPE_MAP };
