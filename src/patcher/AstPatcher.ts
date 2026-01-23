import { Project, SourceFile } from 'ts-morph';
import { ChangeSet } from '../changeset/ChangeSet';

/**
 * AstPatcher - Base class for AST modifications
 */
export abstract class AstPatcher {
  protected project: Project;

  constructor(protected changeset: ChangeSet) {
    this.project = new Project({
      compilerOptions: {
        experimentalDecorators: true,
      },
    });
  }

  /**
   * Apply modifications and add to ChangeSet
   */
  public abstract patch(filePath?: string): void;

  /**
   * Load a source file, modify it, and add to changeset
   * @param filePath Path to the file
   * @param modifier Callback to modify the source file
   */
  protected modifyFile(filePath: string, modifier: (sourceFile: SourceFile) => void): void {
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const originalContent = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = this.project.createSourceFile(filePath, originalContent, { overwrite: true });

    modifier(sourceFile);

    const newContent = sourceFile.getText();
    if (newContent !== originalContent) {
      this.changeset.modifyFile(filePath, newContent, originalContent, `AST patch: ${this.constructor.name}`);
      fs.writeFileSync(filePath, newContent);
    }
  }
}
