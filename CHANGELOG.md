# Changelog

## Unreleased — 可执行 Skill + Tools（2026-10-07）

- 提供真实 stdio MCP 入口、输出 schema、严格 JSON CLI 错误、绑定项目根路径；移除构建/测试中的兄弟源码映射。
- 新增 component/crud recipe、分页上下文、框架指南检索和项目 Skill 安装工具；安装冲突拒绝覆盖。
- plan 默认只预览；CLI 显式 --savePlan 才保存签名计划；MCP 使用连接内有界会话计划。
- 路由检查识别 Controller 前缀与装饰器别名；IOC 规则排除同名局部变量；新增 Validated 参数位置检查，路径遍历拒绝符号链接。
- TOOLS-01 覆盖实际 CLI/MCP 客户端、计划应用、规则和 Skill 安装。未执行真实外部 LLM Agent 评测。


## 0.1.0（未发布）

首个 koatty_ai 版本（设计：docs/koatty-cli-agent-development-design.md，S0–S4）：

- **Skill**：`skills/koatty/SKILL.md` 场景导航入口 + 9 份按需加载的 references；框架不变量、最短工具路径与诊断映射。示例与命令经契约回归（R-01/R-04）。
- **Tools**（CLI `koatty-ai` 与 MCP `koatty-ai mcp` 共用同一 handler 与 v1 envelope）：
  - `capabilities`：工具目录 + koatty_cli 生成能力支持矩阵；
  - `context`：manifest 聚合的项目结构上下文（只输出键名/schema，不输出配置值）；
  - `docs`：版本化 API 索引查询（`knowledge/api-index.json`，随包分发、不联网）；
  - `recipes` / `plan` / `apply`：http-action 场景生成 → 签名计划 → 单次消费应用；
  - `check`：KOATTY_DTO_LOADER_NAME / KOATTY_GLOBAL_IOC / KOATTY_DUP_ROUTE；
  - `verify` / `doctor`：复用 koatty_cli 检查底座。
- **依赖**：`koatty_cli`（公开生成 API）。发布顺序：先发布携带 `koatty_cli/generation` 的 koatty_cli，再发布本包。
