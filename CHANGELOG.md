# Changelog

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
