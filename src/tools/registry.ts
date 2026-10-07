/**
 * koatty_ai Tools 注册层。
 *
 * 工具是少量、框架专用、输入明确的能力面：CLI（bin: koatty-ai）与 MCP
 * （stdio server）共用同一组 handler 与错误语义。参数缺失或不支持时立即
 * 返回失败 envelope，自动化路径绝不进入交互询问。
 */

import * as fs from 'fs';
import * as path from 'path';
import { Ajv } from 'ajv';
import { resolveInside } from 'koatty_cli/project';
import {
  AiDiagnostic,
  AiOperationError,
  AiOperationResult,
  aiDiagnostic,
  aiOperationResultSchema,
  aiResult,
} from '../result';

export interface ToolContext {
  /** 项目根；所有路径参数都相对它解析并校验边界 */
  projectRoot: string;
  signal?: AbortSignal;
  /** MCP 连接会话对象；存在时计划保存在连接内存中，否则落盘为签名计划 */
  session?: object;
}

export interface AiToolDefinition {
  /** MCP 工具名（koatty_ai_* 前缀，避免与传统 CLI 的 koatty_* 工具冲突） */
  name: string;
  /** CLI 子命令名 */
  command: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  annotations: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
  /** verify/test 会执行项目代码；其余工具只读 */
  executesProjectCode: boolean;
  handler: (input: Record<string, unknown>, context: ToolContext) => Promise<AiOperationResult>;
}

const ajv = new Ajv({ strict: false });

/** 校验 envelope 契约；koatty_ai 的每个工具输出都必须通过 */
export function assertEnvelope(result: AiOperationResult): void {
  const validate = ajv.compile(aiOperationResultSchema);
  if (!validate(result)) {
    throw new AiOperationError(
      'CONTRACT_VIOLATION',
      `Tool output violated the v1 envelope: ${ajv.errorsText(validate.errors)}`
    );
  }
}

function validateInput(tool: AiToolDefinition, input: Record<string, unknown>): void {
  const validate = ajv.compile(tool.inputSchema as object);
  if (!validate(input)) {
    throw new AiOperationError(
      'INVALID_ARGUMENT',
      `Invalid input for ${tool.name}: ${ajv.errorsText(validate.errors)}`
    );
  }
}

/**
 * 统一执行入口：输入校验 → handler → envelope 校验。
 * CLI 与 MCP 都从这里走，保证同输入同输出。
 */
export async function runTool(
  tool: AiToolDefinition,
  rawInput: unknown,
  context: ToolContext
): Promise<AiOperationResult> {
  const input = (rawInput ?? {}) as Record<string, unknown>;
  try {
    validateInput(tool, input);
    const root = path.resolve(context.projectRoot);
    if (typeof input.root === 'string' && path.resolve(input.root) !== root) {
      throw new AiOperationError('ROOT_MISMATCH', 'Tool root must match the host-selected project root');
    }
    context.signal?.throwIfAborted();
    const result = await tool.handler(input, { ...context, projectRoot: root });
    assertEnvelope(result);
    return result;
  } catch (error) {
    const diagnostics: AiDiagnostic[] = [aiDiagnostic(error)];
    return aiResult(tool.command, 'failed', null, diagnostics);
  }
}

/** 解析项目根参数：显式 --root 或 cwd；返回绝对路径（不校验是否 Koatty 项目，交给各工具） */
export function resolveRoot(input: { root?: string }): string {
  return path.resolve(input.root ?? process.cwd());
}

/** 限定在项目根内解析相对路径；越界立即拒绝 */
export { resolveInside };

/** 读取项目内已安装框架包版本（node_modules/<name>/package.json），未知返回 null */
export function installedVersions(root: string, names: string[]): Record<string, string | null> {
  const versions: Record<string, string | null> = {};
  for (const name of names) {
    const file = path.join(root, 'node_modules', name, 'package.json');
    try {
      if (fs.existsSync(file)) {
        versions[name] = String(JSON.parse(fs.readFileSync(file, 'utf8')).version ?? null);
      } else {
        versions[name] = null;
      }
    } catch {
      versions[name] = null;
    }
  }
  return versions;
}
