import { BaseGenerator } from './BaseGenerator';

type ApiType = 'rest' | 'grpc' | 'graphql';

const TEMPLATE_MAP: Record<ApiType, string> = {
  rest: 'controller/controller.hbs',
  grpc: 'controller/grpc.hbs',
  graphql: 'controller/graphql.hbs',
};

const SUFFIX_MAP: Record<ApiType, string> = {
  rest: 'Controller',
  grpc: 'GrpcController',
  graphql: 'GraphQLController',
};

/**
 * Controller Generator - Generates Controller files
 * 根据 api.type 选择 REST / gRPC / GraphQL 模板
 * 当 auth.enabled 时，同时生成 AuthAspect 切面文件
 */
export class ControllerGenerator extends BaseGenerator {
  /**
   * Generate Controller file
   */
  public async generate(): Promise<void> {
    const apiType: ApiType = (this.spec.api?.type as ApiType) ?? 'rest';
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
