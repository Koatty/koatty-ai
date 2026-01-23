import { ControllerGenerator } from '../src/generators/ControllerGenerator';
import { ChangeSet } from '../src/changeset/ChangeSet';
import { Spec } from '../src/types/spec';

describe('ControllerGenerator', () => {
  it('should generate a controller file in ChangeSet', () => {
    const spec: Spec = {
      module: 'user',
      fields: {
        id: { name: 'id', type: 'number', primary: true }
      },
      api: { basePath: '/v1/users', endpoints: [] },
      auth: { enabled: true }
    };
    const cs = new ChangeSet(spec.module);
    const generator = new ControllerGenerator(spec, cs);

    generator.generate();

    const changes = cs.getChanges();
    expect(changes.length).toBe(1);
    expect(changes[0].path).toBe('src/controller/UserController.ts');
    expect(changes[0].content).toContain("@Controller('/v1/users')");
    expect(changes[0].content).toContain('class UserController extends BaseController');
    expect(changes[0].content).toContain('@Auth()');
  });
});
