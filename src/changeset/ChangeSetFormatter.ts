import chalk from 'chalk';
import { ChangeSet } from './ChangeSet';

/**
 * ChangeSet Formatter - Formats ChangeSet for terminal output
 */
export class ChangeSetFormatter {
  /**
   * Format a ChangeSet into a colored string
   */
  public static format(cs: ChangeSet): string {
    let output = `\n${chalk.bold.cyan('ChangeSet ID:')} ${cs.id}\n`;
    output += `${chalk.bold.cyan('Module:')} ${cs.module}\n`;
    output += `${chalk.bold.cyan('Timestamp:')} ${cs.timestamp}\n\n`;
    output += `${chalk.bold.white('Proposed Changes:')}\n`;

    const changes = cs.getChanges();
    if (changes.length === 0) {
      output += `  ${chalk.gray('(no changes)')}\n`;
      return output;
    }

    changes.forEach((change) => {
      const icon = this.getIcon(change.type);
      const color = this.getColor(change.type);
      output += `  ${color(icon)} ${color(change.path)} ${chalk.gray(`(${change.description || 'no description'})`)}\n`;
    });

    return output;
  }

  /**
   * Get icon based on change type
   */
  private static getIcon(type: string): string {
    switch (type) {
      case 'create': return '+';
      case 'modify': return 'M';
      case 'delete': return '-';
      default: return '?';
    }
  }

  /**
   * Get color based on change type
   */
  private static getColor(type: string): any {
    switch (type) {
      case 'create': return chalk.green;
      case 'modify': return chalk.yellow;
      case 'delete': return chalk.red;
      default: return chalk.white;
    }
  }
}
