import { Spec } from '../types/spec';
export interface OpenAPISpec {
    openapi: string;
    info: {
        title: string;
        version: string;
        description?: string;
    };
    servers?: Array<{
        url: string;
        description?: string;
    }>;
    paths: Record<string, any>;
    components?: {
        schemas?: Record<string, any>;
        securitySchemes?: Record<string, any>;
    };
}
export declare class OpenAPIGenerator {
    private spec;
    constructor(spec: Spec);
    generate(): OpenAPISpec;
    private generateSchemas;
    private generateSchemaFromFields;
    private fieldToOpenAPIProperty;
    private mapFieldTypeToOpenAPI;
    private generateCreateSchema;
    private generateUpdateSchema;
    private generateQuerySchema;
    private generateListSchema;
    private generatePaths;
    private getDefaultEndpoints;
    private generateOperation;
    private getOperationSummary;
    private getResponseSchema;
}
//# sourceMappingURL=OpenAPIGenerator.d.ts.map