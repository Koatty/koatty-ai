# Verification and delivery evidence

Use a test that fails when the requested behavior is absent. A module export or `expect(true)` does not prove route/service behavior.

## HTTP / framework bootstrap

Compile before tests that load `dist`. Use an undecorated Koatty subclass with `createTestApp`, then `createHttpTest(wrapper.app)`. Never import an auto-starting `@Bootstrap()` entry in such a test. Always stop the wrapper, including failures. Set test-specific configuration through supported app/config seams.

For a route change, check a valid request and an invalid DTO, plus whether business writes were invoked. Check authorization before the side effect. Repository spies establish service/validation behavior; add real database acceptance when database behavior is part of the request.

## MCP and Agent

A minimal business MCP regression checks listTools, valid call, invalid input, missing scope, rejected/missing approval and unchanged business state on denial. Validate the declared output shape too. Exercise HTTP or stdio separately from an in-memory transport; they have distinct lifetime/auth/cancellation paths.

For SSE, verify readable events and termination, disconnect cancellation, provider cleanup and safe errors. Scripted providers make deterministic regression tests; report them as mocks.

For checkpointed runs, verify worker recreation, concurrent lease acquisition, stale definition, cancellation, unknown tool outcome, revision-bound reconciliation and no duplicate business operation. Include a process-level interruption test and the actual deployment store when claiming durable production recovery.

## CLI

Use `verify --json` if supported. It invokes installed tools, reports each check and fails on missing dependencies or failing checks. A successful `apply` performs type verification by default; it does not run every behavior test. `--no-validate` means only applied. Generated default HTTP smoke loads compiled controllers, so build before `verify --checks test`.

Test both CLI and development MCP for changed contracts. A read-only plan must not write files; explicit saved-plan metadata is a separate operation. Test conflicts, consumption, path escape and rollback after injected I/O failure. Never automatically discard `.koatty-apply-*` recovery artifacts.

## Monorepo maintenance only

When working in the Koatty monorepo, follow its AGENTS.md: inspect dirty submodules, add regression coverage for behavior changes, update package CHANGELOG and `docs/migration`, and use the prescribed build order. Do not apply monorepo release commands to an ordinary generated application.

Workspace tests and local dist can mask packaging problems. For a release or new template dependency, check tarball contents and an isolated installation. Keep fresh-install, real provider, shared-store, external-client and deployment evidence separate; never turn a local green test count into a release claim.
