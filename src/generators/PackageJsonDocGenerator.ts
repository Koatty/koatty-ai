import { ChangeSet } from '../changeset/ChangeSet';
import * as fs from 'fs';
import * as path from 'path';

const DOC_SCRIPT = 'npx ts-node scripts/generate-api-doc.ts';
const TYPIA_VERSION = '^0.29.0';
const TS_MORPH_VERSION = '^27.0.0';
const TS_PATCH_VERSION = '^3.0.0';

/**
 * Ensures package.json has the "doc" script and optional devDependencies for API doc generation.
 * Optionally adds scripts/generate-api-doc.ts if not present.
 */
export function ensureDocScriptInPackageJson(
  changeset: ChangeSet,
  workingDirectory: string,
  options: { addScriptFile?: boolean } = { addScriptFile: true }
): void {
  const pkgPath = path.join(workingDirectory, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return;
  }

  const originalContent = fs.readFileSync(pkgPath, 'utf-8');
  const pkg = JSON.parse(originalContent) as {
    name?: string;
    version?: string;
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  let modified = false;
  if (!pkg.scripts) {
    pkg.scripts = {};
  }
  if (!pkg.scripts.doc) {
    pkg.scripts.doc = DOC_SCRIPT;
    modified = true;
  }

  if (!pkg.devDependencies) {
    pkg.devDependencies = {};
  }
  if (!pkg.devDependencies['typia']) {
    pkg.devDependencies['typia'] = TYPIA_VERSION;
    modified = true;
  }
  if (!pkg.devDependencies['ts-morph']) {
    pkg.devDependencies['ts-morph'] = TS_MORPH_VERSION;
    modified = true;
  }
  if (!pkg.devDependencies['ts-patch']) {
    pkg.devDependencies['ts-patch'] = TS_PATCH_VERSION;
    modified = true;
  }

  if (modified) {
    const newContent = JSON.stringify(pkg, null, 2);
    changeset.modifyFile(
      'package.json',
      newContent,
      originalContent,
      'Add doc script for Typia API documentation'
    );
  }

  if (options.addScriptFile) {
    const scriptPath = path.join(workingDirectory, 'scripts', 'generate-api-doc.ts');
    if (!fs.existsSync(scriptPath)) {
      const templatePath = path.join(
        __dirname,
        '..',
        '..',
        'templates',
        'scripts',
        'generate-api-doc.ts'
      );
      const content = fs.existsSync(templatePath)
        ? fs.readFileSync(templatePath, 'utf-8')
        : getDefaultDocScriptContent();
      changeset.createFile(
        'scripts/generate-api-doc.ts',
        content,
        'Add API doc generator script (Typia + controllers)'
      );
    }
  }
}

function getDefaultDocScriptContent(): string {
  return `/**
 * API 文档生成脚本 - 基于 Typia 与 Controller 扫描
 * 运行: npm run doc
 * 输出: docs/openapi.json
 */
import { Project } from 'ts-morph';
import * as fs from 'fs';
import * as path from ' 'path';

const projectRoot = process.cwd();
const srcDir = path.join(projectRoot, 'src');
const scriptsDir = path.join(projectRoot, 'scripts');
const docsDir = path.join(projectRoot, 'docs');

function main() {
  if (!fs.existsSync(srcDir)) {
    console.warn('No src directory found. Skip API doc generation.');
    return;
  }

  const project = new Project({ compilerOptions: { strict: true } });
  project.addSourceFilesAtPaths(path.join(srcDir, '**/*.ts'));

  const dtoFiles = project.getSourceFiles().filter((f) => f.getFilePath().includes('Dto.ts'));
  const controllerFiles = project.getSourceFiles().filter((f) => f.getFilePath().includes('Controller.ts'));

  const schemaEntryLines: string[] = [
    "import typia from 'typia';",
    '',
  ];

  const dtoTypeNames: string[] = [];
  for (const file of dtoFiles) {
    const relPath = path.relative(scriptsDir, file.getFilePath()).replace(/\\.ts$/, '').replace(/\\\\/g, '/');
    const alias = relPath.replace(/[^a-zA-Z0-9]/g, '_');
    const classes = file.getClasses().filter((c) => c.getName()?.endsWith('Dto'));
    if (classes.length === 0) continue;
    const names = classes.map((c) => c.getName()!).filter(Boolean);
    schemaEntryLines.push(\`import { \${names.join(', ')} } from '\${relPath}';\`);
    dtoTypeNames.push(...names);
  }

  if (dtoTypeNames.length > 0) {
    schemaEntryLines.push('');
    schemaEntryLines.push(\`const schemas = typia.json.schemas<[\${dtoTypeNames.join(', ')}]>("3.0");\`);
    schemaEntryLines.push("require('fs').writeFileSync(require('path').join(__dirname, 'api-schemas.json'), JSON.stringify(schemas, null, 2));");
  }

  const paths: Record<string, Record<string, unknown>> = {};
  for (const file of controllerFiles) {
    const classes = file.getClasses();
    for (const clazz of classes) {
      const controllerDec = clazz.getDecorator('Controller');
      const basePath = controllerDec?.getArguments()[0]?.getText().replace(/^['"]|['"]$/g, '') ?? '/';
      for (const method of clazz.getMethods()) {
        const getDec = method.getDecorator('Get') ?? method.getDecorator('GetMapping');
        const postDec = method.getDecorator('Post') ?? method.getDecorator('PostMapping');
        const putDec = method.getDecorator('Put') ?? method.getDecorator('PutMapping');
        const delDec = method.getDecorator('Delete') ?? method.getDecorator('DeleteMapping');
        const dec = getDec ?? postDec ?? putDec ?? delDec;
        if (!dec) continue;
        const methodPath = dec.getArguments()[0]?.getText().replace(/^['"]|['"]$/g, '') ?? '/';
        const fullPath = basePath.replace(/\\/$/, '') + (methodPath === '/' ? '' : methodPath);
        const httpMethod = getDec ? 'get' : postDec ? 'post' : putDec ? 'put' : 'delete';
        const summary = method.getJsDoc().map((d) => d.getDescription().trim()).join(' ') || method.getName() ?? '';

        const op: Record<string, unknown> = { summary, responses: { 200: { description: 'OK' } } };
        const params = method.getParameters();
        for (const p of params) {
          if (p.getDecorator('RequestBody')) {
            const type = p.getType().getText();
            const refName = type.split('.').pop() ?? type;
            if (refName.endsWith('Dto')) {
              op.requestBody = { content: { 'application/json': { schema: { $ref: \`#/components/schemas/\${refName}\` } } } };
            }
          }
        }
        if (!paths[fullPath]) paths[fullPath] = {};
        (paths[fullPath] as Record<string, unknown>)[httpMethod] = op;
      }
    }
  }

  const openapi = {
    openapi: '3.0.0',
    info: { title: 'API', version: '1.0.0' },
    paths,
    components: { schemas: {} },
  };

  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(docsDir, 'openapi.json'), JSON.stringify(openapi, null, 2));
  console.log('API doc written to docs/openapi.json');
}

main();
`.replace("from ' 'path'", "from 'path'");
}
