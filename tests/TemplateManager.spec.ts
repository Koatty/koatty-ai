import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import { exec } from 'child_process';
import { TemplateManager, TemplateType, MirrorSource } from '../src/services/TemplateManager';

// Mock child_process.exec
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

// Mock https
jest.mock('https', () => ({
  get: jest.fn(),
}));

describe('TemplateManager', () => {
  let tempDir: string;

  beforeAll(() => {
    // 创建临时测试目录
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-manager-test-'));
  });

  afterAll(() => {
    // 清理临时目录
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should use default paths when no options provided', () => {
      const tm = new TemplateManager();
      expect(tm.getCacheDir()).toBe(path.join(os.homedir(), '.koatty', 'templates'));
      expect(tm.getSubmoduleDir()).toContain('templates');
    });

    it('should use custom paths when options provided', () => {
      const customCacheDir = '/custom/cache';
      const customSubmoduleDir = '/custom/submodule';
      const tm = new TemplateManager({
        cacheDir: customCacheDir,
        submoduleDir: customSubmoduleDir,
      });
      expect(tm.getCacheDir()).toBe(customCacheDir);
      expect(tm.getSubmoduleDir()).toBe(customSubmoduleDir);
    });
  });

  describe('isValidTemplateDir', () => {
    it('should return false for non-existent directory', () => {
      const tm = new TemplateManager();
      expect(tm.isValidTemplateDir('/nonexistent/path')).toBe(false);
    });

    it('should return false for empty directory', () => {
      const emptyDir = path.join(tempDir, 'empty');
      fs.mkdirSync(emptyDir, { recursive: true });

      const tm = new TemplateManager();
      expect(tm.isValidTemplateDir(emptyDir)).toBe(false);
    });

    it('should return false for directory with only hidden files', () => {
      const hiddenDir = path.join(tempDir, 'hidden');
      fs.mkdirSync(hiddenDir, { recursive: true });
      fs.writeFileSync(path.join(hiddenDir, '.gitkeep'), '');

      const tm = new TemplateManager();
      expect(tm.isValidTemplateDir(hiddenDir)).toBe(false);
    });

    it('should return true for directory with non-hidden files', () => {
      const validDir = path.join(tempDir, 'valid');
      fs.mkdirSync(validDir, { recursive: true });
      fs.writeFileSync(path.join(validDir, 'template.hbs'), 'content');

      const tm = new TemplateManager();
      expect(tm.isValidTemplateDir(validDir)).toBe(true);
    });

    it('should return true for directory with mixed files', () => {
      const mixedDir = path.join(tempDir, 'mixed');
      fs.mkdirSync(mixedDir, { recursive: true });
      fs.writeFileSync(path.join(mixedDir, '.git'), '');
      fs.writeFileSync(path.join(mixedDir, 'template.hbs'), 'content');

      const tm = new TemplateManager();
      expect(tm.isValidTemplateDir(mixedDir)).toBe(true);
    });
  });

  describe('isBinaryFile', () => {
    it('should return true for image files', () => {
      const tm = new TemplateManager();
      expect(tm.isBinaryFile('logo.png')).toBe(true);
      expect(tm.isBinaryFile('logo.PNG')).toBe(true);
      expect(tm.isBinaryFile('icon.ico')).toBe(true);
      expect(tm.isBinaryFile('photo.jpg')).toBe(true);
      expect(tm.isBinaryFile('photo.jpeg')).toBe(true);
      expect(tm.isBinaryFile('image.gif')).toBe(true);
    });

    it('should return true for font files', () => {
      const tm = new TemplateManager();
      expect(tm.isBinaryFile('font.woff')).toBe(true);
      expect(tm.isBinaryFile('font.woff2')).toBe(true);
      expect(tm.isBinaryFile('font.ttf')).toBe(true);
    });

    it('should return true for archive files', () => {
      const tm = new TemplateManager();
      expect(tm.isBinaryFile('archive.zip')).toBe(true);
      expect(tm.isBinaryFile('archive.tar')).toBe(true);
      expect(tm.isBinaryFile('archive.gz')).toBe(true);
    });

    it('should return true for PDF files', () => {
      const tm = new TemplateManager();
      expect(tm.isBinaryFile('document.pdf')).toBe(true);
    });

    it('should return false for text files', () => {
      const tm = new TemplateManager();
      expect(tm.isBinaryFile('app.ts')).toBe(false);
      expect(tm.isBinaryFile('template.hbs')).toBe(false);
      expect(tm.isBinaryFile('config.json')).toBe(false);
      expect(tm.isBinaryFile('readme.md')).toBe(false);
      expect(tm.isBinaryFile('style.css')).toBe(false);
    });

    it('should handle paths with directories', () => {
      const tm = new TemplateManager();
      expect(tm.isBinaryFile('/path/to/logo.png')).toBe(true);
      expect(tm.isBinaryFile('/path/to/app.ts')).toBe(false);
    });
  });

  describe('getTemplatePath', () => {
    it('should prefer cache over bundled submodule', async () => {
      // 同时创建 cache 和 submodule，cache 应当优先
      const cacheDir = path.join(tempDir, 'priority-cache');
      const submoduleDir = path.join(tempDir, 'priority-bundled');
      const cacheModules = path.join(cacheDir, 'modules');
      const subModules = path.join(submoduleDir, 'modules');
      fs.mkdirSync(cacheModules, { recursive: true });
      fs.mkdirSync(subModules, { recursive: true });
      fs.writeFileSync(path.join(cacheModules, 'cached.hbs'), 'cached');
      fs.writeFileSync(path.join(subModules, 'bundled.hbs'), 'bundled');

      const tm = new TemplateManager({ cacheDir, submoduleDir });
      const result = await tm.getTemplatePath('modules');
      expect(result).toBe(cacheModules);
    });

    it('should fallback to bundled submodule when cache is empty', async () => {
      const baseDir = path.join(tempDir, 'templates');
      const modulesDir = path.join(baseDir, 'modules');
      fs.mkdirSync(modulesDir, { recursive: true });
      fs.writeFileSync(path.join(modulesDir, 'template.hbs'), 'content');

      const tm = new TemplateManager({ submoduleDir: baseDir });
      const result = await tm.getTemplatePath('modules');
      expect(result).toBe(modulesDir);
    });

    it('should return submodule path for project type when valid directory exists', async () => {
      const baseDir = path.join(tempDir, 'templates2');
      const projectDir = path.join(baseDir, 'project');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'template.hbs'), 'content');

      const tm = new TemplateManager({ submoduleDir: baseDir });
      const result = await tm.getTemplatePath('project');
      expect(result).toBe(projectDir);
    });
  });

  describe('getTemplateStatus', () => {
    it('should report cache as source when cache is valid', () => {
      const cacheDir = path.join(tempDir, 'status-cache');
      const submoduleDir = path.join(tempDir, 'status-bundled');
      const cacheModules = path.join(cacheDir, 'modules');
      fs.mkdirSync(cacheModules, { recursive: true });
      fs.writeFileSync(path.join(cacheModules, 'template.hbs'), 'content');

      const tm = new TemplateManager({ cacheDir, submoduleDir });
      const status = tm.getTemplateStatus('modules');

      expect(status.source).toBe('cache');
      expect(status.activePath).toBe(cacheModules);
      expect(status.cache.valid).toBe(true);
      expect(status.cache.updatedAt).not.toBeNull();
      expect(typeof status.cache.updatedAt!.getTime).toBe('function');
      expect(status.bundled.valid).toBe(false);
    });

    it('should report bundled as source when only submodule is valid', () => {
      const submoduleDir = path.join(tempDir, 'status-bundled2');
      const modulesDir = path.join(submoduleDir, 'modules');
      fs.mkdirSync(modulesDir, { recursive: true });
      fs.writeFileSync(path.join(modulesDir, 'template.hbs'), 'content');

      const tm = new TemplateManager({ submoduleDir });
      const status = tm.getTemplateStatus('modules');

      expect(status.source).toBe('bundled');
      expect(status.activePath).toBe(modulesDir);
      expect(status.bundled.valid).toBe(true);
    });

    it('should report none when neither is available', () => {
      const tm = new TemplateManager({
        cacheDir: '/nonexistent-cache',
        submoduleDir: '/nonexistent-sub',
      });
      const status = tm.getTemplateStatus('modules');

      expect(status.source).toBe('none');
      expect(status.activePath).toBeNull();
      expect(status.cache.valid).toBe(false);
      expect(status.bundled.valid).toBe(false);
    });
  });

  describe('renderTemplate', () => {
    it('should render simple variables', () => {
      const templateDir = path.join(tempDir, 'render-simple');
      fs.mkdirSync(templateDir, { recursive: true });
      fs.writeFileSync(path.join(templateDir, 'hello.hbs'), 'Hello {{name}}!');

      const tm = new TemplateManager();
      const result = tm.renderTemplate(path.join(templateDir, 'hello.hbs'), { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should render with pascalCase helper', () => {
      const templateDir = path.join(tempDir, 'render-pascal');
      fs.mkdirSync(templateDir, { recursive: true });
      fs.writeFileSync(path.join(templateDir, 'class.hbs'), 'class {{pascalCase name}} {}');

      const tm = new TemplateManager();
      const result = tm.renderTemplate(path.join(templateDir, 'class.hbs'), { name: 'my-service' });
      expect(result).toBe('class MyService {}');
    });

    it('should render with camelCase helper', () => {
      const templateDir = path.join(tempDir, 'render-camel');
      fs.mkdirSync(templateDir, { recursive: true });
      fs.writeFileSync(path.join(templateDir, 'var.hbs'), 'const {{camelCase name}} = 1;');

      const tm = new TemplateManager();
      const result = tm.renderTemplate(path.join(templateDir, 'var.hbs'), { name: 'my-variable' });
      expect(result).toBe('const myVariable = 1;');
    });

    it('should render with snakeCase helper', () => {
      const templateDir = path.join(tempDir, 'render-snake');
      fs.mkdirSync(templateDir, { recursive: true });
      fs.writeFileSync(path.join(templateDir, 'const.hbs'), 'const {{snakeCase name}} = 1;');

      const tm = new TemplateManager();
      const result = tm.renderTemplate(path.join(templateDir, 'const.hbs'), { name: 'MyConstant' });
      expect(result).toBe('const my_constant = 1;');
    });

    it('should render with lowerCase helper', () => {
      const templateDir = path.join(tempDir, 'render-lower');
      fs.mkdirSync(templateDir, { recursive: true });
      fs.writeFileSync(path.join(templateDir, 'lower.hbs'), 'path: /{{lowerCase name}}');

      const tm = new TemplateManager();
      const result = tm.renderTemplate(path.join(templateDir, 'lower.hbs'), { name: 'MyPath' });
      expect(result).toBe('path: /mypath');
    });

    it('should render with eq helper', () => {
      const templateDir = path.join(tempDir, 'render-eq');
      fs.mkdirSync(templateDir, { recursive: true });
      fs.writeFileSync(
        path.join(templateDir, 'eq.hbs'),
        '{{#if (eq type "admin")}}admin{{else}}user{{/if}}'
      );

      const tm = new TemplateManager();
      const result1 = tm.renderTemplate(path.join(templateDir, 'eq.hbs'), { type: 'admin' });
      expect(result1).toBe('admin');

      const result2 = tm.renderTemplate(path.join(templateDir, 'eq.hbs'), { type: 'guest' });
      expect(result2).toBe('user');
    });

    it('should render with json helper', () => {
      const templateDir = path.join(tempDir, 'render-json');
      fs.mkdirSync(templateDir, { recursive: true });
      fs.writeFileSync(path.join(templateDir, 'json.hbs'), 'config = {{{json config}}}');

      const tm = new TemplateManager();
      const result = tm.renderTemplate(path.join(templateDir, 'json.hbs'), {
        config: { port: 3000, host: 'localhost' },
      });
      expect(result).toBe('config = {"port":3000,"host":"localhost"}');
    });

    it('should throw error for non-existent template', () => {
      const tm = new TemplateManager();
      expect(() => tm.renderTemplate('/nonexistent/template.hbs', {})).toThrow('模板文件不存在');
    });
  });

  describe('renderDirectory', () => {
    it('should render .hbs files and remove extension', async () => {
      const templateDir = path.join(tempDir, 'render-dir-hbs');
      fs.mkdirSync(templateDir, { recursive: true });
      fs.writeFileSync(path.join(templateDir, 'app.ts.hbs'), 'const name = "{{name}}";');

      const tm = new TemplateManager();
      const results = await tm.renderDirectory(templateDir, { name: 'test' });

      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('app.ts');
      expect(results[0].content).toBe('const name = "test";');
      expect(results[0].isBinary).toBe(false);
    });

    it('should copy non-hbs text files as-is', async () => {
      const templateDir = path.join(tempDir, 'render-dir-txt');
      fs.mkdirSync(templateDir, { recursive: true });
      fs.writeFileSync(path.join(templateDir, 'readme.md'), '# My Project');

      const tm = new TemplateManager();
      const results = await tm.renderDirectory(templateDir, {});

      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('readme.md');
      expect(results[0].content).toBe('# My Project');
      expect(results[0].isBinary).toBe(false);
    });

    it('should copy binary files as Buffer', async () => {
      const templateDir = path.join(tempDir, 'render-dir-bin');
      fs.mkdirSync(templateDir, { recursive: true });
      // Create a simple binary-like content
      const binaryContent = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
      fs.writeFileSync(path.join(templateDir, 'icon.png'), binaryContent);

      const tm = new TemplateManager();
      const results = await tm.renderDirectory(templateDir, {});

      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('icon.png');
      expect(results[0].isBinary).toBe(true);
      expect(Buffer.isBuffer(results[0].content)).toBe(true);
      expect(results[0].content).toEqual(binaryContent);
    });

    it('should exclude .git and node_modules by default', async () => {
      const templateDir = path.join(tempDir, 'render-dir-exclude');
      fs.mkdirSync(path.join(templateDir, '.git'), { recursive: true });
      fs.mkdirSync(path.join(templateDir, 'node_modules'), { recursive: true });
      fs.writeFileSync(path.join(templateDir, '.git', 'config'), 'git config');
      fs.writeFileSync(path.join(templateDir, 'node_modules', 'pkg.json'), '{}');
      fs.writeFileSync(path.join(templateDir, 'app.ts'), 'content');

      const tm = new TemplateManager();
      const results = await tm.renderDirectory(templateDir, {});

      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('app.ts');
    });

    it('should exclude koatty.json by default', async () => {
      const templateDir = path.join(tempDir, 'render-dir-koatty');
      fs.mkdirSync(templateDir, { recursive: true });
      fs.writeFileSync(path.join(templateDir, 'koatty.json'), '{}');
      fs.writeFileSync(path.join(templateDir, 'app.ts'), 'content');

      const tm = new TemplateManager();
      const results = await tm.renderDirectory(templateDir, {});

      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('app.ts');
    });

    it('should support custom exclude patterns', async () => {
      const templateDir = path.join(tempDir, 'render-dir-custom-exclude');
      fs.mkdirSync(templateDir, { recursive: true });
      fs.writeFileSync(path.join(templateDir, 'app.ts'), 'content');
      fs.writeFileSync(path.join(templateDir, 'test.spec.ts'), 'test');

      const tm = new TemplateManager();
      const results = await tm.renderDirectory(
        templateDir,
        {},
        {
          excludePatterns: ['.spec.ts'],
        }
      );

      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('app.ts');
    });

    it('should handle nested directories', async () => {
      const templateDir = path.join(tempDir, 'render-dir-nested');
      fs.mkdirSync(path.join(templateDir, 'src', 'config'), { recursive: true });
      fs.writeFileSync(path.join(templateDir, 'src', 'app.ts.hbs'), 'const app = "{{name}}";');
      fs.writeFileSync(path.join(templateDir, 'src', 'config', 'db.ts.hbs'), 'export default {};');

      const tm = new TemplateManager();
      const results = await tm.renderDirectory(templateDir, { name: 'myapp' });

      expect(results).toHaveLength(2);

      const appFile = results.find((r) => r.path === path.join('src', 'app.ts'));
      const dbFile = results.find((r) => r.path === path.join('src', 'config', 'db.ts'));

      expect(appFile).toBeDefined();
      expect(appFile?.content).toBe('const app = "myapp";');
      expect(dbFile).toBeDefined();
    });

    it('should render path variables', async () => {
      const templateDir = path.join(tempDir, 'render-dir-path-vars');
      const moduleDir = path.join(templateDir, '{{moduleName}}');
      fs.mkdirSync(moduleDir, { recursive: true });
      fs.writeFileSync(path.join(moduleDir, '{{className}}.ts.hbs'), 'class {{className}} {}');

      const tm = new TemplateManager();
      const results = await tm.renderDirectory(templateDir, {
        moduleName: 'controller',
        className: 'TestController',
      });

      expect(results).toHaveLength(1);
      expect(results[0].path).toBe(path.join('controller', 'TestController.ts'));
      expect(results[0].content).toBe('class TestController {}');
    });
  });

  describe('detectBestMirror', () => {
    const mockHttpsGet = https.get as jest.Mock;

    beforeEach(() => {
      mockHttpsGet.mockReset();
    });

    it('should return github when connection succeeds', async () => {
      const mockRes = { destroy: jest.fn() };
      mockHttpsGet.mockImplementation((_url, _opts, callback) => {
        callback(mockRes);
        return { on: jest.fn() };
      });

      const tm = new TemplateManager();
      const result = await tm.detectBestMirror();
      expect(result).toBe('github');
    });

    it('should return gitee when connection fails', async () => {
      interface MockReq {
        on: jest.Mock;
      }
      const mockReq: MockReq = {
        on: jest.fn((event: string, callback: (err?: Error) => void): MockReq => {
          if (event === 'error') {
            callback(new Error('Connection failed'));
          }
          return mockReq;
        }),
      };
      mockHttpsGet.mockReturnValue(mockReq);

      const tm = new TemplateManager();
      const result = await tm.detectBestMirror();
      expect(result).toBe('gitee');
    });

    it('should return gitee when connection times out', async () => {
      interface MockReqWithDestroy {
        destroy: jest.Mock;
        on: jest.Mock;
      }
      const mockReq: MockReqWithDestroy = {
        destroy: jest.fn(),
        on: jest.fn((event: string, callback: () => void): MockReqWithDestroy => {
          if (event === 'timeout') {
            callback();
          }
          return mockReq;
        }),
      };
      mockHttpsGet.mockReturnValue(mockReq);

      const tm = new TemplateManager();
      const result = await tm.detectBestMirror();
      expect(result).toBe('gitee');
    });
  });

  describe('downloadTemplate', () => {
    const mockExec = exec as unknown as jest.Mock;
    const mockHttpsGet = https.get as jest.Mock;

    beforeEach(() => {
      mockExec.mockReset();
      mockHttpsGet.mockReset();
      // Default: github is available
      const mockRes = { destroy: jest.fn() };
      mockHttpsGet.mockImplementation((_url, _opts, callback) => {
        callback(mockRes);
        return { on: jest.fn() };
      });
    });

    it('should download template from github when specified', async () => {
      const cacheDir = path.join(tempDir, 'download-cache1');
      const tm = new TemplateManager({ cacheDir });

      // Mock successful git clone
      mockExec.mockImplementation(
        (
          _cmd: string,
          callback: (err: Error | null, result: { stdout: string; stderr: string }) => void
        ) => {
          // Create the target directory to simulate successful clone
          const targetDir = path.join(cacheDir, 'modules');
          fs.mkdirSync(targetDir, { recursive: true });
          fs.writeFileSync(path.join(targetDir, 'template.hbs'), 'content');
          callback(null, { stdout: '', stderr: '' });
        }
      );

      await tm.downloadTemplate('modules', 'github');

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('github.com/koatty/koatty-ai-template-modules'),
        expect.any(Function)
      );
    });

    it('should download template from gitee when specified', async () => {
      const cacheDir = path.join(tempDir, 'download-cache2');
      const tm = new TemplateManager({ cacheDir });

      mockExec.mockImplementation(
        (
          _cmd: string,
          callback: (err: Error | null, result: { stdout: string; stderr: string }) => void
        ) => {
          const targetDir = path.join(cacheDir, 'modules');
          fs.mkdirSync(targetDir, { recursive: true });
          fs.writeFileSync(path.join(targetDir, 'template.hbs'), 'content');
          callback(null, { stdout: '', stderr: '' });
        }
      );

      await tm.downloadTemplate('modules', 'gitee');

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('gitee.com/koatty/koatty-ai-template-modules'),
        expect.any(Function)
      );
    });

    it('should fallback to gitee when github fails', async () => {
      const cacheDir = path.join(tempDir, 'download-cache3');
      const tm = new TemplateManager({ cacheDir });

      let callCount = 0;
      mockExec.mockImplementation(
        (
          cmd: string,
          callback: (err: Error | null, result?: { stdout: string; stderr: string }) => void
        ) => {
          callCount++;
          if (callCount === 1 && cmd.includes('github')) {
            callback(new Error('GitHub connection failed'));
          } else {
            const targetDir = path.join(cacheDir, 'modules');
            fs.mkdirSync(targetDir, { recursive: true });
            fs.writeFileSync(path.join(targetDir, 'template.hbs'), 'content');
            callback(null, { stdout: '', stderr: '' });
          }
        }
      );

      await tm.downloadTemplate('modules', 'github');

      expect(mockExec).toHaveBeenCalledTimes(2);
      expect(mockExec).toHaveBeenLastCalledWith(
        expect.stringContaining('gitee.com'),
        expect.any(Function)
      );
    });

    it('should call onProgress callback', async () => {
      const cacheDir = path.join(tempDir, 'download-cache4');
      const tm = new TemplateManager({ cacheDir });

      mockExec.mockImplementation(
        (
          _cmd: string,
          callback: (err: Error | null, result: { stdout: string; stderr: string }) => void
        ) => {
          const targetDir = path.join(cacheDir, 'modules');
          fs.mkdirSync(targetDir, { recursive: true });
          fs.writeFileSync(path.join(targetDir, 'template.hbs'), 'content');
          callback(null, { stdout: '', stderr: '' });
        }
      );

      const onProgress = jest.fn();
      await tm.downloadTemplate('modules', 'github', onProgress);

      expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('正在从 github 下载模板'));
    });

    it('should throw error when download fails completely', async () => {
      const cacheDir = path.join(tempDir, 'download-cache5');
      const tm = new TemplateManager({ cacheDir });

      mockExec.mockImplementation((_cmd: string, callback: (err: Error | null) => void) => {
        callback(new Error('Clone failed'));
      });

      await expect(tm.downloadTemplate('modules', 'github')).rejects.toThrow();
    });

    it('should delete old cache before downloading', async () => {
      const cacheDir = path.join(tempDir, 'download-cache6');
      const oldCacheDir = path.join(cacheDir, 'modules');
      // Create old cache
      fs.mkdirSync(oldCacheDir, { recursive: true });
      fs.writeFileSync(path.join(oldCacheDir, 'old-template.hbs'), 'old content');

      const tm = new TemplateManager({ cacheDir });

      mockExec.mockImplementation(
        (
          _cmd: string,
          callback: (err: Error | null, result: { stdout: string; stderr: string }) => void
        ) => {
          // Simulate git clone creating new files
          fs.mkdirSync(oldCacheDir, { recursive: true });
          fs.writeFileSync(path.join(oldCacheDir, 'new-template.hbs'), 'new content');
          callback(null, { stdout: '', stderr: '' });
        }
      );

      await tm.downloadTemplate('modules', 'github');

      // Old file should be gone
      expect(fs.existsSync(path.join(oldCacheDir, 'old-template.hbs'))).toBe(false);
      // New file should exist
      expect(fs.existsSync(path.join(oldCacheDir, 'new-template.hbs'))).toBe(true);
    });

    it('should throw error when downloaded content is empty', async () => {
      const cacheDir = path.join(tempDir, 'download-cache7');
      const tm = new TemplateManager({ cacheDir });

      mockExec.mockImplementation(
        (
          _cmd: string,
          callback: (err: Error | null, result: { stdout: string; stderr: string }) => void
        ) => {
          // Create target directory but leave it empty
          const targetDir = path.join(cacheDir, 'modules');
          fs.mkdirSync(targetDir, { recursive: true });
          callback(null, { stdout: '', stderr: '' });
        }
      );

      await expect(tm.downloadTemplate('modules', 'github')).rejects.toThrow(
        '模板下载失败或内容为空'
      );
    });
  });

  describe('getTemplatePath with fallback', () => {
    const mockExec = exec as unknown as jest.Mock;
    const mockHttpsGet = https.get as jest.Mock;

    beforeEach(() => {
      mockExec.mockReset();
      mockHttpsGet.mockReset();
    });

    it('should return cache path when cache is valid (cache has priority)', async () => {
      const cacheDir = path.join(tempDir, 'fallback-cache');
      const cacheModulesDir = path.join(cacheDir, 'modules');
      fs.mkdirSync(cacheModulesDir, { recursive: true });
      fs.writeFileSync(path.join(cacheModulesDir, 'template.hbs'), 'content');

      const tm = new TemplateManager({
        submoduleDir: '/nonexistent',
        cacheDir,
      });
      const result = await tm.getTemplatePath('modules');

      expect(result).toBe(cacheModulesDir);
      expect(mockExec).not.toHaveBeenCalled();
    });

    it('should fallback to submodule when cache not valid', async () => {
      const submoduleDir = path.join(tempDir, 'fallback-submodule');
      const modulesDir = path.join(submoduleDir, 'modules');
      fs.mkdirSync(modulesDir, { recursive: true });
      fs.writeFileSync(path.join(modulesDir, 'template.hbs'), 'content');

      const tm = new TemplateManager({ submoduleDir });
      const result = await tm.getTemplatePath('modules');

      expect(result).toBe(modulesDir);
      expect(mockExec).not.toHaveBeenCalled();
    });

    it('should download when neither submodule nor cache exists', async () => {
      const cacheDir = path.join(tempDir, 'fallback-download');

      // Mock github available
      const mockRes = { destroy: jest.fn() };
      mockHttpsGet.mockImplementation((_url, _opts, callback) => {
        callback(mockRes);
        return { on: jest.fn() };
      });

      mockExec.mockImplementation(
        (
          _cmd: string,
          callback: (err: Error | null, result: { stdout: string; stderr: string }) => void
        ) => {
          const targetDir = path.join(cacheDir, 'modules');
          fs.mkdirSync(targetDir, { recursive: true });
          fs.writeFileSync(path.join(targetDir, 'template.hbs'), 'content');
          callback(null, { stdout: '', stderr: '' });
        }
      );

      const tm = new TemplateManager({
        submoduleDir: '/nonexistent',
        cacheDir,
      });
      const result = await tm.getTemplatePath('modules');

      expect(result).toBe(path.join(cacheDir, 'modules'));
      expect(mockExec).toHaveBeenCalled();
    });
  });

  describe('ensureTemplateRepo', () => {
    const mockExec = exec as unknown as jest.Mock;
    const mockHttpsGet = https.get as jest.Mock;

    beforeEach(() => {
      mockExec.mockReset();
      mockHttpsGet.mockReset();
      const mockRes = { destroy: jest.fn() };
      mockHttpsGet.mockImplementation((_url, _opts, callback) => {
        callback(mockRes);
        return { on: jest.fn() };
      });
    });

    it('should use existing template when force is false', async () => {
      const submoduleDir = path.join(tempDir, 'ensure-existing');
      const modulesDir = path.join(submoduleDir, 'modules');
      fs.mkdirSync(modulesDir, { recursive: true });
      fs.writeFileSync(path.join(modulesDir, 'template.hbs'), 'content');

      const tm = new TemplateManager({ submoduleDir });
      const result = await tm.ensureTemplateRepo('modules');

      expect(result).toBe(modulesDir);
      expect(mockExec).not.toHaveBeenCalled();
    });

    it('should force download when force is true', async () => {
      const cacheDir = path.join(tempDir, 'ensure-force');
      const submoduleDir = path.join(tempDir, 'ensure-force-sub');
      fs.mkdirSync(submoduleDir, { recursive: true });
      fs.writeFileSync(path.join(submoduleDir, 'template.hbs'), 'content');

      mockExec.mockImplementation(
        (
          _cmd: string,
          callback: (err: Error | null, result: { stdout: string; stderr: string }) => void
        ) => {
          const targetDir = path.join(cacheDir, 'modules');
          fs.mkdirSync(targetDir, { recursive: true });
          fs.writeFileSync(path.join(targetDir, 'template.hbs'), 'content');
          callback(null, { stdout: '', stderr: '' });
        }
      );

      const tm = new TemplateManager({ submoduleDir, cacheDir });
      const result = await tm.ensureTemplateRepo('modules', { force: true });

      expect(result).toBe(path.join(cacheDir, 'modules'));
      expect(mockExec).toHaveBeenCalled();
    });

    it('should use specified mirror when force downloading', async () => {
      const cacheDir = path.join(tempDir, 'ensure-mirror');

      mockExec.mockImplementation(
        (
          _cmd: string,
          callback: (err: Error | null, result: { stdout: string; stderr: string }) => void
        ) => {
          const targetDir = path.join(cacheDir, 'modules');
          fs.mkdirSync(targetDir, { recursive: true });
          fs.writeFileSync(path.join(targetDir, 'template.hbs'), 'content');
          callback(null, { stdout: '', stderr: '' });
        }
      );

      const tm = new TemplateManager({ submoduleDir: '/nonexistent', cacheDir });
      await tm.ensureTemplateRepo('modules', { force: true, mirror: 'gitee' });

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('gitee.com'),
        expect.any(Function)
      );
    });
  });

  describe('updateTemplates', () => {
    const mockExec = exec as unknown as jest.Mock;
    const mockHttpsGet = https.get as jest.Mock;

    beforeEach(() => {
      mockExec.mockReset();
      mockHttpsGet.mockReset();
      const mockRes = { destroy: jest.fn() };
      mockHttpsGet.mockImplementation((_url, _opts, callback) => {
        callback(mockRes);
        return { on: jest.fn() };
      });
    });

    it('should update all template types', async () => {
      const cacheDir = path.join(tempDir, 'update-all');

      mockExec.mockImplementation(
        (
          cmd: string,
          callback: (err: Error | null, result: { stdout: string; stderr: string }) => void
        ) => {
          // Extract type from command
          const typeMatch = cmd.match(/koatty-ai-template-(\w+)/);
          const type = typeMatch ? typeMatch[1] : 'modules';
          const targetDir = path.join(cacheDir, type);
          fs.mkdirSync(targetDir, { recursive: true });
          fs.writeFileSync(path.join(targetDir, 'template.hbs'), 'content');
          callback(null, { stdout: '', stderr: '' });
        }
      );

      const tm = new TemplateManager({ cacheDir });
      const onProgress = jest.fn();
      await tm.updateTemplates('github', onProgress);

      // Should download all three types
      expect(mockExec).toHaveBeenCalledTimes(3);
      expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('project'));
      expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('modules'));
      expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('component'));
    });
  });
});
