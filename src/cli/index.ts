#!/usr/bin/env node
/**
 * koatty-ai — koatty_ai Tools 的本地非交互执行入口。
 *
 * 设计约定：
 * - stdout 只输出 v1 envelope（机器结果）；进度/提示走 stderr；
 * - 非交互：参数缺失或不支持时立即返回失败 envelope，不进入询问；
 * - 自动化路径（MCP/库调用）与 CLI 共用同一 handler，同输入同输出。
 */

import { Command, CommanderError } from 'commander';
import * as path from 'path';
import { startStdioServer } from '../mcp/server';
import { createRequire } from 'module';
import { AiToolDefinition, buildToolRegistry, runTool, ToolContext } from '../tools';
import { aiResult } from '../result';

const nodeRequire = createRequire(__filename);
const { version, description } = nodeRequire('../../package.json') as { version: string; description: string };

const program = new Command();
program.configureOutput({ writeErr: () => undefined });
program.exitOverride();
program
  .name('koatty-ai')
  .description(description)
  .version(version, '-v, --version', 'Output the current version');

/** 数组型参数以逗号分隔（--checks types,manifest）；对象型参数为 JSON 字符串（--params '{...}'） */
function coerce(
  input: Record<string, unknown>,
  schema: { properties: Record<string, unknown> }
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const property = schema.properties[key] as { type?: string } | undefined;
    if (property?.type === 'object' && typeof value === 'string') {
      try {
        output[key] = JSON.parse(value);
      } catch {
        output[key] = value; // 交给工具层校验并给出可读错误
      }
    } else if (property?.type === 'array' && typeof value === 'string') {
      output[key] = value.split(',').map((item) => item.trim()).filter(Boolean);
    } else if (property?.type === 'integer' && typeof value === 'string') {
      const parsed = Number(value);
      output[key] = Number.isNaN(parsed) ? value : parsed;
    } else {
      output[key] = value;
    }
  }
  return output;
}

/** 解析通用参数并执行工具；输出 v1 envelope JSON 到 stdout */
async function runToolCommand(command: string, options: Record<string, unknown>): Promise<void> {
  const tool = buildToolRegistry().find((t) => t.command === command);
  if (!tool) {
    process.stdout.write(
      `${JSON.stringify(aiResult(command, 'failed', null, [{ code: 'INVALID_ARGUMENT', message: `Unknown command: ${command}` }]))}\n`
    );
    process.exitCode = 1;
    return;
  }
  const context: ToolContext = {
    projectRoot: path.resolve(String(options.root ?? process.cwd())),
    // CLI 无会话：计划落盘为签名计划（.koatty/plans/<id>.json，单次消费）
  };
  const args = { ...options };
  if (!tool.inputSchema.properties.root) delete args.root;
  const result = await runTool(tool, coerce(args, tool.inputSchema), context);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.status === 'failed' || result.status === 'cancelled') process.exitCode = 1;
  // verify 执行项目代码：stderr 给最低限度的进度提示
  if (tool.executesProjectCode) {
    process.stderr.write(`[koatty-ai] ${command} executed project checks; inspect the envelope for results.\n`);
  }
}

function register(tool: AiToolDefinition): void {
  const cmd = program.command(tool.command).description(tool.description);
  for (const [name, schema] of Object.entries(tool.inputSchema.properties)) {
    if ((schema as { type?: string }).type === 'boolean') { cmd.option(`--${name}`, 'Enable this option'); continue; }
    const description =
      (schema as { description?: string } | undefined)?.description ?? '';
    cmd.option(`--${name} <value>`, description);
  }
  if (!tool.inputSchema.properties.root) cmd.option('--root <path>', 'Project root');
  cmd.option('--json', 'JSON output (the default)');
  cmd.action(async (options: Record<string, unknown>) => {
    const input = { ...options };
    delete input.json;
    if (!tool.inputSchema.properties.root) delete input.root;
    // Keep CLI root selection separate from the tool input schema.
    await runToolCommand(tool.command, { ...input, ...(options.root ? { root: options.root } : {}) });
  });
}

for (const tool of buildToolRegistry()) register(tool);

program.command('mcp').description('Start project-bound MCP over stdio')
  .option('--root <path>', 'Project root')
  .action(async (options) => { await startStdioServer(path.resolve(options.root ?? process.cwd()), version); });
program.configureOutput({ writeErr: () => undefined });
program.exitOverride();
void program.parseAsync(process.argv).catch((error: unknown) => {
  if (error instanceof CommanderError && error.exitCode === 0) return;
  process.stdout.write(JSON.stringify(aiResult('cli', 'failed', null, [{ code: 'INVALID_ARGUMENT', message: error instanceof Error ? error.message : String(error) }])) + '\n');
  process.exitCode = 1;
});

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
