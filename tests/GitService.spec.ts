import { GitService } from '../src/utils/GitService';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('GitService', () => {
  const testDir = path.join(__dirname, 'git-test-repo');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    // Initialize a real git repo for testing service
    execSync('git init', { cwd: testDir });
    execSync('git config user.email "test@example.com"', { cwd: testDir });
    execSync('git config user.name "Test User"', { cwd: testDir });
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should identify a git repository', async () => {
    const gitService = new GitService(testDir);
    expect(await gitService.isRepo()).toBe(true);
  });

  it('should check if repo is clean', async () => {
    const gitService = new GitService(testDir);
    expect(await gitService.isClean()).toBe(true);

    fs.writeFileSync(path.join(testDir, 'dirty.txt'), 'dirty');
    expect(await gitService.isClean()).toBe(false);
  });

  it('should commit changes', async () => {
    const gitService = new GitService(testDir);
    await gitService.commit('test: initial commit');
    expect(await gitService.isClean()).toBe(true);
  });
});
