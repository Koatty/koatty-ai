import { RouteRegistrar } from '../src/patcher/RouteRegistrar';
import { ChangeSet } from '../src/changeset/ChangeSet';
import * as fs from 'fs';
import * as path from 'path';

describe('RouteRegistrar', () => {
  const testFile = path.join(__dirname, 'router.ts');

  afterEach(() => {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  });

  it('should add route to default export array', () => {
    const originalContent = `export default [\n  ["/home", "Index"]\n];`;
    fs.writeFileSync(testFile, originalContent);

    const cs = new ChangeSet('user');
    const registrar = new RouteRegistrar(cs, 'User', 'UserController');

    registrar.patch(testFile);

    const newContent = fs.readFileSync(testFile, 'utf-8');
    expect(newContent).toContain('["/user", "UserController"]');
  });

  it('should add route to named routes variable', () => {
    const originalContent = `export const routes = [\n  ["/home", "Index"]\n];`;
    fs.writeFileSync(testFile, originalContent);

    const cs = new ChangeSet('user');
    const registrar = new RouteRegistrar(cs, 'User', 'UserController');

    registrar.patch(testFile);

    const newContent = fs.readFileSync(testFile, 'utf-8');
    expect(newContent).toContain('["/user", "UserController"]');
  });

  it('should not add duplicate routes', () => {
    const originalContent = `export default [\n  ["/user", "UserController"]\n];`;
    fs.writeFileSync(testFile, originalContent);

    const cs = new ChangeSet('user');
    const registrar = new RouteRegistrar(cs, 'User', 'UserController');

    registrar.patch(testFile);

    const newContent = fs.readFileSync(testFile, 'utf-8');
    const matches = newContent.match(/UserController/g);
    expect(matches?.length).toBe(1);
  });
});
