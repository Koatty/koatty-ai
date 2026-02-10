import { BaseGenerator } from './BaseGenerator';

/**
 * Controller Generator - Generates Controller files
 */
export class ControllerGenerator extends BaseGenerator {
  /**
   * Generate Controller file
   */
  public async generate(): Promise<void> {
    const outputPath = this.getOutputPath('controller', 'Controller');
    const content = await this.render('controller/controller.hbs', this.spec);

    this.changeset.createFile(outputPath, content, `Generate Controller for ${this.spec.module}`);
  }
}
