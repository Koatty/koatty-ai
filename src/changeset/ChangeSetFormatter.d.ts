import { ChangeSet } from './ChangeSet';
/**
 * ChangeSet Formatter - Formats ChangeSet for terminal output
 */
export declare class ChangeSetFormatter {
    /**
     * Format a ChangeSet into a colored string
     */
    static format(cs: ChangeSet): string;
    /**
     * Get icon based on change type
     */
    private static getIcon;
    /**
     * Get color based on change type
     */
    private static getColor;
}
//# sourceMappingURL=ChangeSetFormatter.d.ts.map