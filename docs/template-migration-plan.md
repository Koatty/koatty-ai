# Koatty-AI 模板外部仓库化实施方案

> **对标版本**: Koatty 4.0（参考 `packages/koatty-doc/docs/README-en.md`）
> **状态**: 已评审优化（2026-02-10）

## 一、现状分析

### 1.1 当前 koatty-ai 模板系统

项目使用**双轨制**模板系统：

| 模板类型            | 位置                             | 用途                                         | 格式           |
| ------------------- | -------------------------------- | -------------------------------------------- | -------------- |
| **内嵌字符串模板**  | `src/cli/standaloneTemplates.ts` | 单文件创建 (`koatty controller/service/...`) | 字符串占位符   |
| **Handlebars 模板** | `templates/*.hbs`                | 完整模块生成 (`koatty add/generate:module`)  | `.hbs` 文件    |
| **项目模板**        | `src/cli/commands/new.ts`        | 创建项目 (`koatty new`)                      | 内嵌 JSON 结构 |

### 1.2 旧版 koatty_cli 模板仓库

旧版 CLI 使用三个独立的模板仓库：

| 仓库 | 地址 | 用途 | 格式 |
| ---- | ---- | ---- | ---- |
| **koatty_template** | `https://github.com/Koatty/koatty_template.git` | 完整项目骨架 | 可运行 TS 项目（占位符替换） |
| **koatty_template_cli** | `https://github.com/Koatty/koatty_template_cli.git` | 模块文件模板 | `.template` 文件（19 个） |
| **koatty_template_component** | `https://github.com/Koatty/koatty_template_component.git` | 独立组件包 | TS 源码（占位符替换） |

#### koatty_template（项目模板）详细结构

完整的可运行 Koatty 项目，包含 `src/`（App.ts、config/、controller/、service/、dto/、aspect/、middleware/、plugin/、proto/、resource/）、`deploy/`（Dockerfile、pm2.json、start.sh）、`static/`、`view/`、`test/`、`.vscode/`、`.devcontainer/` 以及完整的工程化配置（ESLint、Jest、Commitlint、Husky、standard-version 等）。占位符变量为 `_PROJECT_NAME`。

#### koatty_template_cli（模块模板）包含的 19 个 `.template` 文件

| 文件 | 用途 | 占位符变量 |
| ---- | ---- | ---------- |
| `controller.template` | HTTP 控制器 | `_CLASS_NAME`, `_NEW`, `_SUB_PATH` |
| `controller_grpc.template` | gRPC 控制器 | `_CLASS_NAME`, `_NEW`, `_SUB_PATH`, `//_IMPORT_LIST`, `//_METHOD_LIST` |
| `controller_grpc_import.template` | gRPC 导入行 | `_DTO_NAME`, `_SUB_PATH` |
| `controller_grpc_method.template` | gRPC 方法 | `_METHOD_NAME`, `_REQUEST_TYPE`, `_RESPONSE_TYPE`, `_RESPONSE_RETURN` |
| `controller_ws.template` | WebSocket 控制器 | `_CLASS_NAME`, `_NEW`, `_SUB_PATH` |
| `service.template` | 服务实现 | `_CLASS_NAME`, `_SUB_PATH` |
| `service.interface.template` | 服务接口 | `_CLASS_NAME`, `_CAMEL_NAME` |
| `dto.template` | DTO 类 | `_CLASS_NAME`, `//_ENUM_IMPORT`, `//_FIELDS` |
| `entity.typeorm.template` | TypeORM Entity | `_ENTITY_NAME`, `_NEW` |
| `model.typeorm.template` | TypeORM Model（旧） | `_CLASS_NAME`, `_NEW`, `_SUB_PATH` |
| `model.typeorm.new.template` | TypeORM Model（含 CRUD） | `_CLASS_NAME`, `_ENTITY_NAME`, `_SUB_PATH` |
| `model.template` | ThinkORM Model | `_CLASS_NAME`, `_NEW`, `_SUB_PATH` |
| `middleware.template` | 中间件 | `_CLASS_NAME`, `_SUB_PATH` |
| `plugin.template` | 插件 | `_CLASS_NAME`, `_SUB_PATH` |
| `plugin.typeorm.template` | TypeORM 插件 | 固定类名 `TypeormPlugin` |
| `aspect.template` | AOP 切面 | `_CLASS_NAME`, `_SUB_PATH` |
| `exception.template` | 异常处理 | `_CLASS_NAME` |
| `proto.template` | Proto 定义 | `_CLASS_NAME` |
| `enum.template` | 枚举类型 | `_CLASS_NAME`, `//_FIELDS` |

#### koatty_template_component（组件模板）结构

仅含 `src/middleware.ts` 和 `src/plugin.ts` 两个文件，以函数式导出模式提供独立 npm 包骨架。工程化配置与项目模板一致。占位符变量为 `_PROJECT_NAME`、`_CLASS_NAME`。

### 1.3 现有模板与 Koatty 4.0 的兼容性问题

| 问题                                    | 严重性 | 说明                                                                                 |
| --------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| gRPC/WS/GraphQL Controller 使用错误装饰器 | P0     | 4.0 引入 `@GrpcController`/`@WsController`/`@GraphQLController`，当前模板全部使用 `@Controller` |
| 缺少 `config/server.ts`                 | P0     | 4.0 将服务器配置（hostname/port/protocol/ssl）从 `config.ts` 分离到 `server.ts`        |
| `App.ts` 入口使用旧模式                 | P0     | 当前 `new Koatty()` + `app.run()` 应改为 `@Bootstrap()` 装饰器 + 类继承模式            |
| Service 继承 `BaseService`              | P0     | 4.0 中 Service 不再需要继承 `BaseService`，直接使用 `@Service()` 装饰                   |
| Controller 缺少 `constructor(ctx)`      | P1     | 4.0 中 Controller 必须通过构造函数接收 `ctx: KoattyContext`                             |
| router.ts ext 配置格式变更              | P1     | 4.0 使用协议名（`grpc`/`ws`/`graphql`）作为 ext 的 key                                  |
| proto 目录位置变更                      | P1     | 4.0 中 proto 文件放在 `src/resource/proto/` 或项目根 `resource/proto/`                   |

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

| 新仓库名称 | 用途 | 来源旧仓库 | 改造方向 |
| --- | --- | --- | --- |
| `koatty-ai-template-project` | 项目模板 | `koatty_template` | 升级至 4.0 API（server.ts 分离、@Bootstrap 入口、ext 协议 key） |
| `koatty-ai-template-modules` | 模块模板 | `koatty_template_cli`（19 个 .template） + koatty-ai 内置 `standaloneTemplates.ts` + `templates/*.hbs` | 统一为 .hbs 格式，协议控制器改用专属装饰器 |
| `koatty-ai-template-component` | 组件模板 | `koatty_template_component` | 升级依赖到 koatty@4.0，函数式导出保持不变 |

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

参考 Koatty 4.0 文档标准项目结构，提供生产级项目骨架：

```
koatty-ai-template-project/
├── README.md                         # 模板说明
├── package.json                      # 模板元数据
├── koatty.json                       # 模板配置（变量定义、最低 CLI 版本等）
└── default/                          # 默认项目模板
    ├── package.json.hbs              # 项目配置（4.0 依赖 + 现代化构建脚本）
    ├── tsconfig.json.hbs             # TypeScript 配置（ES2022 + strict）
    ├── jest.config.js.hbs            # Jest 测试配置
    ├── eslint.config.js.hbs          # ESLint 9 Flat Config（替代 .eslintrc.js）
    ├── .gitignore.hbs
    ├── .koattysrc.hbs                # Koatty 项目标识
    ├── .husky/                       # Husky 9 Git hooks（替代 .huskyrc）
    │   ├── commit-msg.hbs            # commitlint 验证
    │   └── pre-commit.hbs            # ESLint 检查
    ├── .commitlintrc.js.hbs          # Commit 规范
    ├── .versionrc.js.hbs             # 版本发布配置
    ├── .npmignore.hbs
    ├── LICENSE.hbs
    ├── README.md.hbs                 # 项目 README
    ├── apidoc.json.hbs               # API 文档配置
    ├── .vscode/                      # VSCode 配置
    │   ├── launch.json.hbs           # 调试配置（ts-node 调试）
    │   └── settings.json.hbs
    ├── .devcontainer/                # Dev Container 配置
    │   └── devcontainer.json.hbs
    ├── deploy/                       # 部署配置
    │   ├── Dockerfile.hbs
    │   ├── pm2.json.hbs
    │   └── start.sh.hbs
    ├── src/
    │   ├── App.ts.hbs                # 入口文件（@Bootstrap 装饰器模式）
    │   ├── config/
    │   │   ├── config.ts.hbs         # 通用配置（日志级别/路径/敏感字段等）
    │   │   ├── server.ts.hbs         # [4.0新增] 服务器配置（protocol/port/ssl/trace）
    │   │   ├── config_dev.ts.hbs     # 开发环境配置
    │   │   ├── db.ts.hbs             # 数据库配置
    │   │   ├── db_dev.ts.hbs         # 开发环境数据库配置
    │   │   ├── middleware.ts.hbs     # 中间件配置
    │   │   ├── plugin.ts.hbs         # 插件配置
    │   │   └── router.ts.hbs         # 路由配置（ext 使用协议名作 key）
    │   ├── controller/
    │   │   └── IndexController.ts.hbs  # HTTP 示例控制器（含 constructor(ctx)）
    │   ├── service/
    │   │   └── TestService.ts.hbs    # 示例服务（@Service 装饰、@Log 注入）
    │   ├── middleware/
    │   │   ├── StaticMiddleware.ts.hbs   # 静态文件中间件
    │   │   └── ViewMiddleware.ts.hbs     # 模板渲染中间件
    │   ├── plugin/
    │   │   └── TestPlugin.ts.hbs     # 示例插件（含 @OnEvent 生命周期事件）
    │   ├── dto/
    │   │   └── UserDto.ts.hbs        # 示例 DTO（@Validated 验证）
    │   ├── aspect/
    │   │   └── AuthAspect.ts.hbs     # 认证切面示例
    │   ├── resource/                 # [4.0] 资源目录
    │   │   ├── proto/                # gRPC Protocol Buffers
    │   │   │   └── .gitkeep
    │   │   └── data.json.hbs         # 静态数据示例
    │   └── utils/                    # 工具函数
    │       └── tool.ts.hbs
    ├── resource/                     # 项目根级资源目录
    │   ├── proto/                    # Proto 文件（生产环境引用）
    │   │   └── .gitkeep
    │   └── graphql/                  # [4.0] GraphQL Schema 文件
    │       └── .gitkeep
    ├── static/
    │   ├── .gitkeep
    │   ├── favicon.ico               # 网站图标（二进制复制，需特殊处理）
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

**关键模板文件内容规范（Koatty 4.0）：**

**`package.json.hbs`** — 依赖和构建脚本全面现代化升级：

```json
{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "application created by koatty",
  "main": "./dist/App.js",
  "scripts": {
    "build": "rimraf dist && tsc && cpy 'src/**/*.json' 'src/**/*.proto' dist/ --parents --cwd=src",
    "build:images": "npm run build && docker build -t koatty/{{projectName}}:latest -f deploy/Dockerfile .",
    "dev": "tsx watch ./src/App.ts",
    "start": "npm run build && cross-env NODE_ENV=production node ./dist/App.js",
    "test": "jest --passWithNoTests --detectOpenHandles",
    "test:cov": "jest --passWithNoTests --detectOpenHandles --coverage",
    "lint": "eslint 'src/**/*.ts' --fix",
    "doc": "apidoc -i src/ -o static/doc/",
    "release": "standard-version",
    "prepare": "husky"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "nodemonConfig": {
    "ignore": ["test/*", "docs/*"],
    "watch": ["src"],
    "execMap": { "ts": "tsx" },
    "delay": "1000"
  },
  "license": "BSD-3-Clause",
  "dependencies": {
    "koatty": "^4.0.0",
    "koatty_cacheable": "^2.0.0",
    "koatty_exception": "^2.0.0",
    "koatty_logger": "^2.0.0",
    "koatty_schedule": "^2.0.0",
    "koatty_static": "^2.0.0",
    "koatty_store": "^2.0.0",
    "koatty_validation": "^2.0.0",
    "koatty_views": "^2.0.0",
    "tslib": "^2.6.0"
  },
  "devDependencies": {
    "@commitlint/cli": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0",
    "@types/jest": "^29.0.0",
    "@types/koa": "^2.15.0",
    "@types/node": "^22.0.0",
    "apidoc": "^1.0.0",
    "cpy-cli": "^5.0.0",
    "cross-env": "^7.0.0",
    "eslint": "^9.0.0",
    "eslint-plugin-jest": "^28.0.0",
    "husky": "^9.0.0",
    "jest": "^29.0.0",
    "jest-html-reporters": "^3.0.0",
    "rimraf": "^6.0.0",
    "standard-version": "^9.0.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0",
    "typescript-eslint": "^8.0.0"
  }
}
```

**相较旧 `koatty_template` 的 `package.json` 变更说明：**

| 变更项 | 旧版 | 新版 | 说明 |
| ------ | ---- | ---- | ---- |
| **Node 引擎** | `>14.0.0` | `>=18.0.0` | Koatty 4.0 最低要求 |
| **koatty** | `^3.10.4` | `^4.0.0` | 框架主版本升级 |
| **新增依赖** | — | `koatty_exception`/`koatty_logger` | 4.0 新特性：@Catch/@Log 装饰器 |
| **构建工具** | `del-cli` + `copyfiles` | `rimraf` + `cpy-cli` | 更现代的替代方案 |
| **开发运行** | `nodemon` + `ts-node` | `tsx watch` | tsx 零配置、更快的 TS 执行 |
| **ESLint** | `eslint@8` + `@typescript-eslint/*@6` | `eslint@9` + `typescript-eslint@8` | Flat config，统一包 |
| **Husky** | `husky@4`（.huskyrc 配置文件） | `husky@9`（`prepare` 脚本 + `.husky/` 目录） |  |
| **supertest** | `^6.x` | `^7.x` | 最新版 |
| **TypeScript** | `^5.x` | `^5.7+` | LTS 稳定版 |
| **移除** | `@types/koa__router`, `@types/validator`, `eslint-plugin-jest@27`, `apidoc-plugin-class`, `conventional-changelog-cli` | — | 不再需要或已内置 |
| **脚本: dev** | `nodemon ./src/App.ts` | `tsx watch ./src/App.ts` | 无需 nodemon 配置 |
| **脚本: build** | `del-cli && tsc && copyfiles` | `rimraf dist && tsc && cpy ...` | cpy-cli 更灵活 |
| **脚本: lint** | `eslint --ext .ts,.js ./` | `eslint 'src/**/*.ts' --fix` | ESLint 9 flat config |
| **脚本: test** | `npm run eslint && npm run build && jest` | `jest --passWithNoTests` | lint 和 test 解耦 |
| **脚本: prepare** | 无 | `husky` | Husky 9 初始化方式 |

**`tsconfig.json.hbs`** — TypeScript 配置升级：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "removeComments": false,
    "importHelpers": true,
    "stripInternal": true,
    "skipLibCheck": true,
    "noImplicitAny": true,
    "strict": true,
    "pretty": true,
    "moduleResolution": "node",
    "typeRoots": ["node_modules/@types"],
    "types": ["node", "jest"],
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "useUnknownInCatchVariables": false,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "exclude": ["node_modules", "dist"],
  "include": ["src/**/*"]
}
```

**相较旧版 `tsconfig.json` 变更说明：**

| 变更项 | 旧版 | 新版 | 说明 |
| ------ | ---- | ---- | ---- |
| target | ES2021 | ES2022 | 支持更多 ES 特性（Top-level await、Error cause） |
| lib | ES2021 | ES2022 | 对应 target |
| rootDir | 无 | `./src` | 明确源码根目录 |
| strict | 无 | `true` | 启用严格模式（旧版仅 `noImplicitAny`） |
| downlevelIteration | true | 移除 | ES2022 原生支持 |

**`eslint.config.js.hbs`** — ESLint 9 Flat Config（替代旧 `.eslintrc.js`）：

```javascript
import tseslint from 'typescript-eslint';
import jest from 'eslint-plugin-jest';

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
  {
    files: ['test/**/*.ts'],
    ...jest.configs['flat/recommended'],
  },
  {
    ignores: ['dist/', 'node_modules/', 'static/', 'view/', 'logs/'],
  }
);
```

**`.husky/commit-msg.hbs`** — Husky 9 Git hooks（替代旧 `.huskyrc`）：

```bash
npx --no -- commitlint --edit "$1"
```

**`.husky/pre-commit.hbs`**：

```bash
npx --no -- eslint 'src/**/*.ts'
```

**`deploy/Dockerfile.hbs`** — 容器镜像升级（旧版使用 `node:alpine3.15` + 清华镜像，需现代化）：

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /build
COPY package.json package-lock.json pnpm-lock.yaml* ./
RUN corepack enable && \
    ([ -f pnpm-lock.yaml ] && pnpm install --frozen-lockfile --production || npm ci --production)
COPY dist/ ./dist/
COPY static/ ./static/
COPY view/ ./view/

FROM node:20-alpine
RUN apk add --no-cache tini tzdata && \
    ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
WORKDIR /data
COPY --from=builder /build ./
COPY deploy/pm2.json /pm2.json
RUN npm i -g pm2

EXPOSE {{port}}
USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["pm2-runtime", "/pm2.json"]
```

**相较旧版 Dockerfile 变更说明：**

| 变更项 | 旧版 | 新版 |
| ------ | ---- | ---- |
| 基础镜像 | `node:alpine3.15` | `node:20-alpine`（多阶段构建） |
| 镜像源 | 硬编码清华镜像 | 不设定（CI 环境自行配置） |
| 安装工具 | `bash curl ca-certificates` + `yarn` + `nrm` | 仅 `tini tzdata`（最小化） |
| PM2 | `pm2@2.x` + `pm2 startOrGracefulReload` | `pm2-runtime`（容器模式） |
| 启动方式 | `start.sh` shell 脚本 | `tini` + `pm2-runtime`（信号处理） |
| 运行用户 | root | `node`（安全最佳实践） |
| 依赖安装 | 运行时在容器内 `npm install` | 构建阶段 `npm ci`（可复现、更安全） |

**`src/App.ts.hbs`** — 使用 `@Bootstrap()` 装饰器模式（旧 `koatty_template` 已使用此模式，保持不变）：

```typescript
import { Koatty, Bootstrap } from "koatty";
import * as path from 'path';

@Bootstrap(() => {
  process.env.UV_THREADPOOL_SIZE = '128';
  // process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
})
// @ComponentScan('./')
// @ConfigurationScan('./config')
export class App extends Koatty {
  public init() {
    this.rootPath = path.dirname(__dirname);
    // this.appDebug = true; // 生产环境设为 false
  }
}
```

**`src/config/server.ts.hbs`** — **4.0 新增**（从旧 `config.ts` 中提取服务器相关字段）：

```typescript
// 4.0: 服务器配置独立文件（从 config.ts 分离）
export default {
  hostname: '{{hostname}}',          // 旧: app_host
  port: {{port}},                    // 旧: app_port
  protocol: "{{protocol}}",         // 'http' | 'https' | 'http2' | 'grpc' | 'ws' | 'wss' | 'graphql'
  trace: false,                      // 旧: open_trace
  ssl: {
    mode: 'auto',                    // 'auto' | 'manual' | 'mutual_tls'
    key: '',                         // 旧: key_file
    cert: '',                        // 旧: crt_file
    ca: ''
  }
};
```

**`src/config/config.ts.hbs`** — 仅通用配置，server 相关字段已移除：

```typescript
export default {
  encoding: "utf-8",
  logs_level: "info",                // "debug" | "info" | "warning" | "error"
  logs_path: "./logs",
  sensitive_fields: ['password', 'token', 'secret'],
};
```

**`src/config/db.ts.hbs`** — 数据库配置（保持旧版结构，支持环境变量占位）：

```typescript
export default {
  "DataBase": {
    type: "mysql",
    host: "${mysql_host}",
    port: "${mysql_port}",
    username: "${mysql_user}",
    password: "${mysql_pass}",
    database: "${mysql_database}",
    synchronize: false,
    logging: true,
    entities: [`${process.env.APP_PATH}/model/**/*`],
    entityPrefix: "",
    timezone: "Z"
  },
  "CacheStore": {
    type: "memory",                  // "redis" or "memory"
    keyPrefix: "koatty",
  },
};
```

**`src/config/middleware.ts.hbs`** — 中间件加载配置（保持旧版结构）：

```typescript
export default {
  list: ["StaticMiddleware", "ViewMiddleware"],
  config: {
    StaticMiddleware: { cache: true },
    ViewMiddleware: {
      root: `${process.env.ROOT_PATH}/view`,
      opts: { autoRender: false, extension: 'html', map: { html: "ejs" }, options: { cache: false } }
    },
  }
};
```

**`src/config/router.ts.hbs`** — ext 使用协议名作 key（**4.0 变更**，旧版为 `ext: { protoFile: "" }`）：

```typescript
export default {
  prefix: '',
  payload: {
    extTypes: {
      json: ['application/json'],
      form: ['application/x-www-form-urlencoded'],
    },
    limit: '20mb',
    encoding: 'utf-8',
  },
  ext: {
    {{#if (eq protocol "grpc")}}
    grpc: {
      protoFile: process.env.APP_PATH + "/resource/proto/{{projectName}}.proto",
      poolSize: 10,
      streamConfig: { maxConcurrentStreams: 50, streamTimeout: 60000 },
    },
    {{/if}}
    {{#if (eq protocol "ws")}}
    ws: {
      maxFrameSize: 1024 * 1024,
      heartbeatInterval: 15000,
      heartbeatTimeout: 30000,
      maxConnections: 1000,
    },
    {{/if}}
    {{#if (eq protocol "graphql")}}
    graphql: {
      schemaFile: "./resource/graphql/schema.graphql",
      playground: true,
      introspection: true,
      depthLimit: 10,
    },
    {{/if}}
  },
};
```

**`src/controller/IndexController.ts.hbs`** — HTTP 控制器（**4.0 变更**：添加 `constructor(ctx)`，去掉 `init()`）：

```typescript
import { Controller, Autowired, GetMapping, PostMapping, KoattyContext, Header, PathVariable } from 'koatty';
import { Valid, Validated } from "koatty_validation";
import { App } from '../App';

@Controller('/')
export class IndexController {
  app: App;
  ctx: KoattyContext;

  constructor(ctx: KoattyContext) {
    this.ctx = ctx;
  }

  @GetMapping('/')
  index(): Promise<any> {
    return this.ok('Hello, Koatty!');
  }

  @GetMapping('/get/:id')
  async get(
    @Header("x-access-token") token: string,
    @Valid("IsNotEmpty", "id不能为空") @PathVariable("id") id: number
  ): Promise<any> {
    return this.ok("success", { id });
  }
}
```

**`src/service/TestService.ts.hbs`** — 服务（**4.0 变更**：去掉 `extends BaseService`，添加 `@Log()`）：

```typescript
import { Service, Autowired } from 'koatty';
import { Log } from 'koatty_logger';
import { CacheAble, CacheEvict } from "koatty_cacheable";
import { Scheduled } from "koatty_schedule";
import { App } from '../App';

@Service()
export class TestService {
  app: App;

  @Log()
  logger: any;

  @CacheAble("getUser")
  getUser(id: number) {
    return { "id": id, "username": "test" };
  }

  @Scheduled("0 * * * * *")
  testCron() {
    this.logger.debug('cron job executed');
  }
}
```

**`src/plugin/TestPlugin.ts.hbs`** — 插件（**4.0 变更**：添加 `@OnEvent` 生命周期）：

```typescript
import { Plugin, IPlugin, OnEvent, AppEvent, KoattyApplication } from 'koatty';
import { Log } from 'koatty_logger';
import { App } from '../App';

@Plugin()
export class TestPlugin implements IPlugin {
  @Log()
  logger: any;

  run(options: any, app: App) {
    this.logger.debug("TestPlugin initialized");
    return Promise.resolve();
  }

  @OnEvent(AppEvent.appReady)
  async onReady(app: KoattyApplication) {
    this.logger.info("Application ready - plugin can perform post-init tasks");
  }

  @OnEvent(AppEvent.appStop)
  async onStop(app: KoattyApplication) {
    this.logger.info("Application stopping - cleanup resources");
  }
}
```

#### koatty-ai-template-modules

合并现有 `.hbs` 模板和 `standaloneTemplates.ts` 内容，**对齐 Koatty 4.0 API**：

```
koatty-ai-template-modules/
├── README.md
├── package.json
├── koatty.json                       # 模板配置
├── controller/
│   ├── crud.hbs                      # 完整 CRUD HTTP 控制器（@Controller 装饰器）
│   ├── simple.hbs                    # 简单 HTTP 控制器（@Controller + constructor(ctx)）
│   ├── grpc.hbs                      # gRPC 控制器（@GrpcController 装饰器）
│   ├── websocket.hbs                 # WebSocket 控制器（@WsController 装饰器）
│   └── graphql.hbs                   # GraphQL 控制器（@GraphQLController 装饰器）
├── service/
│   ├── crud.hbs                      # 完整服务（@Service 装饰，含 @Log/@CacheAble）
│   ├── simple.hbs                    # 简单服务（@Service 装饰，不继承 BaseService）
│   └── interface.hbs                 # 服务接口
├── model/
│   ├── typeorm.hbs                   # TypeORM 模型（现有 model.hbs）
│   ├── simple.hbs                    # 简单模型
│   └── entity.hbs                    # TypeORM Entity
├── dto/
│   ├── crud.hbs                      # 完整 DTO（含 @IsNotEmpty/@IsDefined 验证）
│   └── simple.hbs                    # 简单 DTO
├── middleware/
│   ├── middleware.hbs                # 通用中间件模板（@Middleware 装饰器）
│   └── protocol.hbs                  # [4.0] 协议特定中间件（@Middleware({ protocol: [...] })）
├── plugin/
│   ├── plugin.hbs                    # 插件模板（含 @OnEvent 生命周期事件）
│   ├── typeorm.hbs                   # TypeORM 插件
│   ├── cacheable.hbs                 # [4.0] 缓存插件
│   └── scheduled.hbs                 # [4.0] 定时任务插件
├── aspect/
│   └── aspect.hbs                    # AOP 切面（@Aspect 装饰器）
├── exception/
│   └── exception.hbs                 # 异常处理器（@ExceptionHandler 装饰器）
├── proto/
│   └── proto.hbs                     # gRPC Proto 文件
├── graphql/
│   └── schema.hbs                    # [4.0] GraphQL Schema 文件
└── enum/
    └── enum.hbs                      # 枚举类型
```

**关键模板内容规范（Koatty 4.0）：**

**`controller/simple.hbs`** — HTTP 控制器（必须有 constructor(ctx)）：

```typescript
import { Controller, GetMapping, KoattyContext } from 'koatty';
import { App } from '{{subPath}}/App';

@Controller('/{{lowerCase moduleName}}')
export class {{className}} {
  app: App;
  ctx: KoattyContext;

  constructor(ctx: KoattyContext) {
    this.ctx = ctx;
  }

  @GetMapping('/')
  index(): Promise<any> {
    return this.ok('Hello, Koatty!');
  }
}
```

**`controller/grpc.hbs`** — gRPC 控制器（必须用 @GrpcController）：

```typescript
import { GrpcController, PostMapping, RequestBody, Validated, KoattyContext } from 'koatty';
import { App } from '{{subPath}}/App';

@GrpcController('/{{pascalCase moduleName}}') // 必须匹配 proto 中的 service 名
export class {{className}} {
  app: App;
  ctx: KoattyContext;

  constructor(ctx: KoattyContext) {
    this.ctx = ctx;
  }

  @PostMapping('/SayHello') // 必须匹配 proto 中的 method 名
  @Validated()
  async sayHello(@RequestBody() params: any): Promise<any> {
    return { message: `Hello, ${params.name}!` };
  }
}
```

**`controller/websocket.hbs`** — WebSocket 控制器（必须用 @WsController）：

```typescript
import { WsController, GetMapping, RequestBody, KoattyContext } from 'koatty';
import { App } from '{{subPath}}/App';

@WsController('/{{lowerCase moduleName}}')
export class {{className}} {
  app: App;
  ctx: KoattyContext;

  constructor(ctx: KoattyContext) {
    this.ctx = ctx;
  }

  @GetMapping('/')
  async message(@RequestBody() data: any): Promise<any> {
    return { type: 'response', data: data };
  }
}
```

**`controller/graphql.hbs`** — GraphQL 控制器（必须用 @GraphQLController）：

```typescript
import { GraphQLController, GetMapping, PostMapping, RequestParam, KoattyContext } from 'koatty';
import { App } from '{{subPath}}/App';

@GraphQLController('/graphql')
export class {{className}} {
  app: App;
  ctx: KoattyContext;

  constructor(ctx: KoattyContext) {
    this.ctx = ctx;
  }

  @GetMapping()
  async query(@RequestParam() id: string): Promise<any> {
    return { id, message: 'GraphQL query result' };
  }

  @PostMapping()
  async mutation(@RequestParam() input: any): Promise<any> {
    return { id: input.id, message: 'GraphQL mutation result' };
  }
}
```

**`service/simple.hbs`** — 服务（不继承 BaseService，使用 @Log）：

```typescript
import { Service, Autowired } from 'koatty';
import { Log } from 'koatty_logger';
import { App } from '{{subPath}}/App';

@Service()
export class {{className}} {
  app: App;

  @Log()
  logger: any;

  // implement service methods
}
```

**`middleware/protocol.hbs`** — 协议特定中间件：

```typescript
import { Middleware, KoattyContext, KoattyNext } from 'koatty';
import { App } from '{{subPath}}/App';

@Middleware({ protocol: [{{#each protocols}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}] })
export class {{className}} {
  run(options: any, app: App) {
    return async (ctx: KoattyContext, next: KoattyNext) => {
      // 此中间件仅在指定协议下执行
      await next();
    };
  }
}
```

**`plugin/plugin.hbs`** — 插件（含 @OnEvent 生命周期）：

```typescript
import { Plugin, IPlugin, OnEvent, AppEvent, KoattyApplication } from 'koatty';
import { App } from '{{subPath}}/App';

@Plugin()
export class {{className}} implements IPlugin {
  run(options: any, app: App) {
    // 插件初始化逻辑
  }

  @OnEvent(AppEvent.appReady)
  async onReady(app: KoattyApplication) {
    // 应用就绪后执行（如服务注册、连接池初始化）
  }

  @OnEvent(AppEvent.appStop)
  async onStop(app: KoattyApplication) {
    // 应用停止时执行（如资源清理、服务注销）
  }
}
```

#### koatty-ai-template-component

基于旧仓库 `koatty_template_component` 改造，保持函数式导出模式，升级至 4.0：

```
koatty-ai-template-component/
├── README.md
├── package.json
├── koatty.json
├── middleware/                       # 独立中间件包模板
│   ├── package.json.hbs             # peerDependencies: koatty@^4.0.0
│   ├── tsconfig.json.hbs            # target: ES2021
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

**组件模板升级要点（相较旧 `koatty_template_component`）：**

| 变更项 | 旧版 | 新版 | 说明 |
| ------ | ---- | ---- | ---- |
| Node 引擎 | `>12.0.0` | `>=18.0.0` | 4.0 最低要求 |
| `package.json` peerDependencies | `koatty@^3.x`, `koa@^2.x` | `koatty@^4.0.0` | 不再直接依赖 koa |
| `package.json` devDependencies | husky@4, eslint@8, typescript-eslint@6 | husky@9, eslint@9, typescript-eslint@8 | 构建工具链升级 |
| `tsconfig.json` target | `ES2019` | `ES2022` | 支持更多 ES 特性 |
| `tsconfig.json` strict | 无 | `true` | 启用严格模式 |
| `middleware.ts` 类型引用 | `import Koa from "koa"` + `Koa.Middleware` 返回 | `import { KoattyContext, KoattyNext } from "koatty"` | 解耦 koa 依赖 |
| `plugin.ts` 返回类型 | `Promise`（无泛型） | `Promise<void>` | 明确类型 |
| ESLint 配置 | `.eslintrc.js` | `eslint.config.js`（flat config） | ESLint 9 新格式 |
| Husky 配置 | `.huskyrc` | `.husky/` 目录 + `prepare` 脚本 | Husky 9 新格式 |
| 构建命令 | `del-cli --force dist && tsc` | `rimraf dist && tsc` | 替代废弃工具 |
| 增加 `index.ts` | 无（旧版缺失，main 指向 dist/index.js 但无源文件） | 导出 middleware/plugin 的统一入口 | 修复旧版缺陷 |

**`middleware/package.json.hbs`** — 中间件包依赖示例：

```json
{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "Koatty Extension Middleware",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "rimraf dist && tsc",
    "dev": "tsx watch ./src/index.ts",
    "lint": "eslint 'src/**/*.ts' --fix",
    "test": "jest --passWithNoTests",
    "release": "standard-version",
    "prepare": "husky",
    "prepublishOnly": "npm test && npm run build"
  },
  "engines": { "node": ">=18.0.0" },
  "license": "BSD-3-Clause",
  "dependencies": {
    "koatty_lib": "^2.0.0"
  },
  "peerDependencies": {
    "koatty": "^4.0.0"
  },
  "devDependencies": {
    "@commitlint/cli": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0",
    "@types/jest": "^29.0.0",
    "@types/node": "^22.0.0",
    "eslint": "^9.0.0",
    "husky": "^9.0.0",
    "jest": "^29.0.0",
    "rimraf": "^6.0.0",
    "standard-version": "^9.0.0",
    "ts-jest": "^29.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0",
    "typescript-eslint": "^8.0.0"
  }
}
```

**`middleware/src/index.ts.hbs`** — 中间件入口（现代化类型）：

```typescript
import { Koatty, KoattyContext, KoattyNext } from "koatty";

interface OptionsInterface {
  // 中间件配置项
}

const defaultOptions: OptionsInterface = {
  // 默认配置
};

export function {{className}}(options: OptionsInterface, app: Koatty) {
  const opt = { ...defaultOptions, ...options };

  return async (ctx: KoattyContext, next: KoattyNext): Promise<void> => {
    // 中间件逻辑
    await next();
  };
}
```

**`plugin/src/index.ts.hbs`** — 插件入口（现代化类型）：

```typescript
import { Koatty } from "koatty";

export interface OptionsInterface {
  // 插件配置项
}

const defaultOptions: OptionsInterface = {
  // 默认配置
};

export async function {{className}}(options: OptionsInterface, app: Koatty): Promise<void> {
  const opt = { ...defaultOptions, ...options };
  // 插件初始化逻辑
}
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
import * as http from 'http';
import * as https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';
import Handlebars from 'handlebars';

const execAsync = promisify(exec);

export type TemplateType = 'project' | 'modules' | 'component';
export type MirrorSource = 'github' | 'gitee';

interface TemplateRepoConfig {
  github: string;
  gitee: string;
}

/** 二进制文件扩展名集合（这些文件不做 Handlebars 渲染，以 Buffer 复制） */
const BINARY_EXTENSIONS = new Set([
  '.ico', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.zip', '.tar', '.gz', '.br',
  '.pdf', '.doc', '.xls',
]);

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
   * 下载模板仓库（异步，支持进度回调）
   */
  private async downloadTemplate(
    type: TemplateType,
    mirror?: MirrorSource,
    onProgress?: (msg: string) => void
  ): Promise<void> {
    const source = mirror || (await this.detectBestMirror());
    const repoUrl = TemplateManager.TEMPLATE_REPOS[type][source];
    const targetDir = path.join(this.cacheDir, type);

    // 删除旧缓存
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true });
    }

    // 创建缓存目录
    fs.mkdirSync(this.cacheDir, { recursive: true });

    onProgress?.(`正在从 ${source} 下载模板 ${type}...`);

    // 异步克隆仓库
    try {
      await execAsync(`git clone --depth 1 ${repoUrl} ${targetDir}`);
    } catch (error) {
      // 降级到另一个镜像
      const fallbackSource = source === 'github' ? 'gitee' : 'github';
      const fallbackUrl = TemplateManager.TEMPLATE_REPOS[type][fallbackSource];
      onProgress?.(`${source} 连接失败，降级到 ${fallbackSource}...`);
      await execAsync(`git clone --depth 1 ${fallbackUrl} ${targetDir}`);
    }

    // 验证模板完整性
    if (!this.isValidTemplateDir(targetDir)) {
      throw new Error(`模板下载失败或内容为空: ${type}`);
    }
  }

  /**
   * 检测最佳镜像源（跨平台，使用 Node.js 原生 HTTP）
   */
  private detectBestMirror(): Promise<MirrorSource> {
    return new Promise((resolve) => {
      const req = https.get('https://github.com', { timeout: 3000 }, (res) => {
        res.destroy();
        resolve('github');
      });
      req.on('error', () => resolve('gitee'));
      req.on('timeout', () => {
        req.destroy();
        resolve('gitee');
      });
    });
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
  async updateTemplates(
    mirror?: MirrorSource,
    onProgress?: (msg: string) => void
  ): Promise<void> {
    const types: TemplateType[] = ['project', 'modules', 'component'];
    for (const type of types) {
      await this.downloadTemplate(type, mirror, onProgress);
    }
  }

  /**
   * 判断文件是否为二进制文件
   */
  private isBinaryFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return BINARY_EXTENSIONS.has(ext);
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
   * 支持文本文件渲染和二进制文件原样复制
   */
  async renderDirectory(
    templateDir: string,
    context: Record<string, any>,
    options?: { excludePatterns?: string[] }
  ): Promise<Array<{ path: string; content: string | Buffer; isBinary: boolean }>> {
    const results: Array<{ path: string; content: string | Buffer; isBinary: boolean }> = [];
    const excludePatterns = options?.excludePatterns || ['.git', 'node_modules', 'koatty.json'];

    const walk = (dir: string, baseDir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (excludePatterns.some((p) => entry.name.includes(p))) continue;

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
          walk(fullPath, baseDir);
        } else if (this.isBinaryFile(fullPath)) {
          // 二进制文件：原样复制（Buffer）
          let outputPath = this.renderPathVariables(relativePath, context);
          results.push({
            path: outputPath,
            content: fs.readFileSync(fullPath),
            isBinary: true,
          });
        } else {
          let outputPath = relativePath;
          let content: string;

          if (entry.name.endsWith('.hbs')) {
            // 渲染 Handlebars 模板
            outputPath = relativePath.replace(/\.hbs$/, '');
            content = this.renderTemplate(fullPath, context);
          } else {
            // 文本文件直接复制
            content = fs.readFileSync(fullPath, 'utf-8');
          }

          // 处理路径中的变量
          outputPath = this.renderPathVariables(outputPath, context);
          results.push({ path: outputPath, content, isBinary: false });
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
import ora from 'ora';

export function registerNewCommand(program: Command) {
  const handler = async (projectName: string, options: Options) => {
    const templateManager = new TemplateManager();
    const spinner = ora();

    // 1. 确定模板类型
    const templateType = options.template === 'project' ? 'project' : 'component';
    const subTemplate = options.template === 'project' ? 'default' : options.template;

    // 2. 确保模板可用（支持进度提示）
    spinner.start('正在准备模板...');
    const templateDir = await templateManager.ensureTemplateRepo(templateType, {
      mirror: options.mirror,
    });
    spinner.succeed('模板已就绪');

    // 3. 准备上下文变量（统一使用新变量名，保留兼容映射）
    const context = {
      // 新版标准变量
      projectName: projectName,
      className: toPascal(projectName),
      hostname: '0.0.0.0',
      port: 3000,
      protocol: options.protocol || 'http',
      // 兼容旧变量（逐步废弃）
      PROJECT_NAME: projectName,
      _PROJECT_NAME: projectName,
      _CLASS_NAME: toPascal(projectName),
    };

    // 4. 渲染模板目录
    spinner.start('正在生成项目文件...');
    const files = await templateManager.renderDirectory(
      path.join(templateDir, subTemplate),
      context
    );

    // 5. 写入目标目录（区分文本和二进制文件）
    const targetDir = options.dir
      ? path.resolve(process.cwd(), options.dir)
      : path.join(process.cwd(), projectName);

    for (const { path: filePath, content, isBinary } of files) {
      const fullPath = path.join(targetDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      if (isBinary) {
        // 二进制文件：以 Buffer 写入
        fs.writeFileSync(fullPath, content);
      } else {
        // 文本文件：以 utf-8 写入
        fs.writeFileSync(fullPath, content as string, 'utf-8');
      }
    }

    spinner.succeed(`项目创建成功: ${targetDir}`);
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

/**
 * Controller 协议类型与 Koatty 4.0 装饰器映射
 */
const CONTROLLER_TYPE_MAP: Record<string, string> = {
  http: 'simple',     // → @Controller()
  grpc: 'grpc',       // → @GrpcController()
  ws: 'websocket',    // → @WsController()
  websocket: 'websocket',
  graphql: 'graphql', // → @GraphQLController()
};

export async function createModule(
  type: string,
  name: string,
  options?: { type?: string; interface?: boolean }
): Promise<{ path: string; content: string }> {
  // 选择模板
  let templatePath: string;
  switch (type) {
    case 'controller': {
      const ctrlType = (options?.type || 'http').toLowerCase();
      const templateName = CONTROLLER_TYPE_MAP[ctrlType] || 'simple';
      templatePath = `controller/${templateName}.hbs`;
      break;
    }
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

  const baseName = name.split('/').pop() || name;

  // 准备上下文（统一使用新版变量名，保留兼容映射）
  const context = {
    // 新版标准变量
    moduleName: baseName,
    className: toPascal(baseName) + toPascal(type),
    camelName: toCamel(baseName) + toPascal(type),
    subPath: '..',
    // 兼容旧变量（逐步废弃）
    _CLASS_NAME: toPascal(baseName) + toPascal(type),
    _NEW: baseName,
    _SUB_PATH: '..',
    _CAMEL_NAME: toCamel(baseName) + toPascal(type),
  };

  // 渲染模板
  const content = await TemplateLoader.render(templatePath, context, 'modules');

  // 生成输出路径
  let outputDir: string;
  let fileName: string;
  if (type === 'proto') {
    outputDir = 'resource/proto';  // 4.0: proto 放在 resource/proto/ 下
    fileName = toPascal(baseName);
  } else if (type === 'model') {
    outputDir = 'model';
    fileName = context.className;
  } else {
    outputDir = type;
    fileName = context.className;
  }
  const ext = type === 'proto' ? '.proto' : '.ts';
  const outputPath = path.join(process.cwd(), 'src', outputDir, `${fileName}${ext}`);

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

#### 1.1 创建 GitHub 仓库

```bash
gh repo create koatty/koatty-ai-template-project --public --description "Koatty 4.0 project templates"
gh repo create koatty/koatty-ai-template-modules --public --description "Koatty 4.0 module templates"
gh repo create koatty/koatty-ai-template-component --public --description "Koatty 4.0 component templates"
```

#### 1.2 迁移 koatty-ai-template-project（项目模板）

以旧仓库 `koatty_template` 为基础，执行以下改造：

| 步骤 | 操作 | 说明 |
| ---- | ---- | ---- |
| 1 | `git clone koatty_template` → 放入 `default/` 子目录 | 保留旧仓库完整结构 |
| 2 | 所有含变量的文件重命名为 `.hbs` 后缀 | `package.json` → `package.json.hbs` 等 |
| 3 | 占位符 `_PROJECT_NAME` 改为 `{{projectName}}` | Handlebars 语法 |
| 4 | **新增** `config/server.ts.hbs` | 从 `config.ts` 中提取 `app_port`/`app_host`/`protocol`/`key_file`/`crt_file` |
| 5 | **改造** `config/config.ts.hbs` | 删除 server 相关配置项，仅保留 `logs_level`/`logs_path`/`encoding` 等 |
| 6 | **改造** `config/router.ts.hbs` | `ext` 使用协议名作 key（旧版 `ext: { protoFile: "" }`） |
| 7 | **改造** `App.ts.hbs` | 旧版已使用 `@Bootstrap()` + `extends Koatty`，保持不变 |
| 8 | **改造** `controller/IndexController.ts.hbs` | 添加 `constructor(ctx: KoattyContext)` 替代 `init()` |
| 9 | **改造** `service/TestService.ts.hbs` | 去掉 `extends BaseService`，添加 `@Log()` |
| 10 | **改造** `plugin/TestPlugin.ts.hbs` | 添加 `@OnEvent` 生命周期事件 |
| 11 | **改造** `package.json.hbs` | 全面现代化：koatty→4.0、新增 koatty_logger/koatty_exception、tsx 替代 nodemon+ts-node、rimraf+cpy-cli 替代 del-cli+copyfiles、eslint@9+typescript-eslint@8、husky@9、node>=18 |
| 12 | **改造** `tsconfig.json.hbs` | target→ES2022、新增 rootDir/strict、移除 downlevelIteration |
| 13 | **新增** `eslint.config.js.hbs` | ESLint 9 Flat Config 替代 `.eslintrc.js` |
| 14 | **改造** Husky 配置 | `.huskyrc` → `.husky/commit-msg` + `.husky/pre-commit` + `prepare` 脚本（Husky 9） |
| 15 | **新增** `resource/graphql/.gitkeep` | 4.0 GraphQL schema 目录 |
| 16 | 将 `src/proto/` 移至 `src/resource/proto/` | 4.0 proto 文件目录规范 |
| 17 | 添加 `koatty.json`（仓库根级） | 模板元数据：变量定义、最低 CLI 版本 |

**旧 `config/config.ts` → 拆分为两个文件：**

```
旧版 config.ts 中的字段分配：
┌──────────────────────┬────────────────────────┐
│ 移到 server.ts       │ 保留在 config.ts       │
├──────────────────────┼────────────────────────┤
│ app_port → port      │ logs_level             │
│ app_host → hostname  │ logs_path              │
│ protocol             │ encoding               │
│ open_trace → trace   │ sensitive_fields (新增) │
│ key_file → ssl.key   │                        │
│ crt_file → ssl.cert  │                        │
│ http_timeout         │                        │
└──────────────────────┴────────────────────────┘
```

#### 1.3 迁移 koatty-ai-template-modules（模块模板）

以旧仓库 `koatty_template_cli` 的 19 个 `.template` 文件为基础，合并 koatty-ai 的 `standaloneTemplates.ts` 和 `templates/*.hbs`：

| 旧模板文件 | 新模板路径 | 改造内容 |
| ---------- | --------- | -------- |
| `controller.template` | `controller/simple.hbs` | `@Controller` 保持；添加 `constructor(ctx)`；去掉 `extends BaseController`/`init()` |
| `controller_grpc.template` | `controller/grpc.hbs` | **`@Controller` → `@GrpcController`**；添加 `constructor(ctx)`；去掉 `extends BaseController`/`init()` |
| `controller_grpc_import.template` | `controller/grpc_import.hbs` | 保留为 partial template，供 grpc 控制器导入 DTO |
| `controller_grpc_method.template` | `controller/grpc_method.hbs` | 保留为 partial template，供 grpc 控制器注入方法 |
| `controller_ws.template` | `controller/websocket.hbs` | **`@Controller` → `@WsController`**；`@RequestMapping` → `@GetMapping`；添加 `constructor(ctx)` |
| （新增） | `controller/graphql.hbs` | **`@GraphQLController`**（旧版无 GraphQL 模板） |
| `templates/controller/controller.hbs`（koatty-ai） | `controller/crud.hbs` | 保留完整 CRUD 模式，添加 `constructor(ctx)` |
| `service.template` | `service/simple.hbs` | 去掉 `extends BaseService`/`init()`/`implements I_CLASS_NAME`；添加 `@Log()` |
| `service.interface.template` | `service/interface.hbs` | 保持不变 |
| `templates/service/service.hbs`（koatty-ai） | `service/crud.hbs` | 保留完整 CRUD 模式 |
| `entity.typeorm.template` | `model/entity.hbs` | 保持不变 |
| `model.typeorm.new.template` | `model/typeorm.hbs` | 保持不变（含分页 CRUD） |
| `model.typeorm.template` | `model/simple.hbs` | 保持不变 |
| `model.template` | （暂不迁移） | ThinkORM 在 4.0 中不再默认支持 |
| `dto.template` | `dto/simple.hbs` | 保持不变，支持 `//_FIELDS` 注入 |
| `templates/dto/dto.hbs`（koatty-ai） | `dto/crud.hbs` | 保留完整 CRUD DTO 模式 |
| `middleware.template` | `middleware/middleware.hbs` | 保持不变 |
| （新增） | `middleware/protocol.hbs` | 4.0 新增：`@Middleware({ protocol: [...] })` |
| `plugin.template` | `plugin/plugin.hbs` | 添加 `@OnEvent(AppEvent.appReady/appStop)` |
| `plugin.typeorm.template` | `plugin/typeorm.hbs` | 保持不变，升级 import |
| （新增） | `plugin/cacheable.hbs` | 4.0 新增：`KoattyCached` 缓存插件 |
| （新增） | `plugin/scheduled.hbs` | 4.0 新增：`KoattyScheduled` 定时任务插件 |
| `aspect.template` | `aspect/aspect.hbs` | 保持不变 |
| `exception.template` | `exception/exception.hbs` | 保持不变（已支持多协议） |
| `proto.template` | `proto/proto.hbs` | 保持不变 |
| `enum.template` | `enum/enum.hbs` | 保持不变 |
| （新增） | `graphql/schema.hbs` | 4.0 新增：GraphQL schema 文件模板 |

**占位符统一转换规则：**

```
旧占位符          →  Handlebars 语法
─────────────────────────────────────
_CLASS_NAME      →  {{className}}
_NEW             →  {{moduleName}}
_SUB_PATH        →  {{subPath}}
_CAMEL_NAME      →  {{camelName}}
_ENTITY_NAME     →  {{entityName}}
_DTO_NAME        →  {{dtoName}}
_METHOD_NAME     →  {{methodName}}
_REQUEST_TYPE    →  {{requestType}}
_RESPONSE_TYPE   →  {{responseType}}
_RESPONSE_RETURN →  {{responseReturn}}
//_IMPORT_LIST   →  {{> importList}}   (partial)
//_METHOD_LIST   →  {{> methodList}}   (partial)
//_ENUM_IMPORT   →  {{> enumImport}}   (partial)
//_FIELDS        →  {{> fields}}       (partial)
```

#### 1.4 迁移 koatty-ai-template-component（组件模板）

以旧仓库 `koatty_template_component` 为基础：

| 步骤 | 操作 |
| ---- | ---- |
| 1 | 拷贝旧仓库完整结构，拆分为 `middleware/` 和 `plugin/` 子目录 |
| 2 | 工程化配置文件（tsconfig/eslint/jest/commitlint/versionrc/huskyrc）作为公共基础，重命名为 `.hbs` |
| 3 | `package.json.hbs`：`koatty` peerDependencies 升级为 `^4.0.0`，target 升级为 `ES2021` |
| 4 | `middleware.ts.hbs`：`Koa.Middleware` → 改为 `(ctx: KoattyContext, next: KoattyNext) => Promise<void>` 类型 |
| 5 | `plugin.ts.hbs`：返回类型明确为 `Promise<void>` |
| 6 | 新增 `src/index.ts.hbs`：统一导出入口（旧版缺失） |

#### 1.5 在 Gitee 创建镜像仓库

```bash
# 在 Gitee 创建同名仓库并设置从 GitHub 自动同步
# koatty-ai-template-project、koatty-ai-template-modules、koatty-ai-template-component
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
6. 对比验证：用新模板创建的项目与旧模板创建的项目功能等价

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
            └── new.ts              # 内嵌项目模板（旧模式）
```

### 变更后

```
koatty-ai/
├── .gitmodules                   # Submodule 配置
├── templates/
│   ├── project/                  # Submodule → koatty-ai-template-project
│   │   └── default/
│   │       ├── src/
│   │       │   ├── App.ts.hbs           # @Bootstrap 装饰器入口
│   │       │   └── config/
│   │       │       ├── config.ts.hbs    # 通用配置
│   │       │       ├── server.ts.hbs    # [4.0] 服务器配置
│   │       │       ├── router.ts.hbs    # ext 使用协议名 key
│   │       │       ├── middleware.ts.hbs
│   │       │       ├── plugin.ts.hbs
│   │       │       └── db.ts.hbs
│   │       ├── resource/
│   │       │   ├── proto/               # [4.0] proto 文件位置
│   │       │   └── graphql/             # [4.0] GraphQL schema
│   │       └── ...
│   ├── modules/                  # Submodule → koatty-ai-template-modules
│   │   ├── controller/
│   │   │   ├── simple.hbs               # @Controller
│   │   │   ├── grpc.hbs                 # @GrpcController
│   │   │   ├── websocket.hbs            # @WsController
│   │   │   └── graphql.hbs              # @GraphQLController
│   │   ├── middleware/
│   │   │   ├── middleware.hbs           # 通用中间件
│   │   │   └── protocol.hbs            # [4.0] 协议特定中间件
│   │   ├── plugin/
│   │   │   └── plugin.hbs              # 含 @OnEvent 生命周期
│   │   └── ...
│   └── component/                # Submodule → koatty-ai-template-component
└── src/
    ├── services/
    │   └── TemplateManager.ts    # 新增：模板管理服务（异步、二进制支持）
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

### 7.1 新版标准变量（推荐使用）

| 变量名          | 说明                       | 示例值           | 使用场景         |
| --------------- | -------------------------- | ---------------- | ---------------- |
| `projectName`   | 项目名称（原始）           | `my-app`         | 项目模板         |
| `className`     | PascalCase 类名            | `MyApp`          | 所有模板         |
| `moduleName`    | 模块名称（原始）           | `user`           | 模块模板         |
| `camelName`     | camelCase 完整名称         | `userController` | 模块模板         |
| `subPath`       | 相对路径前缀               | `..`             | 所有模块模板     |
| `hostname`      | 服务器主机名               | `0.0.0.0`        | 项目模板         |
| `port`          | 服务器端口                 | `3000`           | 项目模板         |
| `protocol`      | 服务协议类型               | `http`           | 项目模板         |

### 7.2 兼容旧变量（逐步废弃）

> 在渲染上下文中同时传入，确保旧模板仍可工作。新模板应仅使用新版变量。

| 旧变量名          | 对应新变量名  | 说明               |
| ----------------- | ------------- | ------------------ |
| `_PROJECT_NAME`   | `projectName` | 项目名称           |
| `_CLASS_NAME`     | `className`   | PascalCase 类名    |
| `_NEW`            | `moduleName`  | 模块名称           |
| `_SUB_PATH`       | `subPath`     | 相对路径前缀       |
| `_CAMEL_NAME`     | `camelName`   | camelCase 名称     |

---

## 八、风险与缓解措施

| 风险                         | 缓解措施                                                                  |
| ---------------------------- | ------------------------------------------------------------------------- |
| 网络不可用导致无法获取模板   | 1. 优先使用 submodule 本地模式<br>2. 用户缓存目录 `~/.koatty/templates`   |
| GitHub 在国内访问慢          | 1. Gitee 镜像自动降级<br>2. `--mirror gitee` 参数<br>3. Node.js 原生 HTTP 检测（跨平台） |
| Submodule 同步问题           | 1. CI/CD 自动同步 GitHub → Gitee<br>2. 模板版本锁定                       |
| 删除 standaloneTemplates     | 确保 modules 仓库包含所有迁移后的简单模板                                 |
| 模板与 Koatty 版本不匹配    | 1. `koatty.json` 中声明 `minCliVersion`<br>2. CLI 启动时校验版本兼容性   |
| 二进制文件渲染损坏           | TemplateManager 区分文本/二进制文件，二进制以 Buffer 原样复制              |
| 旧模板变量不兼容             | 渲染上下文同时传入新旧变量，旧变量标记为 deprecated                        |

---

## 九、后续扩展

1. **自定义模板支持**：允许用户指定自己的模板仓库 URL
2. **模板版本管理**：支持指定模板版本 `--template-version v1.0.0`（建议 v1 实现基础版本锁定）
3. **模板在线浏览器**：`koatty template list` 列出可用模板及描述
4. **模板贡献指南**：社区可以提交自己的模板
5. **模板校验**：检查模板完整性和变量定义
6. **多协议项目模板**：根据用户选择的协议组合，自动生成多协议项目骨架
7. **交互式模板创建**：`koatty new` 支持交互式选择协议、数据库、缓存等选项

---

## 十、评审记录

### 评审日期：2026-02-10

### 评审对照：Koatty 4.0 新版框架使用文档 (`packages/koatty-doc/docs/README-en.md`)

### 评审结论

方案的**架构设计合理**：submodule 统一管理 + TemplateManager 三级加载（submodule → 缓存 → 远程）+ 双源（GitHub/Gitee）降级策略是成熟的方案。

主要修正项如下：

#### P0 严重问题（已修正）

| # | 问题 | 修正内容 |
|---|------|---------|
| 1 | gRPC/WS/GraphQL Controller 使用错误装饰器 | 模板改用 `@GrpcController`/`@WsController`/`@GraphQLController` |
| 2 | 项目模板缺少 `config/server.ts` | 新增 `server.ts.hbs`，server 配置从 `config.ts` 分离 |
| 3 | `App.ts` 使用旧的 `new Koatty()` 模式 | 改为 `@Bootstrap()` 装饰器 + 类继承模式 |
| 4 | Service 模板不当继承 `BaseService` | 去掉继承，直接使用 `@Service()` 装饰器 |

#### P1 重要问题（已修正）

| # | 问题 | 修正内容 |
|---|------|---------|
| 5 | proto 目录位置不一致 | 改为 `src/resource/proto/` 和 `resource/proto/` |
| 6 | router.ts ext 配置格式 | ext 使用协议名（`grpc`/`ws`/`graphql`）作 key |
| 7 | 二进制文件处理损坏 | TemplateManager 增加 `BINARY_EXTENSIONS` 集合和 `isBinaryFile` 检测 |
| 8 | 缺少协议特定中间件模板 | 新增 `middleware/protocol.hbs`，使用 `@Middleware({ protocol: [...] })` |

#### P2 建议问题（已修正）

| # | 问题 | 修正内容 |
|---|------|---------|
| 9  | Plugin 模板缺 `@OnEvent` | `plugin/plugin.hbs` 添加 `@OnEvent(AppEvent.appReady/appStop)` 示例 |
| 10 | Service 模板缺 `@Log()` | `service/simple.hbs` 添加 `@Log()` 日志注入 |
| 11 | 缺 `@Catch()` 模式 | 新增 `plugin/cacheable.hbs`、`plugin/scheduled.hbs` 展示高级特性 |
| 12 | `execSync` 阻塞主线程 | `downloadTemplate` 改为 `execAsync`（`promisify(exec)`） |
| 13 | curl 检测不跨平台 | `detectBestMirror` 改为 Node.js 原生 `https.get` |
| 14 | 模板变量命名不统一 | 定义新版标准变量 + 兼容旧变量映射表 |

#### P2 工程化升级（已修正）

| # | 问题 | 修正内容 |
|---|------|---------|
| 15 | `package.json` 依赖过旧 | koatty→4.0、新增 koatty_logger/koatty_exception、Node>=18 |
| 16 | 构建脚本不够现代 | `del-cli`+`copyfiles` → `rimraf`+`cpy-cli`；`nodemon`+`ts-node` → `tsx watch` |
| 17 | ESLint 配置过旧 | `eslint@8`+`.eslintrc.js` → `eslint@9`+`eslint.config.js`（Flat Config） |
| 18 | Husky 版本过旧 | `husky@4`+`.huskyrc` → `husky@9`+`.husky/` 目录+`prepare` 脚本 |
| 19 | `tsconfig.json` 不够严格 | target→ES2022、新增 `strict: true`/`rootDir` |
| 20 | Dockerfile 过旧且不安全 | 多阶段构建、`node:20-alpine`、`tini`信号处理、`node` 用户运行、构建时 `npm ci` |
| 21 | 组件模板 peerDependencies 过旧 | `koatty@^3.x` → `^4.0.0`、`koa@^2.x` 移除 |
| 22 | 组件模板缺少 index.ts 入口 | 新增 `src/index.ts.hbs` 统一导出 |

#### P3 可选优化（已补充）

| # | 问题 | 补充内容 |
|---|------|---------|
| 23 | 模板版本管理 | `koatty.json` 中建议增加 `minCliVersion` 字段 |
| 24 | 缺 GraphQL schema 模板 | modules 仓库新增 `graphql/schema.hbs` |
| 25 | Controller 缺 constructor(ctx) | 所有 Controller 模板统一添加 `constructor(ctx: KoattyContext)` |
