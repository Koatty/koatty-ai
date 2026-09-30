export interface Diagnostic {
  code: string;
  message: string;
  next?: string;
}

export interface OperationResult<T = unknown> {
  schemaVersion: 1;
  operation: string;
  status: 'completed' | 'preview' | 'applied' | 'failed' | 'cancelled';
  data: T;
  diagnostics: Diagnostic[];
}

export class OperationError extends Error {
  constructor(
    public code: string,
    message: string,
    public next?: string
  ) {
    super(message);
    this.name = 'OperationError';
  }
}

export function diagnostic(error: unknown): Diagnostic {
  return error instanceof OperationError
    ? { code: error.code, message: error.message, next: error.next }
    : { code: 'OPERATION_FAILED', message: error instanceof Error ? error.message : String(error) };
}

export function result<T>(
  operation: string,
  status: OperationResult['status'],
  data: T,
  diagnostics: Diagnostic[] = []
): OperationResult<T> {
  return { schemaVersion: 1, operation, status, data, diagnostics };
}

export function printResult(value: OperationResult, json = false): void {
  if (json) process.stdout.write(`${JSON.stringify(value)}\n`);
  else {
    console.log(`${value.operation}: ${value.status}`);
    if (value.data != null) console.log(JSON.stringify(value.data, null, 2));
    for (const item of value.diagnostics)
      console.error(`${item.code}: ${item.message}${item.next ? `\n${item.next}` : ''}`);
  }
  if (value.status === 'failed' || value.status === 'cancelled') process.exitCode = 1;
}

/** One machine result contract shared by CLI and development MCP. */
export const operationResultSchema = {
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
};
