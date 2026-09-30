# Framework map and implementation decisions

## Composition and lifecycle

`koatty` re-exports core, container, exception, router and serve APIs, plus `Config`, logger and bootstrap helpers. It does not automatically export all optional AI packages. Import `Tool` from `koatty_mcp`, `Validated` from `koatty_validation`, and property constraints from `class-validator`.

Typical application paths: `src/App.ts`, `src/config`, `src/controller`, `src/service`, `src/dto`, `src/model`, `src/aspect`, `src/plugin`, `src/middleware`, `test`. Read the existing project's layout before inventing a new one. Keep exported class names consistent with source filenames for Loader discovery.

`@Bootstrap()` starts the application on import. `createApplication(AppClass)` initializes without listening and is appropriate for test/serverless composition; use an undecorated subclass. Close servers/transports and call application stop during teardown. Do not create a second server solely to mount business MCP: use `createMcpHttpAdapter({host}).middleware` on the existing app.

The application-scoped container and request context own DI/lifecycle. Use `@Service`, `@Autowired`, `@Before` / `@Around` and existing request-scope facilities. Capture identity from authenticated context; never keep the current caller in a singleton field or substitute a process-wide variable. Container/AOP exceptions must not silently allow the protected operation to run.

## HTTP and DTOs

Use the project's existing route decorators such as `@Controller`, `@GetMapping`, `@PostMapping`, `@RequestBody`, `@PathVariable`, and `@Get` for query extraction. Parameter ordering must match `@Validated({types: [...]})`; do not assume the first argument is always a DTO when route parameters and DTOs are mixed.

DTO example (`src/dto/CreateArticleDto.ts`):

```ts
import { IsString, Length } from 'class-validator';
export class CreateArticleDto {
  @IsString()
  @Length(1, 120)
  title!: string;
}
```

Use `@IsOptional()` for optional validation, not TypeScript `?` alone. `@Validated` is a runtime validation boundary; static manifest schemas are projections. Custom validators, nested policies, inheritance or dynamic schemas can remain unresolved. Test actual invalid input and ensure the Service/repository write was not reached.

Production security profiles centralize validation, transport limits and operational endpoint policy. Inspect the installed profile/schema and the application's explicit overrides; do not disable strict validation, Origin/auth checks or fail-closed AOP simply to pass a test.

## Optional packages: choose only what the application needs

| Need | Existing package / seam | What to verify |
|---|---|---|
| Typed configuration and environment overlays | koatty_config, Config / LoadConfigs / validateConfig | Schema is valid; required keys exist; output only keys/types, not values. |
| Relational persistence | koatty_typeorm + TypeORM | Driver/connection/migrations and transaction boundaries; generated CRUD is not proof of DB correctness. |
| Store/cache | koatty_store / koatty_cacheable | TTL, key scope and backend behavior; plain get/set is not atomic CAS or atomic budget reservation. |
| Scheduled work | koatty_schedule | Overlap policy, distributed lock backend and process shutdown; do not make an HTTP request carry long work. |
| gRPC / WebSocket / GraphQL | router/serve plus protocol dependencies | Protocol configuration, proto/schema generation, real clients, stream cancellation and applicable Origin/auth controls. |
| SSE | streamSSE from koatty_router | Forward its signal; honor backpressure; stop provider work on disconnect; emit safe terminal errors. |
| Serverless | koatty_serverless createHandler | Undecorated app class, supported platform adapter, cold-start/resource reuse; platform acceptance is separate. |
| AI observability | koatty_trace createGenAiRecorder | Provider attempt and tool spans; usage/error/approval linkage; raw content off unless explicitly masked. |

Prefer installed source/declarations over old README snippets for optional APIs. Do not force every optional dependency into a simple application.
