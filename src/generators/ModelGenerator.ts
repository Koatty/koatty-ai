import { BaseGenerator } from './BaseGenerator';

/**
 * Model Generator - Generates TypeORM entities
 */
export class ModelGenerator extends BaseGenerator {
  /**
   * Generate Model file
   */
  public generate(): void {
    const outputPath = this.getOutputPath('model');
    const content = this.render('model/model.hbs', this.spec);

    this.changeset.createFile(outputPath, content, `Generate TypeORM model for ${this.spec.module}`);
  }
}
