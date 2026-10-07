/**
 * koatty_ai docs 工具：版本匹配的框架 API 查询。
 *
 * 数据来源：随包分发的 knowledge/api-index.json（由 scripts/build-api-index.mjs
 * 从实际包声明生成，不在使用时联网）。用法说明与示例在 skills/koatty/references/
 * 中维护，本工具返回指向它们的引用，不复制可能漂移的代码副本。
 */

import * as fs from 'fs';
import * as path from 'path';
import { AiOperationError, aiResult } from '../result';
import { AiToolDefinition, installedVersions } from './registry';

interface IndexPackage {
  version: string;
  sourceDir: string;
  declaration: string;
  exports: string[];
  reexportedFrom: Record<string, string>;
}

interface ApiIndex {
  generatedAt: string;
  packages: Record<string, IndexPackage>;
}

function loadIndex(): ApiIndex {
  const file = path.join(__dirname, '..', '..', 'knowledge', 'api-index.json');
  if (!fs.existsSync(file)) {
    throw new AiOperationError(
      'KNOWLEDGE_MISSING',
      'knowledge/api-index.json is missing from the installation',
      'Reinstall koatty_ai; the API index ships with the package.'
    );
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as ApiIndex;
}

/** 简单兼容判断：同 major 视为大概率兼容；不同 major 或未知版本标记为需核实 */
function compatibility(installed: string | null, indexed: string): 'same-major' | 'different-major' | 'unresolved' {
  if (!installed) return 'unresolved';
  const im = installed.split('.')[0];
  const dm = indexed.split('.')[0];
  return im === dm ? 'same-major' : 'different-major';
}

export function docsTool(): AiToolDefinition {
  return {
    name: 'koatty_ai_docs',
    command: 'docs',
    description:
      'Look up Koatty framework APIs: package, version, import source and skill references. Prefers exact API ids; falls back to keyword match.',
    inputSchema: {
      type: 'object',
      properties: {
        api: { type: 'string', description: 'Exact export name (e.g. Validated, GetMapping)' },
        package: { type: 'string', description: 'Restrict to one npm package (e.g. koatty_validation)' },
        keyword: { type: 'string', description: 'Case-insensitive substring fallback' },
        root: { type: 'string', description: 'Project root for installed-version resolution' },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
        guide: { enum: ['project', 'http-dto', 'service-di', 'persistence', 'protocols', 'extensions', 'mcp-agent', 'testing', 'troubleshooting'], description: 'Read one bundled scenario guide' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
    executesProjectCode: false,
    handler: async (input, ctx) => {
      if (input.guide) {
        const reference = `skills/koatty/references/${input.guide}.md`;
        const content = fs.readFileSync(path.join(__dirname, '../..', reference), 'utf8');
        return aiResult('docs', 'completed', { reference, content: content.slice(0, 32000), truncated: content.length > 32000 });
      }
      const index = loadIndex();
      const root = ctx.projectRoot;
      const limit = (input.limit as number | undefined) ?? 30;
      const api = input.api as string | undefined;
      const pkgFilter = input.package as string | undefined;
      const keyword = (input.keyword as string | undefined)?.toLowerCase();

      if (!api && !keyword && !pkgFilter) {
        return aiResult('docs', 'completed', {
          generatedAt: index.generatedAt,
          packages: Object.fromEntries(
            Object.entries(index.packages).map(([name, p]) => [name, { version: p.version, exports: p.exports.length }])
          ),
          usage: 'Pass api=<exact export> first; keyword=<substring> as fallback. Usage guidance lives in skills/koatty/references/.',
        });
      }

      const installed = installedVersions(root, Object.keys(index.packages));

      type Hit = {
        api: string;
        package: string;
        packageVersion: string;
        import: string;
        installedVersion: string | null;
        compatibility: string;
        reexportedFrom?: string;
      };
      const hits: Hit[] = [];
      for (const [name, p] of Object.entries(index.packages)) {
        if (pkgFilter && name !== pkgFilter) continue;
        if (p.exports.length === 0) continue;
        const matches = p.exports.filter((exp) =>
          api ? exp === api : keyword ? exp.toLowerCase().includes(keyword!) : true
        );
        for (const exp of matches) {
          const origin = p.reexportedFrom[exp];
          hits.push({
            api: exp,
            package: name,
            packageVersion: p.version,
            import: `import { ${exp} } from '${name}';`,
            installedVersion: installed[name],
            compatibility: compatibility(installed[name], p.version),
            ...(origin ? { reexportedFrom: origin } : {}),
          });
        }
      }

      if (!hits.length && api) {
        return aiResult(
          'docs',
          'completed',
          {
            query: { api, package: pkgFilter, keyword },
            resolved: false,
            unresolved: {
              kind: 'API_NOT_IN_INDEX',
              message:
                `"${api}" was not found in the bundled API index (generated ${index.generatedAt}). ` +
                'Do not invent the API: inspect the installed package declarations or ask the maintainer.',
            },
          },
          [
            {
              code: 'API_NOT_IN_INDEX',
              message: `API "${api}" not found in bundled index`,
              next: 'Inspect node_modules typings of the installed packages, or check skills/koatty/references/ for the scenario guide.',
            },
          ]
        );
      }

      return aiResult('docs', 'completed', {
        query: { api, package: pkgFilter, keyword },
        generatedAt: index.generatedAt,
        truncated: hits.length > limit,
        hits: hits
          .sort((a, b) => (a.api === b.api ? a.package.localeCompare(b.package) : a.api.localeCompare(b.api)))
          .slice(0, limit),
        referenceRoot: 'skills/koatty/references/',
        versionNote: 'The bundled snapshot is guidance, not proof that an API exists in the installed version. Same major alone does not guarantee compatibility.',
      });
    },
  };
}

/** 供测试与 MCP 复用的知识文件定位 */
export function knowledgeDir(): string {
  return path.join(__dirname, '..', '..', 'knowledge');
}

export function knowledgeExists(): boolean {
  return fs.existsSync(path.join(knowledgeDir(), 'api-index.json'));
}
