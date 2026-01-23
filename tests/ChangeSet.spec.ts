import { ChangeSet } from '../src/changeset/ChangeSet';
import { FileChange } from '../src/changeset/FileChange';

describe('ChangeSet and FileChange', () => {
  it('should create a FileChange', () => {
    const change = new FileChange('create', 'path/to/file.ts', 'content', 'description');
    expect(change.type).toBe('create');
    expect(change.path).toBe('path/to/file.ts');
    expect(change.toJSON().content).toBe('content');
  });

  it('should manage multiple changes in a ChangeSet', () => {
    const cs = new ChangeSet('user');
    cs.createFile('src/user.ts', 'module user {}', 'Add user module');
    cs.modifyFile('package.json', '{"version": "1.1.0"}', '{"version": "1.0.0"}', 'Update version');
    cs.deleteFile('temp.txt', 'old content', 'Remove temp file');

    const changes = cs.getChanges();
    expect(changes.length).toBe(3);
    expect(changes[0].type).toBe('create');
    expect(changes[1].type).toBe('modify');
    expect(changes[2].type).toBe('delete');
  });

  it('should generate valid JSON', () => {
    const cs = new ChangeSet('user');
    cs.createFile('test.ts', 'console.log("test")');
    const json = cs.toJSON();

    expect(json.module).toBe('user');
    expect(json.changes.length).toBe(1);
    expect(json.changes[0].path).toBe('test.ts');
    expect(json.id).toBeDefined();
    expect(json.timestamp).toBeDefined();
  });
});
