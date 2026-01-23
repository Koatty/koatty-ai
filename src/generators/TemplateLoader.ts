import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

/**
 * Template Loader - Handles loading and compiling Handlebars templates
 */
export class TemplateLoader {
  private static templatesDir = path.join(__dirname, '../../templates');

  /**
   * Load and compile a template file
   * @param templatePath Path to the template relative to the templates directory
   */
  public static compileTemplate(templatePath: string): Handlebars.TemplateDelegate {
    const fullPath = path.isAbsolute(templatePath)
      ? templatePath
      : path.join(this.templatesDir, templatePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Template not found: ${fullPath}`);
    }

    const source = fs.readFileSync(fullPath, 'utf-8');
    return Handlebars.compile(source, { noEscape: true });
  }

  /**
   * Register custom Handlebars helpers
   */
  public static registerHelpers(): void {
    Handlebars.registerHelper('pascalCase', (str: string) => {
      if (!str) return '';
      return str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase());
    });

    Handlebars.registerHelper('camelCase', (str: string) => {
      if (!str) return '';
      return str.replace(/(?:^|[-_])(\w)/g, (g, c, i) => i === 0 ? c.toLowerCase() : g[1].toUpperCase());
    });

    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);

    Handlebars.registerHelper('json', (obj: any) => JSON.stringify(obj));
  }
}
