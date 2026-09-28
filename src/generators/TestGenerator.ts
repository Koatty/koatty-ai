import { BaseGenerator } from './BaseGenerator';

/**
 * Test Generator - emits a runnable test skeleton for every generated module.
 *
 * Roadmap Phase E, item E-4 ("测试即规格"): AI edits are only as reliable as the
 * tests that can be run afterwards, so a generated Controller/Service always
 * ships with a `test/<module>.test.ts` skeleton.
 */
export class TestGenerator extends BaseGenerator {
  /**
   * Generate the module test skeleton
   */
  public async generate(): Promise<void> {
    const moduleTestPath = `test/${this.spec.module}.test.ts`;
    const content = await this.render('test/module.test.hbs', this.spec);

    this.changeset.createFile(
      moduleTestPath,
      content,
      `Generate test skeleton for ${this.spec.module}`
    );
  }
}
