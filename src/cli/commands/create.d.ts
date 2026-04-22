/**
 * 单文件模块创建命令（与旧 koatty_cli 兼容）
 * controller, middleware, service, plugin, aspect, dto, exception, proto, model
 */
export type CreateModuleOptions = {
    type?: string;
    interface?: boolean;
    orm?: string;
};
/**
 * 执行单文件模块创建：校验项目、渲染模板、写入文件
 */
export declare function runCreateModule(moduleType: string, name: string, options?: CreateModuleOptions): Promise<void>;
/**
 * 批量生成 entity/model, service, controller, dto（all 命令）
 */
export declare function runCreateAll(moduleName: string, options?: {
    type?: string;
}): Promise<void>;
//# sourceMappingURL=create.d.ts.map