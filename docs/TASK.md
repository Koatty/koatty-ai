# Koatty AI MVP 构建任务清单

## 概述

本文档将 Koatty AI MVP 分解为 50 个小型、可测试的任务。每个任务专注于单一功能点，可独立完成和验证。

---

## 阶段 1: 项目初始化 (Tasks 1-5)

### Task 1: 创建项目基础结构 [x]
**目标**: 初始化 TypeScript 项目
**输出**: 
- `package.json` 配置完成
- `tsconfig.json` 配置完成
- 基础目录结构创建
**验证**: `npm install` 成功执行

### Task 2: 配置开发工具 [x]
**目标**: 设置 ESLint 和 Prettier
**输出**:
- `.eslintrc.js` 文件
- `.prettierrc` 文件
- `package.json` 添加 lint 脚本
**验证**: `npm run lint` 可执行

### Task 3: 配置测试框架 [x]
**目标**: 集成 Jest 测试框架
**输出**:
- `jest.config.js` 文件
- `tests/` 目录结构
- 一个简单的测试示例
**验证**: `npm test` 运行成功

### Task 4: 设置 Git 和版本控制 [x]
**目标**: 配置 Git 忽略和提交规范
**输出**:
- `.gitignore` 文件
- `.gitattributes` 文件
**验证**: Git 仓库初始化成功

### Task 5: 创建 CLI 入口点 [x]
**目标**: 创建可执行的 CLI 入口
**输出**:
- `src/cli/index.ts` 文件
- `package.json` 添加 bin 配置
**验证**: `npm link` 后可执行 `koatty-ai --version`

---

## 阶段 2: CLI 命令框架 (Tasks 6-10)

### Task 6: 集成 Commander.js [x]
**目标**: 安装并配置 Commander.js
**输出**:
- Commander.js 依赖安装
- 基础命令结构
**验证**: `koatty-ai --help` 显示帮助信息

### Task 7: 实现 `generate:module` 命令骨架 [x]
**目标**: 创建模块生成命令（无实现）
**输出**:
- `src/cli/commands/generate.ts` 文件
- 命令参数定义
**验证**: `koatty-ai generate:module test` 可识别命令

### Task 8: 实现 `plan` 命令骨架 [x]
**目标**: 创建预览命令（无实现）
**输出**:
- `src/cli/commands/plan.ts` 文件
**验证**: `koatty-ai plan --spec xxx.yml` 可识别命令

### Task 9: 实现 `apply` 命令骨架 [x]
**目标**: 创建应用命令（无实现）
**输出**:
- `src/cli/commands/apply.ts` 文件
**验证**: `koatty-ai apply --spec xxx.yml` 可识别命令

### Task 10: 添加通用参数解析 [x]
**目标**: 实现共享参数解析逻辑
**输出**:
- `src/cli/utils/parseArgs.ts` 文件
- 参数验证函数
**验证**: 单元测试通过

---

## 阶段 3: Spec 解析器 (Tasks 11-15)

### Task 11: 定义 Spec TypeScript 接口 [x]
**目标**: 创建 Spec 数据结构定义
**输出**:
- `src/types/spec.ts` 文件
- 完整的类型定义
**验证**: TypeScript 编译无错误

### Task 12: 实现 YAML 解析器 [x]
**目标**: 解析 YAML 配置文件
**输出**:
- `src/parser/SpecParser.ts` 文件
- YAML 文件读取功能
**验证**: 能成功解析示例 YAML 文件

### Task 13: 实现 JSON 内联参数解析 [x]
**目标**: 解析命令行 JSON 参数
**输出**:
- `src/parser/FieldParser.ts` 文件
- JSON 字符串解析功能
**验证**: 单元测试通过（解析各种 JSON 格式）

### Task 14: 实现 Spec 验证器 [x]
**目标**: 验证 Spec 配置完整性
**输出**:
- `src/parser/Validator.ts` 文件
- 验证规则实现
**验证**: 测试覆盖必填字段、类型检查等

### Task 15: 创建示例 Spec 文件 [x]
**目标**: 提供用户管理模块示例
**输出**:
- `specs/examples/user.yml` 文件
**验证**: 通过 Validator 验证

---

## 阶段 4: ChangeSet 机制 (Tasks 16-20)

### Task 16: 定义 ChangeSet 数据结构 [x]
**目标**: 创建变更集类型定义
**输出**:
- `src/types/changeset.ts` 文件
- FileChange 接口定义
**验证**: TypeScript 编译无错误

### Task 17: 实现 ChangeSet 类 [x]
**目标**: 创建变更管理核心类
**输出**:
- `src/changeset/ChangeSet.ts` 文件
- 基础增删改方法
**验证**: 单元测试通过

### Task 18: 实现 FileChange 类 [x]
**目标**: 管理单个文件变更
**输出**:
- `src/changeset/FileChange.ts` 文件
- 支持 create/modify/delete
**验证**: 单元测试通过

### Task 19: 实现 ChangeSet 序列化 [x]
**目标**: ChangeSet 保存和加载
**输出**:
- 添加 `save()` 和 `load()` 方法
- JSON 序列化逻辑
**验证**: 保存后可成功加载

### Task 20: 实现 ChangeSet 预览输出 [x]
**目标**: 格式化输出变更清单
**输出**:
- `src/changeset/ChangeSetFormatter.ts` 文件
- 彩色终端输出
**验证**: 手动查看输出格式

---

## 阶段 5: 模板系统 (Tasks 21-25)

### Task 21: 集成 Handlebars [x]
**目标**: 安装并配置模板引擎
**输出**:
- Handlebars 依赖
- 模板加载器
**验证**: 能成功渲染简单模板

### Task 22: 创建 Model 模板 [x]
**目标**: 实现 Model 生成模板
**输出**:
- `templates/model/model.hbs` 文件
**验证**: 渲染后代码语法正确

### Task 23: 创建 DTO 模板 [x]
**目标**: 实现 DTO 生成模板
**输出**:
- `templates/dto/dto.hbs` 文件
**验证**: 渲染后代码语法正确

### Task 24: 创建 Service 模板 [x]
**目标**: 实现 Service 生成模板
**输出**:
- `templates/service/service.hbs` 文件
**验证**: 渲染后代码语法正确

### Task 25: 创建 Controller 模板 [x]
**目标**: 实现 Controller 生成模板
**输出**:
- `templates/controller/controller.hbs` 文件
**验证**: 渲染后代码语法正确

---

## 阶段 6: 代码生成器 (Tasks 26-30)

### Task 26: 实现 BaseGenerator 基类 [x]
**目标**: 创建生成器抽象基类
**输出**:
- `src/generators/BaseGenerator.ts` 文件
- IGenerator 接口定义
**验证**: TypeScript 编译无错误

### Task 27: 实现 ModelGenerator [x]
**目标**: 生成 Model 文件
**输出**:
- `src/generators/ModelGenerator.ts` 文件
- 模板渲染逻辑
**验证**: 生成的 Model 文件语法正确

### Task 28: 实现 DtoGenerator [x]
**目标**: 生成 DTO 文件
**输出**:
- `src/generators/DtoGenerator.ts` 文件
**验证**: 生成的 DTO 文件语法正确

### Task 29: 实现 ServiceGenerator [x]
**目标**: 生成 Service 文件
**输出**:
- `src/generators/ServiceGenerator.ts` 文件
**验证**: 生成的 Service 文件语法正确

### Task 30: 实现 ControllerGenerator [x]
**目标**: 生成 Controller 文件
**输出**:
- `src/generators/ControllerGenerator.ts` 文件
**验证**: 生成的 Controller 文件语法正确

---

## 阶段 7: 模块生成器 (Tasks 31-33)

### Task 31: 实现 ModuleGenerator [x]
**目标**: 组合所有子生成器
**输出**:
- `src/generators/ModuleGenerator.ts` 文件
- 生成器编排逻辑
**验证**: 生成完整模块目录结构

### Task 32: 实现模块目录创建 [x]
**目标**: 创建标准模块目录
**输出**:
- 目录创建逻辑
- index.ts 导出文件
**验证**: 目录结构符合 Koatty 规范

### Task 33: 测试完整模块生成 [x]
**目标**: 端到端测试模块生成
**输出**:
- 集成测试用例
**验证**: 生成的代码可编译运行

---

## 阶段 8: AST 修改器 (Tasks 34-37)

### Task 34: 集成 ts-morph [x]
**目标**: 安装并配置 AST 工具
**输出**:
- ts-morph 依赖
- Project 初始化逻辑
**验证**: 能成功解析 TS 文件

### Task 35: 实现 AstPatcher 基类 [x]
**目标**: 创建 AST 修改基础类
**输出**:
- `src/patcher/AstPatcher.ts` 文件
- 幂等性检查方法
**验证**: 单元测试通过

### Task 36: 实现 ModuleRegistrar [x]
**目标**: 自动注册模块
**输出**:
- `src/patcher/ModuleRegistrar.ts` 文件
- import 添加逻辑
**验证**: 能正确修改 index.ts

### Task 37: 实现 RouteRegistrar [x]
**目标**: 自动注册路由
**输出**:
- `src/patcher/RouteRegistrar.ts` 文件
**验证**: 能正确修改路由文件

---

## 阶段 9: 命令实现 (Tasks 38-42)

### Task 38: 实现 generate:module 命令 [x]
**目标**: 连接所有组件
**输出**:
- 完整的命令实现
**验证**: 命令行生成模块成功

### Task 39: 实现 plan 命令 [x]
**目标**: 预览变更功能
**输出**:
- 变更预览输出
**验证**: 显示正确的文件列表

### Task 40: 实现 apply 命令 [x]
**目标**: 执行变更功能
**输出**:
- 文件写入逻辑
**验证**: 文件成功创建

### Task 41: 添加进度提示 [x]
**目标**: 显示生成进度
**输出**:
- 进度条或 spinner
**验证**: 用户体验友好

### Task 42: 添加错误处理 [x]
**目标**: 优雅处理错误
**输出**:
- 统一错误处理
- 友好错误提示
**验证**: 各种错误场景测试

---

## 阶段 10: 验证与质量 (Tasks 43-46)

### Task 43: 实现代码格式化 [x]
**目标**: 自动格式化生成代码
**输出**:
- Prettier 集成
**验证**: 生成的代码格式一致

### Task 44: 实现 Lint 检查 [x]
**目标**: 自动检查生成代码
**输出**:
- ESLint 检查逻辑
**验证**: 生成的代码通过 lint

### Task 45: 实现 TypeScript 编译验证 [x]
**目标**: 确保生成代码可编译
**输出**:
- `tsc --noEmit` 检查
**验证**: 生成的代码无类型错误

### Task 46: 实现验证报告 [x]
**目标**: 输出验证结果
**输出**:
- `src/runner/Validator.ts` 文件
**验证**: 显示详细验证信息

---

## 阶段 11: Git 集成 (Tasks 47-48)

### Task 47: 集成 simple-git [x]
**目标**: 安装 Git 操作库
**输出**:
- simple-git 依赖
- Git 操作封装
**验证**: 能执行基础 Git 命令

### Task 48: 实现自动提交 [x]
**目标**: 生成后自动提交
**输出**:
- 自动 commit 逻辑
- 生成 commit message
**验证**: Git 历史包含新提交

---

## 阶段 12: 文档与示例 (Tasks 49-50)

### Task 49: 编写用户文档 [x]
**目标**: 提供使用指南
**输出**:
- `README.md` 文件
- 命令使用示例
**验证**: 文档清晰完整

### Task 50: 创建完整示例项目 [x]
**目标**: 端到端演示
**输出**:
- `examples/user-management/` 目录
- 包含生成的完整用户模块
**验证**: 示例代码可运行

---

## 执行建议

### 单任务执行流程
1. 阅读任务描述
2. 实现代码
3. 编写单元测试
4. 验证输出
5. 提交代码

### 验收标准
- ✅ 代码通过 TypeScript 编译
- ✅ 单元测试覆盖率 ≥ 80%
- ✅ 代码通过 ESLint
- ✅ 输出结果符合预期

### 依赖关系
- 阶段 1-2 必须顺序执行
- 阶段 3-8 可部分并行
- 阶段 9 依赖前面所有阶段
- 阶段 10-12 可在阶段 9 后并行

---

## 技术栈清单

### 核心依赖
- `typescript` - TypeScript 编译器
- `commander` - CLI 框架
- `handlebars` - 模板引擎
- `ts-morph` - AST 操作
- `yaml` - YAML 解析
- `simple-git` - Git 操作
- `chalk` - 终端颜色
- `ora` - 进度提示

### 开发依赖
- `jest` - 测试框架
- `@types/jest` - Jest 类型
- `eslint` - 代码检查
- `prettier` - 代码格式化
- `ts-jest` - TypeScript Jest 支持

---

## 预期交付物

完成所有任务后，将获得：

1. **可执行 CLI 工具**
   - 命令：`koatty-ai generate:module`
   - 支持 YAML 和 JSON 参数

2. **代码生成能力**
   - Model
   - DTO
   - Service
   - Controller

3. **完整示例**
   - 用户管理模块（CRUD）

4. **文档**
   - 用户使用指南
   - API 文档

5. **测试覆盖**
   - 单元测试
   - 集成测试
   - E2E 测试

---

## 估算工作量

- **总任务数**: 50 个
- **预计时间**: 每个任务 2-4 小时
- **总工时**: 100-200 小时
- **日历时间**: 4-8 周（如每天投入 4-6 小时）

---

## 注意事项

1. **任务粒度**: 每个任务应在 2-4 小时内完成
2. **测试优先**: 每个任务必须包含测试
3. **增量提交**: 每完成一个任务立即提交
4. **文档同步**: 重要功能需同步更新文档
5. **问题记录**: 遇到问题记录在 issues 中
