import { ControllerGenerator } from '../src/generators/ControllerGenerator';
import { ChangeSet } from '../src/changeset/ChangeSet';
import { Spec } from '../src/types/spec';

describe('ControllerGenerator', () => {
  it('should generate a controller file in ChangeSet', async () => {
    const spec: Spec = {
      module: 'user',
      fields: {
        id: { name: 'id', type: 'number', primary: true },
      },
      api: { basePath: '/v1/users', endpoints: [] },
      auth: { enabled: true },
    };
    const cs = new ChangeSet(spec.module);
    const generator = new ControllerGenerator(spec, cs);

    await generator.generate();

    const changes = cs.getChanges();
    // auth.enabled = true → 生成 Controller + AuthAspect 两个文件
    expect(changes.length).toBe(2);

    const controllerChange = changes.find((c) => c.path.includes('Controller'));
    expect(controllerChange).toBeDefined();
    expect(controllerChange!.path).toBe('src/controller/UserController.ts');
    expect(controllerChange!.content).toContain("@Controller('/v1/users')");
    expect(controllerChange!.content).toContain('class UserController');
    expect(controllerChange!.content).toContain('@Autowired()');
    expect(controllerChange!.content).toContain('ctx: KoattyContext');
    expect(controllerChange!.content).toContain('@GetMapping');
    expect(controllerChange!.content).toContain('@BeforeEach("AuthAspect")');

    const aspectChange = changes.find((c) => c.path.includes('AuthAspect'));
    expect(aspectChange).toBeDefined();
    expect(aspectChange!.path).toBe('src/aspect/AuthAspect.ts');
    expect(aspectChange!.content).toContain('@Aspect()');
    expect(aspectChange!.content).toContain('class AuthAspect');
  });
});
