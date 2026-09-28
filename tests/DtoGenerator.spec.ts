import { DtoGenerator } from '../src/generators/DtoGenerator';
import { ChangeSet } from '../src/changeset/ChangeSet';
import { Spec } from '../src/types/spec';

describe('DtoGenerator', () => {
  it('should generate a DTO file in ChangeSet', async () => {
    const spec: Spec = {
      module: 'user',
      fields: {
        username: { name: 'username', type: 'string', required: true },
      },
    };
    const cs = new ChangeSet(spec.module);
    const generator = new DtoGenerator(spec, cs);

    await generator.generate();

    const changes = cs.getChanges();
    expect(changes.length).toBe(3);
    expect(changes[0].path).toBe('src/dto/CreateUserDto.ts');
    expect(changes[0].content).toContain('export class CreateUserDto');
    expect(changes[1].content).toContain('export class UpdateUserDto');
  });
});
