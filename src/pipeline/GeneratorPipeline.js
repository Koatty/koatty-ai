"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeneratorPipeline = void 0;
const tslib_1 = require("tslib");
const ChangeSet_1 = require("../changeset/ChangeSet");
const ModuleGenerator_1 = require("../generators/ModuleGenerator");
const PackageJsonDocGenerator_1 = require("../generators/PackageJsonDocGenerator");
const SpecParser_1 = require("../parser/SpecParser");
const Validator_1 = require("../runner/Validator");
const FieldParser_1 = require("../parser/FieldParser");
const fs = tslib_1.__importStar(require("fs"));
const path = tslib_1.__importStar(require("path"));
/**
 * GeneratorPipeline - Encapsulates the entire generation workflow
 *
 * This class provides a unified interface for:
 * 1. Loading and validating specs (from file or CLI options)
 * 2. Generating code via generators
 * 3. Applying AST patches to existing project files
 * 4. Returning a complete ChangeSet
 */
class GeneratorPipeline {
    constructor(specOrConfig, config = {}) {
        this.config = {
            workingDirectory: process.cwd(),
            ...config,
        };
        this.workingDirectory = this.config.workingDirectory || process.cwd();
        if (typeof specOrConfig === 'string') {
            this.spec = this.loadSpecFromFile(specOrConfig);
        }
        else {
            this.spec = specOrConfig;
        }
        this.changeset = new ChangeSet_1.ChangeSet(this.spec.module);
    }
    /**
     * Build a Spec from CLI options and module name
     */
    static buildSpecFromOptions(moduleName, options) {
        const spec = {
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
    mergeOptions(options) {
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
            const inlineFields = FieldParser_1.FieldParser.parseFields(options.inlineFieldsJson);
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
    loadSpecFromFile(filePath) {
        const resolvedPath = path.resolve(this.workingDirectory, filePath);
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`Spec file not found at: ${resolvedPath}`);
        }
        const spec = SpecParser_1.SpecParser.parseFile(resolvedPath);
        return spec;
    }
    /**
     * Validate the current spec
     */
    validateSpec() {
        Validator_1.Validator.validate(this.spec);
    }
    /**
     * Execute full generation pipeline
     */
    async execute() {
        // Step 1: Validate spec
        this.validateSpec();
        // Step 2: Generate core files
        const generator = new ModuleGenerator_1.ModuleGenerator(this.spec, this.changeset);
        await generator.generate();
        // Step 3: Ensure package.json has "doc" script for Typia API documentation
        (0, PackageJsonDocGenerator_1.ensureDocScriptInPackageJson)(this.changeset, this.workingDirectory);
        return this.changeset;
    }
    /**
     * Get the generated ChangeSet
     */
    getChangeSet() {
        return this.changeset;
    }
    /**
     * Get the Spec object
     */
    getSpec() {
        return this.spec;
    }
}
exports.GeneratorPipeline = GeneratorPipeline;
//# sourceMappingURL=GeneratorPipeline.js.map