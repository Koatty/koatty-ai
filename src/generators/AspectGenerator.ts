import { BaseGenerator } from './BaseGenerator';

/**
 * Aspect Generator - Generates aspect files
 */
export class AspectGenerator extends BaseGenerator {
  /**
   * Generate Aspect file
   */
  public async generate(): Promise<void> {
    const outputPath = this.getOutputPath('aspect', 'Aspect');
    const content = await this.render('aspect/aspect.hbs', this.spec);

    this.changeset.createFile(outputPath, content, `Generate Aspect for ${this.spec.module}`);
  }
}
