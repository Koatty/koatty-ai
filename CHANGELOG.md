## Unreleased — Phase A–F review (2026-09-30)

Reject hard-linked write targets; delimit formatter/linter paths; align static DTO required/conditional rules and explicitly record nested uncertainty; strengthen sandbox and schema regressions.

Migration: `docs/migration/phase-a-f-review-fixes.md` in the monorepo. No release has been applied.

# koatty_cli

## Unreleased — Phase F audit fixes (2026-09-29)

- E1 静态 DTO schema 使用 koatty_validation/schema-rules 共享约束，不执行目标应用；新增规则一致性回归。
- 迁移说明：`docs/migration/phase-f-audit-fixes.md`（主仓库）。


## Unreleased — Phase E audit fixes (2026-09-29)

- Bind MCP apply to issued, expiring single-use session plans and unchanged preimages; validate all inputs before transactional staging and handled-failure rollback.
- Reject nested documentation/source/config symlinks; classify test execution as non-read-only and non-idempotent.
- Export static manifest v1, unresolved diagnostics and validated DTO/config JSON Schemas; omit dynamic profile expressions and schema defaults.
- Generate compilable modules using existing APIs, split DTO files, declare actual dependencies, add service behaviour tests and standalone component test skeletons; use CLI ^5.0.0 in new projects.
- Reuse manifest schemas for new API doc scripts. See docs/migration/phase-e-ai-dev-experience.md for DTO paths, plan lifecycle and static-analysis limits.


## 5.0.0

### Major Changes

- Phase E（AI-Ready 开发体验，路线图 §8）：`koatty_cli@5.0.0` 发布内容。
  - **E-1 应用清单 `koatty manifest`**：静态采集器（`src/manifest`）+ CLI 命令，输出 components / routes / dtos / aspects / `config.keys` / `security.profile` / koatty 版本 / decoratorMode / protocols。**只输出配置键名，绝不输出配置取值**；纯静态分析（ts-morph），不启动应用、不监听端口、无网络。回归测试：`tests/regression/E-01.manifest.test.ts`。
  - **E-2 MCP 形态的 CLI（`koatty mcp`）**：stdio 传输的 MCP server，7 个工具（`koatty_manifest` / `koatty_routes` / `koatty_explain_component` / `koatty_plan` / `koatty_apply` / `koatty_test` / `koatty_docs`）。
    - 只读优先：除写类 `koatty_apply` 和执行类 `koatty_test` 外使用 `readOnlyHint`；`koatty_apply` 必须携带 `koatty_plan` 的 SHA-256 哈希，`dryRun` 默认 `true`。
    - 路径一律经 `resolveInside()`；`koatty_test` 只运行 `test/` / `tests/` 下的测试文件并带超时；不提供任意 shell 工具。
    - 依赖 `@modelcontextprotocol/sdk`（仅 `koatty_cli`）。回归测试：`tests/regression/E-02.mcp.test.ts`。
  - **E-3 面向 AI 的项目文档**：`koatty new` 模板新增 `AGENTS.md`、`.cursor/rules/koatty.mdc`、`llms.txt`。回归测试：`tests/regression/E-04.test-skeleton-and-docs.test.ts`。
  - **E-4 测试即规格**：生成器为每个模块追加 `test/<module>.test.ts` 骨架；模板项目新增 `jest.config.js`（ts-jest）与 `test/smoke.test.ts`。`koatty_testing` 补齐自身测试（QA-05）与 jest 配置（8 例）。
  - **COR-16**：`ChangeSet.save()` 同时接受目录与 `*.json` 文件路径，修复 `koatty apply --changeset .koatty/changesets/<id>.json` 的 `EISDIR` 失败。回归测试：`tests/regression/COR-16.changeset-save.test.ts`。

  迁移方式见 `docs/migration/phase-e-ai-dev-experience.md`。

## Unreleased — Phase A–D completion

- 既有 manifest 命令支持 --runtime-dir，收集排序后的编译文件与 SHA256，拒绝越界与重复实际文件。
- 修复默认模板的严格 TypeScript 编译、控制器返回值、app 初始化及配置清单构建；增加本地 CLI 和 Jest 类型依赖。

本轮尚未发布；验收边界见根目录 `docs/audits/phase-ad-completion-2026-09-28.md`。

## 4.2.2

### Patch Changes

- Phase B 收口：fail-closed 兜底、缺失实现与验收门回归测试（koatty-hardening-and-ai-evolution-plan.md，ADR-101/102）。
  - `koatty_core`：新增 `src/security` barrel（`export * from "./security"`），`app.security` / `SecurityProfile` 与 ADR-102 的模块路径一致；此前只能从深层路径导入。
  - `koatty_router`：GraphQL introspection 改为 fail-closed —— 没有 `security.graphql` profile 时不再默认开启 introspection（此前落到 `true`），显式 `ext.introspection` / profile 仍可开启；新增 `introspectionEnabled` 可观测字段。
  - `koatty_serve`：WebSocket `maxPayload` 兜底从 `0`（ws@8 语义 = 无上限）改为 1MiB，无 profile 时也是 fail-closed；补充 SEC-12 回归测试（`minVersion` 解析 + 连接池不再给 TLSv1.0/1.1 任何协议分）。
  - `koatty_logger`：内置默认敏感字段（password/passwd/secret/token/accessToken/refreshToken/authorization/cookie/apiKey/api_key），默认脱敏；`LoggerOpt.sensFields` 与 `setSensFields()` 改为追加，`clearSensFields()` / `resetSensFields()` 可显式清空。
  - `koatty_store`：COR-09 回归测试锁定 Redis 默认端口为 6379（不是 MySQL 的 3306）。
  - `koatty_cli`：SEC-10 CLI 沙箱修补 —— `config/server.ts` 的 protocol 补丁不再在 dry-run 阶段写入，且写入前经 `resolveInside(process.cwd(), ...)` 校验，dry-run 只打印预览。

## 4.2.1

### Patch Changes

- Phase A（基线修复与 CI 可信）收口：修复让 `pnpm lint` / CI lint job 失败的配置与格式问题。
  - `koatty_cli`：按 prettier 重新格式化 `apply` 命令的 `--yes` 选项（`npx eslint --fix`，无行为变化）；
  - `koatty_graphql`、`koatty_loader`：`@typescript-eslint/ban-types` 已在 @typescript-eslint v8 中移除，配置仍引用该规则会让每次 lint 直接报
    `Definition for rule '@typescript-eslint/ban-types' was not found`；改用后继规则 `@typescript-eslint/no-unsafe-function-type`；
  - `koatty_loader`：为刻意的 ES5/6 动态 `require()` 补充 `eslint-disable`；
  - `koatty_testing`：补充缺失的 `.eslintrc.js`（此前 eslint 以 exit=2 报 `couldn't find a configuration file`）。

  修复后 `pnpm lint` 由 4 个包失败恢复为 21/21 通过；`pnpm build` 23/23、`pnpm security:baseline` PASS 6 / FAIL 0。详见 `docs/reports/test-baseline-2026-09.md` §七。

## 4.2.0

### Minor Changes

- Phase B security hardening (koatty-hardening-and-ai-evolution-plan.md, ADR-101/102/103). Fail-closed defaults with a `security.legacyDefaults: true` rollback switch; see docs/migration/4.3.0.md for the full migration guide.

  Highlights:
  - SecurityProfile (strict/standard/development) exposed read-only as `app.security`, with a startup summary and per-item WARN when rolling back
  - body parsing failures return 400/413/415 instead of silently producing `{}`; body size limit follows the security profile (1mb in production)
  - DTO validation whitelist on by default (strict profile rejects unknown fields); `__proto__`/`constructor` keys never reach DTO instances
  - AOP aspect failures abort the business method unless opted out via `{ onError: 'log' }` or `app.security.aop.onAspectError`
  - After/AfterEach aspects receive the business result via `options.result`
  - GraphQL: profile-driven playground/introspection/depth limits, built-in depth rule, optional complexity package fails startup when configured but missing, CDN-free GraphiQL
  - uploads: profile-driven maxFiles/maxFields/maxFieldsSize, keepExtensions defaults off, array-aware temp cleanup, new `safeFilename` export
  - ops endpoints: minimal liveness body, /ready 503 while draining, /metrics behind the exposeMetrics policy (loopback/RFC1918/allowCidrs/token), Prometheus bound to 127.0.0.1, rateLimit middleware wired (default off)
  - request IDs validated (`[A-Za-z0-9._:-]{1,128}`), query fallback disabled, structured access logs, topology service header opt-in
  - WebSocket: profile maxPayload, perMessageDeflate off, Origin check, connection limits, error-message redaction, slow-consumer guard, timer cleanup on destroy
  - TLS minVersion TLSv1.2 by default; TypeORM production logs errors only with sensitive-parameter redaction; Swagger disabled in production by default
  - defect fixes: escapeHtml (&-escaping, valid entities), ReDoS-safe isNumberString, plugin run() executes once, bootstrap failures propagate, Redis default port 6379, gRPC ListServices, koatty_cli bin (CJS build), RedLocker.resetInstance, config() write loss, CLI sandbox + `apply` dry-run by default

## 4.1.0

### Minor Changes

- build
- build

## 4.0.1

### Patch Changes

- build
