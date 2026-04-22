import { Field } from '../../types/spec';
/**
 * 根据模块名返回建议的默认字段（若有），否则返回通用 id + name + timestamps
 */
export declare function getDefaultFieldsForModule(moduleName: string): Record<string, Field>;
/**
 * 解析简短字段描述为 Field 列表
 * 格式：每段为 "字段名:类型" 或 "字段名:类型 修饰符"
 * 例：name:string username:string required email:string age:number status:enum:active,inactive
 */
export declare function parseFieldShortSpec(input: string): Record<string, Field>;
export declare function hasDefaultForModule(moduleName: string): boolean;
//# sourceMappingURL=defaultSpecs.d.ts.map