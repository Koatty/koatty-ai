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
import { collectRuntimeManifest, RuntimeManifest } from './runtime';
import {
  Project,
  SyntaxKind,
  ClassDeclaration,
  Decorator,
  ObjectLiteralExpression,
} from 'ts-morph';

/** Decorator flavour detected from the project tsconfig. */
export type DecoratorMode = 'legacy' | 'tc39';

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
}

export interface ManifestAspect {
  name: string;
  targets: string[];
  file: string;
}

export interface KoattyManifest {
  runtime?: RuntimeManifest;
  koatty: string;
  decoratorMode: DecoratorMode;
  protocols: string[];
  components: ManifestComponent[];
  routes: ManifestRoute[];
  dtos: Record<string, ManifestDto>;
  aspects: ManifestAspect[];
  config: { keys: string[] };
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
    const first = (args[0] as any).getElements?.()[0];
    return first?._getLiteralText?.() ?? first?.getText().replace(/['"`]/g, '');
  }
  return undefined;
}

function literalKeys(node: ObjectLiteralExpression, depth = 0): string[] {
  if (depth > 3) return [];
  const keys: string[] = [];
  for (const prop of node.getProperties()) {
    if (prop.getKind() !== SyntaxKind.PropertyAssignment) continue;
    const name = prop.asKindOrThrow(SyntaxKind.PropertyAssignment).getName().replace(/['"`]/g, '');
    keys.push(name);
    const initializer = prop.asKindOrThrow(SyntaxKind.PropertyAssignment).getInitializer();
    if (initializer && initializer.getKind() === SyntaxKind.ObjectLiteralExpression) {
      for (const nested of literalKeys(initializer as ObjectLiteralExpression, depth + 1)) {
        keys.push(`${name}.${nested}`);
      }
    }
  }
  return keys;
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
  const tsconfig = readJson(tsconfigPath);
  const sourceRoots = options.sourceRoots ?? ['src', 'app'];
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });

  const patterns: string[] = [];
  for (const dir of sourceRoots) {
    const abs = path.join(root, dir);
    if (fs.existsSync(abs)) {
      patterns.push(path.join(abs, '**/*.ts').replace(/\\/g, '/'));
    }
  }
  if (patterns.length) {
    project.addSourceFilesAtPaths(patterns);
  }

  const rel = (file: string) => path.relative(root, file).replace(/\\/g, '/');
  const isDtoFile = (file: string) =>
    /(^|\/)(dto|dtos|payloads)\//.test(rel(file)) || /\.?dto\.ts$/i.test(rel(file));

  const components: ManifestComponent[] = [];
  const routes: ManifestRoute[] = [];
  const dtos: Record<string, ManifestDto> = {};
  const aspects: ManifestAspect[] = [];

  for (const file of project.getSourceFiles()) {
    const filePath = rel(file.getFilePath());
    for (const cls of file.getClasses()) {
      const classDecs = cls.getDecorators();
      const classDecorator = classDecs.find((d) => CLASS_COMPONENT_DECORATORS[decoratorName(d)]);

      if (classDecorator) {
        const decName = decoratorName(classDecorator);
        const type = CLASS_COMPONENT_DECORATORS[decName];
        const scope = optionsOf(classDecorator)
          ?.getProperty('scope')
          ?.asKind(SyntaxKind.PropertyAssignment)
          ?.getInitializer()
          ?.getText()
          .replace(/['"`]/g, '');
        components.push({
          id: cls.getName() ?? '(anonymous)',
          type,
          scope,
          file: filePath,
          line: cls.getStartLineNumber(),
          dependsOn: bestEffortDependencies(cls),
        });

        if (decName === 'Aspect') {
          aspects.push({
            name: cls.getName() ?? '(anonymous)',
            targets: classDecorator.getArguments().map((a) => a.getText().replace(/['"`]/g, '')),
            file: filePath,
          });
        }
        if (decName === 'Controller') {
          routes.push(...collectRoutes(cls, firstStringArg(classDecorator) ?? '/', filePath));
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
          dtos[name] = { file: filePath, fields };
        }
      }
    }
  }

  return {
    ...(options.runtimeDir ? { runtime: collectRuntimeManifest(root, options.runtimeDir) } : {}),
    koatty: detectKoattyVersion(root),
    decoratorMode: options.decoratorMode ?? detectDecoratorMode(tsconfig),
    protocols: options.protocols ?? detectProtocols(root),
    components: components.sort((a, b) => a.id.localeCompare(b.id)),
    routes: routes.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method)),
    dtos,
    aspects: aspects.sort((a, b) => a.name.localeCompare(b.name)),
    config: { keys: collectConfigKeys(root).sort() },
    security: detectSecurityProfile(root),
  };
}

/** Constructor-injected parameters: best-effort dependency hints. */
function bestEffortDependencies(cls: ClassDeclaration): string[] {
  const ctor = cls.getConstructors()[0];
  if (!ctor) return [];
  return ctor
    .getParameters()
    .map((p) => p.getTypeNode()?.getText())
    .filter(
      (t): t is string => !!t && !['string', 'number', 'boolean', 'any', 'unknown'].includes(t)
    );
}

/** Collect the routes of one controller class. */
function collectRoutes(cls: ClassDeclaration, basePath: string, file: string): ManifestRoute[] {
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
    const subPath = firstStringArg(routeDec) ?? '/';

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

    out.push({
      protocol: 'http',
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
          const param: ManifestRouteParam = { source: decoratorName(dec).toLowerCase() };
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

/** Every config key (dotted paths) of the project - never a config value. */
function collectConfigKeys(root: string): string[] {
  const keys = new Set<string>();
  for (const dirName of ['config']) {
    const dir = path.join(root, dirName);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (!/\.(ts|js|json)$/.test(entry) || /\.d\.ts$/.test(entry)) continue;
      const file = path.join(dir, entry);
      if (entry.endsWith('.json')) {
        const json = readJson(file);
        if (json && typeof json === 'object') {
          for (const k of Object.keys(json)) keys.add(k);
        }
        continue;
      }
      const project = new Project({
        skipAddingFilesFromTsConfig: true,
        skipFileDependencyResolution: true,
      });
      const sf = project.addSourceFileAtPath(file);
      for (const obj of sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
        for (const k of literalKeys(obj)) keys.add(k);
      }
    }
  }
  return [...keys];
}

/** Framework version declared by the project (no network access). */
function detectKoattyVersion(root: string): string {
  const pkg = readJson(path.join(root, 'package.json'));
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const raw = deps.koatty ?? deps.koatty_core ?? 'unknown';
  return String(raw).replace(/^[^\d]*/, '') || 'unknown';
}

function detectDecoratorMode(tsconfig: any): DecoratorMode {
  const compilerOptions = tsconfig?.compilerOptions ?? {};
  if (compilerOptions.experimentalDecorators === false) return 'tc39';
  return 'legacy';
}

/** Protocols from `config/server.ts` (`protocol` key), defaulting to http. */
function detectProtocols(root: string): string[] {
  const candidates = ['config/server.ts', 'config/server.js', 'config/server.json'];
  for (const candidate of candidates) {
    const file = path.join(root, candidate);
    if (!fs.existsSync(file)) continue;
    if (candidate.endsWith('.json')) {
      const json = readJson(file);
      return normalizeProtocols(json?.protocol);
    }
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
    });
    const sf = project.addSourceFileAtPath(file);
    for (const prop of sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
      if (prop.getName().replace(/['"`]/g, '') !== 'protocol') continue;
      const text = prop.getInitializer()?.getText() ?? '';
      const literals = [...text.matchAll(/['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
      if (literals.length) return literals;
    }
  }
  return ['http'];
}

function normalizeProtocols(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.map(String);
  return ['http'];
}

/** Effective security profile, if the project declares one. */
function detectSecurityProfile(root: string): { profile?: string } {
  const candidates = ['config/security.ts', 'config/security.js', 'config/security.json'];
  for (const candidate of candidates) {
    const file = path.join(root, candidate);
    if (!fs.existsSync(file)) continue;
    if (candidate.endsWith('.json')) {
      const json = readJson(file);
      if (typeof json?.profile === 'string') return { profile: json.profile };
      continue;
    }
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
    });
    const sf = project.addSourceFileAtPath(file);
    for (const prop of sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
      if (prop.getName().replace(/['"`]/g, '') !== 'profile') continue;
      const value = prop.getInitializer()?.getText().replace(/['"`]/g, '');
      if (value) return { profile: value };
    }
  }
  return {};
}

/**
 * Structural validation of a manifest: returns the list of problems.
 *
 * Used by tests and by `koatty manifest --validate`; an empty array means the
 * manifest satisfies the documented contract.
 */
export function validateManifest(manifest: any): string[] {
  const errors: string[] = [];
  const isString = (v: unknown) => typeof v === 'string' && v.length > 0;

  if (!manifest || typeof manifest !== 'object') return ['manifest is not an object'];
  if (!isString(manifest.koatty)) errors.push('koatty version is missing');
  if (!['legacy', 'tc39'].includes(manifest.decoratorMode))
    errors.push('decoratorMode must be legacy|tc39');
  if (!Array.isArray(manifest.protocols) || !manifest.protocols.length)
    errors.push('protocols must be a non-empty array');

  for (const key of ['components', 'routes', 'aspects']) {
    if (!Array.isArray(manifest[key])) errors.push(`${key} must be an array`);
  }
  for (const [i, c] of (manifest.components ?? []).entries()) {
    if (!isString(c?.id)) errors.push(`components[${i}].id is missing`);
    if (!isString(c?.type)) errors.push(`components[${i}].type is missing`);
    if (!isString(c?.file)) errors.push(`components[${i}].file is missing`);
    if (typeof c?.line !== 'number') errors.push(`components[${i}].line must be a number`);
    if (!Array.isArray(c?.dependsOn)) errors.push(`components[${i}].dependsOn must be an array`);
  }
  for (const [i, r] of (manifest.routes ?? []).entries()) {
    for (const key of ['method', 'path', 'controller', 'handler', 'file']) {
      if (!isString(r?.[key])) errors.push(`routes[${i}].${key} is missing`);
    }
    if (!r.path.startsWith('/')) errors.push(`routes[${i}].path must start with /`);
    for (const key of ['middleware', 'params']) {
      if (!Array.isArray(r?.[key])) errors.push(`routes[${i}].${key} must be an array`);
    }
  }
  if (typeof manifest.dtos !== 'object' || manifest.dtos === null)
    errors.push('dtos must be an object');
  if (!Array.isArray(manifest.config?.keys)) errors.push('config.keys must be an array');
  if (!manifest.security || typeof manifest.security !== 'object')
    errors.push('security must be an object');

  return errors;
}

/**
 * Render a manifest as Markdown (for `--format md`), aimed at AI prompts.
 */
export function renderManifestMarkdown(manifest: KoattyManifest): string {
  const lines: string[] = [];
  lines.push('# Koatty 应用清单');
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
