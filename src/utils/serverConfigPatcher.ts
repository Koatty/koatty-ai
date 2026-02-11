import * as fs from 'fs';
import * as path from 'path';

/** 需要特殊配置的协议类型 */
export const PROTOCOL_TYPES = ['grpc', 'graphql', 'websocket', 'ws'] as const;

/** 协议名映射：websocket -> ws */
const PROTOCOL_MAP: Record<string, string> = {
  websocket: 'ws',
  grpc: 'grpc',
  graphql: 'graphql',
  ws: 'ws',
};

/**
 * 在 config/server.ts 的 protocol 中增加指定协议
 * 仅 grpc、graphql、websocket(ws) 需要处理
 */
export function addProtocolToServerConfig(
  cwd: string,
  protocolType: string
): boolean {
  const normalized = PROTOCOL_MAP[protocolType?.toLowerCase()] ?? protocolType?.toLowerCase();
  if (!['grpc', 'graphql', 'ws'].includes(normalized)) {
    return false;
  }

  const serverPath = path.join(cwd, 'src/config/server.ts');
  if (!fs.existsSync(serverPath)) {
    return false;
  }

  let content = fs.readFileSync(serverPath, 'utf-8');

  // 检查是否已包含该协议
  if (content.includes(`'${normalized}'`) || content.includes(`"${normalized}"`)) {
    return false;
  }

  // 解析 protocol 字段：可能是 protocol: "http" 或 protocol: ["http"]
  const protocolMatch = content.match(/protocol:\s*(\[[\s\S]*?\]|["'][^"']*["'])/);
  if (!protocolMatch) {
    return false;
  }

  const orig = protocolMatch[1].trim();
  let newProtocol: string;

  if (orig.startsWith('[')) {
    // 已是数组，追加
    const arr = orig
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
    if (arr.includes(normalized)) return false;
    arr.push(normalized);
    newProtocol = `[${arr.map((p) => `"${p}"`).join(', ')}]`;
  } else {
    // 字符串，转为数组并添加
    const current = orig.replace(/^["']|["']$/g, '');
    const protocols = current ? [current, normalized] : ['http', normalized];
    newProtocol = `[${protocols.map((p) => `"${p}"`).join(', ')}]`;
  }

  content = content.replace(/protocol:\s*(\[[\s\S]*?\]|["'][^"']*["'])/, `protocol: ${newProtocol}`);
  fs.writeFileSync(serverPath, content, 'utf-8');
  return true;
}
