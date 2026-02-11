import { BaseGenerator } from '../src/generators/BaseGenerator';
import { ChangeSet } from '../src/changeset/ChangeSet';
import { Spec } from '../src/types/spec';

class TestGenerator extends BaseGenerator {
  public async generate(): Promise<void> {
    const content = await this.render('test/hello.hbs', { name: 'World' });
    this.changeset.createFile(this.getOutputPath('test'), content, 'Test file');
  }
}

describe('BaseGenerator', () => {
  it('should render and add to changeset', async () => {
    const spec: Spec = { module: 'user', fields: {} };
    const cs = new ChangeSet(spec.module);
    const generator = new TestGenerator(spec, cs);

    await generator.generate();

    const changes = cs.getChanges();
    expect(changes.length).toBe(1);
    expect(changes[0].path).toBe('src/test/User.ts');
    expect(changes[0].content).toContain('Hello World');
  });
});
