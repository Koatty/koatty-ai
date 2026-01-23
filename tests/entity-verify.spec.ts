import { SpecParser } from '../src/parser/SpecParser';
import { Validator } from '../src/parser/Validator';
import * as path from 'path';

describe('Example Spec Verification', () => {
  it('should pass validation for user.yml', () => {
    const filePath = path.join(__dirname, '../specs/examples/user.yml');
    const spec = SpecParser.parseFile(filePath);
    expect(() => Validator.validate(spec)).not.toThrow();
  });
});
