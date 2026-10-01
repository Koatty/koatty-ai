import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/** 构造最小 Koatty 项目夹具（isKoattyApp 通过 package.json 依赖识别） */
export function makeKoattyFixture(
  prefix: string,
  options: { service?: string } = {}
): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  fs.mkdirSync(path.join(root, 'src/service'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src/controller'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src/dto'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '1.0.0', dependencies: { koatty: '^5.0.0' } })
  );
  if (options.service !== undefined) {
    fs.writeFileSync(path.join(root, 'src/service/OrderService.ts'), options.service);
  }
  return root;
}

export function cleanup(root: string): void {
  fs.rmSync(root, { recursive: true, force: true });
}
