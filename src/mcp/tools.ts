/**
 * MCP tools exposed by `koatty mcp` (roadmap Phase E, item E-2).
 *
 * Design constraints from the roadmap:
 * - read-only tools never touch the disk (manifest / routes / explain / plan / docs);
 * - `koatty_apply` only accepts a changeset whose `hash` equals the one returned by
 *   `koatty_plan`, so a tampered changeset (e.g. `../outside.txt`) is rejected;
 * - every path argument goes through `resolveInside(root, ...)`;
 * - there is no arbitrary shell tool: `koatty_test` only runs test files below
 *   `test/` or `tests/` inside the project root, with a timeout.
 *
 * @License MIT
 */
import Ajv from 'ajv';
import { version } from '../../package.json';
import { queryManifest, ManifestQuery } from '../operations/inspect';
import * as fs from 'fs';
import * as path from 'path';
import { collectManifest, validateManifest, KoattyManifest } from '../manifest';
import { GeneratorPipeline } from '../pipeline/GeneratorPipeline';
import { SpecParser } from '../parser/SpecParser';
import {
  applyPlan,
  preparePlan,
  DevelopmentPlan,
  hashChangeSet,
  parseChangeSet,
} from '../operations/plans';
export { hashChangeSet } from '../operations/plans';
import { capabilities, doctor } from '../operations/discover';
import { diagnostic, OperationError, operationResultSchema, result } from '../operations/result';
import { runCheck, verifyProject, CheckName } from '../operations/verify';
import { resolveInside } from '../utils/sandbox';
import { ChangeSetInfo } from '../types/changeset';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  outputSchema?: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
  };
}

export interface McpToolContext {
  /** Project root; every path argument is resolved and validated against it. */
  root: string;
  signal?: AbortSignal;
  session?: object;
}

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  /** MCP results may carry extra fields; keeps the type assignable to the SDK's CallToolResult. */
  [key: string]: unknown;
}

type ToolArgs = Record<string, unknown>;
// Context identity is the MCP connection; never accept a plan supplied by another connection.
const issuedPlans = new WeakMap<object, Map<string, DevelopmentPlan>>();

const READ_ONLY = { readOnlyHint: true, idempotentHint: true } as const;

const TEST_FILE_PATTERN = /\.(test|spec)\.[cm]?[jt]sx?$/;
const TEST_DIR_PATTERN = /^(test|tests)\//;

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'koatty_capabilities',
    description: 'Discover supported development contracts and boundaries.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ_ONLY,
  },
  {
    name: 'koatty_doctor',
    description:
      'Diagnose installed project dependencies and static contracts without starting the app.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ_ONLY,
  },
  {
    name: 'koatty_verify',
    description: 'Run project checks without installing tools. Executes trusted project code.',
    inputSchema: {
      type: 'object',
      properties: {
        checks: {
          type: 'array',
          minItems: 1,
          items: { enum: ['types', 'test', 'lint', 'manifest'] },
        },
        file: { type: 'string' },
        timeoutMs: { type: 'integer', minimum: 1, maximum: 600000 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  },
  {
    name: 'koatty_manifest',
    description:
      'Return the application manifest (components, routes, DTOs, aspects, config key names). ' +
      'Config values are never included.',
    inputSchema: {
      type: 'object',
      properties: {
        section: { enum: ['components', 'routes', 'tools', 'resources', 'prompts'] },
        name: { type: 'string' },
        offset: { type: 'integer', minimum: 0 },
        limit: { type: 'integer', minimum: 1, maximum: 200 },
      },
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: 'koatty_routes',
    description:
      'List routes from the manifest, optionally filtered by path substring, controller or HTTP method.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Substring match against the route path' },
        controller: { type: 'string', description: 'Exact controller name' },
        method: { type: 'string', description: 'HTTP method, e.g. GET' },
      },
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: 'koatty_explain_component',
    description:
      'Explain one component: its file, constructor dependencies, dependents, aspects and routes.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Component id, e.g. UserService' } },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: 'koatty_plan',
    description:
      'Preview the changes generated from a spec without writing files. Returns the changeset and ' +
      'the hash required by koatty_apply.',
    inputSchema: {
      type: 'object',
      properties: {
        spec: { type: 'string', description: 'Inline YAML/JSON spec' },
        specPath: { type: 'string', description: 'Path to a spec file inside the project root' },
      },
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: 'koatty_apply',
    description:
      'Apply a changeset produced by koatty_plan. Requires the plan hash; dryRun defaults to true ' +
      'and must be set to false to write files.',
    inputSchema: {
      type: 'object',
      properties: {
        changeset: {
          type: ['object', 'string'],
          description: 'The changeset object (or JSON string) returned by koatty_plan',
        },
        hash: { type: 'string', description: 'Hash returned by koatty_plan' },
        dryRun: { type: 'boolean', description: 'Default true: preview only' },
      },
      required: ['changeset', 'hash'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: 'koatty_test',
    description:
      'Run one test file below test/ or tests/ inside the project root (bounded by a timeout).',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Relative test file path' },
        timeoutMs: { type: 'number', description: 'Timeout in ms (default 60000, max 600000)' },
      },
      required: ['file'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true },
  },
  {
    name: 'koatty_docs',
    description: 'Search the project documentation (docs/, README.md, llms.txt) for a topic.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Case-insensitive search term' },
        scope: {
          enum: ['project', 'framework'],
          description: 'Search project docs or the versioned bundled framework skill',
        },
        limit: { type: 'number', description: 'Maximum matches (default 5, max 20)' },
      },
      required: ['topic'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
];

const inputValidators = new Map(
  MCP_TOOLS.map((tool) => [
    tool.name,
    new Ajv({ strict: false, allErrors: true }).compile(tool.inputSchema),
  ])
);

function asString(args: ToolArgs, key: string, required = false): string | undefined {
  const value = args[key];
  if (value === undefined || value === null) {
    if (required) throw new Error(`Missing required argument: ${key}`);
    return undefined;
  }
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Argument '${key}' must be a non-empty string`);
  }
  return value.trim();
}

function asNumber(args: ToolArgs, key: string, fallback: number, min: number, max: number): number {
  const value = args[key];
  if (value === undefined || value === null) return fallback;
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) {
    throw new Error(`Argument '${key}' must be a number between ${min} and ${max}`);
  }
  return num;
}

function toPosix(relative: string): string {
  return relative.split(path.sep).join('/');
}

function relativeInside(root: string, target: string): string {
  return toPosix(path.relative(root, resolveInside(root, target)));
}

function describeChanges(info: ChangeSetInfo): string[] {
  return (info.changes ?? []).map((change) => `${change.type} ${toPosix(change.path)}`);
}

export function isRunnableTestFile(relativePath: string): boolean {
  const normalized = toPosix(relativePath);
  return TEST_DIR_PATTERN.test(normalized) && TEST_FILE_PATTERN.test(normalized);
}

function loadManifest(ctx: McpToolContext): KoattyManifest {
  const manifest = collectManifest(ctx.root);
  const problems = validateManifest(manifest);
  if (problems.length) {
    throw new Error(`Manifest validation failed: ${problems.join('; ')}`);
  }
  return manifest;
}

function toolManifest(args: ToolArgs, ctx: McpToolContext): unknown {
  return queryManifest(loadManifest(ctx), args as ManifestQuery);
}

function toolRoutes(args: ToolArgs, ctx: McpToolContext): unknown {
  const manifest = loadManifest(ctx);
  const pathFilter = asString(args, 'path')?.toLowerCase();
  const controller = asString(args, 'controller');
  const method = asString(args, 'method')?.toUpperCase();

  const routes = manifest.routes.filter((route) => {
    if (pathFilter && !route.path.toLowerCase().includes(pathFilter)) return false;
    if (controller && route.controller !== controller) return false;
    if (method && route.method.toUpperCase() !== method) return false;
    return true;
  });

  return { total: manifest.routes.length, matched: routes.length, routes };
}

function toolExplainComponent(args: ToolArgs, ctx: McpToolContext): unknown {
  const id = asString(args, 'id', true)!;
  const manifest = loadManifest(ctx);
  const component = manifest.components.find((c) => c.id === id);
  if (!component) {
    throw new Error(
      `Unknown component '${id}'. Known components: ${manifest.components
        .map((c) => c.id)
        .join(', ')}`
    );
  }

  return {
    component,
    mcp: {
      tools: manifest.mcp?.tools.filter((tool) => tool.component === id) ?? [],
      resources: manifest.mcp?.resources.filter((item) => item.component === id) ?? [],
      prompts: manifest.mcp?.prompts.filter((item) => item.component === id) ?? [],
    },
    dependents: manifest.components.filter((c) => c.dependsOn.includes(id)).map((c) => c.id),
    aspects: manifest.aspects.filter((aspect) =>
      aspect.targets.some((target) => target === id || target.startsWith(`${id}.`))
    ),
    routes: manifest.routes.filter((route) => route.controller === id),
  };
}

async function toolPlan(args: ToolArgs, ctx: McpToolContext): Promise<unknown> {
  const specPath = asString(args, 'specPath');
  const inlineSpec = asString(args, 'spec');
  if (!specPath && !inlineSpec) {
    throw new Error("Either 'spec' (inline YAML/JSON) or 'specPath' is required");
  }

  let pipeline: GeneratorPipeline;
  if (specPath) {
    const absolute = resolveInside(ctx.root, specPath);
    if (!fs.existsSync(absolute)) throw new Error(`Spec file not found: ${specPath}`);
    pipeline = new GeneratorPipeline(relativeInside(ctx.root, specPath), {
      workingDirectory: ctx.root,
    });
  } else {
    pipeline = new GeneratorPipeline(SpecParser.parseYaml(inlineSpec!), {
      workingDirectory: ctx.root,
    });
  }

  const changeset = await pipeline.execute();
  const info = changeset.toJSON();
  parseChangeSet(info);
  const hash = hashChangeSet(info);
  const plan = preparePlan(ctx.root, info);
  let plans = issuedPlans.get(ctx.session ?? ctx);
  if (!plans) {
    plans = new Map();
    issuedPlans.set(ctx.session ?? ctx, plans);
  }
  for (const [key, item] of plans) if (item.expires < Date.now()) plans.delete(key);
  if (plans.size >= 32) plans.delete(plans.keys().next().value!);
  plans.set(hash, plan);

  return {
    module: info.module,
    hash,
    changeCount: info.changes.length,
    summary: describeChanges(info),
    changeset: info,
  };
}

function toolApply(args: ToolArgs, ctx: McpToolContext): unknown {
  const info = parseChangeSet(args.changeset);
  const expected = asString(args, 'hash', true)!;
  const actual = hashChangeSet(info);
  if (actual !== expected) {
    throw new OperationError(
      'PLAN_TAMPERED',
      `Changeset hash mismatch: apply the unmodified koatty_plan output (expected ${expected}, got ${actual})`
    );
  }

  if (args.dryRun !== undefined && typeof args.dryRun !== 'boolean') {
    throw new Error('dryRun must be a boolean');
  }
  const root = fs.realpathSync(ctx.root);
  const plans = issuedPlans.get(ctx.session ?? ctx);
  const plan = plans?.get(expected);
  if (!plan || plan.root !== root || plan.expires < Date.now()) {
    throw new OperationError(
      'PLAN_NOT_ISSUED',
      'Plan was not issued by this session, expired or was already applied; run koatty_plan again'
    );
  }
  const dryRun = args.dryRun !== false;
  const preview = applyPlan(root, plan, true);
  if (dryRun) return preview;
  plans!.delete(expected);
  return applyPlan(root, plan, false);
}

async function toolTest(args: ToolArgs, ctx: McpToolContext): Promise<unknown> {
  const file = asString(args, 'file', true)!;
  const relative = relativeInside(ctx.root, file);
  if (!isRunnableTestFile(relative)) {
    throw new Error(
      `Refusing to run '${file}': only *.test.* / *.spec.* files below test/ or tests/ may run`
    );
  }
  const timeoutMs = asNumber(args, 'timeoutMs', 60000, 1, 600000);
  const check = await runCheck(ctx.root, 'test', { file: relative, timeoutMs, signal: ctx.signal });
  return { file: relative, ...check, timeoutMs };
}

function listDocs(root: string, roots = ['docs', 'README.md', 'llms.txt']): string[] {
  const files: string[] = [];
  const walk = (target: string, depth: number): void => {
    if (depth > 4 || files.length > 500) return;
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(resolveInside(root, target));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    if (stat.isFile()) {
      if (/\.(md|mdx|txt)$/i.test(target)) files.push(target);
      return;
    }
    if (!stat.isDirectory()) return;
    for (const entry of fs.readdirSync(target)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      walk(path.join(target, entry), depth + 1);
    }
  };
  for (const candidate of roots) walk(resolveInside(root, candidate), 0);
  return files;
}

function toolDocs(args: ToolArgs, ctx: McpToolContext): unknown {
  const topic = asString(args, 'topic', true)!.toLowerCase();
  const limit = asNumber(args, 'limit', 5, 1, 20);
  const matches: Array<{ file: string; line: number; text: string }> = [];

  const source = args.scope === 'framework' ? 'framework' : 'project';
  const docsRoot =
    source === 'framework' ? path.resolve(__dirname, '../../skills/koatty') : ctx.root;
  for (const file of listDocs(
    docsRoot,
    source === 'framework' ? ['SKILL.md', 'references'] : undefined
  )) {
    if (matches.length >= limit) break;
    const lines = fs.readFileSync(resolveInside(docsRoot, file), 'utf8').split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      if (!lines[index].toLowerCase().includes(topic)) continue;
      matches.push({
        file: toPosix(path.relative(docsRoot, file)),
        line: index + 1,
        text: lines[index].trim().slice(0, 300),
      });
      if (matches.length >= limit) break;
    }
  }

  return {
    topic,
    source,
    ...(source === 'framework' ? { cliVersion: version } : {}),
    matched: matches.length,
    matches,
  };
}

const HANDLERS: Record<
  string,
  (args: ToolArgs, ctx: McpToolContext) => unknown | Promise<unknown>
> = {
  koatty_capabilities: () => capabilities(),
  koatty_doctor: (_args, ctx) => doctor(ctx.root),
  koatty_verify: (args, ctx) =>
    verifyProject(ctx.root, {
      checks: args.checks as CheckName[] | undefined,
      file: args.file as string | undefined,
      timeoutMs: args.timeoutMs as number | undefined,
      signal: ctx.signal,
    }),
  koatty_manifest: toolManifest,
  koatty_routes: toolRoutes,
  koatty_explain_component: toolExplainComponent,
  koatty_plan: toolPlan,
  koatty_apply: toolApply,
  koatty_test: toolTest,
  koatty_docs: toolDocs,
};

const validateOutput = new Ajv({ strict: false }).compile(operationResultSchema);
export function listTools(): McpToolDefinition[] {
  return MCP_TOOLS.map((tool) => ({ ...tool, outputSchema: operationResultSchema }));
}

export async function callTool(
  name: string,
  args: ToolArgs,
  ctx: McpToolContext
): Promise<McpToolResult> {
  const handler = HANDLERS[name];
  if (!handler) throw new OperationError('UNKNOWN_TOOL', `Unknown tool: ${name}`);
  const validate = inputValidators.get(name)!;
  if (!validate(args ?? {}))
    throw new OperationError(
      'INVALID_ARGUMENT',
      `Invalid tool arguments: ${JSON.stringify(validate.errors)}`
    );
  const data = await handler(args ?? {}, ctx);
  const failed =
    !!data &&
    typeof data === 'object' &&
    (('passed' in data && (data as any).passed === false) ||
      ('status' in data && ['failed', 'cancelled'].includes((data as any).status)));
  const envelope =
    (data as any)?.schemaVersion === 1 && (data as any)?.operation && (data as any)?.status
      ? data
      : result(
          name.replace(/^koatty_/, ''),
          failed
            ? 'failed'
            : name === 'koatty_plan' || (data as any)?.dryRun
              ? 'preview'
              : name === 'koatty_apply'
                ? 'applied'
                : 'completed',
          data
        );
  if (!validateOutput(envelope))
    throw new OperationError(
      'OUTPUT_CONTRACT_INVALID',
      'Tool result violates the operation result contract'
    );
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: envelope,
    ...(failed ? { isError: true } : {}),
  };
}

/** MCP-facing wrapper: tool failures are reported as `isError` results, not exceptions. */
export async function callToolSafe(
  name: string,
  args: ToolArgs,
  ctx: McpToolContext
): Promise<McpToolResult> {
  try {
    return await callTool(name, args, ctx);
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
      structuredContent: result(name.replace(/^koatty_/, ''), 'failed', null, [diagnostic(error)]),
      isError: true,
    };
  }
}
