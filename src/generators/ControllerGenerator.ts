import { BaseGenerator } from './BaseGenerator';

/**
 * Controller Generator - Generates Controller files
 * 当 auth.enabled 时，同时生成 AuthAspect 切面文件
 */
export class ControllerGenerator extends BaseGenerator {
  /**
   * Generate Controller file
   */
  public async generate(): Promise<void> {
    const outputPath = this.getOutputPath('controller', 'Controller');
    const content = await this.render('controller/controller.hbs', this.spec);
    this.changeset.createFile(outputPath, content, `Generate Controller for ${this.spec.module}`);

    // 当启用认证时，生成 AuthAspect 切面（仅生成一次）
    if (this.spec.auth?.enabled) {
      const guardPath = 'src/aspect/AuthAspect.ts';
      const guardContent = await this.render('guard/AuthAspect.hbs', this.spec);
      this.changeset.createFile(guardPath, guardContent, 'Generate AuthAspect for authentication');
    }
  }
}
