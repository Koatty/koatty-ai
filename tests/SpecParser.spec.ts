import { SpecParser } from '../src/parser/SpecParser';
import * as fs from 'fs';
import * as path from 'path';

describe('SpecParser', () => {
  const tempFilePath = path.join(__dirname, 'test-spec.yml');

  afterEach(() => {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  });

  it('should parse a valid YAML string', () => {
    const yaml = `
module: user
fields:
  id:
    type: number
    primary: true
`;
    const spec = SpecParser.parseYaml(yaml);
    expect(spec.module).toBe('user');
    expect(spec.fields.id.type).toBe('number');
  });

  it('should parse a YAML file', () => {
    const yaml = 'module: project';
    fs.writeFileSync(tempFilePath, yaml);

    const spec = SpecParser.parseFile(tempFilePath);
    expect(spec.module).toBe('project');
  });

  it('should throw error for non-existent file', () => {
    expect(() => SpecParser.parseFile('non-existent.yml')).toThrow('File not found');
  });

  it('should throw error for invalid YAML', () => {
    const invalidYaml = 'module: [invalid';
    expect(() => SpecParser.parseYaml(invalidYaml)).toThrow('Failed to parse YAML');
  });
});
