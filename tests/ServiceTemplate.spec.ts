import { TemplateLoader } from '../src/generators/TemplateLoader';
import * as path from 'path';

describe('Service Template', () => {
  beforeAll(() => {
    TemplateLoader.registerHelpers();
  });

  it('should render a valid Service class', () => {
    const templatePath = path.join(__dirname, '../templates/service/service.hbs');
    const template = TemplateLoader.compileTemplate(templatePath);

    const context = {
      module: 'user',
      features: {
        softDelete: true,
      },
    };

    const result = template(context);
    expect(result).toContain('@Service()');
    expect(result).toContain('export class UserService');
    expect(result).toContain('@Autowired()');
    expect(result).toContain('private userModel: UserModel');
    expect(result).toContain('async findAll(query: QueryUserDto)');
    expect(result).toContain('async create(dto: CreateUserDto)');
    expect(result).toContain('async softDelete(id: number)');
  });
});
