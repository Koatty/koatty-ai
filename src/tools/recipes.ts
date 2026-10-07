/**
 * koatty_ai recipe 引擎：确定性场景组合。
 *
 * recipe 是结构化输入 → koatty_cli 公开生成 API → ChangeSet → 签名计划的
 * 固定管线。输入经 JSON Schema 校验；不支持的组合在写入前拒绝；业务方法
 * 未实现时通过 notes 返回明确待办，不返回假成功数据。
 * recipes/ 目录随包分发，每个 recipe 附带可直接执行的示例参数（有测试覆盖）。
 */

import * as fs from 'fs';
import * as path from 'path';
import { Ajv } from 'ajv';
import {
  DevelopmentPlan,
  GeneratedOutput,
  HttpActionInput,
  applyPlan,
  applySavedPlan,
  loadPlan,
  preparePlan,
  renderHttpActionApi,
  renderComponent,
  renderModule,
  ComponentInput,
  Spec,
  savePlan,
} from 'koatty_cli/generation';
import { AiOperationError, aiResult } from '../result';
import { AiToolDefinition } from './registry';

const ajv = new Ajv({ strict: false });

// MCP 会话内签发的计划保存在连接内存中（连接即边界）；CLI 等无会话调用方
// 显式落盘签名计划（.koatty/plan-key + plans/<id>.json，单次消费）。
const sessionPlans = new WeakMap<object, Map<string, DevelopmentPlan>>();

export interface RecipeDefinition {
  id: string;
  version: 1;
  title: string;
  description: string;
  /** 映射到 koatty_cli 公开生成 API 的固定函数 */
  koattyCliApi: 'renderHttpActionApi' | 'renderComponent' | 'renderModule';
  inputSchema: Record<string, unknown>;
  /** 生成后的业务待实现项（由工具追加到结果 notes） */
  pending: string[];
  /** 使用指南（相对包根的 skill reference 路径） */
  references: string[];
  /** 有测试覆盖的示例输入 */
  example: Record<string, unknown>;
  unsupported: string[];
}

function recipesDir(): string {
  return path.join(__dirname, '..', '..', 'recipes');
}

export function loadRecipes(): RecipeDefinition[] {
  const dir = recipesDir();
  if (!fs.existsSync(dir)) return [];
  const recipes: RecipeDefinition[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(dir, entry.name, 'recipe.json');
    if (!fs.existsSync(file)) continue;
    const recipe = JSON.parse(fs.readFileSync(file, 'utf8')) as RecipeDefinition;
    recipes.push(recipe);
  }
  return recipes.sort((a, b) => a.id.localeCompare(b.id));
}

export function getRecipe(id: string): RecipeDefinition {
  const recipe = loadRecipes().find((r) => r.id === id);
  if (!recipe) {
    throw new AiOperationError(
      'RECIPE_NOT_FOUND',
      `Recipe "${id}" is not available in this installation`,
      `Call recipes (list) for available ids; do not bend business requirements into an unsupported recipe.`
    );
  }
  return recipe;
}

function renderByApi(api: RecipeDefinition['koattyCliApi'], root: string, params: Record<string, unknown>): Promise<GeneratedOutput> {
  if (api === 'renderComponent') return renderComponent(root, params as unknown as ComponentInput);
  if (api === 'renderModule') return renderModule(root, params as unknown as Spec);
  if (api !== 'renderHttpActionApi') {
    throw new AiOperationError('RECIPE_UNSUPPORTED', `Unknown koatty_cli API binding: ${api}`);
  }
  return renderHttpActionApi(root, params as unknown as HttpActionInput);
}

export function recipesTool(): AiToolDefinition {
  return {
    name: 'koatty_ai_recipes',
    command: 'recipes',
    description:
      'List available scenario recipes with input schema, supported/unsupported combinations and tested examples.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Show one recipe in full' } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
    executesProjectCode: false,
    handler: async (input) => {
      const id = input.id as string | undefined;
      if (id) {
        const recipe = getRecipe(id);
        return aiResult('recipes', 'completed', { recipe });
      }
      const recipes = loadRecipes();
      return aiResult('recipes', 'completed', {
        count: recipes.length,
        recipes: recipes.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          inputSchema: r.inputSchema,
          unsupported: r.unsupported,
          example: r.example,
        })),
        note: 'Recipes are deterministic compositions over koatty_cli generation primitives; unsupported inputs are rejected before any write.',
      });
    },
  };
}

export function planRecipeTool(): AiToolDefinition {
  return {
    name: 'koatty_ai_plan',
    command: 'plan',
    description:
      'Render a scenario recipe (or raw changeset) into a signed, conflict-checked plan. Preview by default; savePlan=true explicitly persists CLI plan metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { type: 'string', description: 'Project root (default: cwd)' },
        savePlan: { type: 'boolean', description: 'Explicitly save a signed CLI plan; MCP plans live in the connection' },
        recipe: { type: 'string', description: 'Recipe id (e.g. http-action)' },
        params: { type: 'object', description: 'Recipe input; validate against recipes <id>.inputSchema' },
        changeset: { type: 'object', description: 'Raw koatty_cli changeset (advanced; validated like the CLI)' },
      },
      required: [],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    executesProjectCode: false,
    handler: async (input, ctx) => {
      const recipeId = input.recipe as string | undefined;
      const rawChangeset = input.changeset;
      if (!recipeId && !rawChangeset) {
        throw new AiOperationError(
          'INVALID_ARGUMENT',
          'Provide either {recipe, params} or {changeset}',
          'Call recipes (list) first to pick a recipe and inspect its inputSchema.'
        );
      }
      if (recipeId && rawChangeset) {
        throw new AiOperationError('INVALID_ARGUMENT', 'recipe and changeset are mutually exclusive');
      }

      if (rawChangeset) {
        const plan = preparePlan(ctx.projectRoot, rawChangeset);
        storePlan(ctx, plan, input.savePlan === true);
        return aiResult('plan', 'preview', {
          planId: ctx.session || input.savePlan ? plan.id : undefined,
          hash: plan.hash,
          expires: plan.expires,
          changeset: plan.changeset,
          notes: [],
        });
      }

      const recipe = getRecipe(recipeId!);
      const params = (input.params ?? {}) as Record<string, unknown>;
      const validate = ajv.compile(recipe.inputSchema);
      if (!validate(params)) {
        throw new AiOperationError(
          'INVALID_RECIPE_INPUT',
          `Invalid params for recipe "${recipe.id}": ${ajv.errorsText(validate.errors)}`,
          'Adjust params to the recipe inputSchema; unsupported combinations are rejected before any write.'
        );
      }
      const output = await renderByApi(recipe.koattyCliApi, ctx.projectRoot, params);
      const plan = preparePlan(ctx.projectRoot, output.changeset);
      storePlan(ctx, plan, input.savePlan === true);
      return aiResult('plan', 'preview', {
        planId: ctx.session || input.savePlan ? plan.id : undefined,
        hash: plan.hash,
        expires: plan.expires,
        changeset: plan.changeset,
        outputs: output.outputs,
        generator: output.generator,
        resolved: output.resolved ?? null,
        persisted: !ctx.session && input.savePlan === true,
        notes: [...output.notes, ...recipe.pending],
        references: recipe.references,
        next: ctx.session || input.savePlan ? 'Review the changeset, then apply this planId.' : 'Preview only. Use savePlan=true to persist a CLI plan before apply.',
      });
    },
  };
}

function storePlan(context: { session?: object; projectRoot: string }, plan: DevelopmentPlan, save: boolean): void {
  if (context.session) {
    let plans = sessionPlans.get(context.session);
    if (!plans) {
      plans = new Map();
      sessionPlans.set(context.session, plans);
    }
    for (const [id, old] of plans) if (old.expires < Date.now()) plans.delete(id);
    if (plans.size >= 32) plans.delete(plans.keys().next().value!);
    plans.set(plan.id, plan);
    return;
  }
  if (save) savePlan(context.projectRoot, plan);
}

function retrievePlan(context: { session?: object; projectRoot: string }, planId: string): DevelopmentPlan {
  if (context.session) {
    const plan = sessionPlans.get(context.session)?.get(planId);
    if (!plan) {
      throw new AiOperationError(
        'PLAN_NOT_ISSUED',
        'Plan was not issued by this connection',
        'Plans are session-bound for MCP; create a fresh plan.'
      );
    }
    return plan;
  }
  return loadPlan(context.projectRoot, planId);
}

function consumePlan(
  context: { session?: object; projectRoot: string },
  planId: string,
  dryRun: boolean
): ReturnType<typeof applyPlan> {
  if (context.session) {
    const plan = retrievePlan(context, planId);
    applyPlan(context.projectRoot, plan, true);
    if (!dryRun) sessionPlans.get(context.session!)!.delete(planId); // 会话内单次消费
    return applyPlan(context.projectRoot, plan, dryRun);
  }
  // CLI 模式：签名计划从磁盘加载并在成功路径上消费（rename 为 .consumed）
  return applySavedPlan(context.projectRoot, planId, dryRun);
}

export function applyRecipeTool(): AiToolDefinition {
  return {
    name: 'koatty_ai_apply',
    command: 'apply',
    description:
      'Apply a previously issued plan (single-use, expired and conflict-checked). Without yes=true it only previews.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { type: 'string' },
        planId: { type: 'string', description: 'Plan id returned by koatty_ai_plan' },
        yes: { type: 'boolean', description: 'Actually write; default false (preview only)' },
      },
      required: ['planId'],
      additionalProperties: false,
    },
    annotations: { destructiveHint: true },
    executesProjectCode: false,
    handler: async (input, ctx) => {
      const planId = input.planId as string;
      const yes = !!input.yes;
      const receipt = consumePlan(ctx, planId, !yes);
      return aiResult('apply', yes ? 'applied' : 'preview', {
        ...receipt,
        note: yes
          ? 'Written. Generated framework wiring is editable; run koatty_ai_check and the relevant verify checks after editing.'
          : 'Preview only; pass yes=true to write.',
      });
    },
  };
}
