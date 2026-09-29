import { Project } from 'ts-morph';
import { dtoSchemas } from '../../src/manifest/schema';
import { applyDtoConstraint } from 'koatty_validation/schema-rules';
test('F-A19: static extraction uses runtime constraint rules without evaluating application code', () => {
  const project = new Project({ useInMemoryFileSystem: true });
  const source = project.createSourceFile('dto.ts', `class Dto { @IsPort() port!: string; @IsJSON() document!: string; @Min(2) count!: number; }`);
  const unresolved: any[] = [];
  const schema = dtoSchemas(source.getClasses(), unresolved).Dto;
  const expected: any = { type: 'number' }; applyDtoConstraint(expected, 'Min', [2]);
  expect(schema.properties.count).toEqual(expected);
  expect(schema.properties.port.type).toBe('string');
  expect(schema.properties.document.type).toBe('string');
  expect(unresolved).toHaveLength(2);
});
