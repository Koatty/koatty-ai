/**
 * 模板类型
 */
export type TemplateType = 'project' | 'modules' | 'component';
/**
 * 镜像源类型
 */
export type MirrorSource = 'github' | 'gitee';
/**
 * TemplateManager 构造函数选项
 */
export interface TemplateManagerOptions {
    /** 缓存目录路径，默认 ~/.koatty/templates */
    cacheDir?: string;
    /** submodule 目录路径，默认 path.join(__dirname, '../../templates') */
    submoduleDir?: string;
}
/**
 * 渲染目录选项
 */
export interface RenderDirectoryOptions {
    /** 排除的文件/目录模式 */
    excludePatterns?: string[];
}
/**
 * 渲染结果项
 */
export interface RenderResult {
    /** 输出路径（相对路径） */
    path: string;
    /** 文件内容 */
    content: string | Buffer;
    /** 是否为二进制文件 */
    isBinary: boolean;
}
/**
 * 确保模板仓库可用的选项
 */
export interface EnsureTemplateRepoOptions {
    /** 指定镜像源 */
    mirror?: MirrorSource;
    /** 强制重新下载 */
    force?: boolean;
}
/**
 * 模板管理器
 *
 * templates/ 目录具有双重角色：
 *   1. **Git Submodule（开发期）**：templates/{project,modules,component} 三个子目录
 *      分别对应外部模板仓库的 submodule checkout，开发者可直接修改、提交模板变更。
 *   2. **内置模板（发布期）**：npm publish 时 submodule 内容随包一起发布，
 *      作为 CLI 工具的内置（bundled）模板。
 *
 * 用户可通过 `koatty template update` 将最新模板下载到用户级缓存目录
 * （默认 ~/.koatty/templates/），缓存优先于内置模板被使用。
 *
 * 模板解析优先级（三级降级）：
 *   用户缓存 (~/.koatty/templates/{type})
 *     → 内置 submodule (templates/{type})
 *       → 远程下载（git clone 到缓存目录）
 */
export declare class TemplateManager {
    /** 模板仓库地址配置 */
    private static readonly TEMPLATE_REPOS;
    /** 用户级缓存目录（默认 ~/.koatty/templates/） */
    private cacheDir;
    /** 内置 submodule 目录（默认 templates/，随 npm 包发布） */
    private submoduleDir;
    /** Handlebars helpers 是否已注册 */
    private static helpersRegistered;
    constructor(options?: TemplateManagerOptions);
    /**
     * 注册 Handlebars 自定义 helpers
     * 仅在首次实例化时注册，避免重复注册
     */
    private registerHelpers;
    /**
     * 检查目录是否为有效模板目录
     * @param dir 目录路径
     * @returns 如果目录存在且有非 `.` 开头文件，返回 true
     */
    isValidTemplateDir(dir: string): boolean;
    /**
     * 检查文件是否为二进制文件
     * @param filePath 文件路径
     * @returns 如果文件扩展名在二进制集合中，返回 true
     */
    isBinaryFile(filePath: string): boolean;
    /**
     * 获取模板路径（三级降级：用户缓存 → 内置 submodule → 远程下载）
     *
     * 优先级说明：
     *   1. 用户缓存 (~/.koatty/templates/{type})：用户通过 `koatty template update`
     *      主动下载的最新版本，应当优先使用。
     *   2. 内置 submodule (templates/{type})：随 npm 包发布的内置模板快照。
     *   3. 远程下载：如果上述两者均不可用，自动从远程仓库 clone 到缓存目录。
     *
     * @param type 模板类型
     * @returns 模板目录路径
     */
    getTemplatePath(type: TemplateType): Promise<string>;
    /**
     * 获取内置 submodule 路径
     * @param type 模板类型
     * @returns templates/{type} 路径
     */
    private getSubmodulePath;
    /**
     * 获取用户级缓存路径
     * @param type 模板类型
     * @returns ~/.koatty/templates/{type} 路径
     */
    private getCachePath;
    /**
     * 检测最佳镜像源
     * 通过尝试连接 GitHub 来判断网络状况
     * @returns 最佳镜像源
     */
    detectBestMirror(): Promise<MirrorSource>;
    /**
     * 下载模板仓库
     * @param type 模板类型
     * @param mirror 指定镜像源（可选，不指定则自动检测）
     * @param onProgress 进度回调（可选）
     */
    downloadTemplate(type: TemplateType, mirror?: MirrorSource, onProgress?: (msg: string) => void): Promise<void>;
    /**
     * 确保模板仓库可用
     * @param type 模板类型
     * @param options 选项
     * @returns 模板目录路径
     */
    ensureTemplateRepo(type: TemplateType, options?: EnsureTemplateRepoOptions): Promise<string>;
    /**
     * 更新所有模板缓存
     * @param mirror 指定镜像源（可选）
     * @param onProgress 进度回调（可选）
     */
    updateTemplates(mirror?: MirrorSource, onProgress?: (msg: string) => void): Promise<void>;
    /**
     * 获取缓存目录路径
     */
    getCacheDir(): string;
    /**
     * 获取 submodule 目录路径
     */
    getSubmoduleDir(): string;
    /**
     * 获取某类模板的详细状态
     * @param type 模板类型
     */
    getTemplateStatus(type: TemplateType): {
        type: TemplateType;
        /** 实际解析使用的路径（null 表示不可用） */
        activePath: string | null;
        /** 来源标识 */
        source: 'cache' | 'bundled' | 'none';
        /** 用户缓存路径及是否可用 */
        cache: {
            path: string;
            valid: boolean;
            updatedAt: Date | null;
        };
        /** 内置 submodule 路径及是否可用 */
        bundled: {
            path: string;
            valid: boolean;
        };
    };
    /**
     * 渲染单个模板文件
     * @param templatePath 模板文件的绝对路径
     * @param context 模板上下文变量
     * @returns 渲染后的字符串内容
     */
    renderTemplate(templatePath: string, context: Record<string, unknown>): string;
    /**
     * 渲染整个模板目录
     * 支持文本文件渲染和二进制文件原样复制
     * @param templateDir 模板目录的绝对路径
     * @param context 模板上下文变量
     * @param options 渲染选项
     * @returns 渲染结果数组
     */
    renderDirectory(templateDir: string, context: Record<string, unknown>, options?: RenderDirectoryOptions): Promise<RenderResult[]>;
    /**
     * 渲染路径中的变量（如 {{moduleName}}/controller.ts）
     * @param filePath 文件路径
     * @param context 上下文变量
     * @returns 替换变量后的路径
     */
    private renderPathVariables;
}
//# sourceMappingURL=TemplateManager.d.ts.map