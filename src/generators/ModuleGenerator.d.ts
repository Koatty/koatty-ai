import { ChangeSet } from '../changeset/ChangeSet';
import { Spec } from '../types/spec';
/**
 * Module Generator - Orchestrates all specific generators for a module
 *
 * 生成文件到 Koatty 项目标准目录结构：
 *   src/controller/{Module}Controller.ts (REST) | {Module}GrpcController.ts | {Module}GraphQLController.ts
 *   src/service/{Module}Service.ts
 *   src/model/{Module}Model.ts (entity)
 *   src/dto/{Module}Dto.ts
 *   src/resource/proto/{Module}.proto (仅 gRPC)
 *
 * Koatty 框架通过 IoC 容器自动扫描加载，无需 barrel index.ts
 */
export declare class ModuleGenerator {
    private spec;
    private changeset;
    constructor(spec: Spec, changeset: ChangeSet);
    /**
     * Generate all files for a module
     */
    generate(): Promise<void>;
}
//# sourceMappingURL=ModuleGenerator.d.ts.map