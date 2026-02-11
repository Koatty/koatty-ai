import { ChangeSet } from '../changeset/ChangeSet';
import { Spec } from '../types/spec';
import { ModelGenerator } from './ModelGenerator';
import { DtoGenerator } from './DtoGenerator';
import { ServiceGenerator } from './ServiceGenerator';
import { ControllerGenerator } from './ControllerGenerator';
import { ProtoGenerator } from './ProtoGenerator';

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
export class ModuleGenerator {
  constructor(
    private spec: Spec,
    private changeset: ChangeSet
  ) {}

  /**
   * Generate all files for a module
   */
  public async generate(): Promise<void> {
    const generators = [
      new ModelGenerator(this.spec, this.changeset),
      new DtoGenerator(this.spec, this.changeset),
      new ServiceGenerator(this.spec, this.changeset),
      new ControllerGenerator(this.spec, this.changeset),
    ];

    if (this.spec.api?.type === 'grpc') {
      generators.push(new ProtoGenerator(this.spec, this.changeset));
    }

    for (const generator of generators) {
      await generator.generate();
    }
  }
}
