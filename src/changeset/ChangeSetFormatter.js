"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeSetFormatter = void 0;
const tslib_1 = require("tslib");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
/**
 * ChangeSet Formatter - Formats ChangeSet for terminal output
 */
class ChangeSetFormatter {
    /**
     * Format a ChangeSet into a colored string
     */
    static format(cs) {
        let output = `\n${chalk_1.default.bold.cyan('ChangeSet ID:')} ${cs.id}\n`;
        output += `${chalk_1.default.bold.cyan('Module:')} ${cs.module}\n`;
        output += `${chalk_1.default.bold.cyan('Timestamp:')} ${cs.timestamp}\n\n`;
        output += `${chalk_1.default.bold.white('Proposed Changes:')}\n`;
        const changes = cs.getChanges();
        if (changes.length === 0) {
            output += `  ${chalk_1.default.gray('(no changes)')}\n`;
            return output;
        }
        changes.forEach((change) => {
            const icon = this.getIcon(change.type);
            const color = this.getColor(change.type);
            output += `  ${color(icon)} ${color(change.path)} ${chalk_1.default.gray(`(${change.description || 'no description'})`)}\n`;
        });
        return output;
    }
    /**
     * Get icon based on change type
     */
    static getIcon(type) {
        switch (type) {
            case 'create':
                return '+';
            case 'modify':
                return 'M';
            case 'delete':
                return '-';
            default:
                return '?';
        }
    }
    /**
     * Get color based on change type
     */
    static getColor(type) {
        switch (type) {
            case 'create':
                return chalk_1.default.green;
            case 'modify':
                return chalk_1.default.yellow;
            case 'delete':
                return chalk_1.default.red;
            default:
                return chalk_1.default.white;
        }
    }
}
exports.ChangeSetFormatter = ChangeSetFormatter;
//# sourceMappingURL=ChangeSetFormatter.js.map