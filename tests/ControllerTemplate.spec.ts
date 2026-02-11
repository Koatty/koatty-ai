import { TemplateLoader } from '../src/generators/TemplateLoader';
import * as path from 'path';

describe('Controller Template', () => {
  beforeAll(() => {
    TemplateLoader.registerHelpers();
  });

  it('should render a valid Controller class without auth', async () => {
    const templatePath = path.join(__dirname, '../templates/modules/controller/controller.hbs');
    const template = await TemplateLoader.compileTemplate(templatePath);

    const context = {
      module: 'user',
      api: {
        basePath: '/v1/users',
      },
      features: {
        softDelete: true,
      },
    };

    const result = template(context);
    expect(result).toContain("@Controller('/v1/users')");
    expect(result).toContain('export class UserController');
    expect(result).toContain('@Autowired()');
    expect(result).toContain('private userService: UserService');
    expect(result).toContain('ctx: KoattyContext');
    expect(result).toContain("@GetMapping('/')");
    expect(result).toContain("@PostMapping('/')");
    expect(result).toContain('@Validated()');
    expect(result).toContain('await this.userService.softDelete(id)');
    // 无认证时不应有 BeforeEach / AuthAspect
    expect(result).not.toContain('@BeforeEach');
    expect(result).not.toContain('AuthAspect');
  });

  it('should use @BeforeEach("AuthAspect") on class when auth is enabled', async () => {
    const templatePath = path.join(__dirname, '../templates/modules/controller/controller.hbs');
    const template = await TemplateLoader.compileTemplate(templatePath);

    const context = {
      module: 'user',
      api: {
        basePath: '/v1/users',
      },
      auth: {
        enabled: true,
        defaultRoles: ['admin'],
      },
      features: {
        softDelete: true,
      },
    };

    const result = template(context);
    expect(result).toContain("@Controller('/v1/users')");
    expect(result).toContain('export class UserController');
    // 类级别 AOP 切面认证：所有方法都会经过 AuthAspect
    expect(result).toContain('@BeforeEach("AuthAspect")');
    expect(result).toContain('BeforeEach');
    // import 中包含 BeforeEach
    expect(result).toContain('import { Controller, GetMapping, PostMapping, PutMapping, DeleteMapping, PathVariable, RequestBody, Query as QueryParam, Autowired, KoattyContext, BeforeEach }');
    // 方法级不再有 @Before
    expect(result).not.toContain('@Before(');
    // 不使用不存在的装饰器
    expect(result).not.toContain('@Auth()');
    expect(result).not.toContain('@Roles(');
  });
});
