# Koatty AI

**koatty_ai** 面向外部 AI Agent：把 Koatty 框架知识、标准实现与框架校验交给工具，帮助 Agent 更快、更准确地开发 Koatty 应用。Skill 负责决策引导，Tools 负责确定性执行，框架检查在 Agent 编辑后发现偏差。

- 不接入 LLM、不做自主任务循环、不做通用代码编辑器。
- 通过正式依赖复用 [koatty_cli](../koatty_cli) 的公开生成 API（`koatty_cli/generation`、`koatty_cli/project`），进程内调用，不启动子进程、不解析人类输出。

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
| `plan` | recipe/changeset → 签名计划（只读预览） |
| `apply` | 应用计划（`--yes` 才写盘；单次消费） |
| `check` | Koatty 静态规则（DTO 命名、全局 IOC、重复路由） |
| `verify` | types/test/lint/manifest（只执行项目内已安装工具） |
| `doctor` | 静态环境诊断 |

MCP 工具名加 `koatty_ai_` 前缀，与传统 CLI 的 `koatty mcp` 工具不冲突。

## 分发内容

- `skills/koatty/` — 主 Skill 与按场景加载的 references（`project` / `http-dto` / `service-di` / `persistence` / `protocols` / `extensions` / `mcp-agent` / `testing` / `troubleshooting`）。
- `knowledge/api-index.json` — 由 `scripts/build-api-index.mjs` 从框架包实际声明生成的版本化 API 索引（维护者运行，不联网）。
- `recipes/` — 确定性场景组合（当前：`http-action`），每个 recipe 附 inputSchema 与经过测试的示例。

## 开发（本仓库内）

```sh
pnpm install --ignore-workspace   # 独立安装（不进主仓库 workspace）
pnpm dev:link                     # node_modules/koatty_cli -> ../koatty_cli（开发期链接）
pnpm build && pnpm test           # 测试映射到 ../koatty_cli/dist
```

`koatty_ai` 依赖的公开 API 位于未发布的 koatty_cli；发布前先发布携带 `koatty_cli/generation` 的 koatty_cli，再把 `dependencies.koatty_cli` 提升到对应版本范围。`dev:link` 只影响本机 node_modules，不进入发布产物。

## 验收边界

- 工具与示例的验收 = 契约/行为测试通过；**没有真实外部 Agent 运行时，不声称已提高 AI 编程成功率**（设计 §11）。
- 静态检查不证明业务正确；verify 只报告实际执行的检查。
