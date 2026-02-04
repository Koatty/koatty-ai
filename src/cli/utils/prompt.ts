import * as readline from 'readline';
import { getDefaultFieldsForModule, hasDefaultForModule, parseFieldShortSpec } from './defaultSpecs';
import { Field } from '../../types/spec';

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
export interface InteractiveSpecResult {
  fields: Record<string, Field>;
  basePath: string;
  auth: boolean;
  authRoles: string[];
  softDelete: boolean;
  pagination: boolean;
  saveSpec: boolean;
}

export async function promptForModule(rl: readline.Interface, moduleName: string): Promise<InteractiveSpecResult> {
  const defaultFields = getDefaultFieldsForModule(moduleName);
  const hasSuggested = hasDefaultForModule(moduleName);
  const defaultPath = `/${moduleName.toLowerCase()}`;

  console.log('\n📦 创建模块: ' + moduleName);
  if (hasSuggested) {
    console.log('   已为该模块准备默认字段，可直接回车使用。');
  }
  console.log('   字段格式示例: name:string username:string required email:string status:enum:active,inactive\n');

  const fieldInput = await question(
    rl,
    '字段定义（空格分隔，回车用默认）',
    hasSuggested ? '(使用默认)' : 'name:string required'
  );

  let fields: Record<string, Field>;
  if (!fieldInput || fieldInput === '(使用默认)') {
    fields = defaultFields;
    console.log('   使用默认字段: ' + Object.keys(fields).join(', '));
  } else {
    fields = parseFieldShortSpec(fieldInput);
    if (Object.keys(fields).length === 0) {
      fields = defaultFields;
      console.log('   解析失败，改用默认字段');
    }
  }

  const basePath = await question(rl, 'API 路径', defaultPath) || defaultPath;
  const authAnswer = await question(rl, '是否启用认证 (y/n)', 'n');
  const auth = /^y|yes|true|1$/i.test(authAnswer);
  let authRoles: string[] = [];
  if (auth) {
    const rolesInput = await question(rl, '默认角色（逗号分隔）', 'user');
    authRoles = rolesInput ? rolesInput.split(',').map((r) => r.trim()).filter(Boolean) : ['user'];
  }

  const softAnswer = await question(rl, '软删除 (y/n)', 'y');
  const softDelete = /^y|yes|true|1$/i.test(softAnswer);
  const pageAnswer = await question(rl, '分页 (y/n)', 'y');
  const pagination = /^y|yes|true|1$/i.test(pageAnswer);
  const saveAnswer = await question(rl, '是否保存为 YAML 便于后续修改 (y/n)', 'y');
  const saveSpec = /^y|yes|true|1$/i.test(saveAnswer);

  return {
    fields,
    basePath: basePath.startsWith('/') ? basePath : `/${basePath}`,
    auth,
    authRoles,
    softDelete,
    pagination,
    saveSpec,
  };
}
