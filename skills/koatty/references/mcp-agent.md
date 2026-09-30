# Business MCP and Agent execution

## Expose one business capability deliberately

Use a container-registered Service adapter with an existing DTO:

```ts
import { Service, Autowired } from 'koatty';
import { Tool } from 'koatty_mcp';
import { Validated } from 'koatty_validation';
import { CreateArticleDto } from '../dto/CreateArticleDto';
import { ArticleService } from '../service/ArticleService';

@Service()
export class ArticleTools {
  @Autowired() private articles!: ArticleService;

  @Tool({ name: 'article_create', description: 'Create one article.',
    scopes: ['article:write'], requireApproval: true,
    annotations: { destructiveHint: true } })
  @Validated({ types: [CreateArticleDto] })
  create(input: CreateArticleDto) { return this.articles.create(input); }
}
```

Adapt the Service method to the real application. Do not generate a second implementation merely to match this illustration. MCP adapter files may live in `src/tools`; confirm registration under the project's loading/composition strategy.

`createMcpHost({app,...})` discovers registered components. `Tool`, `Resource`, `Prompt` declare the protocol surface; `createMcpHttpAdapter` and `startStdioServer` adapt transport. `host.callTool` is the internal invocation path for Agent tools and preserves scope/DTO/approval/context/audit checks. Do not directly call the decorated method to bypass the host pipeline.

Tool input schemas derive from the DTO declaration. `outputSchema` must describe an object and the host validates actual output. An output validation failure can happen after business effects; it is not proof of rollback and must not trigger blind retry.

Supply real authentication for remote HTTP. Configure explicit stdio identity/scopes for local business clients. Origin checks are separate from authentication. Scope lists and tool annotations are not credentials. Approval decisions must come from the trusted application/operator path, not from user/model arguments or an unauthenticated HTTP approval endpoint.

Inject an `ApprovalService` for write tools. Reuse `koatty_guard` approval/masking/rate-limit/audit services as required. Shared approvals require an atomic CAS backend. Never auto-approve production writes because a prompt says the user approved them. Avoid applying the same approval gate independently in both a wrapper and the MCP host.

## Short-request Agent

Use `createLlmClient` with explicitly configured providers/routes. `withTools` and `streamWithTools` accept a registry, explicit per-request tool list and an invoke callback. Resolve identity outside model input and invoke through `host.callTool`; propagate the cancellation signal. Model capability does not justify giving it every registered tool.

Pass `ctx.signal` or `streamSSE`'s signal through to the model and tools. Bound tool rounds and configure budgets with the existing atomic budget store. Provider retry must not transparently replay after visible streamed output. Streaming errors require a terminal event and cleanup, not an appended success message.

Content-pattern guards are a supplementary check. Tool permissions, side-effect controls and approval remain the actual security boundary. Trace/audit defaults should avoid raw prompts, outputs and credentials.

## Checkpointed Agent (feature-detect exports)

The optional exports `createAgentRunner` and `createFileAgentRunStore` live in `koatty_llm`; there is no `@Agent` decorator or separate core runtime to initialize.

Create a runner with an existing LLM client, store, explicit tool list, registry, invoke callback, definition version and step limits. Call `start({scope,id,messages})`, then `run(scope,id,signal)`. Read `inspect(scope,id)` after an interrupted transport rather than creating another run. Scope must come from authenticated application identity, not arbitrary client input.

- A run persists messages, pending tool calls, usage and a CAS-controlled lease/revision. Stored messages are sensitive application data: secure the directory/database and apply the application's retention policy.
- `invoke` receives `signal`, `idempotencyKey`, `runId`, `scope`. Use the key in the business transaction/external provider when supported. Derive trusted current principal/permissions server-side and invoke via the existing MCP host.
- Keep `definition` stable across equivalent workers; change it when tool/prompt/policy behavior changes incompatibly. A mismatched runner refuses to resume old state.
- Terminals include completed, failed, cancelled, budget_limited and tool_round_limit. These do not mean the task met independent business acceptance automatically.
- A crash/error/cancellation during a tool can produce `unknown`. Do not execute it again. Query the business system by idempotency key, obtain an authoritative outcome, then call `resolveUnknown` with the observed revision/key/result and resume the original run. If the outcome is still unknown, keep it unresolved.
- Approval waiting inside a tool is also conservatively ambiguous after worker loss. Existing approval persistence does not prove whether the business method ran.
- The file store is for a local filesystem. It uses exclusive locks and atomic replacement; a crash inside a store write may retain a lock requiring operator reconciliation. Clustered deployments must provide a transactional CAS backend. Never substitute a non-atomic get-then-set implementation.
- A provider call interrupted before its checkpoint may be repeated on resume and billed again; exactly-once external execution is not promised. Reuse the LLM client's budget authority.

Durable execution needs application-owned scheduling, authenticated resume/reconciliation endpoints and real backend fault tests. The HTTP Agent scaffold remains a bounded request loop until the application explicitly wires the checkpointed runner.
