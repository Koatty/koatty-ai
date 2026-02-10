import * as path from 'path';

/**
 * 独立模块模板（与旧 koatty_cli 兼容）：单文件生成，仅需名称
 * 占位符: _CLASS_NAME, _NEW, _SUB_PATH, _CAMEL_NAME
 */
function toPascal(s: string): string {
  return s.replace(/(?:^|[-/])(\w)/g, (_, c) => (c ? c.toUpperCase() : ''));
}
function toCamel(s: string): string {
  const p = toPascal(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

export function getStandaloneReplaceMap(name: string, type: string): Record<string, string> {
  const baseName = name.split('/').pop() || name;
  const newName = toPascal(baseName) + toPascal(type);
  const camelName = baseName + toPascal(type);
  return {
    _CLASS_NAME: newName,
    _NEW: baseName,
    _SUB_PATH: '..',
    _CAMEL_NAME: camelName,
  };
}

const CONTROLLER_HTTP = `/*
 * @Description: 业务层
 * @Usage: 接收处理路由参数
 */

import { KoattyContext, Controller, BaseController, Autowired, GetMapping } from 'koatty';
import { App } from '_SUB_PATH/App';

@Controller('/_NEW')
export class _CLASS_NAME extends BaseController {
  app: App;
  ctx: KoattyContext;

  init() {
    //todo
  }

  @GetMapping('/')
  index(): Promise<any> {
    return this.ok('Hi Koatty');
  }
}
`;

const CONTROLLER_GRPC = `/*
 * @Description: gRPC 业务层
 * @Usage: 需先 koatty proto <name> 生成 proto，再在 controller 中实现 rpc 方法
 */

import { KoattyContext, Controller, BaseController, PostMapping, Post } from 'koatty';
import { App } from '_SUB_PATH/App';

@Controller('_NEW')
export class _CLASS_NAME extends BaseController {
  app: App;
  ctx: KoattyContext;

  init() {
    //todo
  }

  @Post()
  sayHello(): Promise<any> {
    return this.ok({ message: 'Hello' });
  }
}
`;

const CONTROLLER_WEBSOCKET = `/*
 * @Description: WebSocket 业务层
 * @Usage: 使用 @SubscribeMessage 处理客户端事件
 */

import { KoattyContext, Controller, BaseController, RequestMapping, RequestBody } from 'koatty';
import { App } from '_SUB_PATH/App';

@Controller('_NEW')
export class _CLASS_NAME extends BaseController {
  app: App;
  ctx: KoattyContext;

  init() {
    //todo
  }

  @RequestMapping('/')
  index(@RequestBody() body: string): Promise<any> {
    return this.ok('Hi Koatty');
  }
}
`;

const CONTROLLER_GRAPHQL = `/*
 * @Description: GraphQL Resolver
 * @Usage: 需先有 schema/*.graphql，再实现 Query/Mutation/Subscription 方法
 */

import { KoattyContext, Controller, BaseController, GetMapping, PostMapping } from 'koatty';
import { App } from '_SUB_PATH/App';

@Controller('_NEW')
export class _CLASS_NAME extends BaseController {
  app: App;
  ctx: KoattyContext;

  init() {
    //todo
  }

  @GetMapping('/')
  index(): Promise<any> {
    return this.ok('Hi Koatty');
  }
}
`;

const MIDDLEWARE = `/*
 * @Description: 中间件
 */

import { KoattyContext, Middleware, IMiddleware, KoattyNext } from 'koatty';
import { App } from '_SUB_PATH/App';

const defaultOpt = {};

@Middleware()
export class _CLASS_NAME implements IMiddleware {
  run(options: any, app: App) {
    options = { ...defaultOpt, ...options };
    return function (ctx: KoattyContext, next: KoattyNext) {
      return next();
    };
  }
}
`;

const SERVICE = `/*
 * @Description: 逻辑实现层
 */

import { Service, BaseService } from 'koatty';
import { App } from '_SUB_PATH/App';

@Service()
export class _CLASS_NAME extends BaseService {
  app: App;

  init() {
    //property
  }

  // todo
}
`;

const SERVICE_INTERFACE = `/*
 * @Description: Service 接口
 */

export interface I_CLASS_NAME {
  // todo
}
`;

const PLUGIN = `/*
 * @Description: 插件扩展
 */

import { Plugin, IPlugin } from 'koatty';
import { App } from '_SUB_PATH/App';

@Plugin()
export class _CLASS_NAME implements IPlugin {
  run(options: any, app: App) {
    // todo...
  }
}
`;

const ASPECT = `/*
 * @Description: AOP切面类
 */

import { Aspect, IAspect, AspectContext } from 'koatty';
import { App } from '_SUB_PATH/App';

@Aspect()
export class _CLASS_NAME implements IAspect {
  app: App;

  async run(joinPoint: AspectContext): Promise<any> {
    console.log('Method:', joinPoint.getMethodName());
    return joinPoint.hasProceed() ? await joinPoint.executeProceed() : undefined;
  }
}
`;

const DTO = `/*
 * @Description: 数据传输处理层
 */

import { Component } from 'koatty';
import { IsNotEmpty, IsDefined } from 'koatty_validation';

@Component()
export class _CLASS_NAME {
  @IsNotEmpty()
  name: string;

  @IsDefined()
  memo?: string;
}
`;

const MODEL_TYPEORM = `/*
 * @Description: 数据持久层
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Column,
  UpdateDateColumn,
  BaseEntity,
} from 'typeorm';
import { Component } from 'koatty';
import { App } from '_SUB_PATH/App';

@Component()
@Entity('_NEW')
export class _CLASS_NAME extends BaseEntity {
  app: App;

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @CreateDateColumn()
  createdDate: Date;

  @UpdateDateColumn()
  updatedDate: Date;
}
`;

const EXCEPTION = `/*
 * @Description: 业务异常全局处理
 */

import { Exception, ExceptionHandler, KoattyContext } from 'koatty';

@ExceptionHandler()
export class _CLASS_NAME extends Exception {
  async handler(ctx: KoattyContext): Promise<any> {
    ctx.status = this.status;
    ctx.type = 'application/json';
    const body: any = JSON.stringify(ctx.body || null);
    switch (ctx.protocol) {
      case 'ws':
      case 'wss':
        if (ctx.websocket) {
          ctx.websocket.send(body);
          ctx.websocket.emit('finish');
        }
        break;
      case 'grpc':
        if (ctx.rpc && ctx.rpc.callback) {
          ctx.rpc.callback(null, body);
        }
        break;
      default:
        ctx.res.end(
          \`{"code": \${this.code}, "message": "\${this.message || ctx.message}", "data": \${body}}\`
        );
        break;
    }
  }
}
`;

const PROTO = `syntax = "proto3";

package pb;
option go_package = "github.com/koatty/proto;pb";

service _CLASS_NAME {
  rpc SayHello(SayHelloRequest) returns (SayHelloReply) {}
}

message SayHelloRequest {
  uint64 id = 1;
  string name = 2;
  PhoneType phone = 3;
}

message SayHelloReply { string message = 1; }

enum PhoneType {
  MOBILE = 0;
  HOME = 1;
  WORK = 2;
}
`;

const CONTROLLER_TEMPLATES: Record<string, string> = {
  http: CONTROLLER_HTTP,
  grpc: CONTROLLER_GRPC,
  websocket: CONTROLLER_WEBSOCKET,
  graphql: CONTROLLER_GRAPHQL,
};

const TEMPLATES: Record<string, string> = {
  controller: CONTROLLER_HTTP,
  middleware: MIDDLEWARE,
  service: SERVICE,
  plugin: PLUGIN,
  aspect: ASPECT,
  dto: DTO,
  model: MODEL_TYPEORM,
  exception: EXCEPTION,
  proto: PROTO,
};

export function renderStandaloneTemplate(
  type: string,
  name: string,
  options?: { interface?: boolean; type?: string }
): { content: string; path: string; extra?: { content: string; path: string } } | null {
  const baseName = name.split('/').pop() || name;
  const replaceMap = getStandaloneReplaceMap(name, type);
  let template = TEMPLATES[type];

  if (type === 'controller' && options?.type) {
    const t = (options.type || 'http').toLowerCase();
    template = CONTROLLER_TEMPLATES[t] || CONTROLLER_HTTP;
  }
  if (!template) return null;

  if (type === 'service' && options?.interface) {
    const ifaceName = 'I' + replaceMap['_CLASS_NAME'];
    let ifaceTpl = SERVICE_INTERFACE;
    for (const [k, v] of Object.entries(replaceMap)) ifaceTpl = ifaceTpl.split(k).join(v);
    // _CLASS_NAME in "I_CLASS_NAME" already replaced above → IUserService
    const implTpl = template
      .replace('extends BaseService', `extends BaseService implements ${ifaceName}`)
      .replace("import { App } from '_SUB_PATH/App';", `import { App } from '_SUB_PATH/App';\nimport { ${ifaceName} } from '../${ifaceName}';`);
    let content = implTpl;
    for (const [k, v] of Object.entries(replaceMap)) content = content.split(k).join(v);
    const appPath = path.join(process.cwd(), 'src');
    return {
      content,
      path: path.join(appPath, 'service', 'impl', replaceMap['_CLASS_NAME'] + '.ts'),
      extra: {
        content: ifaceTpl,
        path: path.join(appPath, 'service', ifaceName + '.ts'),
      },
    };
  }

  if (type === 'proto') {
    replaceMap['_CLASS_NAME'] = toPascal(baseName);
    const ext = '.proto';
    const appPath = path.join(process.cwd(), 'src');
    const outPath = path.join(appPath, 'proto', toPascal(baseName) + ext);
    let content = template;
    for (const [k, v] of Object.entries(replaceMap)) content = content.split(k).join(v);
    return { content, path: outPath };
  }

  let content = template;
  for (const [k, v] of Object.entries(replaceMap)) content = content.split(k).join(v);

  const appPath = path.join(process.cwd(), 'src');
  const outDir = type === 'model' ? 'entity' : type;
  const fileName = type === 'model' ? replaceMap['_CLASS_NAME'] + 'Entity' : replaceMap['_CLASS_NAME'];
  const ext = '.ts';
  const outPath = path.join(appPath, outDir, fileName + ext);

  if (type === 'model') {
    replaceMap['_CLASS_NAME'] = replaceMap['_CLASS_NAME'] + 'Entity';
    content = template;
    for (const [k, v] of Object.entries(replaceMap)) content = content.split(k).join(v);
  }

  return { content, path: outPath };
}

export { toPascal, toCamel };
