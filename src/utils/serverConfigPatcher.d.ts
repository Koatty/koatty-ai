/** 需要特殊配置的协议类型 */
export declare const PROTOCOL_TYPES: readonly ["grpc", "graphql", "websocket", "ws"];
/**
 * 在 config/server.ts 的 protocol 中增加指定协议
 * 仅 grpc、graphql、websocket(ws) 需要处理
 */
export declare function addProtocolToServerConfig(cwd: string, protocolType: string): boolean;
//# sourceMappingURL=serverConfigPatcher.d.ts.map