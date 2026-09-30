import type { KoattyManifest } from '../manifest';
import { OperationError } from './result';

export interface ManifestQuery {
  section?: 'components' | 'routes' | 'tools' | 'resources' | 'prompts';
  name?: string;
  offset?: number;
  limit?: number;
}

export function queryManifest(manifest: KoattyManifest, query: ManifestQuery = {}): unknown {
  if (!query.section) {
    if (query.name || query.offset !== undefined || query.limit !== undefined)
      throw new OperationError(
        'INVALID_ARGUMENT',
        'Choose a manifest section before filtering or paging'
      );
    return manifest;
  }
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 50;
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 200
  )
    throw new OperationError('INVALID_ARGUMENT', 'offset must be >= 0; limit must be 1..200');
  let entries: Array<Record<string, any>>;
  switch (query.section) {
    case 'components':
      entries = manifest.components;
      break;
    case 'routes':
      entries = manifest.routes;
      break;
    case 'tools':
      entries = manifest.mcp?.tools ?? [];
      break;
    case 'resources':
      entries = manifest.mcp?.resources ?? [];
      break;
    case 'prompts':
      entries = manifest.mcp?.prompts ?? [];
      break;
    default:
      throw new OperationError('INVALID_ARGUMENT', 'Unknown manifest section');
  }
  const selected = query.name
    ? entries.filter((entry) =>
        [entry.id, entry.name, entry.path, entry.component, entry.controller].some(
          (value) => typeof value === 'string' && value.includes(query.name!)
        )
      )
    : entries;
  return {
    schemaVersion: 1,
    collectionMode: 'static',
    section: query.section,
    total: entries.length,
    matched: selected.length,
    offset,
    items: selected.slice(offset, offset + limit),
    nextOffset: offset + limit < selected.length ? offset + limit : null,
    unresolved: manifest.unresolved,
    ...(manifest.mcp ? { mcpCoverage: manifest.mcp.coverage } : {}),
  };
}
