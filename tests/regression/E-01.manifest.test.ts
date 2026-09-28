/**
 * E-01 regression tests: `koatty manifest` (roadmap Phase E, item E-1).
 *
 * The collector is static, so the fixture is a small on-disk Koatty-shaped
 * project written into a temp directory: controller with middleware/aspects,
 * service with constructor injection, a DTO, and config files whose *values*
 * must never appear in the manifest.
 *
 * @License MIT
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  collectManifest,
  renderManifestMarkdown,
  validateManifest,
} from '../../src/manifest';

function writeFixture(root: string): void {
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'fixture-app', dependencies: { koatty: '^4.5.0' } }),
    'tsconfig.json': JSON.stringify({ compilerOptions: { experimentalDecorators: true } }),
    'config/server.ts': `export default () => ({\n  protocol: 'http',\n  port: 8080,\n});\n`,
    'config/security.ts': `export default () => ({ profile: 'strict' });\n`,
    'config/redis.ts': `export default () => ({ host: 'db.internal.example', password: 'super-secret-value' });\n`,
    'src/controller/UserController.ts': `
import { Controller, GetMapping, PostMapping, Body, Query } from 'koatty';

@Controller('/users')
export class UserController {
  constructor(private userService: UserService) {}

  @Around(CacheAspect)
  @GetMapping('/:id', { middleware: [AuthMiddleware] })
  detail(@Query() id: string) {
    return this.userService.find(id);
  }

  @PostMapping('/')
  create(@Body() dto: CreateUserDto) {
    return dto;
  }
}
`,
    'src/service/UserService.ts': `
@Service()
export class UserService {
  constructor(private repo: UserRepository) {}

  find(id: string) { return { id }; }
}
`,
    'src/dto/CreateUserDto.ts': `
export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  age: number;
}
`,
  };

  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf-8');
  }
}

describe('E-01: koatty manifest', () => {
  let root: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'koatty-manifest-'));
    writeFixture(root);
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('collects components, routes, DTOs and aspect metadata', () => {
    const manifest = collectManifest(root);

    expect(manifest.koatty).toBe('4.5.0');
    expect(manifest.decoratorMode).toBe('legacy');
    expect(manifest.protocols).toEqual(['http']);
    expect(manifest.security.profile).toBe('strict');

    const ids = manifest.components.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['UserController', 'UserService']));
    expect(manifest.components.find((c) => c.id === 'UserService')?.type).toBe('SERVICE');
    expect(manifest.components.find((c) => c.id === 'UserService')?.dependsOn).toEqual(['UserRepository']);

    const routes = manifest.routes;
    expect(routes).toHaveLength(2);
    const detail = routes.find((r) => r.handler === 'detail')!;
    expect(detail).toMatchObject({
      protocol: 'http',
      method: 'GET',
      path: '/users/:id',
      controller: 'UserController',
      handler: 'detail',
      middleware: ['AuthMiddleware'],
      file: 'src/controller/UserController.ts',
    });
    expect(detail.params).toEqual([{ source: 'query', dto: undefined }]);
    expect(typeof detail.line).toBe('number');

    const create = routes.find((r) => r.handler === 'create')!;
    expect(create.method).toBe('POST');
    expect(create.path).toBe('/users');
    expect(create.params).toEqual([{ source: 'body', dto: 'CreateUserDto' }]);

    expect(manifest.dtos.CreateUserDto.file).toBe('src/dto/CreateUserDto.ts');
    expect(Object.keys(manifest.dtos.CreateUserDto.fields)).toEqual(['name', 'age']);
    expect(manifest.dtos.CreateUserDto.fields.name.rules).toEqual(['IsString', 'IsNotEmpty']);
  });

  test('the manifest never contains config values', () => {
    const manifest = collectManifest(root);
    const json = JSON.stringify(manifest);

    expect(manifest.config.keys).toEqual(expect.arrayContaining(['protocol', 'port', 'profile', 'host', 'password']));
    expect(json).not.toContain('super-secret-value');
    expect(json).not.toContain('db.internal.example');
    expect(json).not.toMatch(/\b8080\b/);
  });

  test('the manifest satisfies the documented contract', () => {
    expect(validateManifest(collectManifest(root))).toEqual([]);
    expect(validateManifest(null)).not.toEqual([]);
    expect(validateManifest({ koatty: '4.5.0' }).length).toBeGreaterThan(0);
  });

  test('markdown rendering includes the routes and the config keys', () => {
    const md = renderManifestMarkdown(collectManifest(root));
    expect(md).toContain('| GET | `/users/:id` | UserController.detail |');
    expect(md).toContain('配置键');
    expect(md).not.toContain('super-secret-value');
  });

  test('options can override protocols and decorator mode', () => {
    const manifest = collectManifest(root, { protocols: ['http', 'grpc'], decoratorMode: 'tc39' });
    expect(manifest.protocols).toEqual(['http', 'grpc']);
    expect(manifest.decoratorMode).toBe('tc39');
  });
});
