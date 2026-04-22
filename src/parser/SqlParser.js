"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqlParser = void 0;
const SqlTypeMap_1 = require("./SqlTypeMap");
/**
 * 解析 CREATE TABLE SQL，提取表名和字段定义
 */
class SqlParser {
    /**
     * 解析 SQL 文件内容，支持多个 CREATE TABLE
     */
    static parseFile(content, options) {
        const tables = [];
        const unknownTypes = [];
        const dialect = options?.dialect ?? 'auto';
        const createRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`?(\w+)`?\.)?`?(\w+)`?\s*\(/gi;
        let match;
        while ((match = createRegex.exec(content)) !== null) {
            const tableName = match[2].replace(/`/g, '');
            const startParen = match.index + match[0].length;
            const columnsDef = this.extractParenContent(content, startParen);
            const { fields, unknowns } = this.parseColumns(columnsDef, tableName, dialect);
            const moduleName = this.tableToModuleName(tableName);
            tables.push({ tableName, moduleName, fields });
            unknownTypes.push(...unknowns);
        }
        return { tables, unknownTypes };
    }
    /** 提取匹配括号内的内容 */
    static extractParenContent(content, start) {
        let depth = 1;
        let i = start;
        while (i < content.length && depth > 0) {
            const c = content[i];
            if (c === '(')
                depth++;
            else if (c === ')')
                depth--;
            i++;
        }
        return content.slice(start, i - 1);
    }
    /**
     * 表名转模块名：users -> user, profiles -> profile, addresses -> address
     */
    static tableToModuleName(tableName) {
        const lower = tableName.toLowerCase().replace(/`/g, '');
        if (lower.endsWith('ies') && lower.length > 3) {
            return lower.slice(0, -3) + 'y'; // categories -> category
        }
        if (lower.endsWith('ses') || lower.endsWith('xes') || lower.endsWith('zes') || lower.endsWith('ches')) {
            return lower.slice(0, -2); // addresses -> address, boxes -> box
        }
        if (lower.endsWith('es') && lower.length > 2) {
            return lower.slice(0, -1); // profiles -> profile
        }
        if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 1) {
            return lower.slice(0, -1); // users -> user
        }
        return lower;
    }
    static toCamelCase(str) {
        return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    }
    /**
     * 解析列定义
     */
    static parseColumns(columnsDef, tableName, dialect) {
        const fields = {};
        const unknowns = [];
        const lines = this.splitColumnDefs(columnsDef);
        for (const line of lines) {
            if (/^\s*PRIMARY\s+KEY\s*\(/i.test(line) || /^\s*KEY\s+/i.test(line) || /^\s*UNIQUE\s+KEY/i.test(line) || /^\s*FOREIGN\s+KEY/i.test(line) || /^\s*CONSTRAINT\s+/i.test(line)) {
                continue;
            }
            // 类型：单词或 "CHARACTER VARYING"，不含 PRIMARY 等修饰符
            const colMatch = line.match(/^`?([\w]+)`?\s+(\w+(?:\s+VARYING)?)(?:\(([^)]*(?:\([^)]*\))*[^)]*)\))?/i);
            if (!colMatch)
                continue;
            const colNameRaw = colMatch[1].replace(/`/g, '');
            const colName = this.toCamelCase(colNameRaw);
            const sqlType = (colMatch[2] || '').trim();
            const typeArg = colMatch[3]?.trim();
            const { field, unknown } = this.sqlTypeToField(colName, sqlType, typeArg, line, tableName, dialect);
            if (field) {
                fields[colName] = field;
                if (unknown) {
                    unknowns.push({ tableName, columnName: colName, sqlType });
                }
            }
        }
        return { fields, unknowns };
    }
    static splitColumnDefs(columnsDef) {
        const lines = [];
        let depth = 0;
        let start = 0;
        for (let i = 0; i < columnsDef.length; i++) {
            const c = columnsDef[i];
            if (c === '(')
                depth++;
            else if (c === ')')
                depth--;
            else if (c === ',' && depth === 0) {
                lines.push(columnsDef.slice(start, i).trim());
                start = i + 1;
            }
        }
        if (start < columnsDef.length) {
            lines.push(columnsDef.slice(start).trim());
        }
        return lines.filter(Boolean);
    }
    /**
     * SQL 类型转 Spec Field
     */
    static sqlTypeToField(colName, sqlType, typeArg, fullLine, tableName, dialect) {
        const lineLower = fullLine.toLowerCase();
        const mapResult = (0, SqlTypeMap_1.mapSqlType)(sqlType, typeArg, dialect);
        const field = {
            name: colName,
            type: mapResult.type,
        };
        if (mapResult.length)
            field.length = mapResult.length;
        if (mapResult.values?.length) {
            field.values = mapResult.values;
            field.default = mapResult.values[0];
        }
        // 修饰符
        if (/PRIMARY\s+KEY/i.test(lineLower))
            field.primary = true;
        if (/AUTO_INCREMENT|AUTOINCREMENT|SERIAL|IDENTITY/i.test(lineLower))
            field.auto = true;
        if (/NOT\s+NULL/i.test(lineLower) && !field.primary)
            field.required = true;
        if (/UNIQUE/i.test(lineLower))
            field.unique = true;
        if (/DEFAULT\s+(\S+)/i.test(lineLower)) {
            const defMatch = lineLower.match(/DEFAULT\s+([^\s,]+)/);
            if (defMatch) {
                const v = defMatch[1].replace(/^['"]|['"]$/g, '');
                if (v !== 'NULL' && v !== 'CURRENT_TIMESTAMP')
                    field.default = v;
            }
        }
        if (/NULL/i.test(lineLower) && !/NOT\s+NULL/i.test(lineLower))
            field.nullable = true;
        // 常见字段特殊处理
        if (/^(created_at|createdAt|create_time)$/i.test(colName))
            field.auto = true;
        if (/^(updated_at|updatedAt|update_time)$/i.test(colName))
            field.auto = true;
        if (/^(password|password_hash|passwordHash)$/i.test(colName))
            field.private = true;
        if (/^(email|mail)$/i.test(colName))
            field.format = 'email';
        return { field, unknown: mapResult.isUnknown };
    }
}
exports.SqlParser = SqlParser;
//# sourceMappingURL=SqlParser.js.map