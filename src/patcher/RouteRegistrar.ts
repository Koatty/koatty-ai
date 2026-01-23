import { AstPatcher } from './AstPatcher';
import { SourceFile, SyntaxKind, ArrayLiteralExpression } from 'ts-morph';

/**
 * RouteRegistrar handles adding route entries to the routing configuration file.
 * Common format: export default [ ["/path", "Controller", "action", "method"] ]
 */
export class RouteRegistrar extends AstPatcher {
  constructor(
    changeset: any,
    private moduleName: string,
    private controllerName: string
  ) {
    super(changeset);
  }

  /**
   * Patch the routing file
   */
  public patch(routerPath: string = 'src/config/router.ts'): void {
    this.modifyFile(routerPath, (sourceFile) => {
      this.modifier(sourceFile);
    });
  }

  protected modifier(sourceFile: SourceFile): void {
    const routesArray = this.findRoutesArray(sourceFile);

    if (routesArray) {
      const modulePath = `/${this.moduleName.toLowerCase()}`;
      // In Koatty, a common simple route entry is [path, controllerName]
      // Or more complex [path, controllerName, action, method]
      // We'll add a standard [path, controllerName] entry if it doesn't exist
      const entrySnippet = `["${modulePath}", "${this.controllerName}"]`;

      const elements = routesArray.getElements().map(e => e.getText().replace(/['"]/g, '"'));
      const searchString = `"${this.controllerName}"`;

      if (!elements.some(e => e.includes(searchString))) {
        routesArray.addElement(entrySnippet);
      }
    }
  }

  private findRoutesArray(sourceFile: SourceFile): ArrayLiteralExpression | undefined {
    // 1. Check for 'export default [...]'
    const exportAssignment = sourceFile.getExportAssignment(d => !d.isExportEquals());
    if (exportAssignment) {
      const expr = exportAssignment.getExpression();
      if (expr.getKind() === SyntaxKind.ArrayLiteralExpression) {
        return expr as ArrayLiteralExpression;
      }
    }

    // 2. Check for 'export const routes = [...]'
    const routesVar = sourceFile.getVariableDeclaration('routes');
    if (routesVar) {
      const initializer = routesVar.getInitializer();
      if (initializer && initializer.getKind() === SyntaxKind.ArrayLiteralExpression) {
        return initializer as ArrayLiteralExpression;
      }
    }

    // 3. Check for any top-level array literal exported or assigned to routes
    const arrays = sourceFile.getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression);
    // Return the first one if it looks like a routes array (heuristic)
    return arrays[0];
  }
}
