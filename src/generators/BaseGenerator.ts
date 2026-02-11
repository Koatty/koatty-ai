import { ChangeSet } from '../changeset/ChangeSet';
import { Spec } from '../types/spec';
import { TemplateLoader } from './TemplateLoader';

/**
 * Base Generator - Base class for all code generators
 */
export abstract class BaseGenerator {
  constructor(
    protected spec: Spec,
    protected changeset: ChangeSet
  ) {
    TemplateLoader.registerHelpers();
  }

  /**
   * Generate code and add to ChangeSet
   */
  public abstract generate(): Promise<void> | void;

  /**
   * Render a template and return content (async)
   * @param templatePath Path to the template
   * @param context Template context
   */
  protected async render(templatePath: string, context: any): Promise<string> {
    const template = await TemplateLoader.compileTemplate(templatePath);
    return template(context);
  }

  /**
   * Get the output path for a file
   * @param subDir Subdirectory (e.g., 'model', 'dto')
   * @param suffix File suffix (e.g., 'Dto', '')
   * @param ext File extension
   */
  protected getOutputPath(subDir: string, suffix: string = '', ext: string = '.ts'): string {
    const pascalName = this.toPascalCase(this.spec.module);
    return `src/${subDir}/${pascalName}${suffix}${ext}`;
  }

  /**
   * Helper to convert string to PascalCase
   */
  protected toPascalCase(str: string): string {
    return str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase());
  }
}
