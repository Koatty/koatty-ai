/**
 * koatty_ai capabilities 工具：一次性给出全部工具、参数 schema、
 * 生成能力目录（来自 koatty_cli 的 describeGeneration）与边界说明。
 */

import { describeGeneration } from 'koatty_cli/generation';
import { aiResult } from '../result';
import { AiToolDefinition } from './registry';
import { buildToolRegistry } from './index';

export function capabilitiesTool(): AiToolDefinition {
  return {
    name: 'koatty_ai_capabilities',
    command: 'capabilities',
    description: 'List koatty_ai tools, generation capabilities, support matrix and boundaries.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true },
    executesProjectCode: false,
    handler: async () => {
      const tools = buildToolRegistry().map((tool) => ({
        name: tool.name,
        command: tool.command,
        description: tool.description,
        inputSchema: tool.inputSchema,
        executesProjectCode: tool.executesProjectCode,
        readOnly: !!tool.annotations.readOnlyHint,
      }));
      return aiResult('capabilities', 'completed', {
        package: 'koatty_ai',
        contractVersion: 1,
        skill: 'skills/koatty/SKILL.md',
        tools,
        generation: describeGeneration(),
        boundaries: [
          'Static declarations are not live registrations.',
          'checks/verify report facts; they do not decide business acceptance.',
          'Plans are expired, conflict-checked and single-use; writes only happen on apply.',
        ],
      });
    },
  };
}
