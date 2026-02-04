# Koatty CLI - 智能脚手架工具

Koatty CLI（原 koatty-ai）作为 **koatty_cli 的替代**，为 Koatty 框架提供智能代码生成：**无需先写 YAML** 即可通过 `koatty add user` 或 `kt add user` 交互/命令行快速生成 Model、DTO、Service、Controller 等；也支持 YAML/JSON 做精细配置。

## ✨ 特性

- **智能创建模块**：`koatty add user` / `kt add user` 交互式或默认配置即可生成，不必先写 YAML
- **完全符合 Koatty 框架规范**：使用 `@Service()`, `@Autowired()`, `@Get`/`@Post` 等官方推荐方式
- **支持多种代码生成**：Model, DTO, Service, Controller, Middleware, Aspect
- **TypeORM 集成**：自动生成实体类，支持软删除、时间戳等
- **数据验证**：使用 `koatty_validation` 生成带验证规则的 DTO
- **权限控制**：支持基于角色的访问控制（RBAC）
- **代码质量保证**：可选 Prettier、ESLint、TypeScript 类型检查
- **Git 集成**：可选自动提交生成的代码

---

## 📦 安装

```bash
npm install -g koatty_cli
```

安装后使用 **`koatty`** 或 **`kt`** 命令（二者等价）：

```bash
koatty add user
# 或
kt add user
```

## 🚀 快速开始（推荐：无需 YAML）

在 Koatty 项目目录下执行：

```bash
koatty add user
# 或: kt add user
```

按提示输入字段（或直接回车使用 **user** 模块的推荐默认字段）、API 路径、是否认证等，即可生成完整模块并得到预览。若希望直接写入项目：

```bash
koatty add user --apply
```

使用推荐默认配置、不交互一步生成并写入：

```bash
koatty add user -y --apply
```

自定义字段（简写格式，空格分隔）：

```bash
koatty add product --fields "name:string required price:number stock:number status:enum:draft,on_sale" --apply
```

生成后可选择将本次配置保存为 YAML，便于日后用 `plan`/`apply` 复现或修改：

```bash
koatty add order -y --apply --save-spec
# 会生成 order.yml 并写入模块代码
```

### 进阶：使用 YAML 精细配置

需要完全自定义字段、端点、权限时，可先写 YAML（例如 `user.yml`），再预览与应用：

```bash
koatty plan --spec user.yml
koatty apply --spec user.yml --validate --commit
```

YAML 示例与完整格式见下方 [规范文件格式](#-规范文件格式)。执行 `apply` 时，若项目中尚无 `doc` 脚本，会自动在 `package.json` 中增加 `doc` 脚本及依赖（typia、ts-morph、ts-patch），并创建 `scripts/generate-api-doc.ts`。

### 生成 API 文档（多协议 + Typia）

在 Koatty 项目根目录执行：

```bash
npm run doc
```

会基于 **Typia** 与各协议入口扫描，自动生成 API 文档，**兼容多种协议**：

| 协议 | 扫描装饰器/来源 | 说明 |
|------|----------------|------|
| **HTTP** | `@Controller`、`@Get` / `@Post` / `@Put` / `@Delete` / `@Patch`（[Koatty 路由](https://koatty.org/#/?id=%e8%b7%af%e7%94%b1)）及 `@GetMapping` / `@PostMapping` 等别名 | REST 路径与方法、RequestBody / `@Post()` DTO |
| **WebSocket** | `@WebSocket('/path')`、`@SubscribeMessage('event')` | 通道与事件列表 |
| **gRPC** | `@Grpc('/ServiceName/MethodName')` | 服务与方法、请求/响应类型 |
| **GraphQL** | `@Query()` / `@Mutation()` / `@Subscription()` / `@Resolver()`，以及 `**/*.graphql` 文件 | 操作与 Resolver、可选 schema 内容 |

- **输入输出**：从各模块的 DTO（`*Dto.ts`）用 Typia 生成 JSON Schema，供 HTTP/OpenAPI 及统一文档使用。
- **输出文件**：
  - `docs/openapi.json`：仅 HTTP（OpenAPI 3.0），便于 Swagger UI 等工具使用。
  - `docs/api-doc.json`：全协议统一文档（`protocols.http` / `protocols.websocket` / `protocols.grpc` / `protocols.graphql` + `components.schemas`）。

首次使用建议先安装 Typia 编译支持：

```bash
npx ts-patch install
```

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
  type: rest/graphql # API 类型，默认 rest
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

### `add <module-name>`（推荐）

智能创建模块，**无需先写 YAML**。支持交互式、默认配置、命令行字段简写。

**选项：**

- `-y, --yes`：使用该模块的推荐默认字段（user/product/order/article 等），不交互
- `--fields <spec>`：字段简写，如 `name:string username:string required email:string status:enum:active,inactive`
- `--apply`：生成后直接写入项目
- `--save-spec`：将本次配置保存为 `<module>.yml`
- `--auth [roles]`：启用认证，可选角色逗号分隔
- `--soft-delete`：启用软删除
- `--pagination`：启用分页

**示例：**

```bash
koatty add user                    # 交互式，按提示输入（可用 kt 替代 koatty）
koatty add user -y --apply         # 用 user 默认字段，直接写入
koatty add product --fields "name:string price:number" --apply
koatty add order -y --apply --save-spec   # 生成 order.yml 并写入代码
```

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

### `apply`

生成代码并应用变更。

**选项：**

- `--spec <path>`：必需，规范文件路径
- `--validate`：运行代码质量检查（默认：true）
- `--commit`：自动提交到 Git（默认：false）

**示例：**

```bash
koatty apply --spec user.yml --validate --commit
```

## 🎯 生成的代码

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

  async softDelete(id: number) {
    return this.userModel.update(id, { deletedAt: new Date() });
  }
}
```

### Controller

```typescript
import {
  Controller,
  GetMapping,
  PostMapping,
  PutMapping,
  DeleteMapping,
  PathVariable,
  RequestBody,
  Query as QueryParam,
  Autowired,
  KoattyContext,
} from 'koatty';
import { Validated } from 'koatty_validation';
import { UserService } from '../service/UserService';
import { CreateUserDto, UpdateUserDto, QueryUserDto } from '../dto/UserDto';
import { Auth, Roles } from 'koatty';

@Controller('/users')
export class UserController {
  @Autowired()
  private userService: UserService;

  ctx: KoattyContext;

  constructor(ctx: KoattyContext) {
    this.ctx = ctx;
  }

  @GetMapping('/')
  @Auth()
  @Roles(['admin'])
  async list(@QueryParam() query: QueryUserDto) {
    const data = await this.userService.findAll(query);
    return this.ok(data);
  }

  @PostMapping('/')
  @Validated()
  @Auth()
  async create(@RequestBody() dto: CreateUserDto) {
    const data = await this.userService.create(dto);
    return this.ok(data);
  }
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

### Middleware

```typescript
import { Middleware, KoattyContext, Koatty } from 'koatty';

@Middleware()
export class UserMiddleware {
  run(options: any, app: Koatty) {
    return async (ctx: KoattyContext, next: Function) => {
      console.log(`[UserMiddleware] Request: ${ctx.path}`);
      await next();
    };
  }
}
```

### Aspect

```typescript
import { Aspect, Before, After } from 'koatty';

@Aspect()
export class UserAspect {
  @Before('UserController.*')
  async beforeMethod(...args: any[]) {
    console.log('[UserAspect] Before method execution');
  }

  @After('UserController.*')
  async afterMethod(...args: any[]) {
    console.log('[UserAspect] After method execution');
  }
}
```

## 🧪 代码质量保证

Koatty AI 确保生成的代码：

- ✅ 符合项目的 **Prettier** 格式化规则
- ✅ 通过 **ESLint** 代码检查
- ✅ 通过 **TypeScript** 类型检查
- ✅ 遵循 **Koatty 框架规范**
- ✅ 使用正确的 **装饰器**和**依赖注入方式**

## 🔧 配置

Koatty AI 支持通过配置文件自定义生成行为（可选）：

```json
{
  "structure": "modular", // "standard" 或 "modular"
  "outputDir": "src",
  "testDir": "tests"
}
```

## 📚 示例

更多示例请参考 `specs/examples/` 目录：

- `user.yml` - 用户模块（包含认证、软删除、分页）
- `product.yml` - 产品模块（包含枚举、搜索）
- `order.yml` - 订单模块（包含关联关系）

## 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

## 📄 许可证

MIT

## 🔗 相关链接

- [Koatty 框架文档](https://koatty.org)
- [TypeORM 文档](https://typeorm.io/)


## 🔮 未来规划 - AI 驱动的智能开发

Koatty AI 正在从"配置驱动"升级为"对话驱动"的智能开发助手，以下是规划中的 AI 特性：

### 🤖 LLM 驱动的智能代码生成

> **目标**：通过自然语言对话自动生成代码，让开发像聊天一样简单

**核心能力**：

| 能力             | 描述                       | 示例                                               |
| ---------------- | -------------------------- | -------------------------------------------------- |
| **自然语言理解** | 理解用户意图，提取关键信息 | "新增一个用户控制器" → 自动生成 UserController     |
| **多轮对话细化** | 通过对话逐步明确需求       | "开发用户管理" → 询问字段、权限、API 等细节        |
| **智能推断**     | 根据上下文自动推断缺失信息 | "用户管理" → 推断需要 name、email、password 等字段 |
| **代码审查**     | 生成后自动检查代码质量     | 检查是否符合 Koatty 规范，提供优化建议             |

**交互示例**：

```bash
# 场景 1: 简单命令
$ koatty chat
AI: 你好！我是 Koatty AI 助手，我可以帮你生成代码。有什么需要帮助的吗？

你: 新增一个用户控制器

AI: 我将为您创建 UserController。请确认以下信息：
    - 控制器路径: /users
    - 包含方法: list, detail, create, update, remove
    是否需要调整？

你: 路径改成 /api/users

AI: 好的，已调整。正在生成...
    ✅ 已创建 src/user/controller/UserController.ts

    是否需要同时生成对应的 Service 和 Model？

你: 是

AI: 请提供 User 模块的字段信息，或者我可以为您推荐常用字段：
    - username (string, 必填)
    - email (string, 必填, 唯一)
    - password (string, 必填)
    - status (enum: active/inactive)
    使用这些字段吗？

你: 再加一个 phone 字段

AI: 好的，已添加 phone 字段。正在生成完整模块...
    ✅ 已创建 src/user/model/UserModel.ts
    ✅ 已创建 src/user/dto/UserDto.ts
    ✅ 已创建 src/user/service/UserService.ts

    生成完成！您可以运行 `npm run dev` 启动服务测试。
```

**技术架构**：

```
┌─────────────────────────────────────────────────────────┐
│                   用户交互层                        │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │   CLI 命令   │  │  Web UI     │  │  MCP API │ │
│  └─────────────┘  └─────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   LLM 编排层                        │
│  ┌─────────────────────────────────────────────────┐  │
│  │   Conversation Manager (对话管理器)            │  │
│  │   • 会话状态管理                             │  │
│  │   • 上下文维护                               │  │
│  │   • 多轮对话编排                             │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              工具调用层 (Function Calling)         │
│  • generate_module    - 生成完整模块              │
│  • create_controller  - 创建控制器                 │
│  • analyze_project    - 分析项目结构               │
│  • validate_spec     - 验证规范                   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              代码生成层 (现有)                      │
│  • Generators  • Templates  • ChangeSet           │
└─────────────────────────────────────────────────────────┘
```

### 🌐 Koatty Hub - 组件生态平台

> **目标**：建立 Koatty 框架的组件生态，让开发者能够发现、安装和分享高质量组件

**核心功能**：

| 功能     | 描述                 |
| -------- | -------------------- |
| **发现** | 浏览和搜索高质量组件 |
| **安装** | 一键安装组件到项目   |
| **贡献** | 分享自己创建的组件   |
| **评价** | 评分、评论、使用统计 |

**组件分类**：

```
Koatty Hub
├── 🏛️ 官方组件 (Official)
│   ├── koatty_core          # 核心框架
│   ├── koatty_container     # IOC 容器
│   ├── koatty_router        # 路由
│   ├── koatty_validation    # 验证
│   └── ...
│
├── 🔌 中间件 (Middleware)
│   ├── koatty-cors          # 跨域处理
│   ├── koatty-helmet        # 安全头
│   ├── koatty-ratelimit     # 限流
│   └── ...
│
├── 🔧 插件 (Plugin)
│   ├── koatty-swagger       # Swagger 文档
│   ├── koatty-graphql       # GraphQL 支持
│   └── ...
│
├── 🎯 切面 (Aspect)
│   ├── koatty-logger        # 日志切面
│   ├── koatty-metrics       # 指标切面
│   └── ...
│
├── 📦 模板 (Template)
│   ├── koatty-template-api  # REST API 项目模板
│   ├── koatty-template-grpc # gRPC 项目模板
│   └── ...
│
└── 🧩 业务组件 (Business)
    ├── koatty-auth-jwt      # JWT 认证
    ├── koatty-payment       # 支付集成
    └── ... (社区贡献)
```

**使用示例**：

```bash
# 搜索组件
$ koatty hub search jwt

📦 koatty-auth-jwt (v2.1.0) ⭐ 4.8 (128 reviews)
   JWT authentication middleware for Koatty
   Downloads: 12,345 | Category: middleware

📦 koatty-jwt-utils (v1.0.3) ⭐ 4.2 (23 reviews)
   JWT utility functions
   Downloads: 3,456 | Category: plugin

# 安装组件
$ koatty hub install koatty-auth-jwt

✓ 检测项目兼容性...
✓ 安装依赖...
✓ 配置中间件...
✓ 更新文档...
完成！现在可以使用 @UseJwt() 装饰器了

# 查看热门组件
$ koatty hub trending

# 发布自己的组件
$ koatty hub publish

流程: [验证代码] → [上传组件包] → [自动审核] → [发布上线]
```

### 📅 实施路线图

| 阶段     | 内容                  | 预计时间  |
| -------- | --------------------- | --------- |
| 阶段 1   | LLM Provider 抽象层   | 2 周      |
| 阶段 2   | Function Calling 实现 | 2 周      |
| 阶段 3   | MCP 工具集成          | 2 周      |
| 阶段 4   | 对话管理器            | 2 周      |
| 阶段 5   | Koatty Hub 前端       | 3 周      |
| 阶段 6   | Koatty Hub API        | 3 周      |
| 阶段 7   | 组件发布流程          | 2 周      |
| **合计** | **7 个阶段**          | **16 周** |


---

Made with ❤️ by the Koatty community

