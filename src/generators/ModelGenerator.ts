import { BaseGenerator } from './BaseGenerator';

/**
 * Model Generator - Generates TypeORM entities
 */
export class ModelGenerator extends BaseGenerator {
  /**
   * Generate Model file
   */
  public async generate(): Promise<void> {
    const outputPath = this.getOutputPath('model', 'Model');
    const content = await this.render('model/model.hbs', this.spec);

    this.changeset.createFile(
      outputPath,
      content,
      `Generate TypeORM model for ${this.spec.module}`
    );
  }
}
