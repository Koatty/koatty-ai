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

test('P2 static required ignores TS optional syntax and records conditional/nested uncertainty', () => {
  const project = new Project({ useInMemoryFileSystem: true });
  const source = project.createSourceFile('dto.ts', `class Child { @IsString() name!: string; } class Dto { @IsString() required?: string; @ValidateIf(x => false) @IsString() conditional!: string; @ValidateNested() child!: Child; }`);
  const unresolved: any[] = []; const schema = dtoSchemas(source.getClasses(), unresolved).Dto;
  expect(schema.required).toEqual(['required', 'child']);
  expect(unresolved.map(x => x.kind)).toEqual(expect.arrayContaining(['dto.constraint', 'dto.nested-runtime-policy']));
});
