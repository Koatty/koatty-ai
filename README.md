# Koatty AI

**koatty_ai** 面向外部 AI Agent：把 Koatty 框架知识、标准实现与框架校验交给工具，帮助 Agent 更快、更准确地开发 Koatty 应用。Skill 负责决策引导，Tools 负责确定性执行，框架检查在 Agent 编辑后发现偏差。

- 不接入 LLM、不做自主任务循环、不做通用代码编辑器。
- 通过正式依赖复用 [koatty_cli](https://github.com/Koatty/koatty-cli) 的公开生成 API（`koatty_cli/generation`、`koatty_cli/project`），进程内调用，不启动子进程、不解析人类输出。

## 安装与使用

```sh
npm install -D koatty_ai    # 包管理器自动安装其依赖 koatty_cli
npx koatty-ai capabilities  # 工具目录 + 生成能力支持矩阵
npx koatty-ai mcp           # MCP（stdio）接入，同一组 Tools
```

命令（stdout 恒为 v1 envelope JSON，stderr 为进度；非交互）：

| 命令 | 作用 |
|---|---|
| `capabilities` | 工具与生成能力目录（含支持矩阵、边界说明） |
| `context` | 项目结构上下文：组件、路由、DTO、配置键名、unresolved |
| `docs` | 版本匹配的 API 查询（import 来源、re-export 来源、兼容性标注） |
| `recipes` | 场景 recipe 目录与输入 schema（含可执行示例） |
| `plan` | recipe → 只读预览；`--savePlan` 显式保存 CLI 签名计划 |
| `apply` | 应用计划（`--yes` 才写盘；单次消费） |
| `check` | Koatty 静态规则（DTO 命名、Validated 参数顺序、全局 IOC、带前缀的重复路由） |
| `verify` | types/test/lint/manifest（只执行项目内已安装工具） |
| `doctor` | 静态环境诊断 |
| `skill` | 预览项目 Skill 安装；`--yes` 才写入，保留本地修改 |

MCP 工具名加 `koatty_ai_` 前缀，与传统 CLI 的 `koatty mcp` 工具不冲突。

## 分发内容

- `skills/koatty/` — 主 Skill 与按场景加载的 references（`project` / `http-dto` / `service-di` / `persistence` / `protocols` / `extensions` / `mcp-agent` / `testing` / `troubleshooting`）。
- `knowledge/api-index.json` — 由 `scripts/build-api-index.mjs` 从框架包实际声明生成的版本化 API 索引（维护者运行，不联网）。
- `recipes/` — 确定性场景组合（当前：`component`、`crud`、`http-action`），每个 recipe 附 inputSchema 与经过测试的示例。

## 开发（本仓库内）

在 monorepo 根目录：

```sh
pnpm --filter koatty_cli build
pnpm --filter koatty_ai build
pnpm --filter koatty_ai test -- --runInBand
```

独立仓库从安装好的 `koatty_cli` 解析公开 API，tsconfig/Jest 不再指向兄弟目录。开发时可显式 `dev:link`，验收须使用打包安装。发布前先发布携带公开 API 的 koatty_cli，并把 dependencies 的最低版本提升到该版本，不能让旧版 5.1.0 冒充新 API。

项目接入：`koatty-ai skill --root <project>` 预览，`--yes` 安装到 `.agents/skills/koatty`。已有不同内容返回 `SKILL_CONFLICT`，由用户/宿主显式合并。

CLI `plan` 不带 `--savePlan` 不写元数据；MCP 计划自动保存在当前连接。用 `docs --guide http-dto` 按需读取随包指南。`mcp` 的 stdout 是协议流；`--help`/`--version` 为标准文本，其余操作输出 JSON。

## 验收边界

- 工具与示例的验收 = 契约/行为测试通过；**没有真实外部 Agent 运行时，不声称已提高 AI 编程成功率**（设计 §11）。
- 静态检查不证明业务正确；verify 只报告实际执行的检查。

### 从传统脚手架安装新版 Skill

```sh
koatty new demo --offline --no-skill
koatty-ai skill --root ./demo --yes
```

传统 CLI 默认保留旧 Skill；新版安装器遇到同路径不同内容会拒绝覆盖，需先人工核对迁移。发布前仍须将 koatty_cli 依赖下界调整为实际包含新公开 API 的已发布版本。
