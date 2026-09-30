import { queryManifest, ManifestQuery } from '../../operations/inspect';
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { collectManifest, renderManifestMarkdown, validateManifest } from '../../manifest';

interface ManifestCommandOptions {
  out?: string;
  format?: 'json' | 'md';
  root?: string;
  validate?: boolean;
  protocols?: string;
  runtimeDir?: string;
  section?: ManifestQuery['section'];
  name?: string;
  offset?: string;
  limit?: string;
}

/**
 * Manifest command (roadmap Phase E, item E-1).
 *
 * Exports the machine readable structure of the current Koatty project:
 * components, routes, DTO fields, aspects and config **key names** (never
 * values). Static analysis only - no application bootstrap, no ports.
 */
export function registerManifestCommand(program: Command) {
  const manifest = program
    .command('manifest')
    .description(
      'Export the application manifest (components, routes, DTOs, config keys) as JSON/Markdown'
    )
    .option('--root <path>', 'Project root (default: current directory)')
    .option('--out <path>', 'Write the manifest to this file instead of stdout')
    .option('--format <format>', 'Output format: json | md', 'json')
    .option('--protocols <list>', 'Comma separated protocol override, e.g. http,grpc')
    .option(
      '--runtime-dir <path>',
      'Include compiled files for production startup (run after build)'
    )
    .option('--section <name>', 'Query components|routes|tools|resources|prompts')
    .option('--name <text>', 'Filter a section by name/path')
    .option('--offset <n>', 'Section offset')
    .option('--limit <n>', 'Section limit (1..200, default 50)')
    .option('--validate', 'Validate the generated manifest and exit non-zero on problems')
    .action(async (options: ManifestCommandOptions) => {
      try {
        const root = path.resolve(process.cwd(), options.root ?? '.');
        if (!fs.existsSync(root)) {
          console.error(`Error: project root not found at ${root}`);
          process.exit(1);
        }

        const format = (options.format ?? 'json').toLowerCase();
        if (format !== 'json' && format !== 'md') {
          console.error(`Error: unsupported --format '${options.format}' (expected json | md)`);
          process.exit(1);
        }

        const manifestData = collectManifest(root, {
          runtimeDir: options.runtimeDir,
          protocols: options.protocols
            ? options.protocols
                .split(',')
                .map((p) => p.trim())
                .filter(Boolean)
            : undefined,
        });

        if (options.validate) {
          const errors = validateManifest(manifestData);
          if (errors.length) {
            console.error('Manifest validation failed:');
            for (const err of errors) console.error(`  - ${err}`);
            process.exit(1);
          }
          console.error('Manifest is valid.');
        }

        const data = queryManifest(manifestData, {
          section: options.section,
          name: options.name,
          offset: options.offset === undefined ? undefined : Number(options.offset),
          limit: options.limit === undefined ? undefined : Number(options.limit),
        });
        if (options.section && format !== 'json')
          throw new Error('Section queries require JSON format');
        const output =
          format === 'md'
            ? renderManifestMarkdown(manifestData)
            : `${JSON.stringify(data, null, 2)}\n`;

        if (options.out) {
          const outPath = path.resolve(process.cwd(), options.out);
          fs.mkdirSync(path.dirname(outPath), { recursive: true });
          fs.writeFileSync(outPath, output, 'utf-8');
          console.error(`Manifest written to: ${outPath}`);
          console.error(
            `  routes: ${manifestData.routes.length}, components: ${manifestData.components.length}, dtos: ${Object.keys(manifestData.dtos).length}`
          );
          return;
        }

        process.stdout.write(output);
      } catch (error) {
        console.error(`Error generating manifest: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  return manifest;
}
