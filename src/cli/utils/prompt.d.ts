import * as readline from 'readline';
import { Field } from '../../types/spec';
import { Spec } from '../../types/spec';
export declare function createReadlineInterface(): readline.Interface;
/**
 * 询问单行输入
 */
export declare function question(rl: readline.Interface, promptText: string, defaultValue?: string): Promise<string>;
/**
 * 交互式收集模块字段与选项，返回可传给 Pipeline 的 spec 片段（fields + 简单 api/auth/features）
 */
export type ApiType = 'rest' | 'grpc' | 'graphql';
export interface InteractiveSpecResult {
    apiType: ApiType;
    fields: Record<string, Field>;
    basePath: string;
    auth: boolean;
    authRoles: string[];
    softDelete: boolean;
    pagination: boolean;
    apply: boolean;
}
export interface PromptForModuleOptions {
    /** 若传入则跳过 API 类型问答 */
    apiType?: ApiType;
    /** 已有 YAML 时作为默认值，重复执行时传入 */
    existingSpec?: Spec;
}
export declare function promptForModule(rl: readline.Interface, moduleName: string, options?: PromptForModuleOptions): Promise<InteractiveSpecResult>;
//# sourceMappingURL=prompt.d.ts.map