import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import ora from 'ora';

function toPascal(s: string): string {
  return s.replace(/(?:^|[-/])(\w)/g, (_, c) => (c ? c.toUpperCase() : ''));
}

function getProjectTemplate(projectName: string): Array<{ path: string; content: string }> {
  const name = projectName.replace(/[^a-zA-Z0-9-_]/g, '-');
  return [
    {
      path: 'package.json',
      content: JSON.stringify(
        {
          name: name || 'koatty-app',
          version: '1.0.0',
          description: 'Koatty application',
          main: 'dist/App.js',
          scripts: {
            build: 'tsc',
            dev: 'nodemon ./src/App.ts',
            start: 'npm run build && cross-env NODE_ENV=production node ./dist/App.js',
            test: 'npm run eslint && npm run build && jest --passWithNoTests --detectOpenHandles',
            doc: 'npx ts-node scripts/generate-api-doc.ts',
            eslint: 'eslint src --ext .ts',
          },
          dependencies: {
            koatty: '^4.0.0',
          },
          devDependencies: {
            '@types/node': '^20.0.0',
            typescript: '^5.0.0',
            'ts-node': '^10.0.0',
            nodemon: '^3.0.0',
            'cross-env': '^7.0.0',
            jest: '^29.0.0',
            'ts-jest': '^29.0.0',
            eslint: '^8.0.0',
          },
          engines: { node: '>=18.0.0' },
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
            esModuleInterop: true,
            skipLibCheck: true,
            declaration: true,
            declarationDir: 'dist',
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
          },
          include: ['src/**/*'],
          exclude: ['node_modules', 'dist'],
        },
        null,
        2
      ),
    },
    {
      path: 'src/config/config.ts',
      content: `export default {
  server: {
    hostname: '0.0.0.0',
    port: 3000,
    protocol: 'http',
  },
};
`,
    },
    {
      path: 'src/App.ts',
      content: `import { Koatty } from 'koatty';

const app = new Koatty();

app.run().catch((err) => {
  console.error(err);
  process.exit(1);
});
`,
    },
    {
      path: 'README.md',
      content: `# ${name || 'koatty-app'}

Koatty 应用，由 \`koatty new\` 创建。

## 开发

\`\`\`bash
npm install
npm run dev
\`\`\`

## 构建

\`\`\`bash
npm run build
npm start
\`\`\`

## 添加模块

\`\`\`bash
koatty add user --apply
# 或 kt add user -y --apply
\`\`\`
`,
    },
    {
      path: '.gitignore',
      content: `node_modules/
dist/
*.log
.env
.DS_Store
`,
    },
    {
      path: '.koattysrc',
      content: JSON.stringify({ projectName: name || 'koatty-app' }, null, 2),
    },
  ];
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
      return getProjectTemplate(projectName);
  }
}

export function registerNewCommand(program: Command) {
  const handler = (projectName: string, options: { dir?: string; template?: string }) => {
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
      const files = getTemplateFiles(template, name);
      fs.mkdirSync(targetDir, { recursive: true });

      for (const { path: filePath, content } of files) {
        const fullPath = path.join(targetDir, filePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf-8');
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
