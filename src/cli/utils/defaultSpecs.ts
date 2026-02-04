import { Field } from '../../types/spec';

const VALID_TYPES = ['string', 'number', 'boolean', 'enum', 'datetime', 'text', 'json'] as const;

/**
 * 常用模块的默认字段建议，用于无需 YAML 的快速创建
 */
const MODULE_DEFAULTS: Record<string, Record<string, Field>> = {
  user: {
    id: { name: 'id', type: 'number', primary: true, auto: true },
    username: { name: 'username', type: 'string', length: 50, unique: true, required: true },
    email: { name: 'email', type: 'string', format: 'email' },
    passwordHash: { name: 'passwordHash', type: 'string', length: 255, private: true },
    status: { name: 'status', type: 'enum', values: ['active', 'inactive'], default: 'active' },
    createdAt: { name: 'createdAt', type: 'datetime', auto: true },
    updatedAt: { name: 'updatedAt', type: 'datetime', auto: true },
  },
  product: {
    id: { name: 'id', type: 'number', primary: true, auto: true },
    name: { name: 'name', type: 'string', required: true },
    price: { name: 'price', type: 'number' },
    stock: { name: 'stock', type: 'number' },
    status: { name: 'status', type: 'enum', values: ['draft', 'on_sale', 'off_sale'], default: 'draft' },
    createdAt: { name: 'createdAt', type: 'datetime', auto: true },
    updatedAt: { name: 'updatedAt', type: 'datetime', auto: true },
  },
  order: {
    id: { name: 'id', type: 'number', primary: true, auto: true },
    userId: { name: 'userId', type: 'number' },
    amount: { name: 'amount', type: 'number' },
    status: { name: 'status', type: 'enum', values: ['pending', 'paid', 'shipped', 'completed'], default: 'pending' },
    createdAt: { name: 'createdAt', type: 'datetime', auto: true },
    updatedAt: { name: 'updatedAt', type: 'datetime', auto: true },
  },
  article: {
    id: { name: 'id', type: 'number', primary: true, auto: true },
    title: { name: 'title', type: 'string', required: true },
    content: { name: 'content', type: 'text' },
    status: { name: 'status', type: 'enum', values: ['draft', 'published'], default: 'draft' },
    createdAt: { name: 'createdAt', type: 'datetime', auto: true },
    updatedAt: { name: 'updatedAt', type: 'datetime', auto: true },
  },
};

/**
 * 根据模块名返回建议的默认字段（若有），否则返回通用 id + name + timestamps
 */
export function getDefaultFieldsForModule(moduleName: string): Record<string, Field> {
  const key = moduleName.toLowerCase();
  if (MODULE_DEFAULTS[key]) {
    return { ...MODULE_DEFAULTS[key] };
  }
  return {
    id: { name: 'id', type: 'number', primary: true, auto: true },
    name: { name: 'name', type: 'string', required: true },
    createdAt: { name: 'createdAt', type: 'datetime', auto: true },
    updatedAt: { name: 'updatedAt', type: 'datetime', auto: true },
  };
}

/**
 * 解析简短字段描述为 Field 列表
 * 格式：每段为 "字段名:类型" 或 "字段名:类型 修饰符"
 * 例：name:string username:string required email:string age:number status:enum:active,inactive
 */
export function parseFieldShortSpec(input: string): Record<string, Field> {
  const fields: Record<string, Field> = {};
  const parts = input
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const modifiers = new Set<string>(['required', 'unique', 'nullable']);

  for (const part of parts) {
    const colonCount = (part.match(/:/g) || []).length;
    if (colonCount === 0) {
      if (modifiers.has(part.toLowerCase())) {
        const lastKey = Object.keys(fields).pop();
        if (lastKey && fields[lastKey]) {
          if (part.toLowerCase() === 'required') fields[lastKey].required = true;
          if (part.toLowerCase() === 'unique') fields[lastKey].unique = true;
          if (part.toLowerCase() === 'nullable') fields[lastKey].nullable = true;
        }
      }
      continue;
    }

    const [name, type, rest] = part.split(':');
    if (!name || !type) continue;
    const typeLower = type.toLowerCase();
    if (!VALID_TYPES.includes(typeLower as any)) continue;

    const field: Field = {
      name: name.trim(),
      type: typeLower as Field['type'],
    };
    if (rest !== undefined && typeLower === 'enum') {
      field.values = rest.split(',').map((v) => v.trim()).filter(Boolean);
      field.default = field.values[0];
    }
    fields[field.name] = field;
  }

  return fields;
}

export function hasDefaultForModule(moduleName: string): boolean {
  return !!MODULE_DEFAULTS[moduleName.toLowerCase()];
}
