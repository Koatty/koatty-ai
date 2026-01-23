import { ServiceGenerator } from '../src/generators/ServiceGenerator';
import { ChangeSet } from '../src/changeset/ChangeSet';
import { Spec } from '../src/types/spec';

describe('ServiceGenerator', () => {
  it('should generate a service file in ChangeSet', () => {
    const spec: Spec = {
      module: 'user',
      fields: {
        id: { name: 'id', type: 'number', primary: true }
      },
      features: { softDelete: true }
    };
    const cs = new ChangeSet(spec.module);
    const generator = new ServiceGenerator(spec, cs);

    generator.generate();

    const changes = cs.getChanges();
    expect(changes.length).toBe(1);
    expect(changes[0].path).toBe('src/user/service/UserService.ts');
    expect(changes[0].content).toContain('class UserService extends BaseService');
    expect(changes[0].content).toContain('async softDelete(id: number)');
  });
});
