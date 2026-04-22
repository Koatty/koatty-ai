import { ChangeSet } from '../changeset/ChangeSet';
/**
 * Ensures package.json has the "doc" script and optional devDependencies for API doc generation.
 * Optionally adds scripts/generate-api-doc.ts if not present.
 */
export declare function ensureDocScriptInPackageJson(changeset: ChangeSet, workingDirectory: string, options?: {
    addScriptFile?: boolean;
}): void;
//# sourceMappingURL=PackageJsonDocGenerator.d.ts.map