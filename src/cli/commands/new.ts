import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import ora from 'ora';
import { TemplateManager } from '../../services/TemplateManager';

function toPascal(s: string): string {
  return s.replace(/(?:^|[-/])(\w)/g, (_, c) => (c ? c.toUpperCase() : ''));
}

function getMiddlewareTemplate(projectName: string): Array<{ path: string; content: string }> {
  const name = projectName.replace(/[^a-zA-Z0-9-_]/g, '-');
  const className = toPascal(name) + 'Middleware';
  return [
    {
      path: 'package.json',
      content: JSON.stringify(
        {
          name: name || 'koatty-middleware',
          version: '1.0.0',
          main: 'dist/index.js',
          scripts: { build: 'tsc' },
          peerDependencies: { koatty: '^4.0.0' },
          devDependencies: { '@types/node': '^20.0.0', typescript: '^5.0.0' },
        },
        null,
        2
      ),
    },
    {
      path: 'tsconfig.json',
      content: JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
            module: 'commonjs',
            outDir: 'dist',
            rootDir: 'src',
            strict: true,
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
          },
          include: ['src/**/*'],
        },
        null,
        2
      ),
    },
    {
      path: 'src/index.ts',
      content: `import { KoattyContext, Middleware, IMiddleware, KoattyNext } from 'koatty';

const defaultOpt = {};

@Middleware()
export class ${className} implements IMiddleware {
  run(options: any, app: any) {
    options = { ...defaultOpt, ...options };
    return function (ctx: KoattyContext, next: KoattyNext) {
      return next();
    };
  }
}
`,
    },
    { path: '.gitignore', content: 'node_modules/\ndist/\n' },
  ];
}

function getPluginTemplate(projectName: string): Array<{ path: string; content: string }> {
  const name = projectName.replace(/[^a-zA-Z0-9-_]/g, '-');
  const className = toPascal(name) + 'Plugin';
  return [
    {
      path: 'package.json',
      content: JSON.stringify(
        {
          name: name || 'koatty-plugin',
          version: '1.0.0',
          main: 'dist/index.js',
          scripts: { build: 'tsc' },
          peerDependencies: { koatty: '^4.0.0' },
          devDependencies: { '@types/node': '^20.0.0', typescript: '^5.0.0' },
        },
        null,
        2
      ),
    },
    {
      path: 'tsconfig.json',
      content: JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
            module: 'commonjs',
            outDir: 'dist',
            rootDir: 'src',
            strict: true,
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
          },
          include: ['src/**/*'],
        },
        null,
        2
      ),
    },
    {
      path: 'src/index.ts',
      content: `import { Plugin, IPlugin } from 'koatty';

@Plugin()
export class ${className} implements IPlugin {
  run(options: any, app: any) {
    // todo...
  }
}
`,
    },
    { path: '.gitignore', content: 'node_modules/\ndist/\n' },
  ];
}

function getTemplateFiles(
  template: string,
  projectName: string
): Array<{ path: string; content: string }> {
  switch (template) {
    case 'middleware':
      return getMiddlewareTemplate(projectName);
    case 'plugin':
      return getPluginTemplate(projectName);
    default:
      throw new Error(`不支持的组件模板: ${template}，可选 middleware|plugin`);
  }
}

export function registerNewCommand(program: Command) {
  const handler = async (projectName: string, options: { dir?: string; template?: string }) => {
    const name = (projectName || 'koatty-app').trim();
    const template = (options.template || 'project').toLowerCase();
    if (!['project', 'middleware', 'plugin'].includes(template)) {
      console.error(`不支持的模板: ${template}，可选 project|middleware|plugin`);
      process.exit(1);
    }
    const cwd = process.cwd();
    const targetDir = options.dir ? path.resolve(cwd, options.dir) : path.join(cwd, name);

    if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
      console.error(`错误: 目录已存在且非空: ${targetDir}`);
      process.exit(1);
    }

    const spinner = ora(`正在创建${template === 'project' ? '项目' : '组件'}: ${name}`).start();
    try {
      if (template === 'project') {
        const templateManager = new TemplateManager();

        spinner.text = '正在准备模板...';
        const templateDir = await templateManager.ensureTemplateRepo('project');

        // 构造上下文
        const context = {
          projectName: name,
          className: toPascal(name),
          hostname: '0.0.0.0',
          port: 3000,
          protocol: 'http',
          // 兼容旧变量
          _PROJECT_NAME: name,
        };

        spinner.text = '正在生成项目文件...';
        const defaultDir = path.join(templateDir, 'default');
        // 如果 default/ 子目录不存在，直接使用 templateDir
        const renderDir = fs.existsSync(defaultDir) ? defaultDir : templateDir;
        const files = await templateManager.renderDirectory(renderDir, context);

        fs.mkdirSync(targetDir, { recursive: true });
        for (const { path: filePath, content, isBinary } of files) {
          const fullPath = path.join(targetDir, filePath);
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          if (isBinary) {
            fs.writeFileSync(fullPath, content);
          } else {
            fs.writeFileSync(fullPath, content as string, 'utf-8');
          }
        }
      } else {
        // middleware / plugin 保留现有内联逻辑
        const files = getTemplateFiles(template, name);
        fs.mkdirSync(targetDir, { recursive: true });
        for (const { path: filePath, content } of files) {
          const fullPath = path.join(targetDir, filePath);
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, content, 'utf-8');
        }
      }

      spinner.succeed(`已创建: ${targetDir}`);
      console.log('\n下一步:');
      console.log(`  cd ${path.relative(cwd, targetDir) || name}`);
      console.log('  npm install');
      if (template === 'project') {
        console.log('  npm run dev');
        console.log('\n添加模块: koatty add user --apply');
      } else {
        console.log('  npm run build');
      }
    } catch (error) {
      spinner.fail(`创建失败: ${(error as Error).message}`);
      process.exit(1);
    }
  };

  program
    .command('new <project-name>')
    .description('创建新的 Koatty 项目（-t project|middleware|plugin）')
    .option('-d, --dir <path>', '目标目录（默认当前目录下的 <project-name>）')
    .option('-t, --template <template>', '模板: project|middleware|plugin', 'project')
    .action(handler);

  program
    .command('project <project-name>')
    .description('创建项目（同 new）')
    .option('-d, --dir <path>', '目标目录')
    .option('-t, --template <template>', '模板: project|middleware|plugin', 'project')
    .action(handler);

  return program;
}
