# Koatty-AI 模板外部仓库化实施方案

## 一、现状分析

### 1.1 当前 koatty-ai 模板系统

项目使用**双轨制**模板系统：

| 模板类型            | 位置                             | 用途                                         | 格式           |
| ------------------- | -------------------------------- | -------------------------------------------- | -------------- |
| **内嵌字符串模板**  | `src/cli/standaloneTemplates.ts` | 单文件创建 (`koatty controller/service/...`) | 字符串占位符   |
| **Handlebars 模板** | `templates/*.hbs`                | 完整模块生成 (`koatty add/generate:module`)  | `.hbs` 文件    |
| **项目模板**        | `src/cli/commands/new.ts`        | 创建项目 (`koatty new`)                      | 内嵌 JSON 结构 |

### 1.2 koatty_cli 模板系统

旧项目使用**内置模板**，模板文件位于 `templates/` 目录，包括：

- `templates/project/` - 完整项目骨架（包含完整的配置、示例代码、部署脚本等）
- `templates/module/` - 单文件模板 (`.template`)
- `templates/component/` - 独立组件模板（middleware/plugin npm 包）

---

## 二、设计目标

根据需求，需要实现：

1. **模板外部仓库化**：将模板从内嵌代码/本地文件迁移到独立 Git 仓库
2. **Submodule 统一管理**：在 koatty-ai 项目中以 submodule 形式引用模板仓库
3. **双源支持**：GitHub 主仓库 + Gitee 国内镜像
4. **删除 standaloneTemplates.ts**：所有模板统一使用 Handlebars 格式存储在外部仓库

---

## 三、模板仓库规划

### 3.1 仓库结构

| 仓库名称                       | 用途     | 内容来源                                       |
| ------------------------------ | -------- | ---------------------------------------------- |
| `koatty-ai-template-project`   | 项目模板 | 参考 koatty_cli/templates/project 完整项目骨架 |
| `koatty-ai-template-modules`   | 模块模板 | 合并 templates/\*.hbs + standaloneTemplates.ts |
| `koatty-ai-template-component` | 组件模板 | 参考 koatty_cli/templates/component            |

### 3.2 仓库地址设计

```
GitHub (主):
- https://github.com/koatty/koatty-ai-template-project
- https://github.com/koatty/koatty-ai-template-modules
- https://github.com/koatty/koatty-ai-template-component

Gitee (镜像):
- https://gitee.com/koatty/koatty-ai-template-project
- https://gitee.com/koatty/koatty-ai-template-modules
- https://gitee.com/koatty/koatty-ai-template-component
```

### 3.3 各仓库内容结构

#### koatty-ai-template-project

参考 koatty_cli 的完整项目模板，提供生产级项目骨架：

```
koatty-ai-template-project/
├── README.md                         # 模板说明
├── package.json                      # 模板元数据
├── koatty.json                       # 模板配置（变量定义）
└── default/                          # 默认项目模板
    ├── package.json.hbs              # 项目配置（含完整依赖）
    ├── tsconfig.json.hbs             # TypeScript 配置
    ├── jest.config.js.hbs            # Jest 测试配置
    ├── .eslintrc.js.hbs              # ESLint 配置
    ├── .eslintignore.hbs
    ├── .gitignore.hbs
    ├── .koattysrc.hbs                # Koatty 项目标识
    ├── .huskyrc.hbs                  # Git hooks
    ├── .commitlintrc.js.hbs          # Commit 规范
    ├── .versionrc.js.hbs             # 版本发布配置
    ├── .npmignore.hbs
    ├── LICENSE.hbs
    ├── README.md.hbs                 # 项目 README
    ├── apidoc.json.hbs               # API 文档配置
    ├── .vscode/                      # VSCode 配置
    │   ├── launch.json.hbs           # 调试配置
    │   └── settings.json.hbs
    ├── .devcontainer/                # Dev Container 配置
    │   └── devcontainer.json.hbs
    ├── deploy/                       # 部署配置
    │   ├── Dockerfile.hbs
    │   ├── pm2.json.hbs
    │   └── start.sh.hbs
    ├── src/
    │   ├── App.ts.hbs                # 入口文件
    │   ├── config/
    │   │   ├── config.ts.hbs         # 主配置（server/trace/metrics/opentelemetry）
    │   │   ├── config_dev.ts.hbs     # 开发环境配置
    │   │   ├── db.ts.hbs             # 数据库配置
    │   │   ├── db_dev.ts.hbs         # 开发环境数据库配置
    │   │   ├── middleware.ts.hbs     # 中间件配置
    │   │   ├── plugin.ts.hbs         # 插件配置
    │   │   └── router.ts.hbs         # 路由配置（含多协议支持）
    │   ├── controller/
    │   │   └── IndexController.ts.hbs  # 示例控制器（含 CRUD + 验证）
    │   ├── service/
    │   │   └── TestService.ts.hbs    # 示例服务（含缓存/定时任务）
    │   ├── middleware/
    │   │   ├── StaticMiddleware.ts.hbs   # 静态文件中间件
    │   │   └── ViewMiddleware.ts.hbs     # 模板渲染中间件
    │   ├── plugin/
    │   │   └── TestPlugin.ts.hbs     # 示例插件
    │   ├── dto/
    │   │   └── UserDto.ts.hbs        # 示例 DTO
    │   ├── aspect/
    │   │   └── AuthAspect.ts.hbs     # 认证切面示例
    │   ├── proto/
    │   │   └── .gitkeep
    │   └── resource/
    │       └── data.json.hbs         # 静态数据示例
    ├── static/
    │   ├── .gitkeep
    │   ├── favicon.ico               # 网站图标（二进制复制）
    │   └── doc/                      # API 文档静态资源
    │       ├── index.html
    │       └── assets/               # 文档资源文件
    ├── view/
    │   └── index.html.hbs            # EJS 模板示例
    ├── test/
    │   ├── .gitkeep
    │   └── app.test.ts.hbs           # 测试用例示例
    └── logs/
        └── .gitkeep
```

#### koatty-ai-template-modules

合并现有 `.hbs` 模板和 `standaloneTemplates.ts` 内容：

```
koatty-ai-template-modules/
├── README.md
├── package.json
├── koatty.json                       # 模板配置
├── controller/
│   ├── crud.hbs                      # 完整 CRUD 控制器（现有 controller.hbs）
│   ├── simple.hbs                    # 简单控制器（从 standaloneTemplates 迁移）
│   ├── grpc.hbs                      # gRPC 控制器
│   ├── websocket.hbs                 # WebSocket 控制器
│   └── graphql.hbs                   # GraphQL 控制器
├── service/
│   ├── crud.hbs                      # 完整服务（现有 service.hbs）
│   ├── simple.hbs                    # 简单服务
│   └── interface.hbs                 # 服务接口
├── model/
│   ├── typeorm.hbs                   # TypeORM 模型（现有 model.hbs）
│   ├── simple.hbs                    # 简单模型
│   └── entity.hbs                    # TypeORM Entity
├── dto/
│   ├── crud.hbs                      # 完整 DTO（现有 dto.hbs）
│   └── simple.hbs                    # 简单 DTO
├── middleware/
│   └── middleware.hbs                # 中间件模板
├── plugin/
│   ├── plugin.hbs                    # 插件模板
│   └── typeorm.hbs                   # TypeORM 插件
├── aspect/
│   └── aspect.hbs                    # AOP 切面
├── exception/
│   └── exception.hbs                 # 异常处理器
├── proto/
│   └── proto.hbs                     # gRPC Proto 文件
└── enum/
    └── enum.hbs                      # 枚举类型
```

#### koatty-ai-template-component

独立 npm 组件包模板（middleware/plugin）：

```
koatty-ai-template-component/
├── README.md
├── package.json
├── koatty.json
├── middleware/                       # 独立中间件包模板
│   ├── package.json.hbs
│   ├── tsconfig.json.hbs
│   ├── jest.config.js.hbs
│   ├── .eslintrc.js.hbs
│   ├── .eslintignore.hbs
│   ├── .gitignore.hbs
│   ├── .huskyrc.hbs
│   ├── .commitlintrc.js.hbs
│   ├── .versionrc.js.hbs
│   ├── .npmignore.hbs
│   ├── LICENSE.hbs
│   ├── README.md.hbs
│   └── src/
│       └── index.ts.hbs              # 中间件入口（函数式导出）
└── plugin/                           # 独立插件包模板
    ├── package.json.hbs
    ├── tsconfig.json.hbs
    ├── jest.config.js.hbs
    ├── .eslintrc.js.hbs
    ├── .eslintignore.hbs
    ├── .gitignore.hbs
    ├── .huskyrc.hbs
    ├── .commitlintrc.js.hbs
    ├── .versionrc.js.hbs
    ├── .npmignore.hbs
    ├── LICENSE.hbs
    ├── README.md.hbs
    └── src/
        └── index.ts.hbs              # 插件入口（函数式导出）
```

---

## 四、技术实现方案

### 4.1 Submodule 配置

在 koatty-ai 项目根目录创建/更新 `.gitmodules`：

```ini
[submodule "templates/project"]
    path = templates/project
    url = https://github.com/koatty/koatty-ai-template-project.git

[submodule "templates/modules"]
    path = templates/modules
    url = https://github.com/koatty/koatty-ai-template-modules.git

[submodule "templates/component"]
    path = templates/component
    url = https://github.com/koatty/koatty-ai-template-component.git
```

### 4.2 新增 TemplateManager 服务

创建 `src/services/TemplateManager.ts`：

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import Handlebars from 'handlebars';

export type TemplateType = 'project' | 'modules' | 'component';
export type MirrorSource = 'github' | 'gitee';

interface TemplateRepoConfig {
  github: string;
  gitee: string;
}

export class TemplateManager {
  private static TEMPLATE_REPOS: Record<TemplateType, TemplateRepoConfig> = {
    project: {
      github: 'https://github.com/koatty/koatty-ai-template-project.git',
      gitee: 'https://gitee.com/koatty/koatty-ai-template-project.git',
    },
    modules: {
      github: 'https://github.com/koatty/koatty-ai-template-modules.git',
      gitee: 'https://gitee.com/koatty/koatty-ai-template-modules.git',
    },
    component: {
      github: 'https://github.com/koatty/koatty-ai-template-component.git',
      gitee: 'https://gitee.com/koatty/koatty-ai-template-component.git',
    },
  };

  private cacheDir: string;
  private submoduleDir: string;

  constructor() {
    this.cacheDir = path.join(os.homedir(), '.koatty', 'templates');
    this.submoduleDir = path.join(__dirname, '../../templates');
  }

  /**
   * 获取模板路径（优先 submodule → 缓存 → 远程下载）
   */
  async getTemplatePath(type: TemplateType): Promise<string> {
    // 1. 检查 submodule
    const submodulePath = path.join(this.submoduleDir, type);
    if (this.isValidTemplateDir(submodulePath)) {
      return submodulePath;
    }

    // 2. 检查缓存
    const cachePath = path.join(this.cacheDir, type);
    if (this.isValidTemplateDir(cachePath)) {
      return cachePath;
    }

    // 3. 从远程下载
    await this.downloadTemplate(type);
    return cachePath;
  }

  /**
   * 确保模板仓库可用
   */
  async ensureTemplateRepo(
    type: TemplateType,
    options?: { mirror?: MirrorSource; force?: boolean }
  ): Promise<string> {
    const templatePath = await this.getTemplatePath(type);

    if (options?.force) {
      await this.downloadTemplate(type, options.mirror);
      return path.join(this.cacheDir, type);
    }

    return templatePath;
  }

  /**
   * 下载模板仓库
   */
  private async downloadTemplate(type: TemplateType, mirror?: MirrorSource): Promise<void> {
    const source = mirror || this.detectBestMirror();
    const repoUrl = TemplateManager.TEMPLATE_REPOS[type][source];
    const targetDir = path.join(this.cacheDir, type);

    // 删除旧缓存
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true });
    }

    // 创建缓存目录
    fs.mkdirSync(this.cacheDir, { recursive: true });

    // 克隆仓库
    try {
      execSync(`git clone --depth 1 ${repoUrl} ${targetDir}`, { stdio: 'pipe' });
    } catch (error) {
      // 降级到另一个镜像
      const fallbackSource = source === 'github' ? 'gitee' : 'github';
      const fallbackUrl = TemplateManager.TEMPLATE_REPOS[type][fallbackSource];
      execSync(`git clone --depth 1 ${fallbackUrl} ${targetDir}`, { stdio: 'pipe' });
    }
  }

  /**
   * 检测最佳镜像源
   */
  private detectBestMirror(): MirrorSource {
    // 简单实现：检测是否在中国网络
    try {
      execSync('curl -s --connect-timeout 2 https://github.com', { stdio: 'pipe' });
      return 'github';
    } catch {
      return 'gitee';
    }
  }

  /**
   * 检查目录是否为有效模板目录
   */
  private isValidTemplateDir(dir: string): boolean {
    if (!fs.existsSync(dir)) return false;
    const files = fs.readdirSync(dir);
    return files.length > 0 && !files.every((f) => f.startsWith('.'));
  }

  /**
   * 更新所有模板缓存
   */
  async updateTemplates(mirror?: MirrorSource): Promise<void> {
    const types: TemplateType[] = ['project', 'modules', 'component'];
    for (const type of types) {
      await this.downloadTemplate(type, mirror);
    }
  }

  /**
   * 渲染单个模板文件
   */
  renderTemplate(templatePath: string, context: Record<string, any>): string {
    const source = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(source, { noEscape: true });
    return template(context);
  }

  /**
   * 渲染整个模板目录
   */
  async renderDirectory(
    templateDir: string,
    context: Record<string, any>,
    options?: { excludePatterns?: string[] }
  ): Promise<Array<{ path: string; content: string }>> {
    const results: Array<{ path: string; content: string }> = [];
    const excludePatterns = options?.excludePatterns || ['.git', 'node_modules', 'koatty.json'];

    const walk = (dir: string, baseDir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (excludePatterns.some((p) => entry.name.includes(p))) continue;

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
          walk(fullPath, baseDir);
        } else {
          let outputPath = relativePath;
          let content: string;

          if (entry.name.endsWith('.hbs')) {
            // 渲染 Handlebars 模板
            outputPath = relativePath.replace(/\.hbs$/, '');
            content = this.renderTemplate(fullPath, context);
          } else {
            // 直接复制非模板文件
            content = fs.readFileSync(fullPath, 'utf-8');
          }

          // 处理路径中的变量
          outputPath = this.renderPathVariables(outputPath, context);
          results.push({ path: outputPath, content });
        }
      }
    };

    walk(templateDir, templateDir);
    return results;
  }

  /**
   * 渲染路径中的变量（如 {{moduleName}}/controller.ts）
   */
  private renderPathVariables(filePath: string, context: Record<string, any>): string {
    return filePath.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] || '');
  }
}
```

### 4.3 模板加载策略

```
┌─────────────────────────────────────────────────────────────────┐
│                      模板加载流程                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 检查 submodule 路径                                          │
│     └─ templates/{type}/ 存在且有内容？                          │
│           │                                                      │
│     ┌─────┴─────┐                                               │
│     │           │                                                │
│     ▼ Yes       ▼ No                                            │
│  使用本地      2. 检查用户缓存目录                               │
│  submodule       └─ ~/.koatty/templates/{type}/ 存在？          │
│     │                  │                                         │
│     │           ┌──────┴──────┐                                  │
│     │           │             │                                  │
│     │           ▼ Yes         ▼ No                               │
│     │        使用缓存     3. 从远程下载                           │
│     │           │            └─ 优先 GitHub                      │
│     │           │            └─ 降级 Gitee（中国网络）            │
│     │           │                   │                            │
│     └───────────┴───────────────────┘                            │
│                        │                                         │
│                        ▼                                         │
│               返回模板目录路径                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 修改现有文件

#### 4.4.1 TemplateLoader.ts 改造

```typescript
// src/generators/TemplateLoader.ts

import { TemplateManager, TemplateType } from '../services/TemplateManager';

export class TemplateLoader {
  private static templateManager = new TemplateManager();

  // 改造后：支持从 submodule/缓存/远程获取模板
  public static async compileTemplate(
    templatePath: string,
    templateType: TemplateType = 'modules'
  ): Promise<Handlebars.TemplateDelegate> {
    const baseDir = await this.templateManager.getTemplatePath(templateType);
    const fullPath = path.join(baseDir, templatePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`模板不存在: ${fullPath}`);
    }

    const source = fs.readFileSync(fullPath, 'utf-8');
    return Handlebars.compile(source, { noEscape: true });
  }

  /**
   * 渲染模板文件
   */
  public static async render(
    templatePath: string,
    context: Record<string, any>,
    templateType: TemplateType = 'modules'
  ): Promise<string> {
    const template = await this.compileTemplate(templatePath, templateType);
    return template(context);
  }
}
```

#### 4.4.2 new.ts 改造

```typescript
// src/cli/commands/new.ts

import { TemplateManager } from '../../services/TemplateManager';

export function registerNewCommand(program: Command) {
  const handler = async (projectName: string, options: Options) => {
    const templateManager = new TemplateManager();

    // 1. 确定模板类型
    const templateType = options.template === 'project' ? 'project' : 'component';
    const subTemplate = options.template === 'project' ? 'default' : options.template;

    // 2. 确保模板可用
    const templateDir = await templateManager.ensureTemplateRepo(templateType, {
      mirror: options.mirror,
    });

    // 3. 准备上下文变量
    const context = {
      projectName: projectName,
      PROJECT_NAME: projectName,
      _PROJECT_NAME: projectName,
      className: toPascal(projectName),
      _CLASS_NAME: toPascal(projectName),
    };

    // 4. 渲染模板目录
    const files = await templateManager.renderDirectory(
      path.join(templateDir, subTemplate),
      context
    );

    // 5. 写入目标目录
    const targetDir = options.dir
      ? path.resolve(process.cwd(), options.dir)
      : path.join(process.cwd(), projectName);

    for (const { path: filePath, content } of files) {
      const fullPath = path.join(targetDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf-8');
    }

    console.log(`项目创建成功: ${targetDir}`);
  };
}
```

#### 4.4.3 删除 standaloneTemplates.ts

**完全删除** `src/cli/standaloneTemplates.ts`，所有模板迁移到 `koatty-ai-template-modules` 仓库。

单文件创建命令（`koatty controller/service/...`）改为调用 TemplateManager：

```typescript
// src/cli/commands/create.ts

import { TemplateManager } from '../../services/TemplateManager';
import { TemplateLoader } from '../../generators/TemplateLoader';

export async function createModule(
  type: string,
  name: string,
  options?: { type?: string; interface?: boolean }
): Promise<{ path: string; content: string }> {
  // 选择模板
  let templatePath: string;
  switch (type) {
    case 'controller':
      templatePath = `controller/${options?.type || 'simple'}.hbs`;
      break;
    case 'service':
      templatePath = options?.interface ? 'service/interface.hbs' : 'service/simple.hbs';
      break;
    case 'model':
      templatePath = 'model/simple.hbs';
      break;
    case 'dto':
      templatePath = 'dto/simple.hbs';
      break;
    case 'middleware':
      templatePath = 'middleware/middleware.hbs';
      break;
    case 'plugin':
      templatePath = 'plugin/plugin.hbs';
      break;
    case 'aspect':
      templatePath = 'aspect/aspect.hbs';
      break;
    case 'exception':
      templatePath = 'exception/exception.hbs';
      break;
    case 'proto':
      templatePath = 'proto/proto.hbs';
      break;
    default:
      throw new Error(`未知模块类型: ${type}`);
  }

  // 准备上下文
  const context = {
    name,
    className: toPascal(name) + toPascal(type),
    _CLASS_NAME: toPascal(name) + toPascal(type),
    _NEW: name,
    _SUB_PATH: '..',
    _CAMEL_NAME: toCamel(name) + toPascal(type),
  };

  // 渲染模板
  const content = await TemplateLoader.render(templatePath, context, 'modules');

  // 生成输出路径
  const outputDir = type === 'model' ? 'entity' : type;
  const outputPath = path.join(process.cwd(), 'src', outputDir, `${context.className}.ts`);

  return { path: outputPath, content };
}
```

### 4.5 CLI 增强

添加模板管理命令 `src/cli/commands/template.ts`：

```typescript
import { Command } from 'commander';
import { TemplateManager, TemplateType, MirrorSource } from '../../services/TemplateManager';

export function registerTemplateCommand(program: Command) {
  const template = program.command('template').description('管理 Koatty 模板');

  // 更新模板
  template
    .command('update')
    .description('更新模板缓存')
    .option('-t, --type <type>', '模板类型: project|modules|component')
    .option('-m, --mirror <mirror>', '镜像源: github|gitee', 'github')
    .action(async (options) => {
      const manager = new TemplateManager();
      const mirror = options.mirror as MirrorSource;

      if (options.type) {
        await manager.ensureTemplateRepo(options.type as TemplateType, { mirror, force: true });
        console.log(`已更新模板: ${options.type}`);
      } else {
        await manager.updateTemplates(mirror);
        console.log('已更新所有模板');
      }
    });

  // 检查模板状态
  template
    .command('status')
    .description('检查模板状态')
    .action(async () => {
      const manager = new TemplateManager();
      const types: TemplateType[] = ['project', 'modules', 'component'];

      for (const type of types) {
        try {
          const path = await manager.getTemplatePath(type);
          console.log(`✓ ${type}: ${path}`);
        } catch (e) {
          console.log(`✗ ${type}: 未找到`);
        }
      }
    });

  return program;
}
```

命令示例：

```bash
# 更新所有模板
koatty template update

# 更新指定模板
koatty template update --type project

# 使用 Gitee 镜像更新
koatty template update --mirror gitee

# 检查模板状态
koatty template status
```

---

## 五、实施步骤

### Phase 1: 创建模板仓库（准备阶段）

```bash
# 1. 创建 GitHub 仓库
gh repo create koatty/koatty-ai-template-project --public --description "Koatty project templates"
gh repo create koatty/koatty-ai-template-modules --public --description "Koatty module templates"
gh repo create koatty/koatty-ai-template-component --public --description "Koatty component templates"

# 2. 初始化仓库内容
# - 从 koatty_cli/templates/ 提取并转换为 .hbs 格式
# - 添加 koatty.json 配置文件
# - 添加 README.md 说明文档

# 3. 在 Gitee 创建同名仓库并设置从 GitHub 自动同步
```

### Phase 2: 添加 Submodule（代码阶段）

```bash
# 1. 备份并删除现有 templates 目录
mv templates templates.bak

# 2. 添加 submodule
git submodule add https://github.com/koatty/koatty-ai-template-project.git templates/project
git submodule add https://github.com/koatty/koatty-ai-template-modules.git templates/modules
git submodule add https://github.com/koatty/koatty-ai-template-component.git templates/component

# 3. 提交变更
git add .gitmodules templates
git commit -m "feat: migrate templates to external repositories"
```

### Phase 3: 实现 TemplateManager（核心阶段）

1. 创建 `src/services/TemplateManager.ts`
2. 改造 `src/generators/TemplateLoader.ts`
3. 改造 `src/cli/commands/new.ts`
4. **删除** `src/cli/standaloneTemplates.ts`
5. 改造 `src/cli/commands/create.ts`
6. 添加 `src/cli/commands/template.ts`

### Phase 4: 测试与文档（收尾阶段）

1. 编写单元测试
2. 更新 README.md
3. 测试离线场景（submodule 可用）
4. 测试网络场景（远程下载）
5. 测试镜像切换（GitHub ↔ Gitee）

---

## 六、目录变更对比

### 变更前

```
koatty-ai/
├── templates/                    # 内置模板
│   ├── controller/controller.hbs
│   ├── service/service.hbs
│   └── ...
└── src/
    └── cli/
        ├── standaloneTemplates.ts  # 内嵌字符串模板 (待删除)
        └── commands/
            └── new.ts              # 内嵌项目模板
```

### 变更后

```
koatty-ai/
├── .gitmodules                   # Submodule 配置
├── templates/
│   ├── project/                  # Submodule → koatty-ai-template-project
│   ├── modules/                  # Submodule → koatty-ai-template-modules
│   └── component/                # Submodule → koatty-ai-template-component
└── src/
    ├── services/
    │   └── TemplateManager.ts    # 新增：模板管理服务
    ├── generators/
    │   └── TemplateLoader.ts     # 改造：使用 TemplateManager
    └── cli/
        └── commands/
            ├── new.ts            # 改造：使用 TemplateManager
            ├── create.ts         # 改造：使用 TemplateManager
            └── template.ts       # 新增：模板管理命令
```

---

## 七、模板变量约定

为保持向后兼容和一致性，统一使用以下变量：

| 变量名          | 说明                    | 示例值           |
| --------------- | ----------------------- | ---------------- |
| `projectName`   | 项目名称（原始）        | `my-app`         |
| `_PROJECT_NAME` | 项目名称（兼容旧格式）  | `my-app`         |
| `className`     | PascalCase 类名         | `MyApp`          |
| `_CLASS_NAME`   | PascalCase 类名（兼容） | `MyApp`          |
| `moduleName`    | 模块名称（原始）        | `user`           |
| `_NEW`          | 模块名称（兼容旧格式）  | `user`           |
| `_SUB_PATH`     | 相对路径前缀            | `..`             |
| `_CAMEL_NAME`   | camelCase 名称          | `userController` |

---

## 八、风险与缓解措施

| 风险                       | 缓解措施                                                                |
| -------------------------- | ----------------------------------------------------------------------- |
| 网络不可用导致无法获取模板 | 1. 优先使用 submodule 本地模式<br>2. 用户缓存目录 `~/.koatty/templates` |
| GitHub 在国内访问慢        | 1. Gitee 镜像自动降级<br>2. `--mirror gitee` 参数<br>3. 自动检测最佳源  |
| Submodule 同步问题         | 1. CI/CD 自动同步 GitHub → Gitee<br>2. 模板版本锁定                     |
| 删除 standaloneTemplates   | 确保 modules 仓库包含所有迁移后的简单模板                               |

---

## 九、后续扩展

1. **自定义模板支持**：允许用户指定自己的模板仓库 URL
2. **模板版本管理**：支持指定模板版本 `--template-version v1.0.0`
3. **模板在线浏览器**：`koatty template list` 列出可用模板及描述
4. **模板贡献指南**：社区可以提交自己的模板
5. **模板校验**：检查模板完整性和变量定义
