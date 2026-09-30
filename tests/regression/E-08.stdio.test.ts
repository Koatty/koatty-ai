import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { hashChangeSet } from '../../src/mcp/tools';

test('actual stdio server enforces plan provenance and safe apply', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'e08-stdio-'));
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  const client = new Client({ name: 'regression', version: '1' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve(__dirname, '../../dist/cli/index.js'), 'mcp', '--root', root],
    cwd: root,
    stderr: 'pipe',
  });
  const call = async (name: string, args: any) => client.callTool({ name, arguments: args });
  try {
    await client.connect(transport);
    expect((await client.listTools()).tools).toHaveLength(10);
    const changeset: any = {
      module: 'unissued',
      changes: [{ type: 'create', path: 'unissued.txt', content: 'no' }],
    };
    expect(
      (await call('koatty_apply', { changeset, hash: hashChangeSet(changeset), dryRun: false }))
        .isError
    ).toBe(true);
    expect(fs.existsSync(path.join(root, 'unissued.txt'))).toBe(false);
    const result = await call('koatty_plan', {
      spec: 'module: item\nfields:\n  id:\n    type: number\n    primary: true\n',
    });
    expect(result.isError).not.toBe(true);
    const plan = JSON.parse((result.content as any)[0].text);
    expect(
      (await call('koatty_apply', { changeset: plan.changeset, hash: plan.hash, dryRun: 0 }))
        .isError
    ).toBe(true);
    expect(
      (await call('koatty_apply', { changeset: plan.changeset, hash: plan.hash })).isError
    ).not.toBe(true);
    expect(fs.existsSync(path.join(root, 'src'))).toBe(false);
    expect(
      (await call('koatty_apply', { changeset: plan.changeset, hash: plan.hash, dryRun: false }))
        .isError
    ).not.toBe(true);
    expect(fs.existsSync(path.join(root, 'src/dto/CreateItemDto.ts'))).toBe(true);
  } finally {
    await client.close();
    await transport.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}, 30000);
