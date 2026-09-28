/*
 * @Description: Application manifest collector (roadmap Phase E, item E-1).
 *
 * `koatty manifest` exports the structure of a Koatty project as machine
 * readable JSON so that AI coding assistants do not have to rediscover it by
 * reading every file.
 *
 * The collector is intentionally **static** (ts-morph) and dependency-free: the
 * CLI package does not depend on the framework at runtime, and a manifest must
 * be obtainable without booting the application (no ports, no side effects).
 * Config values are NEVER emitted - only key names - because configuration may
 * contain secrets.
 *
 * @License: MIT
 */

import * as fs from 'fs';
import * as path from 'path';
import { resolveInside } from '../utils/sandbox';
import { ts, Node } from 'ts-morph';
import {
  checkManifest,
  configDeclaration,
  dtoSchemas,
  JsonSchema,
  literal,
  Unresolved,
  unresolved,
} from './schema';
export { manifestSchema } from './schema';
import { collectRuntimeManifest, RuntimeManifest } from './runtime';
import {
  Project,
  SyntaxKind,
  ClassDeclaration,
  Decorator,
  ObjectLiteralExpression,
} from 'ts-morph';

/** Decorator flavour detected from the project tsconfig. */
export type DecoratorMode = 'legacy' | 'tc39' | 'unknown';

export interface ManifestComponent {
  id: string;
  type: 'CONTROLLER' | 'SERVICE' | 'COMPONENT' | 'MIDDLEWARE' | 'PLUGIN' | 'ASPECT';
  scope?: string;
  file: string;
  line: number;
  dependsOn: string[];
}

export interface ManifestRouteParam {
  source: string;
  dto?: string;
}

export interface ManifestRoute {
  protocol: string;
  method: string;
  path: string;
  controller: string;
  handler: string;
  middleware: string[];
  params: ManifestRouteParam[];
  file: string;
  line: number;
}

export interface ManifestDtoField {
  type: string;
  rules: string[];
}

export interface ManifestDto {
  file: string;
  fields: Record<string, ManifestDtoField>;
  schema: JsonSchema;
}

export interface ManifestAspect {
  name: string;
  targets: string[];
  file: string;
}

export interface KoattyManifest {
  schemaVersion: 1;
  collectionMode: 'static';
  unresolved: Unresolved[];
  runtime?: RuntimeManifest;
  koatty: string;
  decoratorMode: DecoratorMode;
  protocols: string[];
  components: ManifestComponent[];
  routes: ManifestRoute[];
  dtos: Record<string, ManifestDto>;
  aspects: ManifestAspect[];
  config: { keys: string[]; schema: JsonSchema; schemaSource: 'declaration' | 'inferred' };
  security: { profile?: string };
}

export interface CollectOptions {
  /** Compiled output directory; adds a validated executable file inventory. */
  runtimeDir?: string;
  /** Extra source roots, relative to the project root (default: `src`). */
  sourceRoots?: string[];
  /** `protocols` override; otherwise read from `config/server.ts`. */
  protocols?: string[];
  /** `decoratorMode` override; otherwise detected from `tsconfig.json`. */
  decoratorMode?: DecoratorMode;
}

const ROUTE_DECORATORS: Record<string, string | null> = {
  GetMapping: 'GET',
  Get: 'GET',
  PostMapping: 'POST',
  Post: 'POST',
  PutMapping: 'PUT',
  Put: 'PUT',
  DeleteMapping: 'DELETE',
  Delete: 'DELETE',
  PatchMapping: 'PATCH',
  Patch: 'PATCH',
  HeadMapping: 'HEAD',
  Head: 'HEAD',
  OptionsMapping: 'OPTIONS',
  Options: 'OPTIONS',
  AllMapping: 'ALL',
  All: 'ALL',
  RequestMapping: null, // method comes from the second argument
};

const PARAM_DECORATORS = new Set([
  'RequestBody',
  'PathVariable',
  'Get',
  'Post',
  'RequestHeader',
  'RequestParam',
  'Body',
  'Query',
  'Param',
  'Params',
  'Header',
  'Headers',
  'Req',
  'Request',
  'Res',
  'Response',
  'Ctx',
  'Context',
  'Payload',
  'File',
  'Files',
  'Session',
]);

const CLASS_COMPONENT_DECORATORS: Record<string, ManifestComponent['type']> = {
  Controller: 'CONTROLLER',
  Service: 'SERVICE',
  Component: 'COMPONENT',
  Middleware: 'MIDDLEWARE',
  Plugin: 'PLUGIN',
  Aspect: 'ASPECT',
  GrpcController: 'CONTROLLER',
  WebSocketController: 'CONTROLLER',
  GraphQLController: 'CONTROLLER',
};

/** Safely read a JSON file, returning undefined on any failure. */
function readJson(file: string): any {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return undefined;
  }
}

/** Plain name of a decorator (`@Get("/x")` -> `Get`). */
function decoratorName(dec: Decorator): string {
  return dec.getExpression().getText().replace(/\(.*$/s, '').split('.').pop() ?? '';
}

/** First string literal argument of a decorator/call, if any. */
function firstStringArg(dec: Decorator): string | undefined {
  const args = dec.getArguments();
  if (!args.length) return undefined;
  const kind = args[0].getKind();
  if (kind === SyntaxKind.StringLiteral || kind === SyntaxKind.NoSubstitutionTemplateLiteral) {
    return (args[0] as any).getLiteralText?.() ?? args[0].getText().replace(/['"`]/g, '');
  }
  if (kind === SyntaxKind.ArrayLiteralExpression) {
    const values = literal(args[0]);
    return Array.isArray(values) && typeof values[0] === 'string' ? values[0] : undefined;
  }
  return undefined;
}

/** Read `scope` / `middleware` etc. from a decorator's options object. */
function optionsOf(dec: Decorator): ObjectLiteralExpression | undefined {
  return dec.getArguments().find((arg) => arg.getKind() === SyntaxKind.ObjectLiteralExpression) as
    | ObjectLiteralExpression
    | undefined;
}

/** Join a controller prefix and a method path. */
function joinPath(base: string, sub: string): string {
  const b = (base || '/').replace(/\/+$/, '');
  const s = (sub || '').replace(/^\/+/, '');
  const joined = s === '' ? (b === '' ? '/' : b) : `${b}/${s}`;
  const normalized = joined.replace(/\/{2,}/g, '/');
  return normalized === '' ? '/' : normalized;
}

/**
 * Collect the application manifest of a Koatty project.
 *
 * @param rootPath - Project root (where `src/`, `config/` and `package.json` live)
 * @param options - Optional overrides
 */
export function collectManifest(rootPath: string, options: CollectOptions = {}): KoattyManifest {
  const root = path.resolve(rootPath);
  const tsconfigPath = path.join(root, 'tsconfig.json');
  const pending: Unresolved[] = [];
  const tsconfig = readTsConfig(root, tsconfigPath, pending);
  const sourceRoots = options.sourceRoots ?? ['src', 'app'];
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });

  const patterns: string[] = [];
  for (const dir of sourceRoots) {
    const abs = resolveInside(root, dir);
    if (fs.existsSync(abs)) {
      patterns.push(path.join(abs, '**/*.ts').replace(/\\/g, '/'));
    }
  }
  if (patterns.length) {
    // Validate every source path before ts-morph reads it (including directory links).
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(resolveInside(root, dir), { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const file = resolveInside(root, path.join(dir, entry.name));
        if (entry.isDirectory()) walk(file);
        else if (entry.isFile() && file.endsWith('.ts')) project.addSourceFileAtPath(file);
      }
    };
    for (const dir of sourceRoots)
      if (fs.existsSync(path.join(root, dir))) walk(path.join(root, dir));
  }

  const rel = (file: string) => path.relative(root, file).replace(/\\/g, '/');
  const isDtoFile = (file: string) =>
    /(^|\/)(dto|dtos|payloads)\//.test(rel(file)) || /\.?dto\.ts$/i.test(rel(file));

  const components: ManifestComponent[] = [];
  const routes: ManifestRoute[] = [];
  const dtos: Record<string, ManifestDto> = {};
  const aspects: ManifestAspect[] = [];
  const dtoClasses = project
    .getSourceFiles()
    .filter((f) => isDtoFile(f.getFilePath()))
    .flatMap((f) => f.getClasses())
    .filter((c) => !!c.getName());
  const schemas = dtoSchemas(dtoClasses, pending);
  const identifiers = new Map<string, string>();
  for (const file of project.getSourceFiles())
    for (const cls of file.getClasses()) {
      const dec = cls
        .getDecorators()
        .find((d) =>
          ['Service', 'Component', 'Middleware', 'Plugin', 'Aspect'].includes(decoratorName(d))
        );
      if (cls.getName())
        identifiers.set(
          cls.getName()!,
          dec ? (firstStringArg(dec) ?? cls.getName()!) : cls.getName()!
        );
    }

  for (const file of project.getSourceFiles()) {
    const filePath = rel(file.getFilePath());
    for (const cls of file.getClasses()) {
      const classDecs = cls.getDecorators();
      const classDecorator = classDecs.find((d) => CLASS_COMPONENT_DECORATORS[decoratorName(d)]);

      if (classDecorator) {
        const decName = decoratorName(classDecorator);
        const type = CLASS_COMPONENT_DECORATORS[decName];
        const scopeNode =
          cls.getDecorator('Scope')?.getArguments()[0] ??
          optionsOf(classDecorator)
            ?.getProperty('scope')
            ?.asKind(SyntaxKind.PropertyAssignment)
            ?.getInitializer();
        const scopeValue = literal(scopeNode);
        const scope = ['Singleton', 'Request', 'Prototype'].includes(scopeValue)
          ? scopeValue
          : undefined;
        if (scopeNode && !scope) unresolved(pending, scopeNode, 'component.scope');
        components.push({
          id: identifiers.get(cls.getName()!) ?? cls.getName() ?? '(anonymous)',
          type,
          scope,
          file: filePath,
          line: cls.getStartLineNumber(),
          dependsOn: bestEffortDependencies(cls).map((id) => identifiers.get(id) ?? id),
        });

        if (decName === 'Aspect') {
          aspects.push({
            name: cls.getName() ?? '(anonymous)',
            targets: [],
            file: filePath,
          });
        }
        if (type === 'CONTROLLER') {
          const base = classDecorator.getArguments().length ? firstStringArg(classDecorator) : '/';
          if (base === undefined) unresolved(pending, classDecorator, 'route.path');
          else routes.push(...collectRoutes(cls, base, filePath, pending));
        }
      }

      if (isDtoFile(file.getFilePath())) {
        const name = cls.getName();
        if (name) {
          const fields: Record<string, ManifestDtoField> = {};
          for (const prop of cls.getProperties()) {
            const pname = prop.getName();
            if (!pname || pname.startsWith('_')) continue;
            fields[pname] = {
              type: prop.getTypeNode()?.getText() ?? 'any',
              rules: prop.getDecorators().map(decoratorName).filter(Boolean),
            };
          }
          dtos[name] = { file: filePath, fields, schema: schemas[name] };
        }
      }
    }
  }

  for (const file of project.getSourceFiles())
    for (const cls of file.getClasses()) {
      const id = identifiers.get(cls.getName()!) ?? cls.getName();
      for (const member of [cls, ...cls.getMethods()])
        for (const dec of member.getDecorators()) {
          if (
            !['Around', 'Before', 'After', 'BeforeEach', 'AfterEach'].includes(decoratorName(dec))
          )
            continue;
          const arg = dec.getArguments()[0];
          const name =
            typeof literal(arg) === 'string'
              ? literal(arg)
              : arg && Node.isIdentifier(arg)
                ? arg.getText()
                : undefined;
          if (!name) {
            unresolved(pending, dec, 'aspect.target');
            continue;
          }
          let aspect = aspects.find((a) => a.name === name);
          if (!aspect) {
            aspect = { name, targets: [], file: rel(file.getFilePath()) };
            aspects.push(aspect);
          }
          aspect.targets.push(member === cls ? id! : `${id}.${member.getName()}`);
        }
    }
  const config = collectConfiguration(root, pending);
  const declaredSchema = configDeclaration(project, pending);
  return {
    schemaVersion: 1,
    collectionMode: 'static',
    unresolved: pending,
    ...(options.runtimeDir ? { runtime: collectRuntimeManifest(root, options.runtimeDir) } : {}),
    koatty: detectKoattyVersion(root),
    decoratorMode: options.decoratorMode ?? detectDecoratorMode(tsconfig),
    protocols: options.protocols ?? config.protocols ?? [],
    components: components.sort((a, b) => a.id.localeCompare(b.id)),
    routes: routes.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method)),
    dtos,
    aspects: aspects.sort((a, b) => a.name.localeCompare(b.name)),
    config: {
      keys: config.keys.sort(),
      schema: declaredSchema ?? config.schema,
      schemaSource: declaredSchema ? 'declaration' : 'inferred',
    },
    security: config.security,
  };
}

/** Constructor-injected parameters: best-effort dependency hints. */
function bestEffortDependencies(cls: ClassDeclaration): string[] {
  const dependencies = (cls.getConstructors()[0]?.getParameters() ?? [])
    .map((p) => p.getTypeNode()?.getText())
    .filter(
      (v): v is string => !!v && !['string', 'number', 'boolean', 'any', 'unknown'].includes(v)
    );
  for (const prop of cls.getProperties()) {
    const dec = prop.getDecorator('Autowired');
    if (!dec) continue;
    const arg = dec.getArguments()[0];
    const id =
      typeof literal(arg) === 'string'
        ? literal(arg)
        : arg && Node.isIdentifier(arg)
          ? arg.getText()
          : prop.getTypeNode()?.getText();
    if (id) dependencies.push(id);
  }
  return [...new Set(dependencies)];
}

/** Collect the routes of one controller class. */
function collectRoutes(
  cls: ClassDeclaration,
  basePath: string,
  file: string,
  pending: Unresolved[]
): ManifestRoute[] {
  const out: ManifestRoute[] = [];
  const classDecorators = cls.getDecorators();

  for (const method of cls.getMethods()) {
    const decs = method.getDecorators();
    const routeDec = decs.find((d) => decoratorName(d) in ROUTE_DECORATORS);
    if (!routeDec) continue;

    const decName = decoratorName(routeDec);
    const httpMethod =
      ROUTE_DECORATORS[decName] ??
      (routeDec.getArguments()[1]?.getText().replace(/['"`]/g, '') ?? 'GET').toUpperCase();
    if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'ALL'].includes(httpMethod)) {
      unresolved(pending, routeDec, 'route.method');
      continue;
    }
    if (
      routeDec.getArguments()[0] &&
      Node.isArrayLiteralExpression(routeDec.getArguments()[0]) &&
      (literal(routeDec.getArguments()[0])?.length ?? 0) > 1
    )
      unresolved(pending, routeDec, 'route.additionalPaths');
    const subPath = routeDec.getArguments().length ? firstStringArg(routeDec) : '/';
    if (subPath === undefined) {
      unresolved(pending, routeDec, 'route.path');
      continue;
    }

    const middlewareNames = [...classDecorators, routeDec].flatMap((dec) => {
      const options = dec
        .getArguments()
        .find((arg) => arg.isKind(SyntaxKind.ObjectLiteralExpression));
      if (!options?.isKind(SyntaxKind.ObjectLiteralExpression)) return [];
      const middleware = options.getProperty('middleware');
      if (!middleware?.isKind(SyntaxKind.PropertyAssignment)) return [];
      const list = middleware.getInitializer();
      if (!list?.isKind(SyntaxKind.ArrayLiteralExpression)) return [];
      return list
        .getElements()
        .map((item) => {
          if (item.isKind(SyntaxKind.ObjectLiteralExpression)) {
            const impl = item.getProperty('middleware');
            return impl?.isKind(SyntaxKind.PropertyAssignment)
              ? (impl.getInitializer()?.getText() ?? '')
              : '';
          }
          return item.getText().replace(/^['"]|['"]$/g, '');
        })
        .filter(Boolean);
    });

    const controllerDec = classDecorators.find(
      (d) => CLASS_COMPONENT_DECORATORS[decoratorName(d)] === 'CONTROLLER'
    )!;
    const protocolNode = optionsOf(controllerDec)
      ?.getProperty('protocol')
      ?.asKind(SyntaxKind.PropertyAssignment)
      ?.getInitializer();
    let protocol =
      (
        {
          WebSocketController: 'ws',
          GrpcController: 'grpc',
          GraphQLController: 'graphql',
        } as Record<string, string>
      )[decoratorName(controllerDec)] ?? 'http';
    if (protocolNode) {
      const value = literal(protocolNode);
      const enumName = protocolNode
        .getText()
        .match(/^ControllerProtocol\.(http|websocket|grpc|graphql)$/)?.[1];
      if (['http', 'ws', 'grpc', 'graphql'].includes(value)) protocol = value;
      else if (enumName) protocol = enumName === 'websocket' ? 'ws' : enumName;
      else {
        unresolved(pending, protocolNode, 'route.protocol');
        continue;
      }
    }
    out.push({
      protocol,
      method: httpMethod,
      path: joinPath(basePath, subPath),
      controller: cls.getName() ?? '(anonymous)',
      handler: method.getName(),
      middleware: middlewareNames,
      params: method
        .getParameters()
        .map((p): ManifestRouteParam | undefined => {
          const dec = p.getDecorators().find((d) => PARAM_DECORATORS.has(decoratorName(d)));
          if (!dec) return undefined;
          const typeText = p.getTypeNode()?.getText();
          const sources: Record<string, string> = {
            RequestBody: 'body',
            Body: 'body',
            Get: 'query',
            PathVariable: 'path',
            RequestHeader: 'header',
            Post: 'body',
          };
          const param: ManifestRouteParam = {
            source: sources[decoratorName(dec)] ?? decoratorName(dec).toLowerCase(),
          };
          if (typeText && /^[A-Z]/.test(typeText)) param.dto = typeText;
          return param;
        })
        .filter((p): p is ManifestRouteParam => !!p),
      file,
      line: method.getStartLineNumber(),
    });
  }
  return out;
}

/** Framework version declared by the project (no network access). */
function detectKoattyVersion(root: string): string {
  const pkg = readJson(resolveInside(root, 'package.json'));
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const raw = deps.koatty ?? deps.koatty_core ?? 'unknown';
  return String(raw).replace(/^[^\d]*/, '') || 'unknown';
}

function detectDecoratorMode(tsconfig: any): DecoratorMode {
  if (!tsconfig) return 'unknown';
  return tsconfig.experimentalDecorators === true ? 'legacy' : 'tc39';
}

function readTsConfig(
  root: string,
  file: string,
  pending: Unresolved[]
): ts.CompilerOptions | undefined {
  if (!fs.existsSync(file)) {
    pending.push({
      file: 'tsconfig.json',
      line: 1,
      kind: 'decoratorMode',
      reason: 'Configuration missing',
    });
    return undefined;
  }
  const host = {
    ...ts.sys,
    readFile: (f: string) => ts.sys.readFile(resolveInside(root, f)),
    fileExists: (f: string) => fs.existsSync(resolveInside(root, f)),
  };
  try {
    const config = ts.readConfigFile(file, host.readFile);
    if (config.error) throw new Error();
    const parsed = ts.parseJsonConfigFileContent(config.config, host, root);
    if (parsed.errors.some((e) => e.code !== 18003)) throw new Error();
    return parsed.options;
  } catch {
    pending.push({
      file: 'tsconfig.json',
      line: 1,
      kind: 'decoratorMode',
      reason: 'Configuration could not be safely resolved',
    });
    return undefined;
  }
}

function collectConfiguration(root: string, pending: Unresolved[]) {
  const keys = new Set<string>();
  const properties: JsonSchema = {};
  const result: {
    keys: string[];
    schema: JsonSchema;
    security: { profile?: string };
    protocols?: string[];
  } = { keys: [], schema: { type: 'object', properties }, security: {} };
  const shape = (node: Node, prefix: string): JsonSchema => {
    if (Node.isObjectLiteralExpression(node)) {
      const props: JsonSchema = {};
      for (const prop of node.getProperties()) {
        if (!Node.isPropertyAssignment(prop)) {
          unresolved(pending, prop, 'config.keys');
          continue;
        }
        const nameNode = prop.getNameNode();
        const key = Node.isComputedPropertyName(nameNode)
          ? literal(nameNode.getExpression())
          : prop.getName().replace(/^['"]|['"]$/g, '');
        if (typeof key !== 'string') {
          unresolved(pending, prop, 'config.keys');
          continue;
        }
        keys.add(key);
        keys.add(`${prefix}.${key}`);
        const init = prop.getInitializer();
        props[key] = init ? shape(init, `${prefix}.${key}`) : {};
        if (key === 'profile' && (prefix === 'security' || prefix.endsWith('.security'))) {
          const value = literal(init);
          if (['development', 'standard', 'strict'].includes(value))
            result.security.profile = value;
          else unresolved(pending, prop, 'security.profile');
        }
        if (key === 'protocol' && prefix === 'server') {
          const value = literal(init);
          const values = Array.isArray(value) ? value : [value];
          if (values.every((v) => ['http', 'https', 'ws', 'wss', 'grpc', 'graphql'].includes(v)))
            result.protocols = values;
          else unresolved(pending, prop, 'protocols');
        }
      }
      return { type: 'object', properties: props };
    }
    const value = literal(node);
    if (value === undefined) {
      unresolved(pending, node, 'config.schema');
      return {};
    }
    if (Array.isArray(value)) return { type: 'array' };
    if (value === null) return { type: 'null' };
    return { type: typeof value };
  };
  for (const dirName of ['config', 'src/config', 'app/config']) {
    const dir = resolveInside(root, dirName);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (!/\.(ts|js|json)$/.test(entry) || entry.endsWith('.d.ts')) continue;
      const file = resolveInside(root, path.join(dir, entry));
      const project = new Project({
        skipAddingFilesFromTsConfig: true,
        skipFileDependencyResolution: true,
      });
      const sf = entry.endsWith('.json')
        ? project.createSourceFile(
            'config.ts',
            `export default (${fs.readFileSync(file, 'utf8')});`
          )
        : project.addSourceFileAtPath(file);
      const expression = sf.getExportAssignments()[0]?.getExpression();
      let obj: Node | undefined = expression;
      if (obj && Node.isArrowFunction(obj)) obj = obj.getBody();
      if (obj && Node.isParenthesizedExpression(obj)) obj = obj.getExpression();
      if (obj && Node.isBlock(obj))
        obj = obj.getStatements().find(Node.isReturnStatement)?.getExpression();
      if (obj && Node.isParenthesizedExpression(obj)) obj = obj.getExpression();
      const namespace = entry.replace(/\.(ts|js|json)$/, '');
      if (obj && Node.isObjectLiteralExpression(obj)) properties[namespace] = shape(obj, namespace);
      else unresolved(pending, sf, 'config.keys');
    }
  }
  result.keys = [...keys];
  return result;
}

export function validateManifest(manifest: unknown): string[] {
  return checkManifest(manifest);
}

/**
 * Render a manifest as Markdown (for `--format md`), aimed at AI prompts.
 */
export function renderManifestMarkdown(manifest: KoattyManifest): string {
  const lines: string[] = [];
  lines.push('# Koatty 应用清单');
  lines.push(`采集模式：static；未解析项：${manifest.unresolved.length}`);
  lines.push('');
  lines.push(`- koatty: \`${manifest.koatty}\``);
  lines.push(`- decoratorMode: \`${manifest.decoratorMode}\``);
  lines.push(`- protocols: ${manifest.protocols.map((p) => `\`${p}\``).join(', ')}`);
  if (manifest.security.profile) lines.push(`- security profile: \`${manifest.security.profile}\``);
  lines.push('');

  lines.push(`## 路由（${manifest.routes.length}）`);
  lines.push('');
  lines.push('| Method | Path | Controller.handler | Middleware | 文件:行 |');
  lines.push('|---|---|---|---|---|');
  for (const r of manifest.routes) {
    lines.push(
      `| ${r.method} | \`${r.path}\` | ${r.controller}.${r.handler} | ${r.middleware.join(', ') || '-'} | ${r.file}:${r.line} |`
    );
  }
  lines.push('');

  lines.push(`## 组件（${manifest.components.length}）`);
  lines.push('');
  lines.push('| Id | Type | Scope | 文件:行 |');
  lines.push('|---|---|---|---|');
  for (const c of manifest.components) {
    lines.push(`| ${c.id} | ${c.type} | ${c.scope ?? '-'} | ${c.file}:${c.line} |`);
  }
  lines.push('');

  const dtoNames = Object.keys(manifest.dtos);
  if (dtoNames.length) {
    lines.push(`## DTO（${dtoNames.length}）`);
    lines.push('');
    for (const name of dtoNames) {
      const fields = Object.entries(manifest.dtos[name].fields).map(
        ([field, meta]) =>
          `${field}: ${meta.type}${meta.rules.length ? ` (${meta.rules.join(', ')})` : ''}`
      );
      lines.push(`- **${name}** — ${fields.join('; ') || '（无字段）'}`);
    }
    lines.push('');
  }

  if (manifest.aspects.length) {
    lines.push(`## 切面（${manifest.aspects.length}）`);
    lines.push('');
    for (const a of manifest.aspects)
      lines.push(`- ${a.name}${a.targets.length ? ` → ${a.targets.join(', ')}` : ''}`);
    lines.push('');
  }

  lines.push(`## 配置键（${manifest.config.keys.length}，不含取值）`);
  lines.push('');
  lines.push(manifest.config.keys.map((k) => `\`${k}\``).join(', ') || '（未发现配置）');
  lines.push('');
  return lines.join('\n');
}
