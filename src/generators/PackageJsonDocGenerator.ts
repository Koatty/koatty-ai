import { ChangeSet } from '../changeset/ChangeSet';
import * as fs from 'fs';
import * as path from 'path';

/** The docs command reuses the manifest DTO schemas; no second schema compiler. */
export function ensureDocScriptInPackageJson(
  changeset: ChangeSet,
  workingDirectory: string,
  options: { addScriptFile?: boolean } = { addScriptFile: true }
): void {
  const pkgPath = path.join(workingDirectory, 'package.json');
  if (!fs.existsSync(pkgPath)) return;
  const original = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(original);
  pkg.scripts ??= {};
  pkg.scripts.doc ??= 'tsx scripts/generate-api-doc.ts';
  pkg.dependencies ??= {};
  for (const [name, version] of Object.entries({
    typeorm: '^0.3.28',
    'class-validator': '^0.14.3',
    koatty_validation: '^4.0.0',
  })) {
    pkg.dependencies[name] ??= version;
  }
  pkg.devDependencies ??= {};
  pkg.devDependencies.tsx ??= '^4.0.0';
  // The CLI is also used by the generated doc script.
  pkg.devDependencies.koatty_cli ??= '^5.0.0';
  const content = JSON.stringify(pkg, null, 2);
  if (content !== original)
    changeset.modifyFile(
      'package.json',
      content,
      original,
      'Add module dependencies and manifest-based API docs'
    );
  if (
    options.addScriptFile &&
    !fs.existsSync(path.join(workingDirectory, 'scripts/generate-api-doc.ts'))
  ) {
    changeset.createFile(
      'scripts/generate-api-doc.ts',
      DOC_SOURCE,
      'Add API docs from the static manifest'
    );
  }
}

const DOC_SOURCE = `import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const root = process.cwd();
const out = path.join(root, 'docs');
fs.mkdirSync(out, { recursive: true });
const manifest = JSON.parse(execFileSync(process.execPath, [
  require.resolve('koatty_cli/dist/cli/index.js'), 'manifest', '--root', root, '--validate'
], { encoding: 'utf8' }));
const schemas: Record<string, unknown> = {};
for (const [name, dto] of Object.entries(manifest.dtos) as Array<[string, any]>) {
  const { definitions, $schema, ...schema } = dto.schema;
  schemas[name] = JSON.parse(JSON.stringify(schema).replace(/#\\/definitions\\//g, '#/components/schemas/'));
}
const paths: Record<string, any> = {};
for (const route of manifest.routes) {
  if (route.protocol !== 'http' || !['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(route.method)) continue;
  const url = route.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
  const operation: any = { operationId: route.controller + '.' + route.handler, responses: { '200': { description: 'Success' } } };
  const body = route.params.find((p: any) => p.source === 'body' && p.dto);
  if (body) operation.requestBody = { content: { 'application/json': { schema: { $ref: '#/components/schemas/' + body.dto } } } };
  for (const match of url.matchAll(/\\{([^}]+)\\}/g)) {
    (operation.parameters ??= []).push({ name: match[1], in: 'path', required: true, schema: { type: 'string' } });
  }
  (paths[url] ??= {})[route.method.toLowerCase()] = operation;
}
fs.writeFileSync(path.join(out, 'openapi.json'), JSON.stringify({
  openapi: '3.1.0', info: { title: 'API', version: '1.0.0' }, paths,
  components: { schemas }, 'x-koatty-unresolved': manifest.unresolved
}, null, 2));
console.log('API doc written to docs/openapi.json');
`;
