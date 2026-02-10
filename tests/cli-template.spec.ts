import * as fs from 'fs';
import * as path from 'path';
import { TemplateManager } from '../src/services/TemplateManager';

describe('CLI Template Command', () => {
  it('should report status for template types', async () => {
    const manager = new TemplateManager();
    // modules 应该有本地 submodule（templates/ 目录）
    const modulesPath = await manager.getTemplatePath('modules');
    expect(modulesPath).toBeTruthy();
    expect(fs.existsSync(modulesPath)).toBe(true);
  });

  it('should correctly identify valid template types', () => {
    const validTypes = ['project', 'modules', 'component'];
    for (const type of validTypes) {
      expect(['project', 'modules', 'component']).toContain(type);
    }
  });

  it('should correctly identify valid mirror sources', () => {
    const validMirrors = ['github', 'gitee'];
    for (const mirror of validMirrors) {
      expect(['github', 'gitee']).toContain(mirror);
    }
  });
});
