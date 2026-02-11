import { ModuleGenerator } from '../src/generators/ModuleGenerator';
import { ChangeSet } from '../src/changeset/ChangeSet';
import { Spec } from '../src/types/spec';

describe('ModuleGenerator', () => {
  it('should generate all module files in ChangeSet', async () => {
    const spec: Spec = {
      module: 'user',
      fields: {
        id: { name: 'id', type: 'number', primary: true },
      },
      api: { basePath: '/users', endpoints: [] },
    };
    const cs = new ChangeSet(spec.module);
    const generator = new ModuleGenerator(spec, cs);

    await generator.generate();

    const changes = cs.getChanges();
    // 1 model, 1 dto, 1 service, 1 controller（不再生成 index.ts）
    expect(changes.length).toBe(4);
    expect(changes.some((c) => c.path === 'src/model/UserModel.ts')).toBe(true);
    expect(changes.some((c) => c.path === 'src/dto/UserDto.ts')).toBe(true);
    expect(changes.some((c) => c.path === 'src/service/UserService.ts')).toBe(true);
    expect(changes.some((c) => c.path === 'src/controller/UserController.ts')).toBe(true);
  });
});
