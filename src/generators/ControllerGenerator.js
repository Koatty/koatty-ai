"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControllerGenerator = void 0;
const BaseGenerator_1 = require("./BaseGenerator");
const TEMPLATE_MAP = {
    rest: 'controller/controller.hbs',
    grpc: 'controller/grpc.hbs',
    graphql: 'controller/graphql.hbs',
};
const SUFFIX_MAP = {
    rest: 'Controller',
    grpc: 'GrpcController',
    graphql: 'GraphQLController',
};
/**
 * Controller Generator - Generates Controller files
 * 根据 api.type 选择 REST / gRPC / GraphQL 模板
 * 当 auth.enabled 时，同时生成 AuthAspect 切面文件
 */
class ControllerGenerator extends BaseGenerator_1.BaseGenerator {
    /**
     * Generate Controller file
     */
    async generate() {
        const apiType = this.spec.api?.type ?? 'rest';
        const templatePath = TEMPLATE_MAP[apiType];
        const suffix = SUFFIX_MAP[apiType];
        const outputPath = this.getOutputPath('controller', suffix);
        const content = await this.render(templatePath, this.spec);
        this.changeset.createFile(outputPath, content, `Generate ${apiType.toUpperCase()} Controller for ${this.spec.module}`);
        // 当启用认证时，生成 AuthAspect 切面（仅生成一次）
        if (this.spec.auth?.enabled) {
            const guardPath = 'src/aspect/AuthAspect.ts';
            const guardContent = await this.render('guard/AuthAspect.hbs', this.spec);
            this.changeset.createFile(guardPath, guardContent, 'Generate AuthAspect for authentication');
        }
    }
}
exports.ControllerGenerator = ControllerGenerator;
//# sourceMappingURL=ControllerGenerator.js.map