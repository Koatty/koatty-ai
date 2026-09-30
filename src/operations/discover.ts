import * as fs from 'fs';
import * as path from 'path';
import { version } from '../../package.json';
import { collectManifest, validateManifest } from '../manifest';
import { resolveInside } from '../utils/sandbox';
import { localTool } from './verify';
import { diagnostic, operationResultSchema, result } from './result';

export function capabilities() {
  return result('capabilities', 'completed', {
    cliVersion: version,
    contractVersion: 1,
    outputSchema: operationResultSchema,
    inputSchemas: {
      plan: {
        type: 'object',
        properties: { spec: { type: 'string' }, savePlan: { type: 'boolean' } },
        required: ['spec'],
        additionalProperties: false,
      },
      apply: {
        type: 'object',
        properties: {
          plan: { type: 'string' },
          yes: { type: 'boolean' },
          validate: { type: 'boolean' },
        },
        required: ['plan'],
        additionalProperties: false,
      },
      verify: {
        type: 'object',
        properties: {
          checks: {
            type: 'array',
            minItems: 1,
            items: { enum: ['types', 'test', 'lint', 'manifest'] },
          },
          file: { type: 'string' },
          timeout: { type: 'integer', minimum: 1, maximum: 600000 },
        },
        additionalProperties: false,
      },
    },
    operations: {
      manifest: {
        command: 'manifest --root <path> --validate',
        static: true,
        mcp: 'koatty_manifest',
      },
      plan: {
        command: 'plan --spec <path> --json',
        save: '--save-plan',
        mcp: 'koatty_plan',
        writesByDefault: false,
      },
      apply: {
        command: 'apply --plan <id> --json',
        write: '--yes',
        mcp: 'koatty_apply',
        writesByDefault: false,
      },
      verify: {
        command: 'verify --checks types,test --json',
        mcp: 'koatty_verify',
        executesProjectCode: true,
        checks: ['types', 'test', 'lint', 'manifest'],
      },
      doctor: { command: 'doctor --json', mcp: 'koatty_doctor', executesProjectCode: false },
    },
    plan: { ttlMs: 600000, sessionBoundMcp: true, persistentCli: true, singleUse: true },
    recipes: ['project', 'middleware', 'plugin', 'mcp', 'agent'],
    boundaries: [
      'Static declarations are not live registrations.',
      'Tests execute project code; path checks are not a process sandbox.',
      'applied means written; completed apply means the configured verification passed.',
    ],
  });
}

export function doctor(root: string) {
  const checks: Array<{ name: string; status: 'passed' | 'failed' | 'warning'; code: string }> = [];
  const diagnostics = [];
  try {
    const pkg = JSON.parse(fs.readFileSync(resolveInside(root, 'package.json'), 'utf8'));
    checks.push({ name: 'package', status: 'passed', code: 'OK' });
    const range = pkg.dependencies?.koatty;
    if (range && /^\^?4\./.test(range))
      checks.push({ name: 'framework', status: 'warning', code: 'LEGACY_FRAMEWORK' });
    for (const [name, entry] of [
      ['typescript', 'typescript/bin/tsc'],
      ['jest', 'jest/bin/jest'],
    ]) {
      try {
        localTool(root, entry);
        checks.push({ name, status: 'passed', code: 'OK' });
      } catch (error) {
        checks.push({ name, status: 'failed', code: 'DEPENDENCY_MISSING' });
        diagnostics.push(diagnostic(error));
      }
    }
    const manifest = collectManifest(root);
    const errors = validateManifest(manifest);
    checks.push({
      name: 'manifest',
      status: errors.length ? 'failed' : manifest.unresolved.length ? 'warning' : 'passed',
      code: errors.length
        ? 'MANIFEST_INVALID'
        : manifest.unresolved.length
          ? 'STATIC_UNRESOLVED'
          : 'OK',
    });
    diagnostics.push(...errors.map((message) => ({ code: 'MANIFEST_INVALID', message })));
    if (!fs.existsSync(resolveInside(root, 'tsconfig.json'))) {
      checks.push({ name: 'tsconfig', status: 'failed', code: 'CONFIG_MISSING' });
      diagnostics.push({ code: 'CONFIG_MISSING', message: 'tsconfig.json is required' });
    }
    return result(
      'doctor',
      checks.some((c) => c.status === 'failed') ? 'failed' : 'completed',
      { root: path.resolve(root), checks, unresolved: manifest.unresolved },
      diagnostics
    );
  } catch (error) {
    return result('doctor', 'failed', { checks }, [diagnostic(error)]);
  }
}
