import { DtoGenerator } from '../src/generators/DtoGenerator';
import { ChangeSet } from '../src/changeset/ChangeSet';
import { Spec } from '../src/types/spec';

describe('DtoGenerator', () => {
  it('should generate a DTO file in ChangeSet', () => {
    const spec: Spec = {
      module: 'user',
      fields: {
        username: { name: 'username', type: 'string', required: true }
      }
    };
    const cs = new ChangeSet(spec.module);
    const generator = new DtoGenerator(spec, cs);

    generator.generate();

    const changes = cs.getChanges();
    expect(changes.length).toBe(1);
    expect(changes[0].path).toBe('src/dto/UserDto.ts');
    expect(changes[0].content).toContain('export class CreateUserDto');
    expect(changes[0].content).toContain('export class UpdateUserDto');
  });
});
