import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import { execFile } from 'child_process';
import { collectManifest, validateManifest } from '../manifest';
import { resolveInside } from '../utils/sandbox';
import { diagnostic, OperationError, result } from './result';

export type CheckName = 'types' | 'test' | 'lint' | 'manifest';
export interface CheckResult {
  check: CheckName;
  passed: boolean;
  code: string;
  exitCode: number;
  stdout?: string;
  stderr?: string;
  timedOut?: boolean;
}

/** Uses installed project tools only. Never installs packages or runs a shell. */
export function localTool(root: string, module: string): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(resolveInside(root, 'package.json'), 'utf8'));
    const name = module.startsWith('@')
      ? module.split('/').slice(0, 2).join('/')
      : module.split('/')[0];
    if (!pkg.dependencies?.[name] && !pkg.devDependencies?.[name])
      throw new Error('Undeclared project tool');
    return createRequire(path.join(path.resolve(root), 'package.json')).resolve(module);
  } catch {
    throw new OperationError(
      'DEPENDENCY_MISSING',
      `Project tool is not installed: ${module}`,
      'Install the declared project dependencies, then repeat verification.'
    );
  }
}

export async function runCheck(
  root: string,
  check: CheckName,
  options: { file?: string; timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<CheckResult> {
  const timeout = options.timeoutMs ?? 60000;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 600000)
    throw new OperationError('INVALID_ARGUMENT', 'timeoutMs must be an integer from 1 to 600000');
  options.signal?.throwIfAborted();
  try {
    if (check === 'manifest') {
      const manifest = collectManifest(root);
      const errors = validateManifest(manifest);
      return {
        check,
        passed: !errors.length,
        code: errors.length ? 'MANIFEST_INVALID' : 'OK',
        exitCode: errors.length ? 1 : 0,
        stdout: JSON.stringify({ unresolved: manifest.unresolved, errors }),
      };
    }
    let entry: string;
    let args: string[];
    if (check === 'types') {
      if (!fs.existsSync(resolveInside(root, 'tsconfig.json')))
        throw new OperationError('CONFIG_MISSING', 'tsconfig.json is required for type checking');
      entry = localTool(root, 'typescript/bin/tsc');
      args = ['--noEmit', '--incremental', 'false', '--pretty', 'false', '-p', 'tsconfig.json'];
    } else if (check === 'lint') {
      entry = localTool(root, 'eslint/bin/eslint.js');
      args = ['--no-cache', '--', 'src'];
    } else if (check === 'test') {
      entry = localTool(root, 'jest/bin/jest');
      args = ['--ci', '--runInBand', '--coverage=false', '--no-cache', '--passWithNoTests=false'];
      if (options.file) {
        const file = path
          .relative(path.resolve(root), resolveInside(root, options.file))
          .split(path.sep)
          .join('/');
        if (!/^(test|tests)\/.+\.(test|spec)\.[cm]?[jt]sx?$/.test(file))
          throw new OperationError(
            'INVALID_TEST_PATH',
            'Refusing to run: use a test/spec file below test/ or tests/'
          );
        args.push('--runTestsByPath', file);
      }
    } else throw new OperationError('INVALID_ARGUMENT', `Unknown check: ${check}`);
    return await new Promise<CheckResult>((resolve) => {
      execFile(
        process.execPath,
        [entry, ...args],
        {
          cwd: root,
          timeout,
          killSignal: 'SIGKILL',
          signal: options.signal,
          maxBuffer: 4 * 1024 * 1024,
        },
        (error, stdout, stderr) => {
          const failure = error as (Error & { code?: number | string; killed?: boolean }) | null;
          resolve({
            check,
            passed: !error,
            exitCode: error ? (typeof failure?.code === 'number' ? failure.code : 1) : 0,
            code: options.signal?.aborted
              ? 'CANCELLED'
              : failure?.killed
                ? 'CHECK_TIMEOUT'
                : error
                  ? 'CHECK_FAILED'
                  : 'OK',
            timedOut: !!failure?.killed && !options.signal?.aborted,
            stdout: String(stdout).slice(-12000),
            stderr: String(stderr).slice(-12000),
          });
        }
      );
    });
  } catch (error) {
    const d = diagnostic(error);
    return { check, passed: false, code: d.code, exitCode: 1, stderr: d.message };
  }
}

export async function verifyProject(
  root: string,
  options: {
    checks?: CheckName[];
    file?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
  } = {}
) {
  const names = options.checks ?? ['types', 'test'];
  if (!names.length || names.some((name) => !['types', 'test', 'lint', 'manifest'].includes(name)))
    throw new OperationError(
      'INVALID_ARGUMENT',
      'checks must contain types, test, lint or manifest'
    );
  const checks: CheckResult[] = [];
  for (const name of [...new Set(names)]) {
    if (options.signal?.aborted) break;
    checks.push(await runCheck(root, name, options));
  }
  const passed = checks.length === new Set(names).size && checks.every((check) => check.passed);
  return result(
    'verify',
    options.signal?.aborted ? 'cancelled' : passed ? 'completed' : 'failed',
    { passed, checks },
    checks
      .filter((check) => !check.passed)
      .map((check) => ({
        code: check.code,
        message: `${check.check} failed`,
        next: 'Inspect the check output, fix the cause and run verify again.',
      }))
  );
}
