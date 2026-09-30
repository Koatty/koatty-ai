import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Ajv from 'ajv';
import { collectManifest, validateManifest } from '../../src/manifest';
let root: string;
function write(file: string, content: string) {
  const p = path.join(root, file);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'e06-'));
  write('package.json', '{}');
  write('tsconfig.json', '{"compilerOptions":{"target":"ES2022"}}');
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
test('actual decorators, custom ids, property injection, aspects and src/config are collected', () => {
  write('src/config/server.ts', "export default {protocol:'ws',port:3456}");
  write('src/config/config.ts', "export default {security:{profile:'strict'},password:'SECRET'}");
  write('src/service/UserService.ts', "@Service('users') export class UserService {}");
  write(
    'src/controller/UserController.ts',
    `@Controller('/users',{protocol:ControllerProtocol.websocket}) export class UserController {
    @Autowired(UserService) service:UserService;
    @PostMapping('/create') @Around(AuditAspect) create(@RequestBody() body:UserDto){}
  }`
  );
  const m = collectManifest(root);
  expect(m.decoratorMode).toBe('tc39');
  expect(m.protocols).toEqual(['ws']);
  expect(m.security.profile).toBe('strict');
  expect(m.config.keys).toContain('server.port');
  expect(m.config.schema.properties.server.properties.port).toEqual({ type: 'number' });
  expect(m.components.find((c) => c.id === 'UserController')!.dependsOn).toEqual(['users']);
  expect(m.routes[0]).toMatchObject({
    protocol: 'ws',
    params: [{ source: 'body', dto: 'UserDto' }],
  });
  expect(m.aspects[0]).toMatchObject({ name: 'AuditAspect', targets: ['UserController.create'] });
  expect(validateManifest(m)).toEqual([]);
  expect(JSON.stringify(m)).not.toMatch(/SECRET|3456/);
});
test('JSONC/extends decorator options are resolved without executing application code', () => {
  write('base.json', '{"compilerOptions":{"experimentalDecorators":true}}');
  write(
    'tsconfig.json',
    '{ // comment\n "extends":"./base.json", "compilerOptions":{"target":"ES2022",}, }'
  );
  expect(collectManifest(root).decoratorMode).toBe('legacy');
});
test('dynamic profile and paths are unresolved without expression literals or invented routes', () => {
  write('config/security.ts', "export default {profile:process.env.PROFILE || 'PRIVATE_VALUE'}");
  write(
    'src/controller/Dynamic.ts',
    "@Controller(prefix) export class A {@GetMapping('/x') get(){}} @Controller('/x') export class B {@PostMapping(route) post(){}}"
  );
  const m = collectManifest(root);
  expect(m.security).toEqual({});
  expect(m.routes).toEqual([]);
  expect(m.unresolved.map((u) => u.kind)).toEqual(
    expect.arrayContaining(['security.profile', 'route.path'])
  );
  expect(JSON.stringify(m)).not.toContain('PRIVATE_VALUE');
  expect(validateManifest(m)).toEqual([]);
});
test('DTO schemas validate nested, optional, enum, array and constraint semantics', () => {
  write(
    'src/dto/UserDto.ts',
    `export class Address { @MinLength(3) street:string; }
  export class UserDto { @IsString() @MinLength(2) name:string; @IsOptional() @Min(0) age?:number;
    @ValidateNested() address:Address; @IsArray() roles:('reader'|'writer')[]; extra?: {enabled:boolean}; }`
  );
  const m = collectManifest(root);
  expect(validateManifest(m)).toEqual([]);
  expect(m.unresolved.map((u) => u.kind)).toEqual(expect.arrayContaining(['dto.undecorated']));
  const validate = new Ajv({ strict: false }).compile(m.dtos.UserDto.schema);
  expect(validate({ name: 'ok', address: { street: 'road' }, roles: ['reader'] })).toBe(true);
  expect(validate({ name: 'ok', age: 1, address: { street: 'road' }, roles: ['reader'] })).toBe(true);
  for (const value of [
    { name: 'x', address: { street: 'road' }, roles: [] },
    { name: 'ok', age: -1, address: { street: 'road' }, roles: [] },
    { name: 'ok', address: { street: 'a' }, roles: [] },
    { name: 'ok', address: { street: 'road' }, roles: ['admin'] },
    { name: 'ok', address: { street: 'road' }, roles: ['reader'], extra: { enabled: true } },
  ])
    expect(validate(value)).toBe(false);
});
test('unknown DTO types and constraints produce explicit unresolved diagnostics', () => {
  write(
    'src/dto/UnknownDto.ts',
    'export class UnknownDto { @CustomRule(secret) data:ExternalType; }'
  );
  const m = collectManifest(root);
  expect(m.unresolved.map((u) => u.kind)).toEqual(
    expect.arrayContaining(['dto.type', 'dto.constraint'])
  );
  expect(JSON.stringify(m.unresolved)).not.toContain('secret');
});
test('schema validation rejects malformed inputs without throwing', () => {
  for (const value of [null, {}, { components: {} }, { routes: [{}] }])
    expect(validateManifest(value).length).toBeGreaterThan(0);
  const m: any = collectManifest(root);
  m.security.profile = 'PRIVATE';
  expect(validateManifest(m).length).toBeGreaterThan(0);
  delete m.security.profile;
  m.config.values = { password: 'oops' };
  expect(validateManifest(m).length).toBeGreaterThan(0);
  delete m.config.values;
  m.config.schema = { type: 'not-a-type' };
  expect(validateManifest(m).length).toBeGreaterThan(0);
});
test('manifest refuses symlinked sources and config files', () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'e06-out-'));
  try {
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(outside, 'Leak.ts'), '@Service() export class Leak{}');
    fs.symlinkSync(outside, path.join(root, 'src/linked'));
    expect(() => collectManifest(root)).toThrow(/symlink/);
  } finally {
    fs.rmSync(outside, { recursive: true, force: true });
  }
});
test('C-6 declared schema is reused and defaults do not leak', () => {
  write(
    'src/configure.ts',
    `const schema={type:'object',properties:{port:{type:'integer',minimum:1,default:12345},password:{type:'string',default:'PRIVATE_DEFAULT'}},required:['port']}; validateConfig(config,schema);`
  );
  const m = collectManifest(root);
  expect(m.config.schemaSource).toBe('declaration');
  expect(validateManifest(m)).toEqual([]);
  expect(JSON.stringify(m)).not.toMatch(/PRIVATE_DEFAULT|12345/);
  const check = new Ajv().compile(m.config.schema);
  expect(check({ port: 2 })).toBe(true);
  expect(check({ port: 0 })).toBe(false);
});

test('dynamic computed configuration keys never expose expression text', () => {
  write(
    'src/config/config.ts',
    "export default {[process.env.KEY || 'PRIVATE_KEY_VALUE']: 'PRIVATE_CONFIG_VALUE'};"
  );
  const manifest = collectManifest(root);
  expect(JSON.stringify(manifest)).not.toMatch(/PRIVATE_KEY_VALUE|PRIVATE_CONFIG_VALUE/);
  expect(manifest.unresolved.some((u) => u.kind === 'config.keys')).toBe(true);
});
