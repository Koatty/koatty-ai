import { ModelGenerator } from '../src/generators/ModelGenerator';
import { ChangeSet } from '../src/changeset/ChangeSet';
import { Spec } from '../src/types/spec';

describe('ModelGenerator', () => {
  it('should generate a model file in ChangeSet', () => {
    const spec: Spec = {
      module: 'user',
      table: 'users',
      fields: {
        id: { name: 'id', type: 'number', primary: true }
      }
    };
    const cs = new ChangeSet(spec.module);
    const generator = new ModelGenerator(spec, cs);

    generator.generate();

    const changes = cs.getChanges();
    expect(changes.length).toBe(1);
    expect(changes[0].path).toBe('src/model/User.ts');
    expect(changes[0].content).toContain("@Entity('users')");
    expect(changes[0].content).toContain('export class User');
  });
});
