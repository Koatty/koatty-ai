import { BaseGenerator } from './BaseGenerator';
/**
 * Controller Generator - Generates Controller files
 * 根据 api.type 选择 REST / gRPC / GraphQL 模板
 * 当 auth.enabled 时，同时生成 AuthAspect 切面文件
 */
export declare class ControllerGenerator extends BaseGenerator {
    /**
     * Generate Controller file
     */
    generate(): Promise<void>;
}
//# sourceMappingURL=ControllerGenerator.d.ts.map