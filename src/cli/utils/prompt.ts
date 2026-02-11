import * as readline from 'readline';
import { getDefaultFieldsForModule, hasDefaultForModule, parseFieldShortSpec } from './defaultSpecs';
import { Field } from '../../types/spec';
import { Spec } from '../../types/spec';

export function createReadlineInterface(): readline.Interface {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

/**
 * 询问单行输入
 */
export function question(rl: readline.Interface, promptText: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue !== undefined ? ` [${defaultValue}]` : '';
  return new Promise((resolve) => {
    rl.question(`${promptText}${suffix}: `, (answer) => {
      resolve((answer.trim() || defaultValue || '').trim());
    });
  });
}

/**
 * 交互式收集模块字段与选项，返回可传给 Pipeline 的 spec 片段（fields + 简单 api/auth/features）
 */
export type ApiType = 'rest' | 'grpc' | 'graphql';

export interface InteractiveSpecResult {
  apiType: ApiType;
  fields: Record<string, Field>;
  basePath: string;
  auth: boolean;
  authRoles: string[];
  softDelete: boolean;
  pagination: boolean;
  apply: boolean;
}

export interface PromptForModuleOptions {
  /** 若传入则跳过 API 类型问答 */
  apiType?: ApiType;
  /** 已有 YAML 时作为默认值，重复执行时传入 */
  existingSpec?: Spec;
}

export async function promptForModule(
  rl: readline.Interface,
  moduleName: string,
  options?: PromptForModuleOptions
): Promise<InteractiveSpecResult> {
  const existing = options?.existingSpec;
  const defaultFields = existing?.fields ?? getDefaultFieldsForModule(moduleName);
  const hasSuggested = existing ? true : hasDefaultForModule(moduleName);
  const defaultPath = `/${moduleName.toLowerCase()}`;

  console.log('\n📦 ' + (existing ? '更新模块' : '创建模块') + ': ' + moduleName);
  console.log('   支持的 API 类型: rest | grpc | graphql\n');

  let apiType: ApiType;
  if (options?.apiType && ['rest', 'grpc', 'graphql'].includes(options.apiType)) {
    apiType = options.apiType;
    console.log(`   API 类型: ${apiType}\n`);
  } else {
    const apiDefault = (existing?.api?.type as ApiType) ?? 'rest';
    const apiInput = await question(rl, 'API 类型', apiDefault);
    apiType = ['rest', 'grpc', 'graphql'].includes(apiInput.toLowerCase())
      ? (apiInput.toLowerCase() as ApiType)
      : apiDefault;
  }

  const fieldDefault = existing
    ? '(保持现有)'
    : hasSuggested
      ? '(使用默认)'
      : 'name:string required';
  if (hasSuggested) {
    console.log('   已为该模块准备默认字段，可直接回车使用。');
  }
  if (existing) {
    console.log('   当前字段: ' + Object.keys(existing.fields).join(', '));
  }
  console.log('   字段格式示例: name:string username:string required email:string status:enum:active,inactive\n');

  const fieldInput = await question(rl, '字段定义（空格分隔，回车用默认）', fieldDefault);

  let fields: Record<string, Field>;
  if (!fieldInput || fieldInput === '(使用默认)' || fieldInput === '(保持现有)') {
    fields = defaultFields;
    console.log('   使用字段: ' + Object.keys(fields).join(', '));
  } else {
    fields = parseFieldShortSpec(fieldInput);
    if (Object.keys(fields).length === 0) {
      fields = defaultFields;
      console.log('   解析失败，改用默认字段');
    }
  }

  const basePathDefault =
    apiType === 'rest'
      ? (existing?.api?.basePath || defaultPath).replace(/^\/*/, '/')
      : defaultPath;
  const basePath =
    apiType === 'rest'
      ? (await question(rl, 'API 路径', basePathDefault) || basePathDefault)
      : defaultPath;
  const authDefault = existing?.auth?.enabled ? 'y' : 'n';
  const authAnswer = await question(rl, '是否启用认证 (y/n)', authDefault);
  const auth = /^y|yes|true|1$/i.test(authAnswer);
  let authRoles: string[] = [];
  if (auth) {
    const rolesDefault = existing?.auth?.defaultRoles?.join(', ') ?? 'user';
    const rolesInput = await question(rl, '默认角色（逗号分隔）', rolesDefault);
    authRoles = rolesInput ? rolesInput.split(',').map((r) => r.trim()).filter(Boolean) : ['user'];
  }
  const softDefault = existing?.features?.softDelete !== false ? 'y' : 'n';
  const softAnswer = await question(rl, '软删除 (y/n)', softDefault);
  const softDelete = /^y|yes|true|1$/i.test(softAnswer);
  const pageDefault = existing?.features?.pagination !== false ? 'y' : 'n';
  const pageAnswer = await question(rl, '分页 (y/n)', pageDefault);
  const pagination = /^y|yes|true|1$/i.test(pageAnswer);
  const applyAnswer = await question(rl, '是否直接写入项目 (y/n)', 'n');
  const apply = /^y|yes|true|1$/i.test(applyAnswer);

  return {
    apiType,
    fields,
    basePath: basePath.startsWith('/') ? basePath : `/${basePath}`,
    auth,
    authRoles,
    softDelete,
    pagination,
    apply,
  };
}
