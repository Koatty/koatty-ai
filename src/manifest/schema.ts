import { applyDtoConstraint } from 'koatty_validation/schema-rules';
import Ajv from 'ajv';
import { ClassDeclaration, Node, SyntaxKind } from 'ts-morph';

export type JsonSchema = Record<string, any>;
export interface Unresolved {
  file: string;
  line: number;
  kind: string;
  reason: string;
}
export function unresolved(out: Unresolved[], node: Node, kind: string): void {
  out.push({
    file: node.getSourceFile().getBaseName(),
    line: node.getStartLineNumber(),
    kind,
    reason: 'Not statically resolved; source values omitted',
  });
}

/** Literal-only extraction, never eval/import application modules. */
export function literal(node?: Node): any {
  if (!node) return undefined;
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node))
    return node.getLiteralText();
  if (Node.isNumericLiteral(node)) return Number(node.getText());
  if (node.getKind() === SyntaxKind.TrueKeyword) return true;
  if (node.getKind() === SyntaxKind.FalseKeyword) return false;
  if (node.getKind() === SyntaxKind.NullKeyword) return null;
  if (Node.isPrefixUnaryExpression(node) && node.getOperatorToken() === SyntaxKind.MinusToken) {
    const value = literal(node.getOperand());
    return typeof value === 'number' ? -value : undefined;
  }
  if (Node.isParenthesizedExpression(node)) return literal(node.getExpression());
  if (Node.isArrayLiteralExpression(node)) {
    const items = node.getElements().map(literal);
    return items.includes(undefined) ? undefined : items;
  }
  if (Node.isObjectLiteralExpression(node)) {
    const result = Object.create(null);
    for (const prop of node.getProperties()) {
      if (!Node.isPropertyAssignment(prop)) return undefined;
      const value = literal(prop.getInitializer());
      if (value === undefined) return undefined;
      const nameNode = prop.getNameNode();
      const key = Node.isComputedPropertyName(nameNode)
        ? literal(nameNode.getExpression())
        : prop.getName().replace(/^['"]|['"]$/g, '');
      if (typeof key !== 'string') return undefined;
      result[key] = value;
    }
    return result;
  }
  return undefined;
}

function typeSchema(node: Node | undefined, names: Set<string>, pending: Unresolved[]): JsonSchema {
  if (!node) return {};
  const basic: Record<string, string> = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    null: 'null',
  };
  if (basic[node.getText()]) return { type: basic[node.getText()] };
  if (Node.isArrayTypeNode(node))
    return { type: 'array', items: typeSchema(node.getElementTypeNode(), names, pending) };
  if (Node.isParenthesizedTypeNode(node)) return typeSchema(node.getTypeNode(), names, pending);
  if (Node.isUnionTypeNode(node))
    return {
      anyOf: node
        .getTypeNodes()
        .filter((n) => n.getText() !== 'undefined')
        .map((n) => typeSchema(n, names, pending)),
    };
  if (Node.isLiteralTypeNode(node)) {
    const value = literal(node.getLiteral());
    if (value !== undefined) return { const: value };
  }
  if (Node.isTypeReference(node)) {
    const name = node.getTypeName().getText();
    if (name === 'Array')
      return { type: 'array', items: typeSchema(node.getTypeArguments()[0], names, pending) };
    if (names.has(name)) return { $ref: `#/definitions/${name}` };
  }
  if (Node.isTypeLiteral(node)) {
    const properties: JsonSchema = {};
    const required: string[] = [];
    for (const p of node.getProperties()) {
      properties[p.getName()] = typeSchema(p.getTypeNode(), names, pending);
      if (!p.hasQuestionToken()) required.push(p.getName());
    }
    return { type: 'object', properties, required };
  }
  unresolved(pending, node, 'dto.type');
  return {};
}

export function dtoSchemas(
  classes: ClassDeclaration[],
  pending: Unresolved[]
): Record<string, JsonSchema> {
  const names = new Set(classes.map((c) => c.getName()!));
  const definitions: JsonSchema = {};
  for (const cls of classes) {
    const properties: JsonSchema = {};
    const required: string[] = [];
    if (cls.getExtends()) unresolved(pending, cls, 'dto.inheritance');
    for (const p of cls.getProperties()) {
      if (p.isStatic()) continue;
      const schema = typeSchema(p.getTypeNode(), names, pending);
      const decorators = p.getDecorators();
      if (!decorators.length) {
        unresolved(pending, p, 'dto.undecorated');
        continue;
      }
      if (!decorators.some((d) => ['IsOptional', 'ValidateIf'].includes(d.getName())))
        required.push(p.getName());
      if (
        decorators.some((d) => d.getName() === 'ValidateNested') ||
        schema.$ref ||
        schema.items?.$ref
      )
        unresolved(pending, p, 'dto.nested-runtime-policy');
      for (const d of decorators) {
        const name = d.getName();
        const options = literal(d.getArguments()[d.getArguments().length - 1]);
        const each = options && typeof options === 'object' && options.each === true;
        if (each && schema.type !== 'array') {
          unresolved(pending, d, 'dto.constraint');
          continue;
        }
        const target = each ? (schema.items ??= {}) : schema;
        if (
          !['IsOptional', 'IsDefined', 'Allow', 'Expose', 'Type', 'ValidateNested'].includes(
            name
          ) &&
          !applyDtoConstraint(target, name, d.getArguments().map(literal))
        )
          unresolved(pending, d, 'dto.constraint');
      }
      properties[p.getName()] = decorators.some((d) => d.getName() === 'IsOptional')
        ? { anyOf: [schema, { type: 'null' }] }
        : schema;
    }
    definitions[cls.getName()!] = {
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    };
  }
  return Object.fromEntries(
    Object.entries(definitions).map(([name, schema]) => [
      name,
      { $schema: 'http://json-schema.org/draft-07/schema#', ...(schema as object), definitions },
    ])
  );
}

const str = { type: 'string', minLength: 1 };
const strings = { type: 'array', items: str };
const object = (properties: JsonSchema, required = Object.keys(properties)): JsonSchema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
function mcpEntrySchema(): JsonSchema {
  return object(
    {
      kind: { enum: ['tool', 'resource', 'prompt'] },
      name: str,
      component: str,
      handler: str,
      file: str,
      line: { type: 'integer', minimum: 1 },
      description: { type: 'string' },
      scopes: strings,
      requireApproval: { type: 'boolean' },
      annotations: { type: 'object' },
      uri: str,
      mimeType: str,
      arguments: {
        type: 'array',
        items: object(
          { name: str, description: { type: 'string' }, required: { type: 'boolean' } },
          ['name']
        ),
      },
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      dto: str,
    },
    ['kind', 'name', 'component', 'handler', 'file', 'line']
  );
}
/** Published structural contract; nested DTO/config schemas are validated against draft-07 too. */
export const manifestSchema = object(
  {
    schemaVersion: { const: 1 },
    collectionMode: { const: 'static' },
    unresolved: {
      type: 'array',
      items: object({ file: str, line: { type: 'integer', minimum: 1 }, kind: str, reason: str }),
    },
    koatty: str,
    decoratorMode: { enum: ['legacy', 'tc39', 'unknown'] },
    protocols: strings,
    components: {
      type: 'array',
      items: object(
        {
          id: str,
          type: { enum: ['CONTROLLER', 'SERVICE', 'COMPONENT', 'MIDDLEWARE', 'PLUGIN', 'ASPECT'] },
          scope: str,
          file: str,
          line: { type: 'integer', minimum: 1 },
          dependsOn: strings,
        },
        ['id', 'type', 'file', 'line', 'dependsOn']
      ),
    },
    routes: {
      type: 'array',
      items: object({
        protocol: str,
        method: str,
        path: { type: 'string', pattern: '^/' },
        controller: str,
        handler: str,
        middleware: strings,
        params: { type: 'array', items: object({ source: str, dto: str }, ['source']) },
        file: str,
        line: { type: 'integer', minimum: 1 },
      }),
    },
    dtos: {
      type: 'object',
      additionalProperties: object({
        file: str,
        fields: { type: 'object', additionalProperties: object({ type: str, rules: strings }) },
        schema: { type: 'object' },
      }),
    },
    aspects: { type: 'array', items: object({ name: str, targets: strings, file: str }) },
    config: object({
      keys: strings,
      schema: { type: 'object' },
      schemaSource: { enum: ['declaration', 'inferred'] },
    }),
    security: object({ profile: { enum: ['development', 'standard', 'strict'] } }, []),
    mcp: object({
      schemaVersion: { const: 1 },
      source: { const: 'static' },
      coverage: { enum: ['complete', 'partial'] },
      tools: { type: 'array', items: mcpEntrySchema() },
      resources: { type: 'array', items: mcpEntrySchema() },
      prompts: { type: 'array', items: mcpEntrySchema() },
    }),
    runtime: object({
      version: { const: 1 },
      root: { type: 'string' },
      files: {
        type: 'array',
        items: object({ file: str, sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' } }),
      },
    }),
  },
  [
    'schemaVersion',
    'collectionMode',
    'unresolved',
    'koatty',
    'decoratorMode',
    'protocols',
    'components',
    'routes',
    'dtos',
    'aspects',
    'config',
    'security',
  ]
);
const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
const check = ajv.compile(manifestSchema);
export function checkManifest(value: unknown): string[] {
  if (!check(value)) return (check.errors || []).map((e) => `${e.instancePath} ${e.message}`);
  const m = value as any;
  const errors: string[] = [];
  for (const [name, schema] of Object.entries({
    config: m.config.schema,
    ...Object.fromEntries(Object.entries(m.dtos).map(([k, v]) => [k, (v as any).schema])),
    ...Object.fromEntries(
      (m.mcp?.tools ?? []).flatMap((tool: any) =>
        ['inputSchema', 'outputSchema']
          .filter((key) => tool[key])
          .map((key) => [`mcp.${tool.name}.${key}`, tool[key]])
      )
    ),
  })) {
    try {
      if (!ajv.validateSchema(schema)) errors.push(`${name}: invalid JSON Schema`);
      else ajv.compile(schema as object);
    } catch {
      errors.push(`${name}: invalid JSON Schema reference`);
    }
  }
  return errors;
}

/** Read C-6 schemas at existing validation/loading call sites, without evaluating them. */
export function configDeclaration(
  project: import('ts-morph').Project,
  pending: Unresolved[]
): JsonSchema | undefined {
  const declarations: JsonSchema[] = [];
  for (const file of project.getSourceFiles())
    for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression().getText().split('.').pop();
      const index = callee === 'validateConfig' ? 1 : callee === 'LoadConfigs' ? 4 : -1;
      if (index < 0 || !call.getArguments()[index]) continue;
      let arg: Node = call.getArguments()[index];
      if (Node.isIdentifier(arg)) {
        const variable = file.getVariableDeclaration(arg.getText());
        if (variable?.getInitializer()) arg = variable.getInitializer()!;
      }
      const value = literal(arg);
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        unresolved(pending, arg, 'config.schema');
        continue;
      }
      // Strip annotations containing defaults/examples. Schema constraints are declarations,
      // not values inferred from runtime configuration.
      const clean = (schema: any): any => {
        if (!schema || typeof schema !== 'object') return schema;
        if (Array.isArray(schema)) return schema.map(clean);
        return Object.fromEntries(
          Object.entries(schema)
            .filter(
              ([k]) => !['default', 'examples', 'description', 'title', '$comment'].includes(k)
            )
            .map(([k, v]) => {
              if (
                ['properties', 'patternProperties', 'definitions', '$defs'].includes(k) &&
                v &&
                typeof v === 'object'
              )
                return [
                  k,
                  Object.fromEntries(
                    Object.entries(v).map(([name, child]) => [name, clean(child)])
                  ),
                ];
              if (['enum', 'const', 'required'].includes(k)) return [k, v];
              return [k, clean(v)];
            })
        );
      };
      if ('type' in value || 'properties' in value || '$ref' in value || 'allOf' in value)
        declarations.push(clean(value));
      else {
        const schema: JsonSchema = { type: 'object', properties: {}, required: [] };
        for (const [key, rule] of Object.entries(value) as Array<[string, any]>) {
          if (!rule || typeof rule !== 'object') {
            unresolved(pending, arg, 'config.schema');
            continue;
          }
          let target = schema;
          const parts = key.split('.');
          for (const part of parts.slice(0, -1)) {
            target.properties[part] ??= { type: 'object', properties: {}, required: [] };
            target = target.properties[part];
          }
          const name = parts[parts.length - 1];
          const field: JsonSchema = {};
          if (rule.type) field.type = rule.type;
          if (rule.enum) field.enum = rule.enum;
          const minKey =
            rule.type === 'string' ? 'minLength' : rule.type === 'array' ? 'minItems' : 'minimum';
          const maxKey =
            rule.type === 'string' ? 'maxLength' : rule.type === 'array' ? 'maxItems' : 'maximum';
          if (typeof rule.min === 'number') field[minKey] = rule.min;
          if (typeof rule.max === 'number') field[maxKey] = rule.max;
          target.properties[name] = field;
          if (rule.required) target.required.push(name);
        }
        declarations.push(schema);
      }
    }
  return declarations.length ? { allOf: declarations } : undefined;
}
