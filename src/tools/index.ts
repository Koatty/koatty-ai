/**
 * koatty_ai Tools 注册表：CLI 与 MCP 共用同一组 handler、schema 与错误语义。
 */

import { skillTool } from './skill';
import { AiToolDefinition } from './registry';
import { capabilitiesTool } from './capabilities';
import { contextTool } from './context';
import { docsTool } from './docs';
import { applyRecipeTool, planRecipeTool, recipesTool } from './recipes';
import { checkTool, doctorTool, verifyTool } from './checks';

export * from './registry';
export type { ToolContext, AiToolDefinition } from './registry';

let cached: AiToolDefinition[] | null = null;

/** 全部 koatty_ai 工具（MCP koatty_ai_* 名称与 CLI 子命令一一对应） */
export function buildToolRegistry(): AiToolDefinition[] {
  if (!cached) {
    cached = [
      capabilitiesTool(),
      contextTool(),
      docsTool(),
      recipesTool(),
      planRecipeTool(),
      applyRecipeTool(),
      checkTool(),
      verifyTool(),
      doctorTool(),
      skillTool(),
    ];
  }
  return cached;
}

export { loadRecipes, getRecipe } from './recipes';
export type { RecipeDefinition } from './recipes';
