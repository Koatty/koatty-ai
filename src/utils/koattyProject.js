"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isKoattyApp = isKoattyApp;
exports.getAppPath = getAppPath;
const tslib_1 = require("tslib");
const fs = tslib_1.__importStar(require("fs"));
const path = tslib_1.__importStar(require("path"));
/**
 * 判断当前目录是否为 Koatty 项目根目录（与旧 koatty_cli 兼容）
 */
function isKoattyApp(dir = process.cwd()) {
    const koattysrc = path.join(dir, '.koattysrc');
    if (fs.existsSync(koattysrc)) {
        return true;
    }
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            if (deps && typeof deps === 'object') {
                if (Object.keys(deps).some((k) => k === 'koatty' || k.startsWith('koatty_'))) {
                    return true;
                }
            }
        }
        catch {
            // ignore
        }
    }
    return false;
}
/**
 * 获取项目 src 目录路径（与旧 koatty_cli 一致）
 */
function getAppPath(dir = process.cwd()) {
    return path.normalize(path.join(dir, 'src'));
}
//# sourceMappingURL=koattyProject.js.map