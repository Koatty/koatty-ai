import { SourceFile, SyntaxKind, ArrayLiteralExpression, Decorator, ObjectLiteralExpression } from 'ts-morph';
import { AstPatcher } from './AstPatcher';
import { ChangeSet } from '../changeset/ChangeSet';

/**
 * ModuleRegistrar - Registers controllers and services in the AppModule
 */
export class ModuleRegistrar extends AstPatcher {
  constructor(
    changeset: ChangeSet,
    private moduleName: string,
    private controllerName: string,
    private serviceName: string
  ) {
    super(changeset);
  }

  /**
   * Patch the AppModule file
   */
  public patch(appModulePath: string = 'src/AppModule.ts'): void {
    this.modifyFile(appModulePath, (sourceFile) => {
      this.addImports(sourceFile);
      this.registerInDecorator(sourceFile, 'controllers', this.controllerName);
      this.registerInDecorator(sourceFile, 'services', this.serviceName);
    });
  }

  /**
   * Add necessary imports
   */
  private addImports(sourceFile: SourceFile): void {
    const modulePath = this.moduleName.toLowerCase();
    const controllerPath = `./${modulePath}/controller/${this.controllerName}`;
    const servicePath = `./${modulePath}/service/${this.serviceName}`;

    if (!sourceFile.getImportDeclaration(controllerPath)) {
      sourceFile.addImportDeclaration({
        moduleSpecifier: controllerPath,
        namedImports: [this.controllerName],
      });
    }

    if (!sourceFile.getImportDeclaration(servicePath)) {
      sourceFile.addImportDeclaration({
        moduleSpecifier: servicePath,
        namedImports: [this.serviceName],
      });
    }
  }

  /**
   * Register a class in the @Module decorator
   */
  private registerInDecorator(sourceFile: SourceFile, propertyName: string, className: string): void {
    const classDec = sourceFile.getClasses()[0];
    if (!classDec) return;

    const moduleDecorator = classDec.getDecorators().find(d => d.getName() === 'Module');
    if (!moduleDecorator) return;

    const callExpr = moduleDecorator.getCallExpression();
    if (!callExpr) return;

    const args = callExpr.getArguments();
    if (args.length === 0) {
      callExpr.addArgument('{}');
    }

    const objLiteral = callExpr.getArguments()[0] as ObjectLiteralExpression;
    if (!objLiteral || objLiteral.getKind() !== SyntaxKind.ObjectLiteralExpression) return;

    let property = objLiteral.getProperty(propertyName);
    if (!property) {
      objLiteral.addPropertyAssignment({
        name: propertyName,
        initializer: '[]',
      });
      property = objLiteral.getProperty(propertyName);
    }

    if (property && property.getKind() === SyntaxKind.PropertyAssignment) {
      const initializer = (property as any).getInitializer() as ArrayLiteralExpression;
      if (initializer && initializer.getKind() === SyntaxKind.ArrayLiteralExpression) {
        const elements = initializer.getElements().map(e => e.getText());
        if (!elements.includes(className)) {
          initializer.addElement(className);
        }
      }
    }
  }
}
