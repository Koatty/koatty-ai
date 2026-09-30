/**
 * E-02 regression tests: `koatty mcp` (roadmap Phase E, item E-2).
 *
 * The server is driven through the real MCP protocol over an in-memory
 * transport pair, so `tools/list` and `tools/call` are exercised exactly as an
 * IDE would. Security gates under test:
 * - a read-only manifest never leaks config values;
 * - `koatty_apply` rejects a tampered changeset (`../outside.txt`) and a hash
 *   mismatch, and defaults to a dry run;
 * - `koatty_test` refuses files outside `test/` / `tests/`;
 * - no shell or path-escape tool is exposed.
 *
 * @License MIT
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../../src/mcp/server';
import { hashChangeSet, isRunnableTestFile, listTools, MCP_TOOLS } from '../../src/mcp/tools';
import { validateManifest, KoattyManifest } from '../../src/manifest';

const INLINE_SPEC = 'module: article\nfields:\n  id:\n    type: number\n    primary: true\n';

function writeFixture(root: string): void {
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'fixture-app', scripts: {} }),
    'tsconfig.json': JSON.stringify({ compilerOptions: { experimentalDecorators: true } }),
    'config/server.ts': `export default () => ({ protocol: 'http', port: 8080 });\n`,
    'config/redis.ts': `export default () => ({ host: 'db.internal.example', password: 'super-secret-value' });\n`,
    'src/controller/UserController.ts': `
@Controller('/users')
export class UserController {
  constructor(private userService: UserService) {}

  @Around(CacheAspect)
  @GetMapping('/:id', {middleware: [AuthMiddleware]})
  detail(@Query() id: string) {
    return this.userService.find(id);
  }
}
`,
    'src/service/UserService.ts': `
@Service()
export class UserService {
  constructor(private repo: UserRepository) {}

  find(id: string) { return { id }; }
}
`,
    'docs/guides/security.md':
      '# Security\n\nThe security profile is configured in config/security.ts.\n',
    'tests/unit/sample.test.ts':
      'describe("sample", () => { it("passes", () => { expect(1).toBe(1); }); });\n',
  };

  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf-8');
  }
}

interface Connected {
  client: Client;
  server: ReturnType<typeof createMcpServer>;
  close: () => Promise<void>;
}

async function connect(root: string): Promise<Connected> {
  const client = new Client({ name: 'koatty-e02-test', version: '0.0.0' });
  const server = createMcpServer(root, '4.2.2');
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return {
    client,
    server,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

type ToolText = { text: string; isError: boolean };

async function callTool(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const content = (result.content ?? []) as Array<{ type: string; text?: string }>;
  const text = content.map((part) => part.text ?? '').join('\n');
  return { text, isError: Boolean(result.isError) };
}

async function callJson<T>(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<T> {
  const { text, isError } = await callTool(client, name, args);
  if (isError) throw new Error(text);
  return JSON.parse(text) as T;
}

describe('E-02: koatty mcp', () => {
  let root: string;
  let conn: Connected;

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'koatty-mcp-'));
    writeFixture(root);
    conn = await connect(root);
  });

  afterAll(async () => {
    await conn.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('exposes exactly the Phase E tools with read-only hints', async () => {
    const { tools } = await conn.client.listTools();
    const names = tools.map((tool) => tool.name).sort();

    expect(names).toEqual(
      [
        'koatty_apply',
        'koatty_capabilities',
        'koatty_doctor',
        'koatty_verify',
        'koatty_docs',
        'koatty_explain_component',
        'koatty_manifest',
        'koatty_plan',
        'koatty_routes',
        'koatty_test',
      ].sort()
    );
    expect(listTools()).toHaveLength(MCP_TOOLS.length);

    const apply = tools.find((tool) => tool.name === 'koatty_apply')!;
    expect(apply.annotations?.readOnlyHint).toBe(false);
    expect(apply.annotations?.destructiveHint).toBe(true);
    for (const readOnly of ['koatty_manifest', 'koatty_routes', 'koatty_plan', 'koatty_docs']) {
      expect(tools.find((tool) => tool.name === readOnly)?.annotations?.readOnlyHint).toBe(true);
    }
  });

  test('koatty_manifest returns a valid manifest without config values', async () => {
    const manifest = await callJson<KoattyManifest>(conn.client, 'koatty_manifest', {});
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.components.map((c) => c.id)).toEqual(
      expect.arrayContaining(['UserController', 'UserService'])
    );

    const json = JSON.stringify(manifest);
    expect(json).not.toContain('super-secret-value');
    expect(json).not.toContain('db.internal.example');
    expect(json).not.toMatch(/\b8080\b/);
    expect(manifest.config.keys).toEqual(expect.arrayContaining(['port', 'host', 'password']));
  });

  test('koatty_routes filters by controller, method and path', async () => {
    const all = await callJson<{ total: number; matched: number; routes: unknown[] }>(
      conn.client,
      'koatty_routes',
      {}
    );
    expect(all.total).toBeGreaterThan(0);

    const filtered = await callJson<{ matched: number; routes: Array<{ handler: string }> }>(
      conn.client,
      'koatty_routes',
      { controller: 'UserController', method: 'GET', path: '/users' }
    );
    expect(filtered.matched).toBe(1);
    expect(filtered.routes[0].handler).toBe('detail');

    const empty = await callJson<{ matched: number }>(conn.client, 'koatty_routes', {
      controller: 'MissingController',
    });
    expect(empty.matched).toBe(0);
  });

  test('koatty_explain_component reports dependencies, dependents, aspects and routes', async () => {
    const service = await callJson<{
      component: { id: string; type: string; dependsOn: string[] };
      dependents: string[];
      routes: unknown[];
    }>(conn.client, 'koatty_explain_component', { id: 'UserService' });

    expect(service.component.type).toBe('SERVICE');
    expect(service.component.dependsOn).toEqual(['UserRepository']);
    expect(service.dependents).toEqual(['UserController']);
    expect(service.routes).toEqual([]);

    const controller = await callJson<{ routes: Array<{ handler: string }> }>(
      conn.client,
      'koatty_explain_component',
      { id: 'UserController' }
    );
    expect(controller.routes.map((route) => route.handler)).toEqual(['detail']);

    const unknown = await callTool(conn.client, 'koatty_explain_component', { id: 'Nope' });
    expect(unknown.isError).toBe(true);
    expect(unknown.text).toContain("Unknown component 'Nope'");
  });

  test('koatty_plan returns a hash-guarded preview and writes nothing', async () => {
    const plan = await callJson<{
      module: string;
      hash: string;
      changeCount: number;
      summary: string[];
      changeset: { module: string; changes: Array<{ type: string; path: string }> };
    }>(conn.client, 'koatty_plan', { spec: INLINE_SPEC });

    expect(plan.module).toBe('article');
    expect(plan.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(plan.changeCount).toBe(plan.changeset.changes.length);
    expect(plan.summary.length).toBe(plan.changeCount);

    // A read-only plan must not create anything on disk; `modify` entries point
    // at files that already exist, so only `create` entries are checked.
    expect(
      plan.changeset.changes.filter((change) => change.type === 'create').length
    ).toBeGreaterThan(0);
    for (const change of plan.changeset.changes) {
      expect(change.path.startsWith('..')).toBe(false);
      if (change.type === 'create') {
        expect(fs.existsSync(path.join(root, change.path))).toBe(false);
      }
    }
  });

  test('koatty_apply rejects a tampered changeset and a hash mismatch', async () => {
    const plan = await callJson<{
      hash: string;
      changeset: { module: string; changes: Array<Record<string, unknown>> };
    }>(conn.client, 'koatty_plan', { spec: INLINE_SPEC });

    // 1. Path escaping the project root is rejected before any write.
    const escapePlan = JSON.parse(JSON.stringify(plan)) as typeof plan;
    escapePlan.changeset.changes.push({ type: 'create', path: '../outside.txt', content: 'x' });
    const escaped = await callTool(conn.client, 'koatty_apply', {
      changeset: escapePlan.changeset,
      hash: escapePlan.hash,
    });
    expect(escaped.isError).toBe(true);
    expect(escaped.text).toMatch(/escapes project root|hash mismatch/);
    expect(fs.existsSync(path.join(root, '..', 'outside.txt'))).toBe(false);

    // 2. A content change invalidates the plan hash.
    const tampered = JSON.parse(JSON.stringify(plan)) as typeof plan;
    tampered.changeset.changes[0].content = '// tampered';
    const mismatch = await callTool(conn.client, 'koatty_apply', {
      changeset: tampered.changeset,
      hash: plan.hash,
    });
    expect(mismatch.isError).toBe(true);
    expect(mismatch.text).toContain('hash mismatch');

    // 3. A tampered changeset with a *recomputed* hash still cannot escape the root.
    const escapeOnly = JSON.parse(JSON.stringify(plan)) as typeof plan;
    escapeOnly.changeset.changes = [
      { type: 'create', path: '../outside.txt', content: 'x' } as Record<string, unknown>,
    ];
    const recomputed = await callJson<{ hash: string }>(conn.client, 'koatty_plan', {
      spec: INLINE_SPEC,
    });
    expect(recomputed.hash).toMatch(/^[0-9a-f]{64}$/);
    const escapedAgain = await callTool(conn.client, 'koatty_apply', {
      changeset: escapeOnly.changeset,
      hash: hashChangeSet(escapeOnly.changeset as any),
    });
    expect(escapedAgain.isError).toBe(true);
    expect(fs.existsSync(path.join(root, '..', 'outside.txt'))).toBe(false);
  });

  test('koatty_apply defaults to a dry run and writes only inside the root otherwise', async () => {
    const plan = await callJson<{
      hash: string;
      changeset: {
        module: string;
        changes: Array<{ type: string; path: string; content?: string }>;
      };
    }>(conn.client, 'koatty_plan', { spec: INLINE_SPEC });

    const preview = await callJson<{ dryRun: boolean; changes: string[] }>(
      conn.client,
      'koatty_apply',
      {
        changeset: plan.changeset,
        hash: plan.hash,
      }
    );
    expect(preview.dryRun).toBe(true);
    expect(preview.changes).toHaveLength(plan.changeset.changes.length);
    for (const change of plan.changeset.changes) {
      if (change.type === 'create') {
        expect(fs.existsSync(path.join(root, change.path))).toBe(false);
      }
    }

    const applied = await callJson<{ dryRun: boolean; written: string[] }>(
      conn.client,
      'koatty_apply',
      {
        changeset: plan.changeset,
        hash: plan.hash,
        dryRun: false,
      }
    );
    expect(applied.dryRun).toBe(false);
    expect(applied.written).toHaveLength(plan.changeset.changes.length);
    for (const change of plan.changeset.changes) {
      expect(fs.existsSync(path.join(root, change.path))).toBe(true);
      // The written content is exactly the planned content.
      expect(fs.readFileSync(path.join(root, change.path), 'utf-8')).toBe(change.content);
    }
  });

  test('koatty_test refuses anything outside test/ and tests/', async () => {
    expect(isRunnableTestFile('tests/unit/sample.test.ts')).toBe(true);
    expect(isRunnableTestFile('test/sample.spec.ts')).toBe(true);
    expect(isRunnableTestFile('src/controller/UserController.ts')).toBe(false);
    expect(isRunnableTestFile('tests/helpers.ts')).toBe(false);

    for (const file of [
      'src/controller/UserController.ts',
      '../outside.test.ts',
      'tests/helpers.ts',
    ]) {
      const result = await callTool(conn.client, 'koatty_test', { file });
      expect(result.isError).toBe(true);
      expect(result.text).toMatch(/Refusing to run|escapes project root/);
    }
  });

  test('koatty_docs searches the project documentation', async () => {
    const docs = await callJson<{
      matched: number;
      matches: Array<{ file: string; text: string }>;
    }>(conn.client, 'koatty_docs', { topic: 'security profile' });
    expect(docs.matched).toBe(1);
    expect(docs.matches[0].file).toBe('docs/guides/security.md');
    expect(docs.matches[0].text).toContain('security profile');
  });

  test('unknown tools and bad arguments fail closed', async () => {
    const unknown = await callTool(conn.client, 'koatty_shell', { command: 'rm -rf /' });
    expect(unknown.isError).toBe(true);
    expect(unknown.text).toContain('Unknown tool');

    const missing = await callTool(conn.client, 'koatty_explain_component', {});
    expect(missing.isError).toBe(true);
    expect(missing.text).toContain('Invalid tool arguments');

    const badSpec = await callTool(conn.client, 'koatty_plan', {});
    expect(badSpec.isError).toBe(true);
    expect(badSpec.text).toContain("Either 'spec'");
  });
});
