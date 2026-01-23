import { TemplateLoader } from '../src/generators/TemplateLoader';
import * as path from 'path';

describe('Controller Template', () => {
  beforeAll(() => {
    TemplateLoader.registerHelpers();
  });

  it('should render a valid Controller class', () => {
    const templatePath = path.join(__dirname, '../templates/controller/controller.hbs');
    const template = TemplateLoader.compileTemplate(templatePath);

    const context = {
      module: 'user',
      api: {
        basePath: '/v1/users'
      },
      auth: {
        enabled: true,
        defaultRoles: ['admin']
      },
      features: {
        softDelete: true
      }
    };

    const result = template(context);
    expect(result).toContain("@Controller('/v1/users')");
    expect(result).toContain('export class UserController extends BaseController');
    expect(result).toContain('constructor(private userService: UserService)');
    expect(result).toContain('@Get(\'/\')');
    expect(result).toContain('@Auth()');
    expect(result).toContain('@Roles(["admin"])');
    expect(result).toContain('await this.userService.softDelete(id)');
  });
});
