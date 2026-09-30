import { ClassDeclaration, Decorator, Node, Project } from 'ts-morph';
import * as path from 'path';
import { JsonSchema, literal, Unresolved, unresolved } from './schema';

export interface ManifestMcpEntry {
  kind: 'tool' | 'resource' | 'prompt';
  name: string;
  component: string;
  handler: string;
  file: string;
  line: number;
  description?: string;
  scopes?: string[];
  requireApproval?: boolean;
  annotations?: Record<string, unknown>;
  uri?: string;
  mimeType?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;
  dto?: string;
}
export interface ManifestMcp {
  schemaVersion: 1;
  source: 'static';
  coverage: 'complete' | 'partial';
  tools: ManifestMcpEntry[];
  resources: ManifestMcpEntry[];
  prompts: ManifestMcpEntry[];
}

function option(dec: Decorator, name: string): Node | undefined {
  const arg = dec.getArguments()[0];
  if (!arg || !Node.isObjectLiteralExpression(arg)) return undefined;
  const prop = arg.getProperty(name);
  return prop && Node.isPropertyAssignment(prop) ? prop.getInitializer() : undefined;
}

function canonical(dec: Decorator): string {
  const file = dec.getSourceFile();
  const used = dec.getName();
  for (const imp of file.getImportDeclarations()) {
    const module = imp.getModuleSpecifierValue();
    if (!['koatty_mcp', 'koatty_validation'].includes(module)) continue;
    for (const spec of imp.getNamedImports()) {
      if ((spec.getAliasNode()?.getText() ?? spec.getName()) === used) return spec.getName();
    }
    if (imp.getNamespaceImport() && used.startsWith(`${imp.getNamespaceImport()!.getText()}.`))
      return used.split('.').pop()!;
  }
  return used;
}

/** Collects declarations only; dynamic registrations and effective auth policy remain runtime facts. */
export function collectMcp(
  project: Project,
  root: string,
  schemas: Record<string, JsonSchema>,
  pending: Unresolved[]
): ManifestMcp {
  const out: ManifestMcp = {
    schemaVersion: 1,
    source: 'static',
    coverage: 'complete',
    tools: [],
    resources: [],
    prompts: [],
  };
  const start = pending.length;
  const seen = new Set<string>();
  for (const file of project.getSourceFiles())
    for (const cls of file.getClasses()) {
      for (const method of cls.getMethods())
        for (const dec of method.getDecorators()) {
          const name = canonical(dec);
          if (!['Tool', 'Resource', 'Prompt'].includes(name)) continue;
          const kind = name.toLowerCase() as ManifestMcpEntry['kind'];
          const options = dec.getArguments()[0];
          if (!options || !Node.isObjectLiteralExpression(options)) {
            unresolved(pending, dec, 'mcp.options');
            continue;
          }
          const read = (key: string): any => {
            const node = option(dec, key);
            const value = literal(node);
            if (node && value === undefined) unresolved(pending, node, `mcp.${key}`);
            return value;
          };
          const identifier = read(kind === 'resource' ? 'uri' : 'name');
          if (typeof identifier !== 'string' || !identifier) {
            unresolved(pending, dec, 'mcp.name');
            continue;
          }
          const key = `${kind}:${identifier}`;
          if (seen.has(key)) unresolved(pending, dec, 'mcp.duplicate');
          seen.add(key);
          const entry: ManifestMcpEntry = {
            kind,
            name: identifier,
            component: componentId(cls),
            handler: method.getName(),
            file: path.relative(root, file.getFilePath()).split(path.sep).join('/'),
            line: method.getStartLineNumber(),
          };
          for (const key of ['description', 'mimeType'] as const) {
            const value = read(key);
            if (typeof value === 'string') entry[key] = value;
          }
          const scopes = read('scopes');
          if (Array.isArray(scopes) && scopes.every((x) => typeof x === 'string'))
            entry.scopes = scopes;
          else if (scopes !== undefined) unresolved(pending, dec, 'mcp.scopes');
          if (kind === 'tool') {
            const approval = read('requireApproval');
            if (typeof approval === 'boolean') entry.requireApproval = approval;
            else if (approval !== undefined) unresolved(pending, dec, 'mcp.requireApproval');
            const hints = read('annotations');
            if (hints && typeof hints === 'object' && !Array.isArray(hints)) {
              entry.annotations = {};
              for (const hint of [
                'readOnlyHint',
                'destructiveHint',
                'idempotentHint',
                'openWorldHint',
              ])
                if (typeof hints[hint] === 'boolean') entry.annotations[hint] = hints[hint];
            }
            const output = read('outputSchema');
            if (output && typeof output === 'object' && !Array.isArray(output))
              entry.outputSchema = output;
            const validated = method.getDecorators().find((d) => canonical(d) === 'Validated');
            const types =
              option(dec, 'types') ?? (validated ? option(validated, 'types') : undefined);
            if (
              types &&
              Node.isArrayLiteralExpression(types) &&
              types.getElements().length === 1 &&
              Node.isIdentifier(types.getElements()[0])
            ) {
              const dto = types.getElements()[0].getText();
              entry.dto = dto;
              if (schemas[dto]) entry.inputSchema = schemas[dto];
              else unresolved(pending, types, 'mcp.dto');
            } else if (types) unresolved(pending, types, 'mcp.dto');
            else if (
              validated &&
              (!Node.isObjectLiteralExpression(validated.getArguments()[0]) ||
                validated.getArguments()[0].getDescendants().some(Node.isSpreadAssignment))
            )
              unresolved(pending, validated, 'mcp.dto');
            else
              entry.inputSchema = { type: 'object', properties: {}, additionalProperties: false };
            out.tools.push(entry);
          } else if (kind === 'resource') {
            entry.uri = identifier;
            const resourceName = read('name');
            if (typeof resourceName === 'string') entry.name = resourceName;
            out.resources.push(entry);
          } else {
            const args = read('arguments');
            if (Array.isArray(args) && args.every((x) => x && typeof x.name === 'string'))
              entry.arguments = args.map((x) => ({
                name: x.name,
                ...(typeof x.description === 'string' ? { description: x.description } : {}),
                ...(typeof x.required === 'boolean' ? { required: x.required } : {}),
              }));
            out.prompts.push(entry);
          }
          if (cls.getExtends()) unresolved(pending, cls, 'mcp.inheritance');
          if (
            !cls
              .getDecorators()
              .some((d) => ['Service', 'Component', 'Controller'].includes(d.getName()))
          )
            unresolved(pending, cls, 'mcp.component-registration');
          for (const prop of options.getProperties())
            if (Node.isSpreadAssignment(prop)) unresolved(pending, prop, 'mcp.options');
        }
    }
  // Coverage means static declaration coverage only, never completeness of live registration.
  if (pending.length > start || pending.some((x) => x.kind.startsWith('dto.')))
    out.coverage = 'partial';
  for (const list of [out.tools, out.resources, out.prompts])
    list.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function componentId(cls: ClassDeclaration): string {
  const dec = cls.getDecorators().find((d) => ['Service', 'Component'].includes(d.getName()));
  const id = dec && literal(dec.getArguments()[0]);
  return typeof id === 'string' ? id : (cls.getName() ?? '(anonymous)');
}
