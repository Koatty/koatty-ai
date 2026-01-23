import { FieldParser } from '../src/parser/FieldParser';

describe('FieldParser', () => {
  it('should parse simple JSON fields', () => {
    const json = '{"username": "string", "age": "number"}';
    const fields = FieldParser.parseFields(json);

    expect(fields.username.type).toBe('string');
    expect(fields.age.type).toBe('number');
  });

  it('should parse complex JSON fields with objects', () => {
    const json = '{"email": {"type": "string", "unique": true, "required": true}}';
    const fields = FieldParser.parseFields(json);

    expect(fields.email.type).toBe('string');
    expect(fields.email.unique).toBe(true);
    expect(fields.email.required).toBe(true);
  });

  it('should handle invalid JSON', () => {
    expect(() => FieldParser.parseFields('invalid')).toThrow('Failed to parse fields JSON');
  });
});
