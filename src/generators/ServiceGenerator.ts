import { BaseGenerator } from './BaseGenerator';

/**
 * Service Generator - Generates Service files
 */
export class ServiceGenerator extends BaseGenerator {
  /**
   * Generate Service file
   */
  public generate(): void {
    const outputPath = this.getOutputPath('service', 'Service');
    const content = this.render('service/service.hbs', this.spec);

    this.changeset.createFile(outputPath, content, `Generate Service for ${this.spec.module}`);
  }
}
