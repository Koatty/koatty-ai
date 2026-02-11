import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import ora from 'ora';
import { TemplateManager } from '../../services/TemplateManager';

function toPascal(s: string): string {
  return s.replace(/(?:^|[-/])(\w)/g, (_, c) => (c ? c.toUpperCase() : ''));
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

    const isProject = template === 'project';
    const spinner = ora(`正在创建${isProject ? '项目' : '组件库'}: ${name}`).start();

    try {
      const templateManager = new TemplateManager();
      const context = {
        projectName: name,
        className: toPascal(name) + (isProject ? '' : toPascal(template)),
        hostname: '0.0.0.0',
        port: 3000,
        protocol: 'http',
        // 兼容旧变量
        _PROJECT_NAME: name,
      };

      let renderDir: string;

      if (isProject) {
        spinner.text = '正在准备项目模板...';
        const templateDir = await templateManager.ensureTemplateRepo('project');
        // 如果 default/ 子目录存在，使用它
        const defaultDir = path.join(templateDir, 'default');
        renderDir = fs.existsSync(defaultDir) ? defaultDir : templateDir;
      } else {
        // middleware / plugin → templates/component/{template}/
        spinner.text = '正在准备组件模板...';
        const componentDir = await templateManager.ensureTemplateRepo('component');
        renderDir = path.join(componentDir, template);
        if (!fs.existsSync(renderDir)) {
          throw new Error(`组件模板不存在: ${renderDir}`);
        }
      }

      spinner.text = '正在生成文件...';
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

      spinner.succeed(`已创建: ${targetDir}`);
      console.log('\n下一步:');
      console.log(`  cd ${path.relative(cwd, targetDir) || name}`);
      console.log('  npm install');
      if (isProject) {
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
    .description('创建新的 Koatty 项目或组件库（-t project|middleware|plugin）')
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
