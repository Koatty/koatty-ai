import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { TemplateManager, RenderResult } from '../services/TemplateManager';
import { resolveInside } from '../utils/sandbox';
import { version } from '../../package.json';
import { OperationError } from './result';

export async function scaffoldProject(
  name: string,
  directory: string,
  options: {
    template?: string;
    source?: 'bundled' | 'cache';
    offline?: boolean;
    digest?: string;
  } = {}
) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name))
    throw new OperationError(
      'INVALID_ARGUMENT',
      'Use a simple project name containing letters, digits, dot, dash or underscore'
    );
  const recipe = options.template ?? 'project';
  if (!['project', 'mcp', 'agent', 'middleware', 'plugin'].includes(recipe))
    throw new OperationError(
      'INVALID_ARGUMENT',
      'Template must be project, mcp, agent, middleware or plugin'
    );
  const target = path.resolve(directory);
  if (
    fs.existsSync(target) &&
    (!fs.lstatSync(target).isDirectory() || fs.readdirSync(target).length)
  )
    throw new OperationError('DIRECTORY_NOT_EMPTY', 'Target must be an empty directory');
  const manager = new TemplateManager();
  const project = ['project', 'mcp', 'agent'].includes(recipe);
  const selected = await manager.resolveTemplate(project ? 'project' : 'component', options);
  const renderDir = path.join(selected.directory, project ? 'default' : recipe);
  const context = {
    projectName: name,
    className:
      name.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()) +
      (project ? '' : recipe[0].toUpperCase() + recipe.slice(1)),
    hostname: '127.0.0.1',
    port: 3000,
    protocol: 'http',
    _PROJECT_NAME: name,
    agent: recipe === 'agent',
  };
  let files = await manager.renderDirectory(renderDir, context);
  if (recipe === 'mcp' || recipe === 'agent') {
    const extra = await manager.renderDirectory(path.join(__dirname, '../../recipes/mcp'), context);
    const replacements = new Set(extra.map((f) => f.path));
    files = files.filter(
      (f) =>
        !replacements.has(f.path) &&
        !/^(src\/(controller|aspect|config|service)\/|test\/smoke)/.test(f.path)
    );
    files.push(...extra);
    const pkgFile = files.find((f) => f.path === 'package.json')!;
    const pkg = JSON.parse(String(pkgFile.content));
    Object.assign(pkg.dependencies, {
      koatty_core: '^2.7.0',
      koatty_container: '^4.1.0',
      koatty_mcp: '^1.0.0',
      koatty_validation: '^5.0.0',
      'class-validator': '^0.14.3',
      'reflect-metadata': '^0.2.2',
      '@modelcontextprotocol/sdk': '^1.30.1',
    });
    if (recipe === 'agent')
      Object.assign(pkg.dependencies, { koatty_llm: '^1.0.0', koatty_router: '^2.5.0' });
    pkg.scripts.test = 'jest --runInBand';
    pkg.scripts.start = 'node dist/App.js';
    pkgFile.content = JSON.stringify(pkg, null, 2) + '\n';
    files = files.filter((f) => f.path !== 'README.md');
    files.push({
      path: 'README.md',
      content: `# ${name}\n\nGenerated ${recipe} application.\n\nInstall dependencies, run npm run build and npm test. Configure MCP_API_KEYS as a JSON map from credentials to greeting:read / greeting:write scopes, then npm start. Never commit credentials.\n\nHTTP MCP: /mcp, loopback only by default. Attach an ApprovalService in src/application.ts to allow writes; without it write calls are denied. Greeting state is an in-memory example, not durable business storage.\n${recipe === 'agent' ? '\nPOST /ask accepts {"question":"..."} with x-api-key authentication and returns SSE. Configure LLM_BASE_URL, LLM_PROVIDER_TOKEN and LLM_MODEL. Only greeting_read is allowed in the model tool loop.\n' : ''}\nTests use the real MCP SDK with an in-memory transport; separately verify HTTP and your provider before deployment.\n`,
      isBinary: false,
    });
  }
  // Ship the same maintained skill with generated applications when bundled.
  const skill = path.join(__dirname, '../../skills/koatty');
  if (fs.existsSync(skill)) {
    const resources = await manager.renderDirectory(skill, {});
    files.push(...resources.map((f) => ({ ...f, path: `.agents/skills/koatty/${f.path}` })));
  }
  const outputHash = createHash('sha256');
  files
    .sort((a, b) => a.path.localeCompare(b.path))
    .forEach((f) =>
      outputHash.update(f.path + '\0').update(createHash('sha256').update(f.content).digest())
    );
  const receipt = {
    schemaVersion: 1,
    cliVersion: version,
    recipe,
    template: { source: selected.source, sha256: selected.sha256 },
    outputSha256: outputHash.digest('hex'),
    files: files.map((f) => f.path),
  };
  files.push({
    path: '.koatty/template-lock.json',
    content: JSON.stringify(receipt, null, 2) + '\n',
    isBinary: false,
  });
  fs.mkdirSync(target, { recursive: true });
  // Resolve every generated target before any file write. No formatter changes the locked bytes.
  const paths = new Set<string>();
  for (const f of files) {
    const absolute = resolveInside(target, f.path);
    if (paths.has(absolute))
      throw new OperationError('INVALID_TEMPLATE', 'Template contains duplicate paths');
    paths.add(absolute);
  }
  for (const file of files) writeNewFile(target, file);
  return { root: target, ...receipt };
}

function writeNewFile(root: string, file: RenderResult) {
  const target = resolveInside(root, file.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  resolveInside(root, file.path);
  fs.writeFileSync(target, file.content, { flag: 'wx' });
}
