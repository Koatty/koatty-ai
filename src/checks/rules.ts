/**
 * koatty_ai 框架检查规则（S4）。
 *
 * 原则（设计 §7）：
 * - 采用符号与类型解析（ts-morph），不做字符串搜索；
 * - 每条规则有确定性边界：静态无法判定时不下结论；
 * - 诊断返回 ruleId/severity/file/line/message/suggestion/reference/deterministic；
 * - 语义问题（Controller 是否含业务逻辑、事务设计是否正确）不伪装成 lint 错误。
 */

import * as fs from 'fs';
import * as path from 'path';
import { Node, Project as MorphProject, SourceFile, SyntaxKind } from 'ts-morph';
import { resolveInside } from 'koatty_cli/project';
import { AiOperationError } from '../result';

export interface CheckDiagnostic {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  message: string;
  suggestion?: string;
  reference?: string;
  /** true：静态可完全判定；false：受动态结构影响，仅为提示 */
  deterministic: boolean;
}

/** 规则可跨文件收集的中间事实（如静态路由） */
export interface RouteFact {
  file: string;
  line: number;
  method: string;
  path: string;
  controller: string;
}

export interface CheckRule {
  id: string;
  description: string;
  reference: string;
  severity: 'error' | 'warning' | 'info';
  checkFile(source: SourceFile, root: string, facts: RouteFact[]): CheckDiagnostic[];
  /** 可选的跨文件汇总阶段 */
  aggregate?(root: string, facts: RouteFact[]): CheckDiagnostic[];
}

function relPath(source: SourceFile, root: string): string {
  return path.relative(root, source.getFilePath()).split(path.sep).join('/');
}

const MAPPING_DECORATORS = /^(Get|Post|Put|Delete|Patch|Head|Options|Request)Mapping$/;

export const CHECK_RULES: CheckRule[] = [
  {
    id: 'KOATTY_DTO_LOADER_NAME',
    description:
      'DTO 文件名必须与首个导出类名一致（koatty_loader 按文件名=类名发现组件）。',
    reference: 'skills/koatty/references/http-dto.md',
    severity: 'error',
    checkFile(source, root) {
      const diagnostics: CheckDiagnostic[] = [];
      const rel = relPath(source, root);
      if (!/^src\/dto\/.+\.ts$/.test(rel)) return diagnostics;
      const expected = path.basename(rel, '.ts');
      const first = source.getClasses().find((c) => c.isExported());
      if (!first) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.severity,
          file: rel,
          line: source.getStartLineNumber(),
          message: `src/dto file "${expected}.ts" exports no class; the Loader will not register any DTO from it.`,
          suggestion: `Export a class named ${expected}.`,
          reference: this.reference,
          deterministic: true,
        });
        return diagnostics;
      }
      const name = first.getName();
      if (name && name !== expected) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.severity,
          file: rel,
          line: first.getStartLineNumber(),
          message: `DTO class name "${name}" does not match file name "${expected}" (Loader convention: file name = first exported class name).`,
          suggestion: `Rename the class to ${expected}, or rename the file.`,
          reference: this.reference,
          deterministic: true,
        });
      }
      return diagnostics;
    },
  },
  {
    id: 'KOATTY_GLOBAL_IOC',
    description:
      '应用代码直接使用全局 IOC 容器实例（koatty_container 导出的 IOC/IOCContainer）；项目约定用 app.container。',
    reference: 'skills/koatty/references/service-di.md',
    severity: 'warning',
    checkFile(source, root) {
      const diagnostics: CheckDiagnostic[] = [];
      const rel = relPath(source, root);
      if (!rel.startsWith('src/')) return diagnostics;
      for (const imp of source.getImportDeclarations()) {
        if (imp.getModuleSpecifierValue() !== 'koatty_container') continue;
        for (const named of imp.getNamedImports()) {
          const name = named.getName();
          if (name !== 'IOC' && name !== 'IOCContainer') continue;
          // 只在使用（导出子句之外）时报告，纯 re-export 不算应用代码用法
          const used = source
            .getDescendantsOfKind(SyntaxKind.Identifier)
            .some((id) => id.getText() === name && id.getParent()?.getKind() !== SyntaxKind.ImportSpecifier);
          if (!used) continue;
          diagnostics.push({
            ruleId: this.id,
            severity: this.severity,
            file: rel,
            line: imp.getStartLineNumber(),
            message: `Application code uses the global container instance "${name}" from koatty_container.`,
            suggestion:
              'Use the application-scoped container (this.app.container / constructor app param); ' +
              'the global instance bypasses app isolation. If the usage is intentional bootstrap composition, state it explicitly in review.',
            reference: this.reference,
            deterministic: true,
          });
        }
      }
      return diagnostics;
    },
  },
  {
    id: 'KOATTY_DUP_ROUTE',
    description: '不同控制器声明了相同的 method+path 静态路由（动态路由不下结论）。',
    reference: 'skills/koatty/references/http-dto.md',
    severity: 'warning',
    checkFile(source, root, facts) {
      const diagnostics: CheckDiagnostic[] = [];
      const rel = relPath(source, root);
      if (!/^src\/controller\/.+\.ts$/.test(rel)) return diagnostics;
      for (const cls of source.getClasses()) {
        const controller = cls.getName() ?? path.basename(rel, '.ts');
        for (const method of cls.getMethods()) {
          for (const decorator of method.getDecorators()) {
            const name = decorator.getName();
            if (!MAPPING_DECORATORS.test(name)) continue;
            const call = decorator.getCallExpression();
            const args = call?.getArguments() ?? [];
            const first = args[0];
            // 仅收集静态字符串字面量路径；模板字符串/表达式视为动态，不下结论
            if (first && !Node.isStringLiteral(first)) continue;
            const routePath = first && Node.isStringLiteral(first) ? first.getLiteralText() : '/';
            const httpMethod = name.replace('Mapping', '').toUpperCase();
            facts.push({
              file: rel,
              line: method.getStartLineNumber(),
              method: httpMethod === 'REQUEST' ? 'ALL' : httpMethod,
              path: routePath,
              controller,
            });
          }
        }
      }
      return diagnostics;
    },
    aggregate(_root, facts) {
      const diagnostics: CheckDiagnostic[] = [];
      const seen = new Map<string, RouteFact>();
      const reported = new Set<string>();
      for (const route of facts) {
        const key = `${route.method} ${route.path}`;
        const previous = seen.get(key);
        if (previous && previous.controller !== route.controller) {
          const pairKey = [previous.file, route.file, key].sort().join('|');
          if (reported.has(pairKey)) continue;
          reported.add(pairKey);
          for (const item of [previous, route]) {
            diagnostics.push({
              ruleId: 'KOATTY_DUP_ROUTE',
              severity: 'warning',
              file: item.file,
              line: item.line,
              message: `Static route ${route.method} ${route.path} is declared by both ${previous.controller} (${previous.file}) and ${route.controller} (${route.file}).`,
              suggestion: 'Keep one controller per route; dynamic routes are not judged by this rule.',
              reference: 'skills/koatty/references/http-dto.md',
              deterministic: true,
            });
          }
        } else if (!previous) {
          seen.set(key, route);
        }
      }
      return diagnostics;
    },
  },
];

export interface CheckRunOptions {
  rules?: string[];
}

/**
 * 对项目 src/ 执行全部（或指定）规则。
 * 静态不可解析的场景（动态路由、动态注册）不由本函数下结论。
 */
export function runChecks(root: string, options: CheckRunOptions = {}): CheckDiagnostic[] {
  const srcDir = resolveInside(root, 'src');
  if (!fs.existsSync(srcDir)) {
    return [
      {
        ruleId: 'KOATTY_CHECK_NO_SRC',
        severity: 'info',
        file: 'src/',
        line: 1,
        message: 'No src/ directory found; nothing to check.',
        deterministic: true,
      },
    ];
  }
  let rules = CHECK_RULES;
  if (options.rules?.length) {
    rules = CHECK_RULES.filter((rule) => options.rules!.includes(rule.id));
    const unknown = options.rules.filter((id) => !CHECK_RULES.some((rule) => rule.id === id));
    if (unknown.length) {
      throw new AiOperationError(
        'INVALID_ARGUMENT',
        `Unknown check rules: ${unknown.join(', ')}`,
        `Available rules: ${CHECK_RULES.map((r) => r.id).join(', ')}`
      );
    }
  }

  const morph = new MorphProject({ useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true });
  morph.addSourceFilesAtPaths(path.join(srcDir, '**', '*.ts').split(path.sep).join('/'));

  const facts: RouteFact[] = [];
  const diagnostics: CheckDiagnostic[] = [];
  for (const source of morph.getSourceFiles()) {
    for (const rule of rules) {
      diagnostics.push(...rule.checkFile(source, root, facts));
    }
  }
  for (const rule of rules) {
    if (rule.aggregate) diagnostics.push(...rule.aggregate(root, facts));
  }
  return diagnostics.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.ruleId.localeCompare(b.ruleId)
  );
}
