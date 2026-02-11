import { ChangeSet } from '../changeset/ChangeSet';
import { Spec } from '../types/spec';
import { BaseGenerator } from './BaseGenerator';

/**
 * Proto Generator - Generates gRPC proto files for CRUD modules
 * 输出到 src/resource/proto/{Module}.proto
 */
export class ProtoGenerator extends BaseGenerator {
  /**
   * Generate proto file
   */
  public async generate(): Promise<void> {
    const pascalName = this.toPascalCase(this.spec.module);
    const outputPath = `src/resource/proto/${pascalName}.proto`;
    const content = await this.render('proto/crud.hbs', this.spec);
    this.changeset.createFile(outputPath, content, `Generate gRPC proto for ${this.spec.module}`);
  }
}
