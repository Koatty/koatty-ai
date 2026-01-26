/**
 * Tests for parameter parsing utilities
 */

import {
  parseJsonArg,
  parseCommaSeparated,
  validateRequired,
} from '../src/cli/utils/parseArgs';

describe('Parameter Parsing Utilities', () => {
  describe('parseJsonArg', () => {
    it('should parse valid JSON', () => {
      const result = parseJsonArg('{"name": "test", "value": 123}');
      expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('should throw error for invalid JSON', () => {
      expect(() => parseJsonArg('invalid json')).toThrow('Invalid JSON');
    });
  });

  describe('parseCommaSeparated', () => {
    it('should parse comma-separated values', () => {
      const result = parseCommaSeparated('a, b, c');
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should handle values without spaces', () => {
      const result = parseCommaSeparated('x,y,z');
      expect(result).toEqual(['x', 'y', 'z']);
    });

    it('should filter empty values', () => {
      const result = parseCommaSeparated('a,,b,');
      expect(result).toEqual(['a', 'b']);
    });
  });

  describe('validateRequired', () => {
    it('should not throw for valid value', () => {
      expect(() => validateRequired('value', 'test')).not.toThrow();
    });

    it('should throw for missing value', () => {
      expect(() => validateRequired('', 'test')).toThrow("Parameter 'test' is required");
    });
  });
});
