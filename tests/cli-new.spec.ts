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

    // Verify files exist
    expect(files.some((f) => f.path === 'src/App.ts')).toBe(true);
    expect(files.some((f) => f.path === 'src/config/server.ts')).toBe(true);
    expect(files.some((f) => f.path === 'src/config/config.ts')).toBe(true);
    expect(files.some((f) => f.path === 'package.json')).toBe(true);
    expect(files.some((f) => f.path === '.gitignore')).toBe(true);
    expect(files.some((f) => f.path === '.koattysrc')).toBe(true);
    expect(files.some((f) => f.path === 'README.md')).toBe(true);
    expect(files.some((f) => f.path === 'tsconfig.json')).toBe(true);
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
});
