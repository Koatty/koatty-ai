import { ModuleRegistrar } from '../src/patcher/ModuleRegistrar';
import { ChangeSet } from '../src/changeset/ChangeSet';
import * as fs from 'fs';
import * as path from 'path';

describe('ModuleRegistrar', () => {
  const testFile = path.join(__dirname, 'AppModule.ts');

  beforeEach(() => {
    const content = `
import { Module } from 'koatty';

@Module({
  controllers: [],
  services: []
})
export class AppModule {}
`;
    fs.writeFileSync(testFile, content);
  });

  afterEach(() => {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  });

  it('should add import and register controller/service', () => {
    const cs = new ChangeSet('user');
    const registrar = new ModuleRegistrar(cs, 'User', 'UserController', 'UserService');

    registrar.patch(testFile);

    const newContent = fs.readFileSync(testFile, 'utf-8');
    expect(newContent).toMatch(/import { UserController } from ['"].\/user\/controller\/UserController['"];/);
    expect(newContent).toMatch(/import { UserService } from ['"].\/user\/service\/UserService['"];/);
    expect(newContent).toContain("controllers: [UserController]");
    expect(newContent).toContain("services: [UserService]");
  });
});
