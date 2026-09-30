# Koatty CLI - 智能脚手架工具

Koatty CLI 为 Koatty 4.0 框架提供智能代码生成，通过 交互/命令行快速生成 Controller、Service、Model、DTO、Middleware、Plugin、Aspect、Exception、Proto 等；也支持 YAML/JSON 做精细配置。

## ✨ 特性

- **创建项目与组件**：基于外部模板初始化 Koatty 应用、中间件或插件项目
- **单文件模块创建**：`koatty controller user` / `koatty service user` 快速生成单个模块文件
- **智能创建模块**：`koatty add user` 交互式生成完整 CRUD 模块（REST / gRPC / GraphQL）
- **多协议 Controller**：HTTP、gRPC、WebSocket、GraphQL 控制器模板，自动更新 `config/server.ts` 的 protocol
- **SQL 转 YAML**：`koatty sql2yml schema.sql` 将 CREATE TABLE 转为模块配置，支持 MySQL / PostgreSQL / Oracle
- **多种模块类型**：Controller、Service、Model、DTO、Middleware、Plugin、Aspect、Exception、Proto
- **TypeORM 集成**：自动生成实体类，支持软删除、时间戳等
- **数据验证与权限**：koatty_validation、RBAC
- **变更生效备份**：apply 时对原文件做时间戳备份（`*.bak.HHMMSS`），并加入 `.gitignore`
- **模板缓存管理**：`koatty template update/status` 管理本地模板缓存

---

## 📦 安装

```bash
npm install -g koatty_cli
```

安装后使用 **`koatty`** 或 **`kt`** 命令（二者等价）。

### 不安装 npm 包、在项目里本地测试

开发或调试时不想全局安装，可在**目标 Koatty 项目**目录下直接执行本仓库构建产物：

```bash
# 1. 在本仓库构建
cd /path/to/koatty-ai && npm run build

# 2. 在目标项目目录执行（工作目录 = 目标项目）
cd /path/to/your-koatty-app
node /path/to/koatty-ai/dist/cli/index.js add user
# 或相对路径：node ../koatty-ai/dist/cli/index.js add user --apply

# 或使用 npx
npx file:../koatty-ai add user
```

可选：`npm link` 后可在任意目录使用 `koatty` / `kt` 测试。

---

## 使用流程概览

| 步骤 | 说明 | 常用命令 |
|------|------|----------|
| 1. 创建项目（或组件） | 从模板初始化 Koatty 应用 / 中间件 / 插件 | `koatty new <name>` / `koatty new <name> -t middleware` |
| 2. 创建单个模块文件 | 在项目中快速添加单个文件 | `koatty controller user` / `koatty service user` |
| 3. 智能创建完整模块 | 交互式生成 CRUD 模块（REST/gRPC/GraphQL） | `koatty add <module>` |
| 4. SQL 转模块（可选） | 从 CREATE TABLE 生成 YAML 并 apply | `koatty sql2yml schema.sql --apply` |
| 5. 预览与应用 | 查看变更、写入磁盘、可选校验与提交 | `koatty plan` / `koatty apply <module>` |

以下按该顺序分别说明。

---

## 一、创建项目（或组件）

### 创建 Koatty 应用

```bash
koatty new my-app
```

基于 Koatty 4.0 模板生成应用骨架，包含：
- `src/App.ts` — 使用 `@Bootstrap()` 装饰器
- `src/config/server.ts` — 独立服务器配置（hostname/port/protocol）
- `src/config/config.ts` — 通用配置
- `package.json` — 现代依赖（tsx、rimraf 等）

生成后：

```bash
cd my-app
npm install
npm run dev
```

### 创建中间件项目

```bash
koatty new my-middleware -t middleware
```

生成中间件型项目结构（`@Middleware()` 装饰器），便于发布到 npm。

### 创建插件项目

```bash
koatty new my-plugin -t plugin
```

生成插件型项目结构（`@Plugin()` 装饰器），便于发布到 npm。

### 指定目标目录

```bash
koatty new my-app -d /path/to/target
```

---

## 二、创建单个模块文件

在**已有 Koatty 项目**根目录下（包含 `.koattysrc` 文件），快速生成单个模块文件。

### Controller

```bash
koatty controller user              # HTTP（默认）
koatty controller user -t grpc      # gRPC（自动创建 proto + controller，并更新 config/server.ts）
koatty controller user -t websocket # WebSocket
koatty controller user -t graphql   # GraphQL
```

`-t grpc` / `-t graphql` / `-t websocket` 时会自动在 `config/server.ts` 的 `protocol` 数组中添加对应协议。若 proto 已存在，会提示可直接修改 proto 后再次执行使变更生效。

### Service

```bash
koatty service user
koatty service user -i    # 同时生成接口文件 IUserService.ts
```

### Model / Entity

```bash
koatty model user                    # TypeORM（默认）
koatty model user -o thinkorm       # ThinkORM
```

### 其他模块类型

```bash
koatty dto user           # DTO 类
koatty middleware auth     # 中间件
koatty plugin cache        # 插件（含 @OnEvent 生命周期）
koatty aspect logging      # AOP 切面
koatty exception global    # 异常处理器（@ExceptionHandler）
koatty proto user          # gRPC Proto 文件
```

**注意**：service、middleware、plugin、aspect、dto、exception、model、proto 若目标文件已存在，会提示错误并退出，避免覆盖。仅 `controller -t grpc` 可重复执行以应用 proto 变更。

---

## 三、智能创建完整模块

在**已有 Koatty 项目**根目录下，为业务添加完整模块（Model、DTO、Service、Controller、Aspect 等）。

### 交互式创建（推荐）

```bash
koatty add user
# 或: kt add user
```

按提示依次输入：API 类型（rest/grpc/graphql）、字段定义、API 路径、认证、软删除、分页、是否直接写入。**默认会保存 `user.yml`**，便于后续修改后复用。

### 指定 API 类型

```bash
koatty add user -t grpc      # 跳过 API 类型选择，直接生成 gRPC 模块
koatty add product -t graphql # 生成 GraphQL 模块
```

### 重复执行与 apply

首次执行会生成 `user.yml`；再次执行 `koatty add user` 时会**加载已有 YAML 作为默认值**，可回车沿用或修改。变更生效需执行：

```bash
koatty apply user    # 等价于 koatty apply --spec user.yml
```

### 进阶：完全自定义时使用 YAML

先编写 `user.yml`（格式见 [规范文件格式](#-规范文件格式)），再应用：

```bash
koatty apply user --validate --commit
```

---

## 四、预览与应用变更

- **预览**：只输出将要生成/修改的内容，不写盘。
  `koatty plan --spec user.yml`
- **应用**：将变更写入项目。支持模块名简写、时间戳备份、自动更新 `.gitignore`。

```bash
koatty apply user                    # 使用 user.yml 生成并应用
koatty apply --spec user.yml         # 等价写法
koatty apply --changeset <path>      # 从 ChangeSet 文件应用
koatty apply user --validate --commit
```

**变更生效时**：若原文件已存在，会先备份为 `UserService.bak.HHMMSS.ts`，并将 `*.bak.*` 加入 `.gitignore`。

---

## 五、SQL 转 YAML（sql2yml）

将 `CREATE TABLE` SQL 转为模块 YAML，支持常见数据库类型，便于从已有表结构快速生成模块。

### 基本用法

```bash
koatty sql2yml schema.sql          # 解析 SQL，生成 user.yml、product.yml 等
koatty sql2yml schema.sql --apply  # 生成 YAML 后立即执行 apply
```

### 指定数据库类型

```bash
koatty sql2yml schema.sql -d mysql
koatty sql2yml schema.sql --dialect postgres
koatty sql2yml schema.sql --dialect oracle
```

支持 MySQL、PostgreSQL、Oracle 等常见类型（INT、VARCHAR、TEXT、JSON、JSONB、SERIAL、VARCHAR2、CLOB 等）。

### 未知类型处理

遇到无法识别的 SQL 类型时，会**交互式提示**用户指定 Spec 类型（string/number/boolean/datetime/text/json）。非交互模式使用 `-y`：

```bash
koatty sql2yml schema.sql -y       # 未知类型默认为 string，不提示
```

### 其他选项

```bash
koatty sql2yml schema.sql -o ./specs     # 指定 YAML 输出目录
koatty sql2yml schema.sql --api grpc     # 指定 API 类型
koatty sql2yml schema.sql --auth         # 启用认证
```

---

## 六、模板管理

### 模板目录结构

CLI 的模板存放在 `templates/` 目录下，分为三个子目录，分别映射到独立的外部仓库：

| 子目录 | 用途 | 对应命令 | 外部仓库 |
|--------|------|----------|----------|
| `templates/project/` | 项目脚手架 | `koatty new <name>` | [koatty-ai-template-project](https://github.com/koatty/koatty-ai-template-project) |
| `templates/modules/` | 单文件模块 | `koatty create <type>` / `koatty add` | [koatty-ai-template-modules](https://github.com/koatty/koatty-ai-template-modules) |
| `templates/component/` | 独立组件库 | `koatty new <name> -t middleware\|plugin` | [koatty-ai-template-component](https://github.com/koatty/koatty-ai-template-component) |

这三个子目录同时也是 **Git Submodule**，开发者可在源码仓库中直接修改模板。

### 模板解析优先级

CLI 使用三级降级策略定位模板：

1. **用户缓存** (`~/.koatty/templates/{type}`)：通过 `koatty template update` 下载的最新版本，优先使用
2. **内置模板** (`templates/{type}`)：随 npm 包发布的 submodule 快照
3. **远程下载**：如果以上两者均不可用，自动从远程仓库 clone 到用户缓存

### 查看模板状态

```bash
koatty template status
```

显示每种模板类型的来源（用户缓存 / 内置）、路径、最近更新时间。

### 更新模板

```bash
koatty template update                        # 更新所有模板到 ~/.koatty/templates/
koatty template update -t modules             # 仅更新 modules 模板
koatty template update -t project -m gitee    # 从 Gitee 镜像更新 project 模板
```

更新后的模板会覆盖内置版本的优先级，确保使用最新模板。

---

## 📝 规范文件格式

### 基本结构

```yaml
module: <模块名> # 必需，如 user, product
table: <表名> # 可选，默认为模块名复数形式
fields: # 字段定义
  <字段名>:
    type: <类型> # number, string, boolean, enum, datetime, text, json, decimal
    primary: true/false # 是否为主键
    auto: true/false # 是否自动生成
    required: true/false # 是否必填
    unique: true/false # 是否唯一
    length: <数字> # 字符串长度
    format: email/url # 特殊格式（用于验证）
    nullable: true/false # 是否可为空
    default: <默认值> # 默认值
    comment: <注释> # 字段注释
    searchable: true/false # 是否可搜索（用于查询 DTO）
api: # API 配置
  basePath: <路径> # 基础路径，如 /users
  type: rest/grpc/graphql # API 类型，默认 rest
  endpoints: # 自定义端点（可选）
    - method: GET/POST/PUT/DELETE
      path: <路径>
      action: <方法名>
      auth: true/false
      roles: [<角色>]
dto: # DTO 配置
  create: [<字段列表>] # 创建 DTO 包含的字段
  update: [<字段列表>] # 更新 DTO 包含的字段
  query: [<字段列表>] # 查询 DTO 包含的字段
auth: # 认证配置
  enabled: true/false # 是否启用认证
  defaultRoles: [<角色>] # 默认角色
features: # 功能特性
  softDelete: true/false # 软删除
  pagination: true/false # 分页
  search: true/false # 搜索
```

### 字段类型

| 类型       | 描述      | 示例                 |
| ---------- | --------- | -------------------- |
| `string`   | 字符串    | username, name       |
| `number`   | 数字      | age, price           |
| `boolean`  | 布尔值    | isActive, verified   |
| `datetime` | 日期时间  | createdAt, updatedAt |
| `text`     | 长文本    | description, content |
| `json`     | JSON 数据 | metadata, config     |
| `enum`     | 枚举      | status, type         |
| `decimal`  | 小数      | price, rate          |

## 🛠️ 命令参考

### `new <project-name>`

创建新的 Koatty 项目或组件项目。

**选项：**

- `-t, --template <template>`：模板类型: `project`（默认）| `middleware` | `plugin`
- `-d, --dir <path>`：目标目录（默认为当前目录下的 `<project-name>`）

**别名：** `project <project-name>`

**示例：**

```bash
koatty new my-app                       # 创建 Koatty 应用
koatty new my-middleware -t middleware   # 创建中间件项目
koatty new my-plugin -t plugin          # 创建插件项目
koatty new my-app -d ./workspace        # 指定目标目录
```

### 单文件模块创建命令

在 Koatty 项目中创建单个模块文件。

| 命令 | 说明 | 选项 |
|------|------|------|
| `controller [name]` | 创建 Controller | `-t http\|grpc\|websocket\|graphql` |
| `service <name>` | 创建 Service | `-i` 同时生成接口 |
| `model <name>` | 创建 Model/Entity | `-o typeorm\|thinkorm` |
| `dto <name>` | 创建 DTO 类 | |
| `middleware <name>` | 创建 Middleware | |
| `plugin <name>` | 创建 Plugin | |
| `aspect <name>` | 创建 Aspect 切面 | |
| `exception <name>` | 创建 Exception | |
| `proto <name>` | 创建 Proto 文件 | |

### `add <module-name>`（推荐）

智能创建模块，**无需先写 YAML**。交互式输入字段、API 类型、认证等，默认保存为 `<module>.yml`。

**选项：**

- `-t, --type <type>`：API 类型 `rest|grpc|graphql`，传入则跳过交互式选择

**示例：**

```bash
koatty add user                    # 交互式，按提示输入
koatty add user -t grpc            # 指定 gRPC，跳过 API 类型选择
koatty add product -t graphql     # 指定 GraphQL
```

变更生效：`koatty apply user`。重复执行 `koatty add user` 时会加载已有 `user.yml` 作为默认值。

### `generate:module <name>`

使用 CLI 标志生成模块（需提供 `--fields` JSON 或 `--config` YAML）。

**选项：**

- `--fields <json>`：JSON 格式的字段定义
- `--config <path>`：YAML 配置文件路径
- `--api <type>`：API 类型（rest/graphql）
- `--auth [roles]`：启用认证并指定默认角色
- `--soft-delete`：启用软删除
- `--pagination`：启用分页
- `--search <fields>`：可搜索字段，逗号分隔

**示例：**

```bash
koatty generate:module product \
  --fields '{"name":{"type":"string","required":true},"price":{"type":"number"}}' \
  --api rest --auth admin --soft-delete --pagination
```

### `plan`

预览将要生成的代码，不实际修改文件。

**选项：**

- `--spec <path>`：必需，规范文件路径

**示例：**

```bash
koatty plan --spec user.yml
```

### `apply [module-name]`

生成代码并应用变更。支持模块名简写。

**选项：**

- `[module-name]`：模块名，使用 `<module>.yml` 生成并应用
- `--spec <path>`：规范文件路径
- `--changeset <path>`：ChangeSet JSON 文件路径
- `--no-validate`：跳过质量检查
- `--commit`：自动提交到 Git

**示例：**

```bash
koatty apply user                  # 使用 user.yml
koatty apply --spec user.yml
koatty apply --changeset .koatty/changesets/xxx.json --validate --commit
```

### `sql2yml <sql-file>`

将 CREATE TABLE SQL 转为模块 YAML，支持 MySQL、PostgreSQL、Oracle。未知类型可交互式指定或使用 `-y` 默认为 string。

**选项：**

- `-o, --output <dir>`：YAML 输出目录
- `-d, --dialect <db>`：数据库类型 `mysql|postgres|oracle|auto`
- `--api <type>`：API 类型 `rest|grpc|graphql`
- `--auth`：启用认证
- `--no-soft-delete`：禁用软删除
- `--no-pagination`：禁用分页
- `--apply`：生成 YAML 后立即执行 apply
- `-y, --yes`：非交互模式，未知类型默认为 string

**示例：**

```bash
koatty sql2yml schema.sql
koatty sql2yml schema.sql -d postgres --apply
koatty sql2yml schema.sql -y
```

### `template`

管理模板缓存。

**子命令：**

- `template update`：更新模板缓存（从远程仓库下载）
  - `-t, --type <type>`：模板类型 `project|modules|component`（不指定则更新全部）
  - `-m, --mirror <mirror>`：镜像源 `github|gitee`（默认 `github`）
- `template status`：检查模板缓存状态

**示例：**

```bash
koatty template status
koatty template update
koatty template update -t modules -m gitee
```

## 🎯 生成的代码示例

### Controller（Koatty 4.0）

```typescript
import { KoattyContext, Controller, Autowired, GetMapping } from 'koatty';
import { App } from '../App';

@Controller('/user')
export class UserController {
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

### Service

```typescript
import { Service, Autowired } from 'koatty';
import { UserModel } from '../model/UserModel';
import { CreateUserDto, UpdateUserDto, QueryUserDto } from '../dto/UserDto';

@Service()
export class UserService {
  @Autowired()
  private userModel: UserModel;

  async findAll(query: QueryUserDto) {
    const { page = 1, pageSize = 10, ...filters } = query;
    return this.userModel.list(filters, page, pageSize);
  }

  async findById(id: number) {
    return this.userModel.get(id);
  }

  async create(dto: CreateUserDto) {
    return this.userModel.add(dto);
  }

  async update(id: number, dto: UpdateUserDto) {
    return this.userModel.update(id, dto);
  }

  async delete(id: number) {
    return this.userModel.delete(id);
  }
}
```

### Model (TypeORM Entity)

```typescript
import { Component } from 'koatty';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  BaseEntity,
} from 'typeorm';

@Component()
@Entity('users')
export class UserModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: false })
  username: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
```

### DTO

```typescript
import { IsString, IsNotEmpty, MaxLength, IsOptional, IsEmail } from 'koatty_validation';

export class CreateUserDto {
  @IsNotEmpty({ message: 'username 不能为空' })
  @IsString({ message: 'username 必须是字符串' })
  @MaxLength(50, { message: 'username 长度不能超过 50' })
  username: string;

  @IsOptional()
  @IsString({ message: 'email 必须是字符串' })
  @IsEmail({}, { message: 'email 必须是有效的邮箱地址' })
  email?: string;
}
```

### Plugin（Koatty 4.0 — 含 @OnEvent 生命周期）

```typescript
import { Plugin, IPlugin, OnEvent, AppEvent, KoattyApplication } from 'koatty';
import { App } from '../App';

@Plugin()
export class CachePlugin implements IPlugin {
  run(options: any, app: App) {
    // plugin initialization
  }

  @OnEvent(AppEvent.appReady)
  async onReady(app: KoattyApplication) {
    // execute after application is ready
  }

  @OnEvent(AppEvent.appStop)
  async onStop(app: KoattyApplication) {
    // cleanup resources
  }
}
```

### Aspect（Koatty 4.0）

```typescript
import { Aspect } from 'koatty';
import { App } from '../App';

@Aspect()
export class LoggingAspect {
  app: App;

  run() {
    // AOP aspect logic
  }
}
```

### Middleware

```typescript
import { Middleware, KoattyContext, KoattyNext } from 'koatty';

@Middleware()
export class AuthMiddleware {
  run(options: any, app: any) {
    return async (ctx: KoattyContext, next: KoattyNext) => {
      // middleware logic
      await next();
    };
  }
}
```

### Exception（Koatty 4.0）

```typescript
import { Exception, ExceptionHandler, KoattyContext } from 'koatty';

@ExceptionHandler()
export class GlobalException extends Exception {
  async handler(ctx: KoattyContext): Promise<any> {
    ctx.status = this.status;
    ctx.type = 'application/json';
    ctx.res.end(`{"code": ${this.code}, "message": "${this.message}"}`);
  }
}
```

## 🧪 代码质量保证

Koatty CLI 确保生成的代码：

- 符合项目的 **Prettier** 格式化规则
- 通过 **ESLint** 代码检查
- 通过 **TypeScript** 类型检查
- 遵循 **Koatty 4.0 框架规范**
- 使用正确的 **装饰器**和**依赖注入方式**

## 📚 示例

更多示例请参考 `packages/koatty/examples/` 目录。

## 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

## 📄 许可证

BSD-3-Clause

## 🔗 相关链接

- [Koatty 框架文档](https://koatty.org)
- [TypeORM 文档](https://typeorm.io/)

---

Made with ❤️ by the Koatty community

## AI development workflow (unreleased)

Use `koatty capabilities --json` and `koatty doctor --json` to discover the installed contract.
`plan --spec <file> --save-plan --json` produces a reviewable, project-bound plan;
`apply --plan <returned-id> --yes --json` applies it once. Check its status and run
`verify --checks types,test --json`. Verification uses installed tools and never installs dependencies.

`new <name> --template mcp|agent --offline --json` creates protocol-tested starter applications.
Bundled templates are the default; cache use is explicit. Generated applications include
`.agents/skills/koatty/`. The maintained Agent skill is [skills/koatty/SKILL.md](skills/koatty/SKILL.md).
Development MCP exposes the same plan/application operations plus capability, diagnostic and verification tools;
`koatty_docs` with `scope: framework` searches the bundled versioned skill.
`manifest --section tools --limit 20` provides bounded static discovery; unresolved declarations remain explicit.

See the monorepo migration guide `docs/migration/phase-g-ai-development.md` for changed defaults and acceptance boundaries.
