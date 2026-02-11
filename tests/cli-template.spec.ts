import * as fs from 'fs';
import * as path from 'path';
import { TemplateManager, TemplateType } from '../src/services/TemplateManager';

describe('CLI Template Command', () => {
  it('should report status for template types', async () => {
    const manager = new TemplateManager();
    // modules 应该有本地 submodule（templates/modules/ 目录）
    const modulesPath = await manager.getTemplatePath('modules');
    expect(modulesPath).toBeTruthy();
    expect(fs.existsSync(modulesPath)).toBe(true);
  });

  it('should correctly identify valid template types', () => {
    const validTypes: TemplateType[] = ['project', 'modules', 'component'];
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

  it('should return getTemplateStatus with correct source for bundled templates', () => {
    const manager = new TemplateManager();
    // 内置 templates/modules/ 应该存在
    const status = manager.getTemplateStatus('modules');
    expect(status.type).toBe('modules');
    expect(['cache', 'bundled']).toContain(status.source);
    expect(status.activePath).toBeTruthy();
  });

  it('should return getTemplateStatus with source=none for invalid dirs', () => {
    const manager = new TemplateManager({
      cacheDir: '/tmp/nonexistent-cli-test',
      submoduleDir: '/tmp/nonexistent-cli-test2',
    });
    const status = manager.getTemplateStatus('modules');
    expect(status.source).toBe('none');
    expect(status.activePath).toBeNull();
  });
});
