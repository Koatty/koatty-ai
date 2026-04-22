"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAPIGenerator = void 0;
class OpenAPIGenerator {
    constructor(spec) {
        this.spec = spec;
    }
    generate() {
        const moduleName = this.spec.module;
        const basePath = this.spec.api?.basePath || `/${moduleName.toLowerCase()}`;
        const openapi = {
            openapi: '3.1.0',
            info: {
                title: `${moduleName} API`,
                version: '1.0.0',
                description: `API specification for ${moduleName} module`,
            },
            paths: {},
            components: {
                schemas: {},
            },
        };
        if (this.spec.api?.type === 'rest' || !this.spec.api?.type) {
            openapi.servers = [
                {
                    url: `http://localhost:3000${basePath}`,
                    description: 'Development server',
                },
            ];
        }
        this.generateSchemas(openapi);
        this.generatePaths(openapi);
        if (this.spec.auth?.enabled) {
            openapi.components.securitySchemes = {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            };
        }
        return openapi;
    }
    generateSchemas(openapi) {
        const moduleName = this.spec.module;
        openapi.components.schemas[moduleName] = this.generateSchemaFromFields(this.spec.fields);
        openapi.components.schemas[`${moduleName}Create`] = this.generateCreateSchema(this.spec.fields);
        openapi.components.schemas[`${moduleName}Update`] = this.generateUpdateSchema(this.spec.fields);
        if (this.spec.dto?.query || this.spec.features?.pagination) {
            openapi.components.schemas[`${moduleName}Query`] = this.generateQuerySchema();
        }
        if (this.spec.features?.pagination) {
            openapi.components.schemas[`${moduleName}List`] = this.generateListSchema(moduleName);
        }
    }
    generateSchemaFromFields(fields) {
        const properties = {};
        const required = [];
        for (const [name, field] of Object.entries(fields)) {
            if (field.primary)
                continue;
            properties[name] = this.fieldToOpenAPIProperty(field);
            if (field.required && !field.nullable) {
                required.push(name);
            }
        }
        return {
            type: 'object',
            properties,
            required: required.length > 0 ? required : undefined,
        };
    }
    fieldToOpenAPIProperty(field) {
        const property = {
            type: this.mapFieldTypeToOpenAPI(field.type),
        };
        if (field.comment) {
            property.description = field.comment;
        }
        if (field.format) {
            property.format = field.format;
        }
        else if (field.type === 'datetime') {
            property.format = 'date-time';
        }
        else if (field.type === 'text') {
            property.format = 'text';
        }
        if (field.length && field.type === 'string') {
            property.maxLength = field.length;
        }
        if (field.type === 'enum' && field.values) {
            property.enum = field.values;
        }
        if (field.default !== undefined) {
            property.default = field.default;
        }
        if (field.nullable) {
            property.nullable = true;
        }
        return property;
    }
    mapFieldTypeToOpenAPI(type) {
        const typeMap = {
            string: 'string',
            number: 'number',
            boolean: 'boolean',
            enum: 'string',
            datetime: 'string',
            text: 'string',
            json: 'object',
        };
        return typeMap[type] || 'string';
    }
    generateCreateSchema(fields) {
        const properties = {};
        const required = [];
        for (const [name, field] of Object.entries(fields)) {
            if (field.primary || field.auto)
                continue;
            properties[name] = this.fieldToOpenAPIProperty(field);
            if (field.required && !field.nullable) {
                required.push(name);
            }
        }
        return {
            type: 'object',
            properties,
            required: required.length > 0 ? required : undefined,
        };
    }
    generateUpdateSchema(fields) {
        const properties = {};
        for (const [name, field] of Object.entries(fields)) {
            if (field.primary)
                continue;
            properties[name] = {
                ...this.fieldToOpenAPIProperty(field),
                nullable: true,
            };
        }
        return {
            type: 'object',
            properties,
        };
    }
    generateQuerySchema() {
        const properties = {
            page: {
                type: 'integer',
                minimum: 1,
                default: 1,
            },
            pageSize: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 20,
            },
            sortBy: {
                type: 'string',
            },
            sortOrder: {
                type: 'string',
                enum: ['asc', 'desc'],
            },
        };
        if (this.spec.features?.searchableFields) {
            properties.search = {
                type: 'string',
                description: `Search in fields: ${this.spec.features.searchableFields.join(', ')}`,
            };
        }
        return {
            type: 'object',
            properties,
        };
    }
    generateListSchema(moduleName) {
        return {
            type: 'object',
            properties: {
                data: {
                    type: 'array',
                    items: {
                        $ref: `#/components/schemas/${moduleName}`,
                    },
                },
                total: {
                    type: 'integer',
                },
                page: {
                    type: 'integer',
                },
                pageSize: {
                    type: 'integer',
                },
                totalPages: {
                    type: 'integer',
                },
            },
        };
    }
    generatePaths(openapi) {
        const moduleName = this.spec.module;
        const basePath = this.spec.api?.basePath || `/${moduleName.toLowerCase()}`;
        const endpoints = this.spec.api?.endpoints || this.getDefaultEndpoints();
        for (const endpoint of endpoints) {
            const fullPath = `${basePath}${endpoint.path}`;
            const method = endpoint.method.toLowerCase();
            if (!openapi.paths[fullPath]) {
                openapi.paths[fullPath] = {};
            }
            openapi.paths[fullPath][method] = this.generateOperation(endpoint, moduleName);
        }
    }
    getDefaultEndpoints() {
        const moduleName = this.spec.module;
        return [
            { method: 'GET', path: '', action: 'list' },
            { method: 'GET', path: '/:id', action: 'get' },
            { method: 'POST', path: '', action: 'create' },
            { method: 'PUT', path: '/:id', action: 'update' },
            { method: 'DELETE', path: '/:id', action: 'delete' },
        ];
    }
    generateOperation(endpoint, moduleName) {
        const operation = {
            summary: this.getOperationSummary(endpoint, moduleName),
            operationId: `${moduleName}_${endpoint.action}`,
            tags: [moduleName],
            responses: {
                '200': {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: this.getResponseSchema(endpoint, moduleName),
                        },
                    },
                },
                '400': {
                    description: 'Bad Request',
                },
                '401': {
                    description: 'Unauthorized',
                },
                '404': {
                    description: 'Not Found',
                },
                '500': {
                    description: 'Internal Server Error',
                },
            },
        };
        if (endpoint.auth || this.spec.auth?.enabled) {
            operation.security = [{ bearerAuth: [] }];
            if (endpoint.roles && endpoint.roles.length > 0) {
                operation.description = `Required roles: ${endpoint.roles.join(', ')}`;
            }
        }
        if (endpoint.method === 'POST' || endpoint.method === 'PUT' || endpoint.method === 'PATCH') {
            operation.requestBody = {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: `#/components/schemas/${moduleName}${endpoint.method === 'POST' ? 'Create' : 'Update'}`,
                        },
                    },
                },
            };
        }
        if (endpoint.pagination || endpoint.action === 'list') {
            operation.parameters = [
                {
                    name: 'page',
                    in: 'query',
                    schema: {
                        type: 'integer',
                        minimum: 1,
                        default: 1,
                    },
                },
                {
                    name: 'pageSize',
                    in: 'query',
                    schema: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 100,
                        default: 20,
                    },
                },
            ];
        }
        if (endpoint.path.includes(':id')) {
            operation.parameters = operation.parameters || [];
            operation.parameters.unshift({
                name: 'id',
                in: 'path',
                required: true,
                schema: {
                    type: 'string',
                },
            });
        }
        return operation;
    }
    getOperationSummary(endpoint, moduleName) {
        const actionSummaries = {
            list: `List all ${moduleName}`,
            get: `Get a ${moduleName} by ID`,
            create: `Create a new ${moduleName}`,
            update: `Update a ${moduleName}`,
            delete: `Delete a ${moduleName}`,
        };
        return actionSummaries[endpoint.action] || `${endpoint.action} ${moduleName}`;
    }
    getResponseSchema(endpoint, moduleName) {
        if (endpoint.action === 'list' || endpoint.pagination) {
            return {
                $ref: `#/components/schemas/${moduleName}List`,
            };
        }
        return {
            $ref: `#/components/schemas/${moduleName}`,
        };
    }
}
exports.OpenAPIGenerator = OpenAPIGenerator;
//# sourceMappingURL=OpenAPIGenerator.js.map