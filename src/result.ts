/**
 * koatty_ai 的 v1 结果 envelope——与 koatty_cli 的 operationResultSchema 契约一致
 * （schemaVersion: 1；status: completed|preview|applied|failed|cancelled）。
 * JSON stdout 只输出机器结果；进度与人类提示走 stderr。
 */

export interface AiDiagnostic {
  code: string;
  message: string;
  next?: string;
}

export interface AiOperationResult<T = unknown> {
  schemaVersion: 1;
  operation: string;
  status: 'completed' | 'preview' | 'applied' | 'failed' | 'cancelled';
  data: T;
  diagnostics: AiDiagnostic[];
}

export class AiOperationError extends Error {
  constructor(
    public code: string,
    message: string,
    public next?: string
  ) {
    super(message);
    this.name = 'AiOperationError';
  }
}

export function aiDiagnostic(error: unknown): AiDiagnostic {
  if (error instanceof AiOperationError) {
    return { code: error.code, message: error.message, next: error.next };
  }
  // koatty_cli 抛出的 OperationError 与本包 AiOperationError 共享 v1 错误契约
  // （name === 'OperationError' 且携带机器可读 code/next）
  if (error instanceof Error && error.name === 'OperationError') {
    const shaped = error as Error & { code?: string; next?: string };
    if (shaped.code) {
      return { code: shaped.code, message: shaped.message, next: shaped.next };
    }
  }
  return {
    code: 'OPERATION_FAILED',
    message: error instanceof Error ? error.message : String(error),
  };
}

export function aiResult<T>(
  operation: string,
  status: AiOperationResult['status'],
  data: T,
  diagnostics: AiDiagnostic[] = []
): AiOperationResult<T> {
  return { schemaVersion: 1, operation, status, data, diagnostics };
}

/** 与 koatty_cli operationResultSchema 逐字段一致的 v1 契约（用于 ajv 输出校验） */
export const aiOperationResultSchema = {
  type: 'object',
  required: ['schemaVersion', 'operation', 'status', 'data', 'diagnostics'],
  properties: {
    schemaVersion: { const: 1 },
    operation: { type: 'string' },
    status: { enum: ['completed', 'preview', 'applied', 'failed', 'cancelled'] },
    data: {},
    diagnostics: {
      type: 'array',
      items: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          next: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const;
