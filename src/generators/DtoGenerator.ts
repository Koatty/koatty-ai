import { BaseGenerator } from './BaseGenerator';

/**
 * DTO Generator - Generates Create, Update, and Query DTOs
 */
export class DtoGenerator extends BaseGenerator {
  /**
   * Generate DTO file
   */
  public generate(): void {
    const outputPath = this.getOutputPath('dto', 'Dto');
    const content = this.render('dto/dto.hbs', this.spec);

    this.changeset.createFile(outputPath, content, `Generate DTOs for ${this.spec.module}`);
  }
}
