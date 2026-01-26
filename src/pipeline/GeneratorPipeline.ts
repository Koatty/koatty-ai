import { Spec } from '../types/spec';
import { ChangeSet } from '../changeset/ChangeSet';
import { ModuleGenerator } from '../generators/ModuleGenerator';
import { ModuleRegistrar } from '../patcher/ModuleRegistrar';
import { RouteRegistrar } from '../patcher/RouteRegistrar';
import { SpecParser } from '../parser/SpecParser';
import { Validator } from '../runner/Validator';
import { FieldParser } from '../parser/FieldParser';
import * as fs from 'fs';
import * as path from 'path';

export interface PipelineOptions {
  specFilePath?: string;
  inlineFieldsJson?: string;
  apiType?: 'rest' | 'graphql';
  auth?: string | boolean;
  softDelete?: boolean;
  pagination?: boolean;
  searchFields?: string;
}

export interface PipelineConfig {
  enablePatching?: boolean;
  workingDirectory?: string;
}

/**
 * GeneratorPipeline - Encapsulates the entire generation workflow
 *
 * This class provides a unified interface for:
 * 1. Loading and validating specs (from file or CLI options)
 * 2. Generating code via generators
 * 3. Applying AST patches to existing project files
 * 4. Returning a complete ChangeSet
 */
export class GeneratorPipeline {
  private spec: Spec;
  private changeset: ChangeSet;
  private config: PipelineConfig;
  private workingDirectory: string;

  constructor(specOrConfig: Spec | string, config: PipelineConfig = {}) {
    this.config = {
      enablePatching: true,
      workingDirectory: process.cwd(),
      ...config,
    };
    this.workingDirectory = this.config.workingDirectory || process.cwd();

    if (typeof specOrConfig === 'string') {
      this.spec = this.loadSpecFromFile(specOrConfig);
    } else {
      this.spec = specOrConfig;
    }

    this.changeset = new ChangeSet(this.spec.module);
  }

  /**
   * Build a Spec from CLI options and module name
   */
  public static buildSpecFromOptions(moduleName: string, options: PipelineOptions): Spec {
    const spec: Spec = {
      module: moduleName,
      fields: {},
      api: options.apiType
        ? {
            type: options.apiType,
            basePath: `/${moduleName.toLowerCase()}`,
            endpoints: [],
          }
        : undefined,
      dto: {
        create: true,
        update: true,
        query: true,
      },
      features: {
        softDelete: !!options.softDelete,
        pagination: !!options.pagination,
        search: !!options.searchFields,
        searchableFields: options.searchFields ? options.searchFields.split(',') : [],
      },
    };

    // Handle auth roles
    if (options.auth) {
      spec.auth = {
        enabled: true,
        defaultRoles: typeof options.auth === 'string' ? options.auth.split(',') : [],
      };
    }

    return spec;
  }

  /**
   * Merge CLI options with an existing spec
   */
  public mergeOptions(options: PipelineOptions): void {
    // Update API type if specified
    if (options.apiType) {
      this.spec.api = {
        type: options.apiType,
        basePath: `/${this.spec.module.toLowerCase()}`,
        endpoints: this.spec.api?.endpoints || [],
      };
    }

    // Parse and merge inline fields
    if (options.inlineFieldsJson) {
      const inlineFields = FieldParser.parseFields(options.inlineFieldsJson);
      this.spec.fields = { ...this.spec.fields, ...inlineFields };
    }

    // Handle auth roles
    if (options.auth) {
      this.spec.auth = {
        enabled: true,
        defaultRoles: typeof options.auth === 'string' ? options.auth.split(',') : [],
      };
    }

    // Handle features
    if (options.softDelete !== undefined) {
      this.spec.features = this.spec.features || {};
      this.spec.features.softDelete = options.softDelete;
    }

    if (options.pagination !== undefined) {
      this.spec.features = this.spec.features || {};
      this.spec.features.pagination = options.pagination;
    }
  }

  /**
   * Load spec from a file (YAML or JSON)
   */
  private loadSpecFromFile(filePath: string): Spec {
    const resolvedPath = path.resolve(this.workingDirectory, filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Spec file not found at: ${resolvedPath}`);
    }

    const spec = SpecParser.parseFile(resolvedPath);
    return spec;
  }

  /**
   * Validate the current spec
   */
  public validateSpec(): void {
    Validator.validate(this.spec);
  }

  /**
   * Execute the full generation pipeline
   */
  public execute(): ChangeSet {
    // Step 1: Validate spec
    this.validateSpec();

    // Step 2: Generate core files
    const generator = new ModuleGenerator(this.spec, this.changeset);
    generator.generate();

    // Step 3: Apply AST patches if enabled
    if (this.config.enablePatching !== false) {
      this.applyAstPatches();
    }

    return this.changeset;
  }

  /**
   * Apply AST patches to existing project files
   */
  private applyAstPatches(): void {
    const controllerName = `${this.spec.module}Controller`;
    const serviceName = `${this.spec.module}Service`;

    const registrar = new ModuleRegistrar(
      this.changeset,
      this.spec.module,
      controllerName,
      serviceName
    );
    const routeRegistrar = new RouteRegistrar(this.changeset, this.spec.module, controllerName);

    const appModulePath = path.join(this.workingDirectory, 'src/AppModule.ts');
    const routerPath = path.join(this.workingDirectory, 'src/config/router.ts');

    if (fs.existsSync(appModulePath)) {
      try {
        registrar.patch(appModulePath);
      } catch (error) {
        console.warn(`⚠️  Could not patch AppModule.ts: ${(error as Error).message}`);
      }
    }

    if (fs.existsSync(routerPath)) {
      try {
        routeRegistrar.patch(routerPath);
      } catch (error) {
        console.warn(`⚠️  Could not patch router.ts: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Get the generated ChangeSet
   */
  public getChangeSet(): ChangeSet {
    return this.changeset;
  }

  /**
   * Get the Spec object
   */
  public getSpec(): Spec {
    return this.spec;
  }
}
