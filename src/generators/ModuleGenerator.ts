import { ChangeSet } from '../changeset/ChangeSet';
import { Spec } from '../types/spec';
import { ModelGenerator } from './ModelGenerator';
import { DtoGenerator } from './DtoGenerator';
import { ServiceGenerator } from './ServiceGenerator';
import { ControllerGenerator } from './ControllerGenerator';
import * as path from 'path';

/**
 * Module Generator - Orchestrates all specific generators for a module
 */
export class ModuleGenerator {
  constructor(private spec: Spec, private changeset: ChangeSet) { }

  /**
   * Generate all files for a module
   */
  public generate(): void {
    const generators = [
      new ModelGenerator(this.spec, this.changeset),
      new DtoGenerator(this.spec, this.changeset),
      new ServiceGenerator(this.spec, this.changeset),
      new ControllerGenerator(this.spec, this.changeset),
    ];

    generators.forEach((generator) => generator.generate());
    this.generateIndex();
  }

  /**
   * Generate index.ts to export module components
   */
  private generateIndex(): void {
    const moduleName = this.spec.module;
    const pascalName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);

    let content = `export * from './controller/${pascalName}Controller';\n`;
    content += `export * from './service/${pascalName}Service';\n`;
    content += `export * from './model/${pascalName}';\n`;
    content += `export * from './dto/${pascalName}Dto';\n`;

    const outputPath = path.join('src', moduleName.toLowerCase(), 'index.ts');
    this.changeset.createFile(outputPath, content, `Generated module index for ${moduleName}`);
  }
}
