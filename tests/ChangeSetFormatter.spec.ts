import { ChangeSet } from '../src/changeset/ChangeSet';
import { ChangeSetFormatter } from '../src/changeset/ChangeSetFormatter';

describe('ChangeSetFormatter', () => {
  it('should format a ChangeSet with changes', () => {
    const cs = new ChangeSet('user');
    cs.createFile('src/index.ts', 'content', 'Initial commit');
    cs.modifyFile('package.json', 'new', 'old', 'Update version');
    cs.deleteFile('old.ts', 'content', 'Remove old file');

    const output = ChangeSetFormatter.format(cs);
    const stripAnsi = (str: string) => str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
    const cleanOutput = stripAnsi(output);

    expect(cleanOutput).toContain('ChangeSet ID:');
    expect(cleanOutput).toContain('Module: user');
    expect(cleanOutput).toContain('Proposed Changes:');
    expect(cleanOutput).toContain('src/index.ts');
    expect(cleanOutput).toContain('package.json');
    expect(cleanOutput).toContain('old.ts');
  });

  it('should handle empty ChangeSet', () => {
    const cs = new ChangeSet('empty');
    const output = ChangeSetFormatter.format(cs);
    expect(output).toContain('(no changes)');
  });
});
