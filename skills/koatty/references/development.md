# Development workflow

## New application

After resolving an installed CLI that advertises these recipes:

```bash
./node_modules/.bin/koatty new order-tools --template mcp --offline --json
./node_modules/.bin/koatty new support-app --template agent --offline --json
```

Use `project` for the standard HTTP scaffold and `middleware` / `plugin` for component libraries. `mcp` and `agent` use an explicit composition factory in `src/application.ts`; standard `project` uses `@Bootstrap()` in `src/App.ts`.

Generation does not install dependencies or start services. Default source is the bundled template, so an old user cache cannot silently replace it. `.koatty/template-lock.json` records CLI version, selected template digest, recipe and generated output digest. `--template-digest <sha256>` rejects a different template snapshot. Full output reproducibility also requires the same CLI/recipe/skill bytes. Explicit `--source cache` selects a cache; `--offline` forbids downloading it.

MCP examples have in-memory greeting state, not a production repository. The Agent recipe requires explicit provider configuration and allows only its read tool. Add persistence, business validation, policies and budget configuration according to the user's actual application.

## Existing project: generate a module

Example `article.yml`:

```yaml
module: article
fields:
  id:
    name: id
    type: number
    primary: true
  title:
    name: title
    type: string
    required: true
    length: 120
api:
  type: rest
  basePath: /articles
  endpoints: []
dto:
  create: true
  update: true
  query: true
```

```bash
./node_modules/.bin/koatty plan --spec article.yml --save-plan --json
# Read data.planId, review the exact changeset, then use that returned ID:
./node_modules/.bin/koatty apply --plan <returned-id> --yes --json
./node_modules/.bin/koatty verify --checks types,test --json
```

Without `--save-plan`, planning is read-only. Saving explicitly writes local plan metadata. Without `--yes`, apply previews. Saved CLI plans expire after ten minutes, bind to the project/source state and are consumed once. They use a project-local signature; this protects the invocation contract, not against another actor who already controls that filesystem/account. Do not put plan keys, consumed receipts or conversation artifacts in commits.

MCP uses `koatty_plan` followed by `koatty_apply` with the exact returned hash/changeset in the same connection. `dryRun` defaults to true. CLI-saved IDs and MCP session plans are intentionally not interchangeable. Read `structuredContent` for operation status; older tools may only provide text JSON. Tool test results may contain `passed:false`; do not infer success from transport completion.

New-file collisions fail rather than overwriting application code. CRUD generators are for creating modules, not arbitrary semantic modification of an existing implementation. For an existing Service, edit the relevant code while preserving its conventions and add behavior tests; do not delete existing files just to make a generator run.

`controller`, `service`, `dto`, `model`, `proto`, `aspect`, `middleware` and `plugin` retain explicit creation commands. Interactive `add` is for a human terminal; use Spec/plan/apply for automation. SQL conversion is a separate explicit file-writing command; review unknown SQL type mappings before applying.

## Diagnose by code and evidence

| Result | Next action |
|---|---|
| DEPENDENCY_MISSING | Install declared project dependencies using its lockfile/package manager; verify again. Verification never installs tools. |
| CONFIG_MISSING | Locate/create the intended project tsconfig; do not typecheck a different directory. |
| PLAN_CONFLICT / FILE_EXISTS | Inspect concurrent edits and regenerate or make an explicit targeted modification. |
| PLAN_EXPIRED / PLAN_NOT_ISSUED | Obtain a fresh plan. Check whether prior writes already happened before retrying. |
| PLAN_TAMPERED | Reject altered input; do not recalculate signatures to bypass validation. |
| CHECK_FAILED / CHECK_TIMEOUT | Inspect individual check output and repair the cause. Writes may already be present. |
| STATIC_UNRESOLVED | Inspect identified source and validate runtime behavior; do not treat it as a resolved contract. |

`verify --checks types,test,lint,manifest` is explicit: choose only checks the application requires and supports. Typecheck/lint do not auto-fix. User tests/configs execute code and can have effects; path restrictions are not an OS sandbox. Build first when tests load `dist`.
