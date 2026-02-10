import { BaseGenerator } from './BaseGenerator';

/**
 * Service Generator - Generates Service files
 */
export class ServiceGenerator extends BaseGenerator {
  /**
   * Generate Service file
   */
  public async generate(): Promise<void> {
    const outputPath = this.getOutputPath('service', 'Service');
    const content = await this.render('service/service.hbs', this.spec);

    this.changeset.createFile(outputPath, content, `Generate Service for ${this.spec.module}`);
  }
}
