"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPlanCommand = registerPlanCommand;
const tslib_1 = require("tslib");
const GeneratorPipeline_1 = require("../../pipeline/GeneratorPipeline");
const ChangeSetFormatter_1 = require("../../changeset/ChangeSetFormatter");
const OpenAPIGenerator_1 = require("../../utils/OpenAPIGenerator");
const fs = tslib_1.__importStar(require("fs"));
const path = tslib_1.__importStar(require("path"));
/**
 * Plan command - Preview changes before applying
 */
function registerPlanCommand(program) {
    const plan = program
        .command('plan')
        .description('Preview changes without applying them')
        .option('--spec <path>', 'Path to specification file (YAML/JSON)')
        .option('--openapi <output>', 'Output OpenAPI 3.1 spec to file (JSON format)')
        .action(async (options) => {
        try {
            if (!options.spec) {
                console.error('Error: --spec <path> is required');
                process.exit(1);
            }
            const specPath = path.resolve(process.cwd(), options.spec);
            if (!fs.existsSync(specPath)) {
                console.error(`Error: Spec file not found at ${specPath}`);
                process.exit(1);
            }
            const pipeline = new GeneratorPipeline_1.GeneratorPipeline(specPath);
            const spec = pipeline.getSpec();
            if (options.openapi) {
                const openapiGenerator = new OpenAPIGenerator_1.OpenAPIGenerator(spec);
                const openapiSpec = openapiGenerator.generate();
                const outputPath = path.resolve(process.cwd(), options.openapi);
                const outputDir = path.dirname(outputPath);
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }
                fs.writeFileSync(outputPath, JSON.stringify(openapiSpec, null, 2), 'utf-8');
                console.log(`OpenAPI 3.1 spec written to: ${outputPath}`);
                return;
            }
            const changeset = await pipeline.execute();
            console.log(`Plan for module: ${spec.module}`);
            console.log(`Spec file: ${options.spec}`);
            console.log('\n--- Proposed Changes ---');
            console.log(ChangeSetFormatter_1.ChangeSetFormatter.format(changeset));
            console.log('\n--- End of Plan ---');
            console.log(`Run 'koatty apply --spec ${options.spec}' to apply these changes.`);
        }
        catch (error) {
            console.error(`Error planning changes: ${error.message}`);
            process.exit(1);
        }
    });
    return plan;
}
//# sourceMappingURL=plan.js.map