---
name: koatty
description: Build, modify, and diagnose Koatty TypeScript backend applications, including HTTP/gRPC/WebSocket services, MCP tools, and LLM or checkpointed Agent workflows. Use for Koatty application code and its CLI development workflow; do not assume these APIs exist in unrelated Node.js frameworks.
---

# Koatty application engineering

Deliver working application behavior using the project's installed Koatty APIs. Prefer the existing Service, DTO, container, configuration and lifecycle over a parallel implementation.

## Establish the actual contract

Inspect the target project's instructions, package.json, lockfile, tsconfig and current changes before choosing commands. Package names use underscores (`koatty_cli`, `koatty_mcp`); the CLI executable is `koatty` or `kt`. A monorepo directory such as `koatty-ai` is not the package name.

Use the installed project CLI, normally `./node_modules/.bin/koatty`. Start with `--version`, `--help` and, if listed, `capabilities --json` and `doctor --json`. New operations in this skill must be feature-detected: a matching version number alone does not prove a locally modified or previously published CLI implements them. Do not download a newer CLI merely to inspect a project.

Read the static `manifest --validate`. Check `unresolved` and `mcp.coverage` before relying on its schemas. `collectionMode: static` describes declarations, not live registration; `runtime.files` is the Loader's compiled-file inventory. Neither proves runtime authentication, provider connectivity or application correctness.

## Choose the relevant guide

- Project creation, CRUD, noninteractive plans, conflicts and failure diagnosis: [development.md](references/development.md).
- HTTP/gRPC/WebSocket, DI, configuration, validation, optional extensions: [framework.md](references/framework.md).
- Business MCP, LLM streaming and checkpointed Agent execution: [mcp-agent.md](references/mcp-agent.md).
- Meaningful tests and deployment evidence: [verification.md](references/verification.md).

Read only the guides needed for the request. For version-sensitive APIs beyond these guides, inspect installed declarations and the corresponding package documentation before writing code.

## Preserve these framework invariants

- Controller and MCP adapters parse/authorize input and call Services. Keep business logic and transactions in Services; do not auto-expose every service method as a tool.
- Use `app.container` and `app.paths.*`. Do not replace global IOC or write process environment variables to route framework state. Credentials may be read at the application composition boundary, but never include their values in manifests, reports or logs.
- Keep DTO class names and filenames aligned with the Loader. Use existing `@Validated({ types: [...] })` and property validators; do not invent `@Agent`, `@McpController`, `@BodyDto` or other decorators.
- Default to the project's supported decorator mode. Current DTO integrations use legacy decorators and emitted metadata; do not migrate them to TC39 syntax merely because a method decorator supports both modes.
- Development MCP (`koatty mcp`) can change project files or run tests. Business MCP (`createMcpHost`) exposes application capabilities. Keep their authority and transport configuration separate.
- Read-only, idempotent and destructive annotations describe intent. Enforce authentication, scopes, approval and business idempotency in the execution path.
- For plan conflicts, expired/consumed plans or ambiguous tool results, use the documented recovery operation. Do not bypass checks or automatically replay a write.

## Complete the requested behavior

Prefer a reviewable plan for generated changes, apply within the user's authorized scope, and run checks appropriate to the affected path. Follow existing authorization; this skill does not require a new confirmation for every ordinary code edit and does not authorize deployment, publication or messages to others.

Distinguish `preview`, `applied`, `completed` and `failed`. A successful apply verifies only its configured checks; run relevant behavior/protocol tests too. If verification fails after writes, inspect the returned receipt and current files instead of reapplying a consumed plan.

Report what changed, which checks actually ran, and any remaining external acceptance. Do not call mocked providers, local workspace dependencies, in-memory MCP transports or static manifests production acceptance.
