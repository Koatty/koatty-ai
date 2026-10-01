/**
 * koatty_ai 库入口（main: dist/index.js）。
 *
 * 程序化使用：createMcpServer / startStdioServer（MCP 适配）与
 * buildToolRegistry / runTool（自建宿主集成）。CLI bin 见 dist/cli/index.js。
 * @packageDocumentation
 */

export { createMcpServer, startStdioServer, MCP_SERVER_NAME } from './mcp/server';
export { buildToolRegistry, runTool } from './tools';
export type { AiToolDefinition, ToolContext } from './tools';
export {
  aiResult,
  aiDiagnostic,
  AiOperationError,
  aiOperationResultSchema,
} from './result';
export type { AiOperationResult, AiDiagnostic } from './result';
export { runChecks, CHECK_RULES } from './checks/rules';
export type { CheckDiagnostic, CheckRule } from './checks/rules';
export { loadRecipes, getRecipe } from './tools/recipes';
export type { RecipeDefinition } from './tools/recipes';
