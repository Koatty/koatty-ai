/**
 * koatty_ai context 工具：聚合 manifest / routes 的框架信息，
 * 返回按任务聚焦的项目结构上下文（组件、DI 依赖、DTO、协议、配置键名）。
 *
 * 边界：只返回路径、符号、声明摘要与 unresolved 项；宿主 Agent 用自己的
 * 读文件工具查看业务源码。配置只输出键名/schema，绝不输出配置值。
 */

import * as fs from 'fs';
import { describeProject, validateProjectManifest } from 'koatty_cli/project';
import { aiResult } from '../result';
import { AiToolDefinition, installedVersions } from './registry';

const SECTION_ENUM = [
  'components',
  'routes',
  'dtos',
  'protocols',
  'config',
  'aspects',
  'unresolved',
] as const;

export function contextTool(): AiToolDefinition {
  return {
    name: 'koatty_ai_context',
    command: 'context',
    description:
      'Focused Koatty project context (components, routes, DTOs, config keys, unresolved) from the static manifest.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { type: 'string', description: 'Project root (default: cwd)' },
        sections: {
          type: 'array',
          minItems: 1,
          items: { enum: SECTION_ENUM },
          description: 'Sections to include (default: all)',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 500,
          description: 'Max items per section (default 100)',
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
    executesProjectCode: false,
    handler: async (input, ctx) => {
      if (!fs.existsSync(ctx.projectRoot)) {
        return aiResult('context', 'failed', null, [
          { code: 'ROOT_NOT_FOUND', message: `Project root does not exist: ${ctx.projectRoot}` },
        ]);
      }
      const sections = (input.sections as (typeof SECTION_ENUM)[number][] | undefined) ?? [
        ...SECTION_ENUM,
      ];
      const limit = (input.limit as number | undefined) ?? 100;
      const manifest = describeProject(ctx.projectRoot);
      const schemaErrors = validateProjectManifest(manifest);

      const data: Record<string, unknown> = {
        root: ctx.projectRoot,
        koatty: manifest.koatty,
        decoratorMode: manifest.decoratorMode,
        collectionMode: manifest.collectionMode,
        installedVersions: installedVersions(ctx.projectRoot, ['koatty']),
        schemaErrors,
        truncated: {
          components: sections.includes('components') && manifest.components.length > limit,
          routes: sections.includes('routes') && manifest.routes.length > limit,
        },
        note: 'Static declarations only; read business source files with host tools. Config values are never included.',
      };
      if (sections.includes('components')) {
        data.components = manifest.components.slice(0, limit).map((c) => ({
          id: c.id,
          type: c.type,
          scope: c.scope,
          file: c.file,
          dependsOn: c.dependsOn,
        }));
      }
      if (sections.includes('routes')) {
        data.routes = manifest.routes.slice(0, limit).map((r) => ({
          controller: r.controller,
          handler: r.handler,
          method: r.method,
          path: r.path,
          protocol: r.protocol,
          params: r.params,
          file: r.file,
        }));
      }
      if (sections.includes('dtos')) {
        data.dtos = Object.entries(manifest.dtos)
          .slice(0, limit)
          .map(([name, dto]) => ({ name, file: dto.file, fields: Object.keys(dto.fields) }));
      }
      if (sections.includes('protocols')) data.protocols = manifest.protocols;
      if (sections.includes('config')) {
        // 只输出键名与 schema 来源，不输出配置值
        data.config = {
          keys: manifest.config.keys.slice(0, limit),
          schemaSource: manifest.config.schemaSource,
        };
      }
      if (sections.includes('aspects')) data.aspects = manifest.aspects;
      if (sections.includes('unresolved')) data.unresolved = manifest.unresolved.slice(0, limit);

      return aiResult('context', 'completed', data);
    },
  };
}
