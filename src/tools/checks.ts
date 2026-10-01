/**
 * koatty_ai check / verify / doctor 工具。
 *
 * check：Koatty 专用静态规则（文件/行号、规则 ID、原因、修复建议、正确示例引用）。
 * verify：复用 koatty_cli 的 types/test/lint/manifest 检查底座，只执行项目内
 *         已安装工具，不安装依赖；结果只陈述实际覆盖范围。
 */

import { verify as cliVerify, diagnoseProject } from 'koatty_cli/project';
import { aiResult } from '../result';
import { AiToolDefinition } from './registry';
import { runChecks } from '../checks/rules';

export function checkTool(): AiToolDefinition {
  return {
    name: 'koatty_ai_check',
    command: 'check',
    description:
      'Run Koatty-specific static checks (DTO naming, global IOC usage, duplicate routes). Reports facts with ruleId/file/line/suggestion; it does not decide business correctness.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { type: 'string', description: 'Project root (default: cwd)' },
        rules: { type: 'array', items: { type: 'string' }, description: 'Rule ids (default: all)' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
    executesProjectCode: false,
    handler: async (input, ctx) => {
      const diagnostics = runChecks(ctx.projectRoot, { rules: input.rules as string[] | undefined });
      return aiResult('check', 'completed', {
        root: ctx.projectRoot,
        diagnostics,
        counts: {
          error: diagnostics.filter((d) => d.severity === 'error').length,
          warning: diagnostics.filter((d) => d.severity === 'warning').length,
          info: diagnostics.filter((d) => d.severity === 'info').length,
        },
        boundaries: [
          'Static checks do not prove business correctness; behavior tests remain the authority.',
          'Dynamic routes/registrations are not judged.',
        ],
      });
    },
  };
}

export function verifyTool(): AiToolDefinition {
  return {
    name: 'koatty_ai_verify',
    command: 'verify',
    description:
      'Run installed project checks (types/test/lint/manifest) without installing tools. Executes trusted project code.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { type: 'string' },
        checks: {
          type: 'array',
          minItems: 1,
          items: { enum: ['types', 'test', 'lint', 'manifest'] },
        },
        file: { type: 'string', description: 'Single test file below test/ or tests/' },
        timeout: { type: 'integer', minimum: 1, maximum: 600000 },
      },
      additionalProperties: false,
    },
    annotations: {},
    executesProjectCode: true,
    handler: async (input, ctx) => {
      const result = await cliVerify(ctx.projectRoot, {
        checks: input.checks as Array<'types' | 'test' | 'lint' | 'manifest'> | undefined,
        file: input.file as string | undefined,
        timeoutMs: input.timeout as number | undefined,
        signal: ctx.signal,
      });
      return result;
    },
  };
}

export function doctorTool(): AiToolDefinition {
  return {
    name: 'koatty_ai_doctor',
    command: 'doctor',
    description: 'Diagnose installed project dependencies and static contracts without starting the app.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true },
    executesProjectCode: false,
    handler: async (_input, ctx) => diagnoseProject(ctx.projectRoot),
  };
}
