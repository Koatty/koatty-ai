import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { collectManifest } from '../../src/manifest';
import { collectRuntimeManifest } from '../../src/manifest/runtime';

let root: string;
beforeEach(() => {root=fs.mkdtempSync(path.join(os.tmpdir(),'koatty-build-manifest-'));fs.mkdirSync(path.join(root,'dist'));});
afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
test('build output inventory hashes modules without executing them',()=>{
  fs.writeFileSync(path.join(root,'dist/Service.js'),'throw new Error("must not execute");');
  const manifest=collectManifest(root,{runtimeDir:'dist'});
  expect(manifest.runtime).toEqual({version:1,root:'dist',files:[{file:'Service.js',sha256:expect.stringMatching(/^[a-f0-9]{64}$/)}]});
  expect(collectManifest(root).runtime).toBeUndefined();
});
test('compiled output and symlinks cannot escape project/output roots',()=>{
  fs.writeFileSync(path.join(root,'outside.js'),'module.exports=1');
  fs.symlinkSync(path.join(root,'outside.js'),path.join(root,'dist/link.js'));
  expect(()=>collectRuntimeManifest(root,'dist')).toThrow('escapes');
  expect(()=>collectRuntimeManifest(root,'..')).toThrow('escapes');
});
