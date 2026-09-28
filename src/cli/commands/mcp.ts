import { Command } from 'commander';
import * as path from 'path';
import { startStdioServer } from '../../mcp/server';
import { version } from '../../../package.json';

interface McpCommandOptions {
  root?: string;
}

/**
 * MCP command (roadmap Phase E, item E-2).
 *
 * `koatty mcp` exposes the project to AI IDEs over stdio: read-only tools
 * (manifest / routes / explain_component / plan / docs), a hash-guarded
 * `koatty_apply`, and a sandboxed `koatty_test` runner.
 */
export function registerMcpCommand(program: Command) {
  program
    .command('mcp')
    .description('Start the MCP server (stdio transport) for Cursor / Claude Code')
    .option('--root <path>', 'Project root (default: current directory)')
    .action(async (options: McpCommandOptions) => {
      const root = path.resolve(process.cwd(), options.root ?? '.');
      try {
        await startStdioServer(root, version);
        // stdout carries the MCP protocol; diagnostics must go to stderr.
        console.error(`koatty mcp listening on stdio (root: ${root})`);
      } catch (error) {
        console.error(`Error starting MCP server: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}
