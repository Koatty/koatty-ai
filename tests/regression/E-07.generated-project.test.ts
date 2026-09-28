import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { TemplateManager } from '../../src/services/TemplateManager';
import { GeneratorPipeline } from '../../src/pipeline/GeneratorPipeline';

// Real local framework packages; external dependency bytes come from the existing
// workspace install. This is not an online fresh-install or database acceptance test.
test('generated project compiles, runs service tests, and rejects invalid POST DTOs over HTTP', async () => {
  const repo = path.resolve(__dirname, '../../../..');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'e07-generated-'));
  const cliRequire = createRequire(path.join(repo, 'packages/koatty-ai/package.json'));
  const validationRequire = createRequire(
    path.join(repo, 'packages/koatty-validation/package.json')
  );
  const ormRequire = createRequire(path.join(repo, 'packages/koatty-typeorm/package.json'));
  const link = (name: string, target: string) => {
    const file = path.join(root, 'node_modules', name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.symlinkSync(target, file, 'dir');
  };
  try {
    const files = await new TemplateManager().renderDirectory(
      path.join(repo, 'packages/koatty-ai/templates/project/default'),
      { projectName: 'e07', hostname: '127.0.0.1', port: 0, protocol: 'http' }
    );
    for (const f of files) {
      const file = path.join(root, f.path);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, f.content);
    }
    const pipeline = new GeneratorPipeline(
      {
        module: 'article',
        fields: {
          id: { name: 'id', type: 'number', primary: true },
          name: { name: 'name', type: 'string', required: true, length: 20 },
        },
      },
      { workingDirectory: root }
    );
    for (const c of (await pipeline.execute()).toJSON().changes) {
      const file = path.join(root, c.path);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, c.content!);
    }
    for (const [name, dir] of Object.entries({
      koatty: 'koatty',
      koatty_validation: 'koatty-validation',
    }))
      link(name, path.join(repo, 'packages', dir));
    for (const name of ['class-validator'])
      link(name, path.dirname(validationRequire.resolve(`${name}/package.json`)));
    link('typeorm', path.dirname(ormRequire.resolve('typeorm')));
    link('koatty_cli', path.join(repo, 'packages/koatty-ai'));
    for (const name of ['typescript', 'ts-jest', '@types/node', '@types/jest'])
      link(name, path.dirname(cliRequire.resolve(`${name}/package.json`)));
    const run = (args: string[]) => {
      const r = spawnSync(process.execPath, args, {
        cwd: root,
        encoding: 'utf8',
        timeout: 60000,
        maxBuffer: 2 * 1024 * 1024,
      });
      if (r.status !== 0) throw Error(`${r.error || ''}\n${r.stdout}\n${r.stderr}`);
      return r.stdout;
    };
    run([cliRequire.resolve('typescript/bin/tsc'), '--pretty', 'false']);
    run([
      cliRequire.resolve('jest/bin/jest'),
      '--runInBand',
      '--config',
      path.join(root, 'jest.config.js'),
    ]);
    run([
      cliRequire.resolve('typescript/bin/tsc'),
      'scripts/generate-api-doc.ts',
      '--outDir',
      '.doc',
      '--module',
      'commonjs',
      '--target',
      'ES2022',
      '--skipLibCheck',
    ]);
    run(['.doc/generate-api-doc.js']);
    const openapi = JSON.parse(fs.readFileSync(path.join(root, 'docs/openapi.json'), 'utf8'));
    expect(openapi.components.schemas.CreateArticleDto.properties.name.minLength).toBe(1);
    expect(openapi.paths['/article'].post.requestBody).toBeDefined();
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(pkg.devDependencies.koatty_cli).toBe('^5.0.0');
    expect(pkg.dependencies.typeorm).toBeDefined();
    expect(pkg.dependencies['class-validator']).toBeDefined();
    const script = `
      const assert=require('assert/strict'),path=require('path');
      const {Koatty}=require(${JSON.stringify(path.join(repo, 'packages/koatty/dist'))});
      const {createTestApp,createHttpTest}=require(${JSON.stringify(path.join(repo, 'packages/koatty-testing/dist'))});
      class App extends Koatty {init(){this.rootPath=process.cwd();this.appPath=path.join(process.cwd(),'dist');this.silent=true;}}
      (async()=>{
        const fixture=await createTestApp(App);
        try {
          const Model=require('./dist/model/ArticleModel').ArticleModel;
          let writes=0; Model.create=dto=>dto;Model.save=async dto=>{writes++;return {...dto,id:1}};
          await fixture.start();assert.equal(fixture.app.server.getNativeServer().listening,true);
          const request=createHttpTest(fixture.app);
          const ok=await request.post('/article').send({name:'valid'});
          assert.equal(ok.status,200,JSON.stringify(ok.body));assert.equal(writes,1);
          const bad=await request.post('/article').send({name:''});
          assert.equal(bad.status,400,JSON.stringify(bad.body));assert.equal(writes,1);
          const badUpdate=await request.put('/article/1').send({name:'x'.repeat(21)});
          assert.equal(badUpdate.status,400,JSON.stringify(badUpdate.body));assert.equal(writes,1);
          Model.update=async(id,dto)=>{assert.equal(id,1);writes++;};
          Model.findOneBy=async({id})=>({id,name:'updated'});
          const updated=await request.put('/article/1').send({name:'updated'});
          assert.equal(updated.status,200,JSON.stringify(updated.body));assert.equal(writes,2);
          console.log('E07_HTTP_OK');
        } finally {await fixture.stop();}
      })().catch(e=>{console.error(e);process.exitCode=1});`;
    fs.writeFileSync(path.join(root, 'verify.cjs'), script);
    expect(run(['verify.cjs'])).toContain('E07_HTTP_OK');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}, 120000);
