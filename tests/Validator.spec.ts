import { Validator } from '../src/parser/Validator';
import { Spec } from '../src/types/spec';

describe('Validator', () => {
  it('should validate a correct spec', () => {
    const spec: Spec = {
      module: 'user',
      fields: {
        id: { name: 'id', type: 'number', primary: true },
      },
    };
    expect(() => Validator.validate(spec)).not.toThrow();
  });

  it('should throw error if module name is missing', () => {
    const spec: any = { fields: { id: { type: 'number' } } };
    expect(() => Validator.validate(spec)).toThrow('Validation failed: "module" name is required');
  });

  it('should throw error if fields are missing', () => {
    const spec: any = { module: 'user', fields: {} };
    expect(() => Validator.validate(spec)).toThrow('Validation failed: at least one "field" is required');
  });

  it('should throw error for invalid field type', () => {
    const spec: any = {
      module: 'user',
      fields: {
        avatar: { type: 'invalid-type' },
      },
    };
    expect(() => Validator.validate(spec)).toThrow('Validation failed: Invalid type');
  });

  it('should throw error for enum without values', () => {
    const spec: any = {
      module: 'user',
      fields: {
        status: { type: 'enum' },
      },
    };
    expect(() => Validator.validate(spec)).toThrow('must have "values"');
  });
});
