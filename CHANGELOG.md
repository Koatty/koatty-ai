# koatty_cli

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
