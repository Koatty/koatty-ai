# Koatty-AI 智能脚手架评审与优化方案

> **版本**: 2.0  
> **更新日期**: 2024-01  
> **状态**: 评审完成，待实施

---

## 目录

1. [项目现状评审](#一项目现状评审)
2. [Koatty 框架规范符合性评审](#二koatty-框架规范符合性评审)
3. [关键架构问题发现](#三关键架构问题发现)
4. [智能化与开发效率评审](#四智能化与开发效率评审)
5. [优化方案](#五优化方案)
6. [增量生成与 Schema 驱动开发](#六增量生成与-schema-驱动开发)
7. [插件化架构设计](#七插件化架构设计)
8. [测试策略](#八测试策略)
9. [实施路线图](#九实施路线图)
10. [风险评估与缓解措施](#十风险评估与缓解措施)
11. [未来扩展特性（规划中）](#十一未来扩展特性规划中暂不实施)
    - [11.1 LLM 驱动的智能代码生成](#111-特性一llm-驱动的智能代码生成)
    - [11.2 Koatty Hub - 组件生态平台](#112-特性二koatty-hub---组件生态平台)
12. [总结](#十二总结)

---

## 一、项目现状评审

### 1.1 项目概述

**koatty-ai** 是一个为 Koatty 框架设计的智能代码生成脚手架工具，旨在通过 YAML/JSON 规范文件驱动，快速生成符合 Koatty 框架规范的 Model、DTO、Service、Controller 等代码文件。

### 1.2 当前架构

```
koatty-ai/
├── src/
│   ├── cli/                    # CLI 入口与命令
│   │   ├── index.ts
│   │   └── commands/
│   │       ├── generate.ts     # generate:module 命令
│   │       ├── plan.ts         # plan 预览命令
│   │       └── apply.ts        # apply 应用命令
│   ├── parser/                 # 配置解析
│   │   ├── SpecParser.ts
│   │   ├── FieldParser.ts
│   │   └── Validator.ts
│   ├── generators/             # 代码生成器
│   │   ├── BaseGenerator.ts
│   │   ├── ModuleGenerator.ts
│   │   ├── ModelGenerator.ts
│   │   ├── DtoGenerator.ts
│   │   ├── ServiceGenerator.ts
│   │   └── ControllerGenerator.ts
│   ├── patcher/                # AST 修改器 ⚠️ 需要移除
│   │   ├── AstPatcher.ts
│   │   ├── ModuleRegistrar.ts  # ❌ 基于 NestJS 概念
│   │   └── RouteRegistrar.ts   # ❌ 基于 NestJS 概念
│   ├── changeset/              # 变更管理
│   │   ├── ChangeSet.ts
│   │   └── FileChange.ts
│   ├── pipeline/               # 流水线
│   │   └── GeneratorPipeline.ts
│   └── utils/                  # 工具类
│       ├── QualityService.ts
│       ├── GitService.ts
│       └── FileOperator.ts
└── templates/                  # Handlebars 模板
    ├── controller/controller.hbs
    ├── service/service.hbs
    ├── model/model.hbs
    └── dto/dto.hbs
```

### 1.3 已实现功能

| 功能            | 状态      | 说明                     |
| --------------- | --------- | ------------------------ |
| YAML Spec 解析  | ✅ 已实现 | 支持基本的模块规范解析   |
| Model 生成      | ✅ 已实现 | TypeORM 实体生成         |
| DTO 生成        | ✅ 已实现 | Create/Update/Query DTO  |
| Service 生成    | ✅ 已实现 | 基础 CRUD 服务           |
| Controller 生成 | ✅ 已实现 | REST API 控制器          |
| ChangeSet 管理  | ✅ 已实现 | 变更追踪与保存           |
| AST Patching    | ⚠️ 需移除 | 基于 NestJS 概念，不兼容 |
| 代码质量检查    | ✅ 已实现 | Prettier + ESLint + TSC  |
| Git 集成        | ✅ 已实现 | 自动提交                 |

---

## 二、Koatty 框架规范符合性评审

### 2.1 符合项

| Koatty 规范              | koatty-ai 实现        | 评估                         |
| ------------------------ | --------------------- | ---------------------------- |
| @Controller 装饰器       | ✅ 模板已使用         | 符合                         |
| @Service 装饰器          | ❌ 模板缺失           | **需补充**                   |
| @GetMapping/@PostMapping | ✅ 使用 @Get/@Post    | 基本符合，建议统一           |
| TypeORM Entity           | ✅ 模板已使用         | 符合                         |
| class-validator          | ✅ DTO 使用验证装饰器 | 符合                         |
| IOC 依赖注入             | ⚠️ 构造函数注入       | 应使用 @Autowired            |
| 项目目录结构             | ⚠️ 自定义结构         | 与 koatty_cli 标准结构有差异 |

### 2.2 不符合项详细分析

#### 2.2.1 Service 装饰器缺失

**问题**: `templates/service/service.hbs` 中 Service 类没有使用 `@Service()` 装饰器。

**Koatty 规范** (文档第 974-1007 行):

```typescript
@Service()
export class TestService {
  app: App;
  // ...
}
```

**当前模板**:

```typescript
export class {{pascalCase module}}Service extends BaseService {
    // 缺少 @Service() 装饰器
}
```

**影响**: 服务类无法被 IOC 容器识别和管理。

#### 2.2.2 依赖注入方式不规范

**问题**: Controller 使用构造函数参数注入，而非 Koatty 推荐的 `@Autowired()` 装饰器。

**Koatty 规范** (文档第 988-1006 行):

```typescript
@Controller()
export class AdminController {
  @Autowired()
  testService: TestService;
}
```

**当前模板**:

```typescript
@Controller('{{api.basePath}}')
export class {{pascalCase module}}Controller extends BaseController {
    constructor(private {{camelCase module}}Service: {{pascalCase module}}Service) {
        super();
    }
}
```

#### 2.2.3 路由装饰器命名不统一

**问题**: 模板使用 `@Get/@Post` 而 Koatty 推荐 `@GetMapping/@PostMapping`。

**Koatty 规范** (文档第 525-539 行):

```typescript
@GetMapping("/test")
test(){
    ...
}
```

#### 2.2.4 项目目录结构差异

**Koatty 标准结构**:

```
src/
├── config/
├── controller/
├── service/
├── model/
├── middleware/
├── aspect/
└── App.ts
```

**koatty-ai 生成结构**:

```
src/
├── {moduleName}/
│   ├── controller/
│   ├── service/
│   ├── model/
│   └── dto/
```

**分析**: koatty-ai 采用模块化目录结构，每个模块独立一个目录。这种结构在大型项目中有优势，但与 Koatty 标准结构不同。建议提供配置选项支持两种结构。

---

## 三、关键架构问题发现

### 3.1 严重设计问题：AST Patcher 与 Koatty 框架不兼容

经过深入分析，发现项目中存在**严重的架构设计错误**：

#### 3.1.1 问题描述

**ModuleRegistrar** 和 **RouteRegistrar** 是基于 **NestJS** 框架的概念设计的，但 Koatty 框架使用完全不同的机制：

| 功能     | NestJS 方式                       | Koatty 方式                            |
| -------- | --------------------------------- | -------------------------------------- |
| 模块注册 | `@Module({ controllers: [...] })` | 不需要，IOC 自动扫描                   |
| 服务注册 | `@Module({ providers: [...] })`   | 不需要，`@Service()` 自动注册          |
| 路由配置 | 手动配置路由数组                  | `@Controller` + `@GetMapping` 自动绑定 |
| 配置文件 | `AppModule.ts`                    | 不存在此文件                           |

#### 3.1.2 Koatty 的正确机制

根据 Koatty 文档：

```typescript
// 1. 控制器通过装饰器自动注册
@Controller("/admin")
export class AdminController {
    // 路由通过方法装饰器自动绑定
    @GetMapping("/test")
    test() { ... }
}

// 2. 服务通过装饰器自动注册
@Service()
export class TestService {
    // 自动被 IOC 容器管理
}

// 3. 框架启动时自动扫描目录
// - src/controller/ 下的所有控制器
// - src/service/ 下的所有服务
// - src/model/ 下的所有模型
// - src/middleware/ 下的所有中间件
```

**关键结论**：Koatty 框架**不需要** `AppModule.ts` 文件，也**不需要**手动注册控制器和服务到模块，更**不需要**手动配置路由数组。

#### 3.1.3 当前错误实现

```typescript
// src/patcher/ModuleRegistrar.ts - ❌ 错误设计
export class ModuleRegistrar extends AstPatcher {
  public patch(appModulePath: string = 'src/AppModule.ts'): void {
    // 尝试修改不存在的 AppModule.ts
    this.modifyFile(appModulePath, (sourceFile) => {
      // 尝试添加 @Module 装饰器 - Koatty 不需要！
      this.registerInDecorator(sourceFile, 'controllers', this.controllerName);
    });
  }
}

// src/patcher/RouteRegistrar.ts - ❌ 错误设计
export class RouteRegistrar extends AstPatcher {
  protected modifier(sourceFile: SourceFile): void {
    // 尝试修改路由数组 - Koatty 不需要！
    const routesArray = this.findRoutesArray(sourceFile);
    // ...
  }
}
```

#### 3.1.4 修复方案

**必须移除的文件**：

| 文件路径                         | 原因                                        |
| -------------------------------- | ------------------------------------------- |
| `src/patcher/ModuleRegistrar.ts` | 基于 NestJS @Module 概念，Koatty 不需要     |
| `src/patcher/RouteRegistrar.ts`  | 基于手动路由配置，Koatty 使用装饰器自动绑定 |
| `tests/ModuleRegistrar.spec.ts`  | 对应的测试文件                              |
| `tests/RouteRegistrar.spec.ts`   | 对应的测试文件                              |

**需要修改的文件**：

| 文件路径                            | 修改内容                                          |
| ----------------------------------- | ------------------------------------------------- |
| `src/pipeline/GeneratorPipeline.ts` | 移除调用 ModuleRegistrar 和 RouteRegistrar 的代码 |
| `src/patcher/index.ts`              | 移除导出                                          |

**保留的功能**：

1. 代码生成器（Model, DTO, Service, Controller）
2. ChangeSet 管理（用于文件创建追踪）
3. AstPatcher 基类（可用于其他 AST 操作）
4. 代码质量检查

### 3.2 其他关键问题

#### 3.2.1 Service 模板缺少 @Service 装饰器

```typescript
// ❌ 当前错误模板
export class UserService extends BaseService {
  // 缺少 @Service() 装饰器！
}

// ✅ 正确模板
import { Service, Autowired } from 'koatty';

@Service()
export class UserService {
  @Autowired()
  private userModel: UserModel;
  // ...
}
```

#### 3.2.2 Controller 使用错误的依赖注入方式

```typescript
// ❌ 当前错误模板
@Controller('/users')
export class UserController extends BaseController {
  constructor(private userService: UserService) {
    super();
  }
}

// ✅ 正确模板
import { Controller, Autowired, KoattyContext } from 'koatty';

@Controller('/users')
export class UserController {
  @Autowired()
  private userService: UserService;

  ctx: KoattyContext;

  constructor(ctx: KoattyContext) {
    this.ctx = ctx;
  }
}
```

#### 3.2.3 路由装饰器命名不统一

```typescript
// ❌ 当前模板使用
@Get('/')
@Post('/')

// ✅ Koatty 规范使用
@GetMapping('/')
@PostMapping('/')
```

---

## 四、智能化与开发效率评审

### 4.1 当前智能化水平

| 能力           | 当前状态      | 智能化程度 |
| -------------- | ------------- | ---------- |
| 规范解析       | YAML 手动编写 | ⭐⭐ 低    |
| 代码生成       | 模板驱动      | ⭐⭐⭐ 中  |
| 智能推断       | 无            | ⭐ 无      |
| 自然语言理解   | 无            | ⭐ 无      |
| 项目上下文感知 | 有限          | ⭐⭐ 低    |
| 错误修复建议   | 无            | ⭐ 无      |

### 4.2 缺失的智能化能力

1. **自然语言输入**: 无法通过描述性语言生成模块
2. **字段类型推断**: 无法根据字段名自动推断类型
3. **关联关系识别**: 无法自动识别模块间关系
4. **代码上下文感知**: 无法分析已有代码结构
5. **最佳实践建议**: 无法提供代码优化建议
6. **错误诊断**: 无法诊断生成代码中的问题

---

## 五、优化方案

### 5.1 紧急修复项（P0）

#### 5.1.1 修复 Service 模板

**文件**: `templates/service/service.hbs`

```handlebars
{{! templates/service/service.hbs }}
import { Service, Autowired } from 'koatty'; import {
{{pascalCase module}}Model } from '../model/{{pascalCase module}}Model'; import { Create{{pascalCase
  module
}}Dto, Update{{pascalCase module}}Dto, Query{{pascalCase module}}Dto } from '../dto/{{pascalCase
  module
}}Dto'; @Service() export class
{{pascalCase module}}Service { @Autowired() private
{{camelCase module}}Model:
{{pascalCase module}}Model; /** * 分页查询 */ async findAll(query: Query{{pascalCase module}}Dto) {
const { page = 1, pageSize = 10, ...filters } = query; return this.{{camelCase
  module
}}Model.list(filters, page, pageSize); } /** * 根据 ID 查询 */ async findById(id: number) { return
this.{{camelCase module}}Model.get(id); } /** * 创建 */ async create(dto: Create{{pascalCase
  module
}}Dto) { return this.{{camelCase module}}Model.add(dto); } /** * 更新 */ async update(id: number,
dto: Update{{pascalCase module}}Dto) { return this.{{camelCase module}}Model.update(id, dto); } /**
* 删除 */ async delete(id: number) { return this.{{camelCase module}}Model.delete(id); }

{{#if features.softDelete}}
  /** * 软删除 */ async softDelete(id: number) { return this.{{camelCase module}}Model.update(id, {
  deletedAt: new Date() }); }
{{/if}}
}
```

#### 5.1.2 修复 Controller 模板

**文件**: `templates/controller/controller.hbs`

```handlebars
{{! templates/controller/controller.hbs }}
import { Controller, GetMapping, PostMapping, PutMapping, DeleteMapping, PathVariable, RequestBody,
Query as QueryParam, Autowired, KoattyContext } from 'koatty'; import { Validated } from
'koatty_validation'; import {
{{pascalCase module}}Service } from '../service/{{pascalCase module}}Service'; import { Create{{pascalCase
  module
}}Dto, Update{{pascalCase module}}Dto, Query{{pascalCase module}}Dto } from '../dto/{{pascalCase
  module
}}Dto'; @Controller('{{#if api.basePath}}{{api.basePath}}{{else}}/{{lowerCase module}}{{/if}}')
export class
{{pascalCase module}}Controller { @Autowired() private
{{camelCase module}}Service:
{{pascalCase module}}Service; ctx: KoattyContext; constructor(ctx: KoattyContext) { this.ctx = ctx;
} /** * 分页列表 */ @GetMapping('/') async list(@QueryParam() query: Query{{pascalCase module}}Dto)
{ const data = await this.{{camelCase module}}Service.findAll(query); return this.ok(data); } /** *
详情 */ @GetMapping('/:id') async detail(@PathVariable('id') id: number) { const data = await this.{{camelCase
  module
}}Service.findById(id); return this.ok(data); } /** * 创建 */ @PostMapping('/') @Validated() async
create(@RequestBody() dto: Create{{pascalCase module}}Dto) { const data = await this.{{camelCase
  module
}}Service.create(dto); return this.ok(data); } /** * 更新 */ @PutMapping('/:id') @Validated() async
update( @PathVariable('id') id: number, @RequestBody() dto: Update{{pascalCase module}}Dto ) { const
data = await this.{{camelCase module}}Service.update(id, dto); return this.ok(data); } /** * 删除 */
@DeleteMapping('/:id') async remove(@PathVariable('id') id: number) { await this.{{camelCase
  module
}}Service.{{#if features.softDelete}}softDelete{{else}}delete{{/if}}(id); return this.ok(); } }
```

#### 5.1.3 修复 Model 模板

**文件**: `templates/model/model.hbs`

```handlebars
{{! templates/model/model.hbs }}
import { Component } from 'koatty'; import { Entity, Column, PrimaryGeneratedColumn,
CreateDateColumn, UpdateDateColumn,
{{#if features.softDelete}}
  DeleteDateColumn,
{{/if}}
BaseEntity } from 'typeorm'; @Component() @Entity('{{#if table}}{{table}}{{else}}{{snakeCase
    module
  }}{{/if}}') export class
{{pascalCase module}}Model extends BaseEntity { @PrimaryGeneratedColumn() id: number;

{{#each fields}}
  {{#unless primary}}
    @Column({
    {{#if (eq type 'string')}}type: 'varchar',{{/if}}
    {{#if (eq type 'number')}}type: 'int',{{/if}}
    {{#if (eq type 'boolean')}}type: 'boolean',{{/if}}
    {{#if (eq type 'datetime')}}type: 'timestamp',{{/if}}
    {{#if (eq type 'text')}}type: 'text',{{/if}}
    {{#if (eq type 'json')}}type: 'json',{{/if}}
    {{#if (eq type 'decimal')}}type: 'decimal', precision: 10, scale: 2,{{/if}}
    {{#if (eq type 'enum')}}
      type: 'enum', enum: [{{#each values}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}}],
    {{/if}}
    {{#if unique}}unique: true,{{/if}}
    {{#if nullable}}nullable: true,{{else}}nullable: false,{{/if}}
    {{#if length}}length: {{length}},{{/if}}
    {{#if default}}default:
      {{#if (eq type 'string')}}'{{default}}'{{else}}{{default}}{{/if}},{{/if}}
    {{#if comment}}comment: '{{comment}}',{{/if}}
    })
    {{@key}}:
    {{#if (eq type 'number')}}number{{else if (eq type 'boolean')}}boolean{{else if
      (eq type 'datetime')
    }}Date{{else if (eq type 'decimal')}}number{{else if (eq type 'enum')}}{{#each
        values
      }}'{{this}}'{{#unless @last}} | {{/unless}}{{/each}}{{else}}string{{/if}};

  {{/unless}}
{{/each}}

@CreateDateColumn() createdAt: Date; @UpdateDateColumn() updatedAt: Date;

{{#if features.softDelete}}
  @DeleteDateColumn() deletedAt: Date;
{{/if}}
}
```

#### 5.1.4 修复 DTO 模板

**文件**: `templates/dto/dto.hbs`

```handlebars
{{! templates/dto/dto.hbs }}
import { Component } from 'koatty'; import { IsString, IsNumber, IsBoolean, IsOptional, IsEnum,
IsNotEmpty, MinLength, MaxLength, IsEmail, Min, Max, IsInt } from 'koatty_validation'; /** * 创建
DTO */ @Component() export class Create{{pascalCase module}}Dto {
{{#each fields}}
  {{#unless primary}}
    {{#unless auto}}
      {{#if required}}
        @IsNotEmpty({ message: '{{@key}}
        不能为空' })
      {{/if}}
      {{#if (eq type 'string')}}
        @IsString({ message: '{{@key}}
        必须是字符串' })
        {{#if (eq format 'email')}}
          @IsEmail({}, { message: '{{@key}}
          必须是有效的邮箱地址' })
        {{/if}}
        {{#if length}}
          @MaxLength({{length}}, { message: '{{@key}}
          长度不能超过
          {{length}}' })
        {{/if}}
        {{#if minLength}}
          @MinLength({{minLength}}, { message: '{{@key}}
          长度不能少于
          {{minLength}}' })
        {{/if}}
      {{/if}}
      {{#if (eq type 'number')}}
        @IsNumber({}, { message: '{{@key}}
        必须是数字' })
        {{#if min}}
          @Min({{min}}, { message: '{{@key}}
          不能小于
          {{min}}' })
        {{/if}}
        {{#if max}}
          @Max({{max}}, { message: '{{@key}}
          不能大于
          {{max}}' })
        {{/if}}
      {{/if}}
      {{#if (eq type 'boolean')}}
        @IsBoolean({ message: '{{@key}}
        必须是布尔值' })
      {{/if}}
      {{#if (eq type 'enum')}}
        @IsEnum([{{#each values}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}}], { message: '{{@key}}
        必须是有效的枚举值' })
      {{/if}}
      {{#unless required}}
        @IsOptional()
      {{/unless}}
      {{@key}}:
      {{#if (eq type 'number')}}number{{else if (eq type 'boolean')}}boolean{{else if
        (eq type 'enum')
      }}{{#each values}}'{{this}}'{{#unless @last}} | {{/unless}}{{/each}}{{else}}string{{/if}};

    {{/unless}}
  {{/unless}}
{{/each}}
} /** * 更新 DTO */ @Component() export class Update{{pascalCase module}}Dto {
{{#each fields}}
  {{#unless primary}}
    {{#unless auto}}
      {{#if (eq type 'string')}}
        @IsString({ message: '{{@key}}
        必须是字符串' })
      {{/if}}
      {{#if (eq type 'number')}}
        @IsNumber({}, { message: '{{@key}}
        必须是数字' })
      {{/if}}
      {{#if (eq type 'boolean')}}
        @IsBoolean({ message: '{{@key}}
        必须是布尔值' })
      {{/if}}
      @IsOptional()
      {{@key}}?:
      {{#if (eq type 'number')}}number{{else if (eq type 'boolean')}}boolean{{else if
        (eq type 'enum')
      }}{{#each values}}'{{this}}'{{#unless @last}} | {{/unless}}{{/each}}{{else}}string{{/if}};

    {{/unless}}
  {{/unless}}
{{/each}}
} /** * 查询 DTO */ @Component() export class Query{{pascalCase module}}Dto { @IsInt({ message:
'page 必须是整数' }) @Min(1, { message: 'page 不能小于 1' }) @IsOptional() page?: number; @IsInt({
message: 'pageSize 必须是整数' }) @Min(1, { message: 'pageSize 不能小于 1' }) @Max(100, { message:
'pageSize 不能大于 100' }) @IsOptional() pageSize?: number;

{{#each fields}}
  {{#if searchable}}
    @IsOptional()
    {{@key}}?:
    {{#if (eq type 'number')}}number{{else if (eq type 'boolean')}}boolean{{else}}string{{/if}};

  {{/if}}
{{/each}}
}
```

### 5.2 重要改进项（P1）

#### 5.2.1 支持标准 Koatty 目录结构

新增配置选项，支持两种目录结构：

```typescript
// src/types/spec.ts
export interface ProjectConfig {
  /**
   * 目录结构类型
   * - standard: src/controller/, src/service/ 等
   * - modular: src/{module}/controller/ 等
   */
  structure: 'standard' | 'modular';
}
```

#### 5.2.2 新增 Middleware 生成器

**文件**: `src/generators/MiddlewareGenerator.ts`

```typescript
export class MiddlewareGenerator extends BaseGenerator {
  public generate(): void {
    const outputPath = this.getOutputPath('middleware', 'Middleware');
    const content = this.render('middleware/middleware.hbs', this.spec);
    this.changeset.createFile(outputPath, content, `Generate Middleware for ${this.spec.module}`);
  }
}
```

**模板**: `templates/middleware/middleware.hbs`

```handlebars
{{! templates/middleware/middleware.hbs }}
import { Middleware, KoattyContext, Koatty } from 'koatty'; @Middleware() export class
{{pascalCase module}}Middleware { run(options: any, app: Koatty) { return async (ctx: KoattyContext,
next: Function) => { // Pre-processing logic console.log(`[{{pascalCase module}}Middleware] Request:
${ctx.path}`); await next(); // Post-processing logic }; } }
```

#### 5.2.3 新增 Aspect 切面生成器

**文件**: `src/generators/AspectGenerator.ts`

```typescript
export class AspectGenerator extends BaseGenerator {
  public generate(): void {
    const outputPath = this.getOutputPath('aspect', 'Aspect');
    const content = this.render('aspect/aspect.hbs', this.spec);
    this.changeset.createFile(outputPath, content, `Generate Aspect for ${this.spec.module}`);
  }
}
```

**模板**: `templates/aspect/aspect.hbs`

```handlebars
{{! templates/aspect/aspect.hbs }}
import { Aspect, Pointcut, Before, After } from 'koatty'; @Aspect() export class
{{pascalCase module}}Aspect { app: any; @Before('{{pascalCase module}}Controller.*') async
beforeMethod(...args: any[]) { console.log('[{{pascalCase module}}Aspect] Before method execution');
// AOP before logic } @After('{{pascalCase module}}Controller.*') async afterMethod(...args: any[])
{ console.log('[{{pascalCase module}}Aspect] After method execution'); // AOP after logic } }
```

### 5.3 智能化增强项（P2）

#### 5.3.1 字段类型智能推断

```typescript
// src/parser/FieldInferrer.ts
export class FieldInferrer {
  private static patterns: Map<RegExp, Partial<Field>> = new Map([
    [/^(id|Id|ID)$/, { type: 'number', primary: true, auto: true }],
    [/^.*Id$/, { type: 'number' }],
    [/^(email|mail)$/i, { type: 'string', format: 'email' }],
    [/^(phone|mobile|tel)$/i, { type: 'string', length: 20 }],
    [/^(password|passwd|pwd)$/i, { type: 'string', private: true }],
    [/^(name|title|label)$/i, { type: 'string', length: 100 }],
    [/^(description|content|body|text)$/i, { type: 'text' }],
    [/^(status|state|type)$/i, { type: 'enum', values: ['active', 'inactive'] }],
    [/^(is|has|can|should|enable).*$/i, { type: 'boolean', default: false }],
    [/^(count|num|amount|total|quantity)$/i, { type: 'number' }],
    [/^(price|cost|fee|rate)$/i, { type: 'decimal' }],
    [/^(url|link|href|src)$/i, { type: 'string', length: 500 }],
    [/^(avatar|image|photo|picture|icon)$/i, { type: 'string', length: 500 }],
    [/^(created|updated|deleted).*$/i, { type: 'datetime', auto: true }],
    [/^.*At$/, { type: 'datetime' }],
    [/^.*Date$/, { type: 'datetime' }],
    [/^.*Time$/, { type: 'datetime' }],
    [/^(config|setting|option|meta|extra|data)$/i, { type: 'json' }],
  ]);

  static infer(fieldName: string): Partial<Field> {
    for (const [pattern, fieldType] of this.patterns) {
      if (pattern.test(fieldName)) {
        return fieldType;
      }
    }
    return { type: 'string' }; // default
  }

  static inferFromShorthand(shorthand: string): Field {
    // 支持简写语法: "username:string:unique:required"
    const [name, ...modifiers] = shorthand.split(':');
    const inferred = this.infer(name);

    const field: Field = {
      name,
      type: inferred.type || 'string',
      ...inferred,
    };

    for (const mod of modifiers) {
      if (
        ['string', 'number', 'boolean', 'datetime', 'text', 'json', 'enum', 'decimal'].includes(mod)
      ) {
        field.type = mod as any;
      } else if (mod === 'unique') {
        field.unique = true;
      } else if (mod === 'required') {
        field.required = true;
      } else if (mod === 'nullable') {
        field.nullable = true;
      } else if (mod === 'private') {
        field.private = true;
      } else if (mod.startsWith('len:')) {
        field.length = parseInt(mod.split(':')[1]);
      }
    }

    return field;
  }
}
```

**使用示例**:

```bash
# 简写语法
koatty-ai g:m user --fields "username:string:unique:required,email:email,age:number,status:enum"

# 自动推断
koatty-ai g:m user --fields "username,email,passwordHash,status,createdAt"
```

#### 5.3.2 项目上下文分析器

```typescript
// src/analyzer/ProjectAnalyzer.ts
export class ProjectAnalyzer {
  private projectPath: string;

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
  }

  /**
   * 检测项目是否是 Koatty 项目
   */
  async detectKoattyProject(): Promise<boolean> {
    const packageJson = await this.readPackageJson();
    return !!(packageJson?.dependencies?.koatty || packageJson?.devDependencies?.koatty);
  }

  /**
   * 获取已存在的模块
   */
  async getExistingModules(): Promise<string[]> {
    const controllerDir = path.join(this.projectPath, 'src/controller');
    if (!fs.existsSync(controllerDir)) {
      return [];
    }

    const files = fs.readdirSync(controllerDir);
    return files
      .filter((f) => f.endsWith('Controller.ts'))
      .map((f) => f.replace('Controller.ts', ''));
  }

  /**
   * 检测数据库类型
   */
  async detectDatabaseType(): Promise<string | null> {
    const dbConfigPath = path.join(this.projectPath, 'src/config/db.ts');
    if (fs.existsSync(dbConfigPath)) {
      const content = fs.readFileSync(dbConfigPath, 'utf-8');
      if (content.includes('mysql')) return 'mysql';
      if (content.includes('postgresql') || content.includes('postgres')) return 'postgresql';
      if (content.includes('mongodb')) return 'mongodb';
      if (content.includes('sqlite')) return 'sqlite';
    }
    return null;
  }

  /**
   * 获取项目协议类型
   */
  async getProtocol(): Promise<'http' | 'grpc' | 'ws'> {
    const configPath = path.join(this.projectPath, 'src/config/config.ts');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      if (content.includes("protocol: 'grpc'")) return 'grpc';
      if (content.includes("protocol: 'ws'")) return 'ws';
    }
    return 'http';
  }
}
```

#### 5.3.3 交互式生成向导

```typescript
// src/cli/commands/interactive.ts
import inquirer from 'inquirer';

export async function interactiveGenerate() {
  const analyzer = new ProjectAnalyzer();
  const existingModules = await analyzer.getExistingModules();
  const dbType = await analyzer.detectDatabaseType();

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'moduleName',
      message: '模块名称 (如: user, product, order):',
      validate: (input) => !!input || '请输入模块名称',
    },
    {
      type: 'input',
      name: 'tableName',
      message: '数据库表名 (留空则自动生成):',
    },
    {
      type: 'editor',
      name: 'fields',
      message: '定义字段 (每行一个，格式: fieldName:type:modifier):',
      default: 'id:number:primary\nname:string:required\ncreatedAt:datetime:auto',
    },
    {
      type: 'checkbox',
      name: 'features',
      message: '选择功能特性:',
      choices: [
        { name: '软删除 (Soft Delete)', value: 'softDelete' },
        { name: '分页 (Pagination)', value: 'pagination' },
        { name: '搜索 (Search)', value: 'search' },
        { name: '审计日志 (Audit)', value: 'audit' },
      ],
    },
    {
      type: 'confirm',
      name: 'auth',
      message: '是否需要权限控制?',
      default: false,
    },
    {
      type: 'list',
      name: 'apiType',
      message: 'API 类型:',
      choices: ['REST', 'GraphQL', 'gRPC'],
      default: 'REST',
    },
    {
      type: 'confirm',
      name: 'generateTest',
      message: '是否生成单元测试?',
      default: true,
    },
  ]);

  // 根据答案构建 Spec 并执行生成
  const spec = buildSpecFromAnswers(answers);
  const pipeline = new GeneratorPipeline(spec);
  return pipeline.execute();
}
```

### 5.4 协议扩展模板（P2）

#### 5.4.1 gRPC Controller 模板

**文件**: `templates/controller/grpc-controller.hbs`

```handlebars
{{!-- templates/controller/grpc-controller.hbs --}}
import { Controller, Autowired, KoattyContext } from 'koatty';
import { Grpc } from 'koatty_serve';
import { {{pascalCase module}}Service } from '../service/{{pascalCase module}}Service';
import {
  {{pascalCase module}}Request,
  {{pascalCase module}}Response,
  {{pascalCase module}}ListRequest,
  {{pascalCase module}}ListResponse
} from '../proto/{{lowerCase module}}_pb';

@Controller()
export class {{pascalCase module}}GrpcController {
  @Autowired()
  private {{camelCase module}}Service: {{pascalCase module}}Service;

  ctx: KoattyContext;

  constructor(ctx: KoattyContext) {
    this.ctx = ctx;
  }

  /**
   * gRPC: Get{{pascalCase module}}
   */
  @Grpc('/{{pascalCase module}}Service/Get{{pascalCase module}}')
  async get{{pascalCase module}}(request: {{pascalCase module}}Request): Promise<{{pascalCase module}}Response> {
    const data = await this.{{camelCase module}}Service.findById(request.getId());

    const response = new {{pascalCase module}}Response();
    if (data) {
      response.setId(data.id);
      {{#each fields}}
      {{#unless primary}}
      response.set{{pascalCase @key}}(data.{{@key}});
      {{/unless}}
      {{/each}}
    }
    return response;
  }

  /**
   * gRPC: List{{pascalCase module}}
   */
  @Grpc('/{{pascalCase module}}Service/List{{pascalCase module}}')
  async list{{pascalCase module}}(request: {{pascalCase module}}ListRequest): Promise<{{pascalCase module}}ListResponse> {
    const data = await this.{{camelCase module}}Service.findAll({
      page: request.getPage(),
      pageSize: request.getPagesize(),
    });

    const response = new {{pascalCase module}}ListResponse();
    response.setItemsList(data.items);
    response.setTotal(data.total);
    return response;
  }

  /**
   * gRPC: Create{{pascalCase module}}
   */
  @Grpc('/{{pascalCase module}}Service/Create{{pascalCase module}}')
  async create{{pascalCase module}}(request: {{pascalCase module}}Request): Promise<{{pascalCase module}}Response> {
    const dto = {
      {{#each fields}}
      {{#unless primary}}
      {{#unless auto}}
      {{@key}}: request.get{{pascalCase @key}}(),
      {{/unless}}
      {{/unless}}
      {{/each}}
    };

    const data = await this.{{camelCase module}}Service.create(dto);

    const response = new {{pascalCase module}}Response();
    response.setId(data.id);
    return response;
  }
}
```

#### 5.4.2 WebSocket Controller 模板

**文件**: `templates/controller/ws-controller.hbs`

```handlebars
{{! templates/controller/ws-controller.hbs }}
import { Controller, Autowired, KoattyContext } from 'koatty'; import { WebSocket } from
'koatty_serve'; import {
{{pascalCase module}}Service } from '../service/{{pascalCase module}}Service'; @Controller() export
class
{{pascalCase module}}WsController { @Autowired() private
{{camelCase module}}Service:
{{pascalCase module}}Service; ctx: KoattyContext; constructor(ctx: KoattyContext) { this.ctx = ctx;
} /** * WebSocket: 获取列表 */ @WebSocket('/{{lowerCase module}}/list') async list(data: any) {
const result = await this.{{camelCase module}}Service.findAll(data); return { event: '{{lowerCase
  module
}}:list', data: result, }; } /** * WebSocket: 获取详情 */ @WebSocket('/{{lowerCase module}}/detail')
async detail(data: { id: number }) { const result = await this.{{camelCase
  module
}}Service.findById(data.id); return { event: '{{lowerCase module}}:detail', data: result, }; } /** *
WebSocket: 创建 */ @WebSocket('/{{lowerCase module}}/create') async create(data: any) { const result
= await this.{{camelCase module}}Service.create(data); return { event: '{{lowerCase
  module
}}:created', data: result, }; } /** * WebSocket: 订阅更新 */ @WebSocket('/{{lowerCase
  module
}}/subscribe') async subscribe(data: { id: number }) { // 返回订阅确认 return { event: '{{lowerCase
  module
}}:subscribed', data: { id: data.id }, }; } }
```

### 5.5 测试生成器（P2）

**文件**: `src/generators/TestGenerator.ts`

```typescript
export class TestGenerator extends BaseGenerator {
  public generate(): void {
    const outputPath = `tests/${this.spec.module.toLowerCase()}/${this.spec.module}.test.ts`;
    const content = this.render('test/test.hbs', this.spec);
    this.changeset.createFile(outputPath, content, `Generate Tests for ${this.spec.module}`);
  }
}
```

**模板**: `templates/test/test.hbs`

```handlebars
{{! templates/test/test.hbs }}
import request from 'supertest'; import { ExecBootStrap } from 'koatty'; import { App } from
'../../src/App'; describe('{{pascalCase module}}
API Tests', () => { let server: any; let testId: number; beforeAll(async () => { const appInstance =
await ExecBootStrap()(App); server = appInstance.callback(); }); describe('POST
{{#if api.basePath}}{{api.basePath}}{{else}}/{{lowerCase module}}{{/if}}', () => { it('should create
a new
{{lowerCase module}}', async () => { const response = await request(server) .post('{{#if
  api.basePath
}}{{api.basePath}}{{else}}/{{lowerCase module}}{{/if}}') .send({
{{#each fields}}
  {{#unless primary}}
    {{#unless auto}}
      {{@key}}:
      {{#if (eq type 'string')}}'test_{{@key}}'{{else if (eq type 'number')}}1{{else if
        (eq type 'boolean')
      }}true{{else}}'test'{{/if}},
    {{/unless}}
  {{/unless}}
{{/each}}
}); expect(response.status).toBe(200); expect(response.body.code).toBe(0); testId =
response.body.data.id; }); }); describe('GET
{{#if api.basePath}}{{api.basePath}}{{else}}/{{lowerCase module}}{{/if}}', () => { it('should list
all
{{lowerCase module}}s', async () => { const response = await request(server) .get('{{#if
  api.basePath
}}{{api.basePath}}{{else}}/{{lowerCase module}}{{/if}}'); expect(response.status).toBe(200);
expect(response.body.code).toBe(0); expect(Array.isArray(response.body.data.items)).toBe(true); });
}); describe('GET
{{#if api.basePath}}{{api.basePath}}{{else}}/{{lowerCase module}}{{/if}}/:id', () => { it('should
get
{{lowerCase module}}
by id', async () => { const response = await request(server) .get(`{{#if
  api.basePath
}}{{api.basePath}}{{else}}/{{lowerCase module}}{{/if}}/${testId}`);
expect(response.status).toBe(200); expect(response.body.code).toBe(0); }); }); describe('PUT
{{#if api.basePath}}{{api.basePath}}{{else}}/{{lowerCase module}}{{/if}}/:id', () => { it('should
update
{{lowerCase module}}', async () => { const response = await request(server) .put(`{{#if
  api.basePath
}}{{api.basePath}}{{else}}/{{lowerCase module}}{{/if}}/${testId}`) .send({
{{#each fields}}
  {{#unless primary}}
    {{#unless auto}}
      {{@key}}:
      {{#if (eq type 'string')}}'updated_{{@key}}'{{else if (eq type 'number')}}2{{else if
        (eq type 'boolean')
      }}false{{else}}'updated'{{/if}},
    {{/unless}}
  {{/unless}}
{{/each}}
}); expect(response.status).toBe(200); expect(response.body.code).toBe(0); }); }); describe('DELETE
{{#if api.basePath}}{{api.basePath}}{{else}}/{{lowerCase module}}{{/if}}/:id', () => { it('should
delete
{{lowerCase module}}', async () => { const response = await request(server) .delete(`{{#if
  api.basePath
}}{{api.basePath}}{{else}}/{{lowerCase module}}{{/if}}/${testId}`);
expect(response.status).toBe(200); expect(response.body.code).toBe(0); }); }); });
```

---

## 六、增量生成与 Schema 驱动开发

### 6.1 问题场景

在开发 **gRPC**、**GraphQL** 等有 schema 的协议应用时，新增 API 的标准流程是：

1. 修改 `.proto` 或 `.graphql` schema 文件
2. 重新生成代码模板
3. **关键要求**：不能覆盖现有的 API 实现，只添加新的 API

### 6.2 当前问题

**当前实现**：全量覆盖生成

```typescript
// 每次生成都是全新文件，直接覆盖
this.changeset.createFile(outputPath, content, `Generate Controller for ${this.spec.module}`);
```

**问题**：

- 会覆盖已有的业务逻辑代码
- 无法识别哪些方法是新增的
- 不支持增量更新

### 6.3 解决方案：增量生成引擎

#### 6.3.1 架构设计

```
Schema 变更检测 → 代码差异分析 → 增量生成 → 智能合并
```

#### 6.3.2 核心组件

**1. Schema 变更检测器 (SchemaDiffDetector)**

```typescript
// src/diff/SchemaDiffDetector.ts
export interface SchemaChange {
  type: 'added' | 'removed' | 'modified';
  name: string;
  category: 'endpoint' | 'field' | 'type';
  oldDefinition?: any;
  newDefinition?: any;
}

export class SchemaDiffDetector {
  /**
   * 对比新旧 schema，识别变更
   */
  static detectChanges(oldSchema: Spec, newSchema: Spec): SchemaChange[] {
    const changes: SchemaChange[] = [];

    // 检测新增的 API 端点
    const oldEndpoints = new Set(oldSchema.api?.endpoints?.map((e) => e.action) || []);
    const newEndpoints = new Set(newSchema.api?.endpoints?.map((e) => e.action) || []);

    for (const endpoint of newEndpoints) {
      if (!oldEndpoints.has(endpoint)) {
        changes.push({
          type: 'added',
          name: endpoint,
          category: 'endpoint',
          newDefinition: newSchema.api?.endpoints?.find((e) => e.action === endpoint),
        });
      }
    }

    // 检测删除的 API
    for (const endpoint of oldEndpoints) {
      if (!newEndpoints.has(endpoint)) {
        changes.push({
          type: 'removed',
          name: endpoint,
          category: 'endpoint',
          oldDefinition: oldSchema.api?.endpoints?.find((e) => e.action === endpoint),
        });
      }
    }

    // 检测字段变更
    const oldFields = Object.keys(oldSchema.fields || {});
    const newFields = Object.keys(newSchema.fields || {});

    for (const field of newFields) {
      if (!oldFields.includes(field)) {
        changes.push({
          type: 'added',
          name: field,
          category: 'field',
          newDefinition: newSchema.fields[field],
        });
      }
    }

    // 检测字段修改
    for (const field of oldFields) {
      if (newFields.includes(field)) {
        const oldDef = JSON.stringify(oldSchema.fields[field]);
        const newDef = JSON.stringify(newSchema.fields[field]);
        if (oldDef !== newDef) {
          changes.push({
            type: 'modified',
            name: field,
            category: 'field',
            oldDefinition: oldSchema.fields[field],
            newDefinition: newSchema.fields[field],
          });
        }
      }
    }

    return changes;
  }
}
```

**2. 代码解析器 (CodeParser)**

```typescript
// src/parser/CodeParser.ts
import { Project, SourceFile, MethodDeclaration, ClassDeclaration } from 'ts-morph';

export interface ParsedMethod {
  name: string;
  signature: string;
  body: string;
  decorators: string[];
  parameters: string[];
  returnType?: string;
  startLine: number;
  endLine: number;
  isCustom: boolean; // 是否包含自定义业务逻辑
}

export class CodeParser {
  private project: Project;

  constructor() {
    this.project = new Project({
      compilerOptions: { experimentalDecorators: true },
    });
  }

  /**
   * 解析现有 Controller 文件，提取所有方法
   */
  parseController(filePath: string): ParsedMethod[] {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const sourceFile = this.project.addSourceFileAtPath(filePath);
    const classDecl = sourceFile.getClasses()[0];

    if (!classDecl) return [];

    return classDecl.getMethods().map((method) => ({
      name: method.getName(),
      signature: this.getMethodSignature(method),
      body: method.getBody()?.getText() || '',
      decorators: method.getDecorators().map((d) => d.getName()),
      parameters: method.getParameters().map((p) => p.getText()),
      returnType: method.getReturnType()?.getText(),
      startLine: method.getStartLineNumber(),
      endLine: method.getEndLineNumber(),
      isCustom: this.containsCustomLogic(method.getBody()?.getText() || ''),
    }));
  }

  /**
   * 检查方法是否包含自定义业务逻辑
   */
  private containsCustomLogic(body: string): boolean {
    // 模板代码模式
    const templatePatterns = [
      /return\s+this\.ok\(.*\);?\s*$/,
      /await\s+this\.\w+Service\.(findAll|findById|create|update|delete|softDelete)\(/,
    ];

    // 自定义代码模式
    const customPatterns = [
      /if\s*\(/,
      /for\s*\(/,
      /while\s*\(/,
      /switch\s*\(/,
      /try\s*\{/,
      /throw\s+/,
      /\.then\s*\(/,
      /await\s+(?!this\.\w+Service\.(findAll|findById|create|update|delete|softDelete))/,
    ];

    // 如果匹配自定义模式，则认为包含自定义逻辑
    return customPatterns.some((pattern) => pattern.test(body));
  }

  private getMethodSignature(method: MethodDeclaration): string {
    const name = method.getName();
    const params = method
      .getParameters()
      .map((p) => p.getText())
      .join(', ');
    const returnType = method.getReturnType()?.getText() || 'any';
    return `async ${name}(${params}): ${returnType}`;
  }
}
```

**3. 增量生成器 (IncrementalGenerator)**

```typescript
// src/generators/IncrementalControllerGenerator.ts
import { BaseGenerator } from './BaseGenerator';
import { CodeParser, ParsedMethod } from '../parser/CodeParser';
import { SchemaDiffDetector, SchemaChange } from '../diff/SchemaDiffDetector';

export class IncrementalControllerGenerator extends BaseGenerator {
  private codeParser: CodeParser;

  constructor(
    spec: Spec,
    changeset: ChangeSet,
    private oldSpec?: Spec
  ) {
    super(spec, changeset);
    this.codeParser = new CodeParser();
  }

  /**
   * 增量生成 Controller
   */
  public generate(): void {
    const outputPath = this.getOutputPath('controller', 'Controller');

    // 如果文件不存在，使用全量生成
    if (!fs.existsSync(outputPath)) {
      return super.generate();
    }

    const existingMethods = this.codeParser.parseController(outputPath);

    // 检测 schema 变更
    const changes = this.oldSpec ? SchemaDiffDetector.detectChanges(this.oldSpec, this.spec) : [];

    // 只处理新增的端点
    const addedEndpoints = changes.filter((c) => c.type === 'added' && c.category === 'endpoint');

    if (addedEndpoints.length === 0) {
      console.log('No new endpoints detected, skipping generation.');
      return;
    }

    // 生成新方法的代码
    const newMethodsCode = this.generateNewMethods(addedEndpoints, existingMethods);

    // 合并到现有文件
    const existingContent = fs.readFileSync(outputPath, 'utf-8');
    const mergedContent = this.mergeIntoClass(existingContent, newMethodsCode);

    this.changeset.modifyFile(
      outputPath,
      mergedContent,
      existingContent,
      `Incrementally add ${addedEndpoints.length} methods to ${this.spec.module}Controller`
    );
  }

  private generateNewMethods(changes: SchemaChange[], existingMethods: ParsedMethod[]): string {
    const existingMethodNames = new Set(existingMethods.map((m) => m.name));
    const newMethods: string[] = [];

    for (const change of changes) {
      if (!change.newDefinition) continue;

      const endpoint = change.newDefinition;
      const methodName = endpoint.action;

      // 跳过已存在的方法
      if (existingMethodNames.has(methodName)) {
        console.log(`Method "${methodName}" already exists, skipping.`);
        continue;
      }

      // 生成方法代码
      const methodCode = this.renderMethodTemplate(endpoint);
      newMethods.push(methodCode);
    }

    return newMethods.join('\n\n');
  }

  private renderMethodTemplate(endpoint: any): string {
    const httpMethod = endpoint.method || 'Get';
    const path = endpoint.path || '/';
    const methodName = endpoint.action;

    return `
  /**
   * ${endpoint.description || methodName}
   * @generated - 由 koatty-ai 自动生成
   */
  @${httpMethod}Mapping('${path}')
  ${endpoint.auth ? '@Auth()' : ''}
  async ${methodName}(@RequestBody() dto: any) {
    // TODO: Implement ${methodName}
    const result = await this.${this.toCamelCase(this.spec.module)}Service.${methodName}(dto);
    return this.ok(result);
  }`;
  }

  private mergeIntoClass(existingContent: string, newMethods: string): string {
    // 找到类的结束位置（最后一个 }）
    const lastBraceIndex = existingContent.lastIndexOf('}');
    if (lastBraceIndex === -1) {
      throw new Error('Invalid class structure');
    }

    // 在类结束前插入新方法
    return (
      existingContent.slice(0, lastBraceIndex) +
      '\n' +
      newMethods +
      '\n' +
      existingContent.slice(lastBraceIndex)
    );
  }
}
```

### 6.4 Proto/GraphQL Schema 解析器

```typescript
// src/parser/ProtoParser.ts
export interface ProtoMethod {
  name: string;
  requestType: string;
  responseType: string;
  isStreaming: boolean;
}

export interface ProtoDefinition {
  serviceName: string;
  methods: ProtoMethod[];
}

export class ProtoParser {
  /**
   * 解析 .proto 文件，提取 service 和 rpc 定义
   */
  static parseProto(filePath: string): ProtoDefinition {
    const content = fs.readFileSync(filePath, 'utf-8');

    // 提取 service 定义
    const serviceMatch = content.match(/service\s+(\w+)\s*\{([^}]+)\}/);
    if (!serviceMatch) {
      throw new Error('No service definition found in proto file');
    }

    const serviceName = serviceMatch[1];
    const serviceBody = serviceMatch[2];

    // 提取 rpc 方法
    const rpcMatches = serviceBody.matchAll(
      /rpc\s+(\w+)\s*\(\s*(stream\s+)?(\w+)\s*\)\s+returns\s*\(\s*(stream\s+)?(\w+)\s*\)/g
    );

    const methods: ProtoMethod[] = Array.from(rpcMatches).map((match) => ({
      name: match[1],
      requestType: match[3],
      responseType: match[5],
      isStreaming: !!(match[2] || match[4]),
    }));

    return { serviceName, methods };
  }
}

// src/parser/GraphQLParser.ts
export interface GraphQLField {
  name: string;
  args: { name: string; type: string }[];
  returnType: string;
}

export interface GraphQLDefinition {
  queries: GraphQLField[];
  mutations: GraphQLField[];
  subscriptions: GraphQLField[];
}

export class GraphQLParser {
  /**
   * 解析 .graphql 文件
   */
  static parseGraphQL(filePath: string): GraphQLDefinition {
    const content = fs.readFileSync(filePath, 'utf-8');

    return {
      queries: this.parseTypeFields(content, 'Query'),
      mutations: this.parseTypeFields(content, 'Mutation'),
      subscriptions: this.parseTypeFields(content, 'Subscription'),
    };
  }

  private static parseTypeFields(content: string, typeName: string): GraphQLField[] {
    const typeMatch = content.match(new RegExp(`type\\s+${typeName}\\s*\\{([^}]+)\\}`));
    if (!typeMatch) return [];

    const fieldMatches = typeMatch[1].matchAll(/(\w+)\s*(?:\(([^)]*)\))?\s*:\s*(\[?\w+!?\]?!?)/g);

    return Array.from(fieldMatches).map((match) => ({
      name: match[1],
      args: this.parseArgs(match[2] || ''),
      returnType: match[3],
    }));
  }

  private static parseArgs(argsStr: string): { name: string; type: string }[] {
    if (!argsStr.trim()) return [];

    const argMatches = argsStr.matchAll(/(\w+)\s*:\s*(\w+!?)/g);
    return Array.from(argMatches).map((match) => ({
      name: match[1],
      type: match[2],
    }));
  }
}
```

### 6.5 保护策略

#### 6.5.1 业务逻辑保护标记

```typescript
// 在生成的代码中添加保护标记
@Controller('/users')
export class UserController {
  // ===== KOATTY-AI:GENERATED:START - getUser =====
  // 此部分由 koatty-ai 生成，可被覆盖
  @GetMapping('/:id')
  async getUser(@PathVariable('id') id: string) {
    return this.ok(await this.userService.findById(id));
  }
  // ===== KOATTY-AI:GENERATED:END - getUser =====

  // ===== KOATTY-AI:CUSTOM:START - customAction =====
  // 此部分为自定义代码，不会被覆盖
  @PostMapping('/custom-action')
  async customAction(@RequestBody() data: any) {
    // 复杂的业务逻辑...
  }
  // ===== KOATTY-AI:CUSTOM:END - customAction =====
}
```

#### 6.5.2 变更预览 (Plan Mode)

```bash
# 预览将要生成的变更
koatty-ai plan --proto ./proto/user.proto --incremental

# 输出：
# 📋 Schema Changes Detected:
#   ✨ Added: UpdateUser
#   🗑️  Removed: DeleteUser
#   📝 Modified: GetUser (参数变更)
#
# 📝 Files to be modified:
#   ~ src/user/controller/UserController.ts (新增 UpdateUser 方法)
#   ~ src/user/dto/UpdateUserDto.ts (新建)
#   ~ src/user/service/UserService.ts (新增 update 方法)
#
# ⚠️  Protected Methods (不会被覆盖):
#   - customAction
```

### 6.6 边缘情况处理

| 场景         | 处理策略                                 |
| ------------ | ---------------------------------------- |
| 方法签名变更 | 生成新方法，保留旧方法并添加 @deprecated |
| 字段类型变更 | 警告用户，不自动修改                     |
| 方法删除     | 不删除，添加 @deprecated 注释            |
| 装饰器变更   | 保留用户自定义装饰器，仅更新生成的装饰器 |
| 循环依赖     | 检测并警告                               |

---

## 七、插件化架构设计

### 7.1 架构目标

1. **独立项目生成**: 支持创建独立的 middleware/plugin 项目（可发布到 npm）
2. **模板系统**: 支持从远程仓库拉取模板，支持多版本
3. **社区扩展**: 允许第三方贡献模板和生成器
4. **模板市场**: 支持模板发现、安装、更新

### 7.2 核心组件设计

#### 7.2.1 模板管理器 (TemplateManager)

```typescript
// src/template/TemplateManager.ts
import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';
import { execSync } from 'child_process';

export interface TemplateConfig {
  name: string;
  description: string;
  version: string;
  author: string;
  type: 'project' | 'module' | 'component' | 'generator';
  repository: {
    github?: string;
    gitee?: string;
    npm?: string;
  };
  tags: string[];
  koattyVersion: string;
}

export interface Template {
  name: string;
  config: TemplateConfig;
  localPath: string;
  version: string;
}

export class TemplateManager {
  private templatesDir: string;
  private registryPath: string;
  private registry: Map<string, TemplateConfig>;

  constructor() {
    this.templatesDir = path.join(
      process.env.HOME || process.env.USERPROFILE || '',
      '.koatty-ai',
      'templates'
    );
    this.registryPath = path.join(this.templatesDir, 'registry.json');
    this.registry = new Map();
    this.loadRegistry();
  }

  /**
   * 从 Git 仓库安装模板
   */
  async installFromGit(url: string, name?: string): Promise<Template> {
    const templateName = name || this.extractNameFromUrl(url);
    const localPath = path.join(this.templatesDir, templateName);

    const git = simpleGit();

    if (fs.existsSync(localPath)) {
      // 更新现有模板
      await git.cwd(localPath).pull();
    } else {
      // 克隆新模板
      fs.mkdirSync(this.templatesDir, { recursive: true });
      await git.clone(url, localPath);
    }

    // 读取模板配置
    const configPath = path.join(localPath, 'koatty-ai.json');
    if (!fs.existsSync(configPath)) {
      throw new Error(`Template ${templateName} missing koatty-ai.json`);
    }

    const config: TemplateConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    this.registry.set(templateName, config);
    this.saveRegistry();

    return {
      name: templateName,
      config,
      localPath,
      version: config.version,
    };
  }

  /**
   * 从 npm 安装模板
   */
  async installFromNpm(packageName: string): Promise<Template> {
    const localPath = path.join(this.templatesDir, 'npm', packageName);

    fs.mkdirSync(localPath, { recursive: true });
    execSync(`npm install ${packageName} --prefix ${localPath}`, {
      stdio: 'pipe',
    });

    const configPath = path.join(localPath, 'node_modules', packageName, 'koatty-ai.json');

    if (!fs.existsSync(configPath)) {
      throw new Error(`Package ${packageName} is not a valid koatty-ai template`);
    }

    const config: TemplateConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    this.registry.set(packageName, config);
    this.saveRegistry();

    return {
      name: packageName,
      config,
      localPath: path.join(localPath, 'node_modules', packageName),
      version: config.version,
    };
  }

  /**
   * 列出所有已安装的模板
   */
  listTemplates(type?: string): Template[] {
    return Array.from(this.registry.entries())
      .filter(([, config]) => !type || config.type === type)
      .map(([name, config]) => ({
        name,
        config,
        localPath: path.join(this.templatesDir, name),
        version: config.version,
      }));
  }

  /**
   * 更新模板
   */
  async updateTemplate(name: string): Promise<Template> {
    const config = this.registry.get(name);
    if (!config) {
      throw new Error(`Template ${name} not found`);
    }

    const url = config.repository.github || config.repository.gitee;
    if (!url) {
      throw new Error(`Template ${name} has no repository URL`);
    }

    return this.installFromGit(url, name);
  }

  /**
   * 卸载模板
   */
  uninstallTemplate(name: string): void {
    const localPath = path.join(this.templatesDir, name);
    if (fs.existsSync(localPath)) {
      fs.rmSync(localPath, { recursive: true, force: true });
    }

    this.registry.delete(name);
    this.saveRegistry();
  }

  private loadRegistry(): void {
    if (fs.existsSync(this.registryPath)) {
      const data = JSON.parse(fs.readFileSync(this.registryPath, 'utf-8'));
      Object.entries(data).forEach(([name, config]) => {
        this.registry.set(name, config as TemplateConfig);
      });
    }
  }

  private saveRegistry(): void {
    const data = Object.fromEntries(this.registry);
    fs.mkdirSync(path.dirname(this.registryPath), { recursive: true });
    fs.writeFileSync(this.registryPath, JSON.stringify(data, null, 2));
  }

  private extractNameFromUrl(url: string): string {
    const match = url.match(/\/([^\/]+?)(?:\.git)?$/);
    return match ? match[1] : 'unknown';
  }
}
```

### 7.3 CLI 命令扩展

```typescript
// src/cli/commands/template.ts
export function registerTemplateCommands(program: Command) {
  const templateCmd = program.command('template').description('Manage koatty-ai templates');

  // 安装模板
  templateCmd
    .command('install <source>')
    .description('Install a template from git/npm')
    .option('-n, --name <name>', 'Template name')
    .option('-t, --type <type>', 'Source type: git|npm', 'git')
    .action(async (source, options) => {
      const manager = new TemplateManager();
      const template =
        options.type === 'npm'
          ? await manager.installFromNpm(source)
          : await manager.installFromGit(source, options.name);
      console.log(`Template "${template.name}" installed successfully`);
    });

  // 列出模板
  templateCmd
    .command('list')
    .alias('ls')
    .description('List installed templates')
    .action(() => {
      const manager = new TemplateManager();
      const templates = manager.listTemplates();
      templates.forEach((t) => {
        console.log(`${t.name} v${t.version} - ${t.config.description}`);
      });
    });

  // 更新模板
  templateCmd
    .command('update <name>')
    .description('Update an installed template')
    .action(async (name) => {
      const manager = new TemplateManager();
      const template = await manager.updateTemplate(name);
      console.log(`Template "${template.name}" updated to v${template.version}`);
    });

  // 卸载模板
  templateCmd
    .command('uninstall <name>')
    .alias('rm')
    .description('Uninstall a template')
    .action((name) => {
      const manager = new TemplateManager();
      manager.uninstallTemplate(name);
      console.log(`Template "${name}" uninstalled`);
    });
}
```

### 7.4 模板配置文件标准

```json
{
  "name": "koatty-middleware-template",
  "description": "Koatty Middleware Project Template",
  "version": "1.0.0",
  "author": "Koatty Team",
  "type": "component",
  "repository": {
    "github": "https://github.com/Koatty/koatty_template_component.git",
    "gitee": "https://gitee.com/richenlin/koatty_template_component.git"
  },
  "tags": ["middleware", "koatty", "typescript"],
  "koattyVersion": ">=3.0.0",

  "files": [
    { "source": "package.json", "target": "package.json" },
    { "source": "tsconfig.json", "target": "tsconfig.json" },
    { "source": "src/middleware.ts", "target": "src/{{Name}}Middleware.ts" },
    { "source": "src/index.ts", "target": "src/index.ts" },
    { "source": "README.md", "target": "README.md" }
  ],

  "variables": {
    "name": { "default": "", "description": "Project name", "required": true },
    "description": { "default": "A koatty middleware", "description": "Project description" },
    "author": { "default": "", "description": "Author name" },
    "license": { "default": "MIT", "description": "License type" }
  },

  "postCreate": {
    "message": "🎉 Middleware project '{{name}}' created!\n\nTo use:\n  cd {{name}}\n  npm install\n  npm publish"
  }
}
```

---

## 八、测试策略

### 8.1 测试分层

| 层级       | 测试类型          | 目标        | 工具           |
| ---------- | ----------------- | ----------- | -------------- |
| 单元测试   | Unit Tests        | 单个类/函数 | Jest           |
| 集成测试   | Integration Tests | 模块间交互  | Jest           |
| 端到端测试 | E2E Tests         | 完整流程    | Jest + execa   |
| 快照测试   | Snapshot Tests    | 模板输出    | Jest snapshots |

### 8.2 测试用例设计

#### 8.2.1 生成器测试

```typescript
// tests/generators/ServiceGenerator.spec.ts
describe('ServiceGenerator', () => {
  it('should generate service with @Service decorator', () => {
    const spec: Spec = {
      module: 'User',
      fields: { name: { type: 'string' } },
    };

    const generator = new ServiceGenerator(spec, new ChangeSet('test'));
    generator.generate();

    const content = generator.getChangeset().getChanges()[0].content;

    expect(content).toContain('@Service()');
    expect(content).toContain('export class UserService');
    expect(content).toContain('@Autowired()');
  });

  it('should include softDelete method when feature enabled', () => {
    const spec: Spec = {
      module: 'User',
      fields: {},
      features: { softDelete: true },
    };

    const generator = new ServiceGenerator(spec, new ChangeSet('test'));
    generator.generate();

    const content = generator.getChangeset().getChanges()[0].content;

    expect(content).toContain('async softDelete(id: number)');
  });
});
```

#### 8.2.2 模板快照测试

```typescript
// tests/templates/controller.snapshot.spec.ts
describe('Controller Template Snapshots', () => {
  it('should match snapshot for basic controller', () => {
    const spec: Spec = {
      module: 'Product',
      fields: {
        name: { type: 'string', required: true },
        price: { type: 'number' },
      },
      api: { basePath: '/api/products' },
    };

    const generator = new ControllerGenerator(spec, new ChangeSet('test'));
    generator.generate();

    const content = generator.getChangeset().getChanges()[0].content;

    expect(content).toMatchSnapshot();
  });
});
```

#### 8.2.3 端到端测试

```typescript
// tests/e2e/generate-module.spec.ts
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('E2E: generate module', () => {
  const testDir = path.join(__dirname, 'temp');

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should generate all module files', () => {
    const specPath = path.join(testDir, 'user.yaml');
    fs.writeFileSync(
      specPath,
      `
module: User
table: users
fields:
  name:
    type: string
    required: true
  email:
    type: string
    format: email
`
    );

    execSync(`koatty-ai generate:module -f ${specPath}`, {
      cwd: testDir,
    });

    // 验证生成的文件
    expect(fs.existsSync(path.join(testDir, 'src/user/model/UserModel.ts'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'src/user/service/UserService.ts'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'src/user/controller/UserController.ts'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'src/user/dto/UserDto.ts'))).toBe(true);
  });
});
```

### 8.3 测试覆盖率目标

| 模块          | 目标覆盖率 |
| ------------- | ---------- |
| generators/   | ≥ 90%      |
| parser/       | ≥ 85%      |
| template/     | ≥ 80%      |
| cli/commands/ | ≥ 75%      |
| utils/        | ≥ 80%      |

---

## 九、实施路线图

### Phase 0: 紧急修复（3-5 天）

**优先级：最高 - 当前代码无法与 Koatty 框架正常工作**

| 任务                    | 预计时间 | 优先级 |
| ----------------------- | -------- | ------ |
| 移除 ModuleRegistrar 类 | 2h       | P0     |
| 移除 RouteRegistrar 类  | 2h       | P0     |
| 修复 Service 模板       | 4h       | P0     |
| 修复 Controller 模板    | 4h       | P0     |
| 修复 Model 模板         | 2h       | P0     |
| 修复 DTO 模板           | 4h       | P0     |
| 更新 GeneratorPipeline  | 2h       | P0     |
| 更新相关测试            | 4h       | P0     |
| 验证生成代码正确性      | 4h       | P0     |

**具体文件修改清单**：

```
删除:
- src/patcher/ModuleRegistrar.ts
- src/patcher/RouteRegistrar.ts
- tests/ModuleRegistrar.spec.ts
- tests/RouteRegistrar.spec.ts

修改:
- src/pipeline/GeneratorPipeline.ts
  - 移除 ModuleRegistrar 调用
  - 移除 RouteRegistrar 调用
- src/patcher/index.ts
  - 移除导出
- templates/service/service.hbs
  - 添加 @Service() 装饰器
  - 使用 @Autowired()
- templates/controller/controller.hbs
  - 使用 @Autowired() 替代构造函数注入
  - 使用 @GetMapping/@PostMapping
- templates/model/model.hbs
  - 添加 @Component() 装饰器
- templates/dto/dto.hbs
  - 使用 koatty_validation 装饰器
```

### Phase 1: 规范完善（1 周）

| 任务                         | 预计时间 | 优先级 |
| ---------------------------- | -------- | ------ |
| 支持标准 Koatty 目录结构     | 8h       | P1     |
| 增强 DTO 验证规则            | 4h       | P1     |
| 添加 @Validated() 装饰器支持 | 2h       | P1     |
| 完善错误处理                 | 4h       | P1     |
| 更新文档                     | 4h       | P1     |

### Phase 2: 功能增强（2-3 周）

| 任务                      | 预计时间 | 优先级 |
| ------------------------- | -------- | ------ |
| Middleware 生成器         | 8h       | P1     |
| Aspect 切面生成器         | 8h       | P1     |
| Test 生成器               | 8h       | P2     |
| gRPC Controller 模板      | 8h       | P2     |
| WebSocket Controller 模板 | 8h       | P2     |
| CLI 输出美化              | 4h       | P2     |

### Phase 3: 增量生成（2 周）

| 任务                   | 预计时间 | 优先级 |
| ---------------------- | -------- | ------ |
| SchemaDiffDetector     | 16h      | P2     |
| CodeParser (ts-morph)  | 16h      | P2     |
| IncrementalGenerator   | 16h      | P2     |
| Proto 文件解析         | 8h       | P2     |
| GraphQL Schema 解析    | 8h       | P2     |
| --incremental CLI 选项 | 4h       | P2     |
| 变更预览功能           | 8h       | P2     |

### Phase 4: 插件化架构（3-4 周）

| 任务                | 预计时间 | 优先级 |
| ------------------- | -------- | ------ |
| TemplateManager 类  | 16h      | P2     |
| ProjectGenerator 类 | 16h      | P2     |
| template 命令组     | 8h       | P2     |
| new 命令增强        | 8h       | P2     |
| 默认模板仓库        | 16h      | P2     |
| 模板开发文档        | 8h       | P2     |

### Phase 5: 智能化（4-6 周）

| 任务             | 预计时间 | 优先级 |
| ---------------- | -------- | ------ |
| 字段类型智能推断 | 16h      | P2     |
| 项目上下文分析器 | 16h      | P2     |
| 交互式生成向导   | 24h      | P2     |
| 数据库逆向生成   | 24h      | P3     |
| LLM 自然语言接口 | 40h      | P3     |

---

## 十、风险评估与缓解措施

### 10.1 技术风险

| 风险                  | 影响 | 概率 | 缓解措施                         |
| --------------------- | ---- | ---- | -------------------------------- |
| Koatty 框架版本不兼容 | 高   | 中   | 添加版本检测，支持多版本模板     |
| ts-morph AST 解析错误 | 中   | 低   | 添加错误处理，失败时回退全量生成 |
| 模板语法错误          | 中   | 低   | 模板验证，单元测试覆盖           |
| 增量生成破坏用户代码  | 高   | 中   | 严格的保护标记，预览模式         |

### 10.2 版本兼容性矩阵

| koatty-ai 版本 | Koatty | Node.js | TypeORM | 备注     |
| -------------- | ------ | ------- | ------- | -------- |
| 1.x            | ≥3.0.0 | ≥14.0.0 | ≥0.3.0  | 当前版本 |
| 2.x            | ≥3.6.0 | ≥16.0.0 | ≥0.3.0  | 计划版本 |

### 10.3 回滚策略

1. **生成前备份**: 修改现有文件前自动创建 `.backup` 文件
2. **Git 集成**: 生成前创建 stash，失败时自动恢复
3. **ChangeSet 日志**: 记录所有变更，支持撤销

---

## 十一、未来扩展特性（规划中，暂不实施）

> **说明**: 以下特性为长期愿景规划，当前 MVP 阶段不实施，待基础功能稳定后逐步推进。

### 11.1 特性一：LLM 驱动的智能代码生成

#### 11.1.1 愿景

将 koatty-ai 从"配置驱动"升级为"对话驱动"的智能开发助手，用户可以通过自然语言描述需求，系统自动完成代码生成。

#### 11.1.2 核心能力

| 能力             | 描述                       | 示例                                                |
| ---------------- | -------------------------- | --------------------------------------------------- |
| **自然语言理解** | 理解用户意图，提取关键信息 | "新增一个用户控制器" → 生成 UserController          |
| **多轮对话细化** | 通过对话逐步明确需求       | "开发一个用户管理" → 询问字段、权限、API 等细节     |
| **智能推断**     | 根据上下文自动推断缺失信息 | 根据"用户管理"推断需要 name、email、password 等字段 |
| **代码审查**     | 生成后自动检查代码质量     | 检查是否符合 Koatty 规范，提供优化建议              |

#### 11.1.3 技术架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     用户交互层                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   CLI 命令   │  │  MCP Server │  │   Web UI    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     LLM 编排层                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  Conversation Manager                        ││
│  │  • 会话状态管理                                               ││
│  │  • 上下文维护                                                 ││
│  │  • 多轮对话编排                                               ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│        ┌─────────────────────┼─────────────────────┐            │
│        ▼                     ▼                     ▼            │
│  ┌───────────┐        ┌───────────┐        ┌───────────┐        │
│  │sequential │        │  mcp-     │        │  LLM      │        │
│  │-thinking  │        │  feedback │        │  Provider │        │
│  │  (推理)    │        │ (用户反馈) │        │ (生成)    │        │
│  └───────────┘        └───────────┘        └───────────┘        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     工具调用层 (Function Calling)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ generate_   │  │  analyze_   │  │  modify_    │              │
│  │ module      │  │  project    │  │  code       │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ create_     │  │  validate_  │  │  search_    │              │
│  │ controller  │  │  spec       │  │  codebase   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     代码生成层 (现有)                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Generators  │  │  Templates  │  │  ChangeSet  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

#### 11.1.4 MCP 工具集成

**sequential-thinking (推理引擎)**:

- 分解复杂任务为步骤
- 验证每个步骤的输出
- 支持回溯和修正

**mcp-feedback-enhanced (用户反馈)**:

- 在关键决策点请求用户确认
- 收集用户偏好
- 支持中途修改需求

#### 11.1.5 Function Calling 定义

```typescript
// 工具定义示例
const tools = [
  {
    name: 'generate_module',
    description: '生成完整的模块（包含 Model、DTO、Service、Controller）',
    parameters: {
      type: 'object',
      properties: {
        moduleName: { type: 'string', description: '模块名称，如 User、Product' },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string', enum: ['string', 'number', 'boolean', 'datetime', 'enum'] },
              required: { type: 'boolean' },
            },
          },
        },
        features: {
          type: 'object',
          properties: {
            softDelete: { type: 'boolean' },
            pagination: { type: 'boolean' },
            auth: { type: 'boolean' },
          },
        },
      },
      required: ['moduleName'],
    },
  },
  {
    name: 'create_controller',
    description: '单独创建一个控制器',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        basePath: { type: 'string' },
        methods: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              httpMethod: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
              path: { type: 'string' },
            },
          },
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'analyze_project',
    description: '分析当前项目结构，获取已有模块、配置等信息',
    parameters: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', default: '.' },
      },
    },
  },
  {
    name: 'validate_spec',
    description: '验证模块规范是否符合 Koatty 框架要求',
    parameters: {
      type: 'object',
      properties: {
        spec: { type: 'object' },
      },
      required: ['spec'],
    },
  },
];
```

#### 11.1.6 交互示例

**示例 1: 简单命令**

```
用户: 新增一个用户控制器

AI: 我将为您创建 UserController。请确认以下信息：
    - 控制器路径: /user
    - 包含方法: list, detail, create, update, remove

    是否需要调整？

用户: 路径改成 /api/users

AI: 好的，已调整。正在生成...
    ✅ 已创建 src/controller/UserController.ts

    是否需要同时生成对应的 Service 和 Model？

用户: 是

AI: 请提供 User 模块的字段信息，或者我可以为您推荐常用字段：
    - name (string, 必填)
    - email (string, 必填, 唯一)
    - password (string, 必填)
    - avatar (string, 可选)
    - status (enum: active/inactive)
    - createdAt, updatedAt (自动)

    是否使用这些字段？

用户: 再加一个 phone 字段

AI: 好的，已添加 phone 字段。正在生成完整模块...
    ✅ 已创建 src/model/UserModel.ts
    ✅ 已创建 src/dto/UserDto.ts
    ✅ 已创建 src/service/UserService.ts
    ✅ 已创建 src/controller/UserController.ts

    生成完成！您可以运行 `npm run dev` 启动服务测试。
```

**示例 2: 复杂需求**

```
用户: 开发一个用户管理功能

AI: [使用 sequential-thinking 分解任务]

    我来帮您规划用户管理功能。这通常包括：

    1. **用户 CRUD** - 基本的增删改查
    2. **用户认证** - 登录、注册、JWT
    3. **角色权限** - 角色管理、权限控制
    4. **个人中心** - 资料修改、密码重置

    请问您需要哪些功能？（可多选）

    [1] 仅用户 CRUD
    [2] CRUD + 认证
    [3] 完整用户管理（全部）
    [4] 自定义选择

用户: 2

AI: 好的，我将为您创建包含认证功能的用户管理模块。

    [使用 mcp-feedback-enhanced 收集详细需求]

    请回答几个问题帮助我生成更符合需求的代码：

    Q1: 用户登录方式？
        [a] 用户名 + 密码
        [b] 邮箱 + 密码
        [c] 手机号 + 验证码
        [d] 多种方式

用户: b

AI: Q2: 是否需要第三方登录（微信、GitHub 等）？

用户: 暂时不需要

AI: Q3: Token 有效期？
        [a] 2 小时
        [b] 7 天
        [c] 30 天
        [d] 自定义

用户: b

AI: 明白了。我将生成以下内容：

    📁 src/user/
    ├── model/UserModel.ts        # 用户实体
    ├── dto/
    │   ├── UserDto.ts            # CRUD DTO
    │   ├── LoginDto.ts           # 登录 DTO
    │   └── RegisterDto.ts        # 注册 DTO
    ├── service/
    │   ├── UserService.ts        # 用户服务
    │   └── AuthService.ts        # 认证服务
    └── controller/
        ├── UserController.ts     # 用户 CRUD
        └── AuthController.ts     # 登录/注册/刷新Token

    确认生成？[Y/n]

用户: Y

AI: 正在生成代码...
    [调用 generate_module, create_controller 等工具]

    ✅ 生成完成！

    📝 后续步骤：
    1. 配置 JWT 密钥: 编辑 src/config/config.ts
    2. 配置数据库: 编辑 src/config/db.ts
    3. 运行迁移: npm run typeorm migration:run
    4. 启动服务: npm run dev

    需要我帮您配置这些吗？
```

#### 11.1.7 实施路线图

| 阶段     | 内容                  | 预计时间  |
| -------- | --------------------- | --------- |
| 阶段 1   | LLM Provider 抽象层   | 2 周      |
| 阶段 2   | Function Calling 实现 | 2 周      |
| 阶段 3   | MCP 工具集成          | 2 周      |
| 阶段 4   | 对话管理器            | 2 周      |
| 阶段 5   | CLI 交互界面          | 1 周      |
| 阶段 6   | 测试与优化            | 2 周      |
| **合计** |                       | **11 周** |

---

### 11.2 特性二：Koatty Hub - 组件生态平台

#### 11.2.1 愿景

建立 Koatty 框架的组件生态平台，类似于 npm + Awesome 列表 + 组件市场的结合体，为开发者提供：

- **发现**: 浏览和搜索高质量组件
- **安装**: 一键安装组件到项目
- **贡献**: 分享自己创建的组件
- **评价**: 评分、评论、使用统计

#### 11.2.2 平台架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Koatty Hub 前端                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   组件浏览   │  │   搜索过滤   │  │   个人中心   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   组件详情   │  │   评分评论   │  │   安装向导   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Koatty Hub API                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  /api/components      - 组件 CRUD                           ││
│  │  /api/categories      - 分类管理                            ││
│  │  /api/users           - 用户管理                            ││
│  │  /api/reviews         - 评价管理                            ││
│  │  /api/stats           - 统计分析                            ││
│  │  /api/install         - 安装指引生成                        ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        数据存储层                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  PostgreSQL │  │    Redis    │  │     OSS     │              │
│  │  (元数据)    │  │   (缓存)    │  │  (组件包)   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     koatty-ai CLI 集成                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  koatty-ai hub search <keyword>     # 搜索组件              ││
│  │  koatty-ai hub install <name>       # 安装组件              ││
│  │  koatty-ai hub publish              # 发布组件              ││
│  │  koatty-ai hub info <name>          # 查看组件信息          ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

#### 11.2.3 组件分类

```
Koatty Hub
├── 🏛️ 官方组件 (Official)
│   ├── koatty_core          # 核心框架
│   ├── koatty_container     # IOC 容器
│   ├── koatty_router        # 路由
│   ├── koatty_serve         # 服务器
│   ├── koatty_validation    # 验证
│   ├── koatty_typeorm       # TypeORM 集成
│   ├── koatty_cacheable     # 缓存
│   ├── koatty_schedule      # 定时任务
│   └── koatty_trace         # 链路追踪
│
├── 🔌 中间件 (Middleware)
│   ├── koatty-cors          # 跨域处理
│   ├── koatty-helmet        # 安全头
│   ├── koatty-ratelimit     # 限流
│   ├── koatty-compress      # 压缩
│   └── koatty-static        # 静态文件
│
├── 🔧 插件 (Plugin)
│   ├── koatty-swagger       # Swagger 文档
│   ├── koatty-graphql       # GraphQL 支持
│   ├── koatty-websocket     # WebSocket
│   ├── koatty-queue         # 消息队列
│   └── koatty-storage       # 文件存储
│
├── 🎯 切面 (Aspect)
│   ├── koatty-logger        # 日志切面
│   ├── koatty-metrics       # 指标切面
│   ├── koatty-transaction   # 事务切面
│   └── koatty-permission    # 权限切面
│
├── 📦 模板 (Template)
│   ├── koatty-template-api  # REST API 项目模板
│   ├── koatty-template-grpc # gRPC 项目模板
│   ├── koatty-template-full # 全栈项目模板
│   └── koatty-template-micro# 微服务项目模板
│
└── 🧩 业务组件 (Business) [社区贡献]
    ├── koatty-auth-jwt      # JWT 认证
    ├── koatty-auth-oauth    # OAuth 认证
    ├── koatty-payment       # 支付集成
    ├── koatty-sms           # 短信服务
    └── ...更多社区组件
```

#### 11.2.4 组件元数据结构

```typescript
interface HubComponent {
  // 基本信息
  name: string; // 组件名称
  version: string; // 版本号
  description: string; // 描述
  keywords: string[]; // 关键词

  // 分类
  category: 'official' | 'middleware' | 'plugin' | 'aspect' | 'template' | 'business';
  tags: string[];

  // 作者信息
  author: {
    name: string;
    email?: string;
    github?: string;
  };

  // 仓库信息
  repository: {
    type: 'git';
    url: string;
    branch?: string;
  };

  // 兼容性
  compatibility: {
    koatty: string; // 如 ">=3.6.0"
    node: string; // 如 ">=16.0.0"
  };

  // 安装信息
  installation: {
    npm: string; // npm 包名
    peerDependencies?: Record<string, string>;
  };

  // 文档
  documentation: {
    readme: string; // README 内容或 URL
    examples: Example[]; // 使用示例
    api?: string; // API 文档 URL
    changelog?: string; // 更新日志
  };

  // 统计
  stats: {
    downloads: number; // 下载量
    stars: number; // 收藏数
    rating: number; // 平均评分 (1-5)
    reviewCount: number; // 评论数
  };

  // 审核状态
  status: 'pending' | 'approved' | 'rejected' | 'deprecated';
  verifiedAt?: Date;

  // 时间戳
  createdAt: Date;
  updatedAt: Date;
}

interface Example {
  title: string;
  description: string;
  code: string;
  language: 'typescript' | 'javascript' | 'yaml' | 'json';
}

interface Review {
  id: string;
  componentId: string;
  userId: string;
  rating: number; // 1-5
  title: string;
  content: string;
  helpful: number; // 有用数
  createdAt: Date;
}
```

#### 11.2.5 组件发布流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      组件发布流程                                │
└─────────────────────────────────────────────────────────────────┘

1. 开发者在本地创建组件
   koatty-ai new my-middleware --type middleware

2. 开发和测试组件
   cd my-middleware
   npm test

3. 配置组件元数据 (koatty-hub.json)
   {
     "name": "koatty-my-middleware",
     "version": "1.0.0",
     "category": "middleware",
     "description": "My awesome middleware",
     ...
   }

4. 发布前验证
   koatty-ai hub validate

   检查项:
   ✅ package.json 完整性
   ✅ README.md 存在
   ✅ 测试覆盖率 >= 80%
   ✅ TypeScript 类型声明
   ✅ Koatty 版本兼容性
   ✅ 无安全漏洞

5. 发布到 Hub
   koatty-ai hub publish

   流程:
   [用户确认] → [上传组件包] → [自动审核] → [人工审核(可选)] → [发布上线]

6. 审核机制
   - 自动审核: 代码扫描、依赖检查、兼容性测试
   - 人工审核: 官方组件、高风险组件需人工审核
   - 社区审核: 通过评分和评论进行社区筛选
```

#### 11.2.6 CLI 命令设计

```bash
# ==================== 搜索与浏览 ====================

# 搜索组件
koatty-ai hub search jwt
# 输出:
# 📦 koatty-auth-jwt (v2.1.0) ⭐ 4.8 (128 reviews)
#    JWT authentication middleware for Koatty
#    Downloads: 12,345 | Category: middleware
#
# 📦 koatty-jwt-utils (v1.0.3) ⭐ 4.2 (23 reviews)
#    JWT utility functions
#    Downloads: 3,456 | Category: plugin

# 按分类浏览
koatty-ai hub list --category middleware
koatty-ai hub list --category official

# 查看热门组件
koatty-ai hub trending
koatty-ai hub trending --period weekly

# ==================== 组件详情 ====================

# 查看组件信息
koatty-ai hub info koatty-auth-jwt
# 输出:
# ┌─────────────────────────────────────────────┐
# │ koatty-auth-jwt v2.1.0                      │
# ├─────────────────────────────────────────────┤
# │ JWT authentication middleware for Koatty    │
# │                                             │
# │ Author:    John Doe <john@example.com>      │
# │ Category:  middleware                       │
# │ License:   MIT                              │
# │ Downloads: 12,345                           │
# │ Rating:    ⭐⭐⭐⭐⭐ 4.8 (128 reviews)         │
# │                                             │
# │ Compatibility:                              │
# │   Koatty: >=3.6.0                          │
# │   Node:   >=16.0.0                         │
# │                                             │
# │ Install: koatty-ai hub install koatty-auth-jwt │
# └─────────────────────────────────────────────┘

# 查看使用示例
koatty-ai hub examples koatty-auth-jwt

# 查看评论
koatty-ai hub reviews koatty-auth-jwt

# ==================== 安装组件 ====================

# 安装组件
koatty-ai hub install koatty-auth-jwt
# 流程:
# 1. 检测项目兼容性
# 2. 安装 npm 依赖
# 3. 生成配置文件 (可选)
# 4. 更新项目配置 (可选)
# 5. 显示使用说明

# 安装并自动配置
koatty-ai hub install koatty-auth-jwt --setup

# 指定版本安装
koatty-ai hub install koatty-auth-jwt@2.0.0

# ==================== 发布组件 ====================

# 初始化组件项目
koatty-ai hub init
# 交互式创建 koatty-hub.json

# 验证组件
koatty-ai hub validate
# 检查必要文件、测试覆盖率、安全漏洞等

# 发布组件
koatty-ai hub publish
# 需要 Hub 账号登录

# 更新组件
koatty-ai hub publish --update

# ==================== 用户操作 ====================

# 登录
koatty-ai hub login

# 查看我的组件
koatty-ai hub my-components

# 收藏组件
koatty-ai hub star koatty-auth-jwt

# 评价组件
koatty-ai hub review koatty-auth-jwt --rating 5 --comment "Great middleware!"
```

#### 11.2.7 用户贡献流程

```
开发者创建组件
       │
       ▼
┌──────────────────┐
│ koatty-ai hub    │
│ validate         │◄─────── 本地验证
└────────┬─────────┘
         │ 通过
         ▼
┌──────────────────┐
│ 用户确认发布?     │
│ [Y] 同意条款      │◄─────── 用户授权
│ [N] 取消          │
└────────┬─────────┘
         │ Y
         ▼
┌──────────────────┐
│ 上传到 Koatty Hub │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 自动审核          │
│ • 安全扫描        │
│ • 依赖检查        │
│ • 兼容性测试      │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 通过      不通过
    │         │
    ▼         ▼
┌───────┐  ┌───────────┐
│ 发布   │  │ 返回错误   │
│ 上线   │  │ 修复后重试 │
└───────┘  └───────────┘
```

#### 11.2.8 安全与质量保障

| 措施         | 描述                             |
| ------------ | -------------------------------- |
| **代码扫描** | 使用 Snyk/npm audit 检测安全漏洞 |
| **依赖检查** | 检查过期依赖、许可证兼容性       |
| **测试覆盖** | 要求最低 80% 测试覆盖率          |
| **类型检查** | 必须提供 TypeScript 类型声明     |
| **文档要求** | 必须包含 README、示例代码        |
| **版本控制** | 强制语义化版本                   |
| **恶意检测** | 检测挖矿、数据窃取等恶意代码     |
| **社区监督** | 差评组件自动标记、下架机制       |

#### 11.2.9 实施路线图

| 阶段     | 内容             | 预计时间  |
| -------- | ---------------- | --------- |
| 阶段 1   | Hub API 后端开发 | 4 周      |
| 阶段 2   | CLI 命令集成     | 2 周      |
| 阶段 3   | Web 前端开发     | 4 周      |
| 阶段 4   | 自动审核系统     | 2 周      |
| 阶段 5   | 官方组件迁移     | 2 周      |
| 阶段 6   | 测试与上线       | 2 周      |
| **合计** |                  | **16 周** |

---

### 11.3 特性优先级与依赖关系

```
                    ┌─────────────────────┐
                    │    MVP 基础功能      │
                    │  (当前实施中)        │
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
              ▼                                 ▼
    ┌─────────────────┐               ┌─────────────────┐
    │  增量生成功能    │               │  插件化架构      │
    │  (Phase 3)      │               │  (Phase 4)      │
    └────────┬────────┘               └────────┬────────┘
             │                                  │
             │         ┌───────────────────────┘
             │         │
             ▼         ▼
    ┌─────────────────────────────┐
    │      LLM 智能生成           │
    │      (特性一)               │
    │  • 依赖: 基础生成功能完善    │
    │  • 依赖: 增量生成支持       │
    └──────────────┬──────────────┘
                   │
                   ▼
    ┌─────────────────────────────┐
    │      Koatty Hub            │
    │      (特性二)               │
    │  • 依赖: 插件化架构完成     │
    │  • 依赖: 组件标准化         │
    └─────────────────────────────┘
```

### 11.4 技术选型建议

| 组件             | 推荐技术                                   | 备选方案                      |
| ---------------- | ------------------------------------------ | ----------------------------- |
| **LLM Provider** | OpenAI API                                 | Anthropic Claude, 本地 Ollama |
| **MCP 集成**     | sequential-thinking, mcp-feedback-enhanced | 自研推理引擎                  |
| **Hub 后端**     | Koatty (dogfooding)                        | NestJS, Fastify               |
| **Hub 前端**     | Next.js + Tailwind                         | Vue 3 + Element Plus          |
| **Hub 数据库**   | PostgreSQL                                 | MySQL                         |
| **Hub 缓存**     | Redis                                      | Memcached                     |
| **Hub 存储**     | 阿里云 OSS                                 | AWS S3, MinIO                 |
| **Hub 搜索**     | Elasticsearch                              | MeiliSearch                   |

---

## 十二、总结

### 12.1 核心问题

1. **严重架构错误**: AST Patcher 基于 NestJS 概念设计，与 Koatty 框架完全不兼容
2. **规范符合性不足**: 生成的代码未完全遵循 Koatty 框架的装饰器规范
3. **智能化程度低**: 仅支持手动编写 YAML，缺乏智能推断能力
4. **功能覆盖不全**: 缺少 Middleware、Aspect、Test 等重要组件的生成

### 12.2 紧急行动项

**必须立即执行**：

1. 移除 ModuleRegistrar 和 RouteRegistrar
2. 修复所有模板以符合 Koatty 规范
3. 重新验证生成的代码可以在 Koatty 项目中正常运行

### 12.3 优化收益

| 收益           | 描述                               |
| -------------- | ---------------------------------- |
| **架构正确性** | 修复后工具将与 Koatty 框架完全兼容 |
| **开发效率**   | 生成的代码可直接运行，无需手动修改 |
| **学习成本**   | 交互式向导降低使用门槛             |
| **代码质量**   | 统一的最佳实践，自动验证规则       |
| **扩展性**     | 插件化架构支持社区贡献             |

### 12.4 风险提示

- **破坏性变更**: 移除 AST Patcher 是破坏性变更，需要更新所有相关测试
- **Koatty 版本兼容**: 需要持续跟踪 Koatty 框架更新
- **模板维护**: 模板需要与 Koatty 版本保持同步

---

**文档结束**

> 建议按照 Phase 0 → Phase 1 → Phase 2 的顺序逐步实施，确保每个阶段都经过充分测试后再进入下一阶段。
