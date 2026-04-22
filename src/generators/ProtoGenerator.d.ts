import { BaseGenerator } from './BaseGenerator';
/**
 * Proto Generator - Generates gRPC proto files for CRUD modules
 * 输出到 src/resource/proto/{Module}.proto
 */
export declare class ProtoGenerator extends BaseGenerator {
    /**
     * Generate proto file
     */
    generate(): Promise<void>;
}
//# sourceMappingURL=ProtoGenerator.d.ts.map