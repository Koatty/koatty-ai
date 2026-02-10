import { TemplateLoader } from '../src/generators/TemplateLoader';
import * as fs from 'fs';
import * as path from 'path';

describe('TemplateLoader', () => {
  const testDir = path.join(__dirname, '../templates/test');
  const testFile = path.join(testDir, 'hello.hbs');

  beforeAll(() => {
    TemplateLoader.registerHelpers();
  });

  it('should compile and render a simple template', async () => {
    const template = await TemplateLoader.compileTemplate(testFile);
    const result = template({ name: 'World' });
    expect(result).toContain('Hello World');
  });

  it('should use custom helpers - pascalCase', () => {
    const Handlebars = require('handlebars');
    const source = '{{pascalCase name}}';
    const template = Handlebars.compile(source);
    expect(template({ name: 'user_profile' })).toBe('UserProfile');
  });

  it('should use custom helpers - camelCase', () => {
    const Handlebars = require('handlebars');
    const source = '{{camelCase name}}';
    const template = Handlebars.compile(source);
    expect(template({ name: 'user_profile' })).toBe('userProfile');
  });

  it('should throw error for non-existent template', async () => {
    await expect(TemplateLoader.compileTemplate('non-existent.hbs')).rejects.toThrow(
      'Template not found'
    );
  });
});
