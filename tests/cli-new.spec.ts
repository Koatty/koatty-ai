import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TemplateManager } from '../src/services/TemplateManager';

describe('CLI New Command', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-new-test-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should generate project with correct directory structure', async () => {
    const manager = new TemplateManager();
    const templateDir = await manager.ensureTemplateRepo('project');

    const context = {
      projectName: 'my-test-app',
      className: 'MyTestApp',
      hostname: '0.0.0.0',
      port: 3000,
      protocol: 'http',
      _PROJECT_NAME: 'my-test-app',
    };

    const files = await manager.renderDirectory(path.join(templateDir, 'default'), context);
    const paths = files.map((f) => f.path);

    // Root files
    expect(paths).toContain('package.json');
    expect(paths).toContain('tsconfig.json');
    expect(paths).toContain('.gitignore');
    expect(paths).toContain('.koattysrc');
    expect(paths).toContain('README.md');

    // Entry
    expect(paths).toContain('src/App.ts');

    // Config
    expect(paths).toContain('src/config/server.ts');
    expect(paths).toContain('src/config/config.ts');
    expect(paths).toContain('src/config/db.ts');
    expect(paths).toContain('src/config/middleware.ts');
    expect(paths).toContain('src/config/plugin.ts');
    expect(paths).toContain('src/config/router.ts');

    // Sample controller & service
    expect(paths).toContain('src/controller/IndexController.ts');
    expect(paths).toContain('src/service/TestService.ts');

    // Empty directory placeholders
    expect(paths).toContain('src/model/.gitkeep');
    expect(paths).toContain('src/middleware/.gitkeep');
    expect(paths).toContain('src/plugin/.gitkeep');
    expect(paths).toContain('src/aspect/AuthAspect.ts');
    expect(paths).toContain('src/dto/.gitkeep');
    expect(paths).toContain('static/.gitkeep');
    expect(paths).toContain('test/.gitkeep');
  });

  it('should render projectName in package.json', async () => {
    const manager = new TemplateManager();
    const templateDir = await manager.ensureTemplateRepo('project');

    const context = {
      projectName: 'my-awesome-app',
      className: 'MyAwesomeApp',
      hostname: '0.0.0.0',
      port: 3000,
      protocol: 'http',
      _PROJECT_NAME: 'my-awesome-app',
    };

    const files = await manager.renderDirectory(path.join(templateDir, 'default'), context);
    const packageJsonFile = files.find((f) => f.path === 'package.json');

    expect(packageJsonFile).toBeDefined();
    expect(packageJsonFile?.content).toContain('"my-awesome-app"');
  });

  it('should use @Bootstrap decorator in App.ts', async () => {
    const manager = new TemplateManager();
    const templateDir = await manager.ensureTemplateRepo('project');

    const context = {
      projectName: 'my-test-app',
      className: 'MyTestApp',
      hostname: '0.0.0.0',
      port: 3000,
      protocol: 'http',
      _PROJECT_NAME: 'my-test-app',
    };

    const files = await manager.renderDirectory(path.join(templateDir, 'default'), context);
    const appFile = files.find((f) => f.path === 'src/App.ts');

    expect(appFile).toBeDefined();
    expect(appFile?.content).toContain('@Bootstrap()');
    expect(appFile?.content).toContain('export class App extends Koatty');
  });

  it('should have separate server.ts config', async () => {
    const manager = new TemplateManager();
    const templateDir = await manager.ensureTemplateRepo('project');

    const context = {
      projectName: 'my-test-app',
      className: 'MyTestApp',
      hostname: '0.0.0.0',
      port: 3000,
      protocol: 'http',
      _PROJECT_NAME: 'my-test-app',
    };

    const files = await manager.renderDirectory(path.join(templateDir, 'default'), context);
    const serverFile = files.find((f) => f.path === 'src/config/server.ts');

    expect(serverFile).toBeDefined();
    expect(serverFile?.content).toContain('hostname');
    expect(serverFile?.content).toContain('port');
    expect(serverFile?.content).toContain('protocol');
  });

  it('should remove .hbs extension from output files', async () => {
    const manager = new TemplateManager();
    const templateDir = await manager.ensureTemplateRepo('project');

    const context = {
      projectName: 'my-test-app',
      className: 'MyTestApp',
      hostname: '0.0.0.0',
      port: 3000,
      protocol: 'http',
      _PROJECT_NAME: 'my-test-app',
    };

    const files = await manager.renderDirectory(path.join(templateDir, 'default'), context);

    // Verify no .hbs extension in output paths
    for (const file of files) {
      expect(file.path).not.toContain('.hbs');
    }
  });

  // ── component: middleware ──────────────────────────────────────────

  it('should generate middleware component with correct structure', async () => {
    const manager = new TemplateManager();
    const componentDir = await manager.ensureTemplateRepo('component');
    const renderDir = path.join(componentDir, 'middleware');

    const context = {
      projectName: 'koatty-auth-middleware',
      className: 'KoattyAuthMiddlewareMiddleware',
    };

    const files = await manager.renderDirectory(renderDir, context);
    const paths = files.map((f) => f.path);

    expect(paths).toContain('package.json');
    expect(paths).toContain('tsconfig.json');
    expect(paths).toContain('src/index.ts');
    expect(paths).toContain('.gitignore');
    expect(paths).toContain('README.md');
  });

  it('should render middleware component package.json with projectName', async () => {
    const manager = new TemplateManager();
    const componentDir = await manager.ensureTemplateRepo('component');
    const renderDir = path.join(componentDir, 'middleware');

    const context = {
      projectName: 'koatty-auth-middleware',
      className: 'KoattyAuthMiddlewareMiddleware',
    };

    const files = await manager.renderDirectory(renderDir, context);
    const pkg = files.find((f) => f.path === 'package.json');
    expect(pkg).toBeDefined();
    expect(pkg?.content).toContain('"koatty-auth-middleware"');
    expect(pkg?.content).toContain('peerDependencies');
    expect(pkg?.content).toContain('"koatty"');
  });

  it('should render middleware component index.ts with @Middleware decorator', async () => {
    const manager = new TemplateManager();
    const componentDir = await manager.ensureTemplateRepo('component');
    const renderDir = path.join(componentDir, 'middleware');

    const context = {
      projectName: 'koatty-auth-middleware',
      className: 'KoattyAuthMiddlewareMiddleware',
    };

    const files = await manager.renderDirectory(renderDir, context);
    const indexFile = files.find((f) => f.path === 'src/index.ts');
    expect(indexFile).toBeDefined();
    expect(indexFile?.content).toContain('@Middleware()');
    expect(indexFile?.content).toContain('KoattyAuthMiddlewareMiddleware');
    expect(indexFile?.content).toContain('IMiddleware');
  });

  // ── component: plugin ─────────────────────────────────────────────

  it('should generate plugin component with correct structure', async () => {
    const manager = new TemplateManager();
    const componentDir = await manager.ensureTemplateRepo('component');
    const renderDir = path.join(componentDir, 'plugin');

    const context = {
      projectName: 'koatty-cache-plugin',
      className: 'KoattyCachePluginPlugin',
    };

    const files = await manager.renderDirectory(renderDir, context);
    const paths = files.map((f) => f.path);

    expect(paths).toContain('package.json');
    expect(paths).toContain('tsconfig.json');
    expect(paths).toContain('src/index.ts');
    expect(paths).toContain('.gitignore');
    expect(paths).toContain('README.md');
  });

  it('should render plugin component index.ts with @Plugin and @OnEvent', async () => {
    const manager = new TemplateManager();
    const componentDir = await manager.ensureTemplateRepo('component');
    const renderDir = path.join(componentDir, 'plugin');

    const context = {
      projectName: 'koatty-cache-plugin',
      className: 'KoattyCachePluginPlugin',
    };

    const files = await manager.renderDirectory(renderDir, context);
    const indexFile = files.find((f) => f.path === 'src/index.ts');
    expect(indexFile).toBeDefined();
    expect(indexFile?.content).toContain('@Plugin()');
    expect(indexFile?.content).toContain('IPlugin');
    expect(indexFile?.content).toContain('@OnEvent(AppEvent.appReady)');
    expect(indexFile?.content).toContain('@OnEvent(AppEvent.appStop)');
    expect(indexFile?.content).toContain('KoattyCachePluginPlugin');
  });
});
