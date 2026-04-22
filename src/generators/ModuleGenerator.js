"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleGenerator = void 0;
const ModelGenerator_1 = require("./ModelGenerator");
const DtoGenerator_1 = require("./DtoGenerator");
const ServiceGenerator_1 = require("./ServiceGenerator");
const ControllerGenerator_1 = require("./ControllerGenerator");
const ProtoGenerator_1 = require("./ProtoGenerator");
/**
 * Module Generator - Orchestrates all specific generators for a module
 *
 * 生成文件到 Koatty 项目标准目录结构：
 *   src/controller/{Module}Controller.ts (REST) | {Module}GrpcController.ts | {Module}GraphQLController.ts
 *   src/service/{Module}Service.ts
 *   src/model/{Module}Model.ts (entity)
 *   src/dto/{Module}Dto.ts
 *   src/resource/proto/{Module}.proto (仅 gRPC)
 *
 * Koatty 框架通过 IoC 容器自动扫描加载，无需 barrel index.ts
 */
class ModuleGenerator {
    constructor(spec, changeset) {
        this.spec = spec;
        this.changeset = changeset;
    }
    /**
     * Generate all files for a module
     */
    async generate() {
        const generators = [
            new ModelGenerator_1.ModelGenerator(this.spec, this.changeset),
            new DtoGenerator_1.DtoGenerator(this.spec, this.changeset),
            new ServiceGenerator_1.ServiceGenerator(this.spec, this.changeset),
            new ControllerGenerator_1.ControllerGenerator(this.spec, this.changeset),
        ];
        if (this.spec.api?.type === 'grpc') {
            generators.push(new ProtoGenerator_1.ProtoGenerator(this.spec, this.changeset));
        }
        for (const generator of generators) {
            await generator.generate();
        }
    }
}
exports.ModuleGenerator = ModuleGenerator;
//# sourceMappingURL=ModuleGenerator.js.map