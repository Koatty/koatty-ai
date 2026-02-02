import { TemplateLoader } from '../src/generators/TemplateLoader';
import * as path from 'path';

describe('DTO Template', () => {
  beforeAll(() => {
    TemplateLoader.registerHelpers();
  });

  it('should render valid DTOs', () => {
    const templatePath = path.join(__dirname, '../templates/dto/dto.hbs');
    const template = TemplateLoader.compileTemplate(templatePath);

    const context = {
      module: 'user',
      fields: {
        id: { type: 'number', primary: true },
        username: { type: 'string', length: 50, required: true },
        email: { type: 'string', required: false },
        status: { type: 'string', search: true },
      },
    };

    const result = template(context);
    expect(result).toContain("from 'koatty_validation'");
    expect(result).toContain('export class CreateUserDto');
    expect(result).toContain('export class UpdateUserDto');
    expect(result).toContain('export class QueryUserDto');
    expect(result).toContain("@IsString({ message: 'username 必须是字符串' })");
    expect(result).toContain("@IsNotEmpty({ message: 'username 不能为空' })");
    expect(result).toContain('@MaxLength(50,');
    expect(result).toContain('username: string;');
    expect(result).toContain('@IsOptional');
    expect(result).toContain('email: string;');
    expect(result).toContain('status?: string;');
    expect(result).toContain('page?: number;');
    expect(result).toContain('@IsInt({ message:');
  });
});
