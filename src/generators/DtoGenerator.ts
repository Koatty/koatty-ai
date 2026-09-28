import { BaseGenerator } from './BaseGenerator';
import { Project } from 'ts-morph';

/**
 * DTO Generator - Generates Create, Update, and Query DTOs
 */
export class DtoGenerator extends BaseGenerator {
  /**
   * Generate DTO file
   */
  public async generate(): Promise<void> {
    const outputPath = this.getOutputPath('dto', 'Dto');
    const content = await this.render('dto/dto.hbs', this.spec);

    // The loader checks that the first exported class matches its filename.
    const source = new Project({ useInMemoryFileSystem: true }).createSourceFile(
      outputPath,
      content
    );
    const imports = source
      .getImportDeclarations()
      .map((d) => d.getText())
      .join('\n');
    for (const cls of source.getClasses()) {
      const file = outputPath.replace(/[^/]+$/, `${cls.getName()}.ts`);
      this.changeset.createFile(
        file,
        `${imports}\n\n${cls.getText()}\n`,
        `Generate ${cls.getName()}`
      );
    }
  }
}
