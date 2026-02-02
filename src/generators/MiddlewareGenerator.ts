import { BaseGenerator } from './BaseGenerator';

/**
 * Middleware Generator - Generates middleware files
 */
export class MiddlewareGenerator extends BaseGenerator {
  /**
   * Generate Middleware file
   */
  public generate(): void {
    const outputPath = this.getOutputPath('middleware', 'Middleware');
    const content = this.render('middleware/middleware.hbs', this.spec);

    this.changeset.createFile(outputPath, content, `Generate Middleware for ${this.spec.module}`);
  }
}
