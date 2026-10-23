import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const source=process.cwd();
test('clean build records inputs and outputs and failed build removes prior receipt',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'backsolve-build-'));
 try{
 for(const p of ['src','scripts','package.json','package-lock.json','tsconfig.json'])fs.cpSync(path.join(source,p),path.join(root,p),{recursive:true});
 fs.symlinkSync(path.join(source,'node_modules'),path.join(root,'node_modules'),'dir');
 execFileSync('git',['init','-q'],{cwd:root});
 execFileSync('git',['add','src','scripts','package.json','package-lock.json','tsconfig.json'],{cwd:root});
 execFileSync('git',['-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','fixture'],{cwd:root});
 execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root});
 const receipt=JSON.parse(fs.readFileSync(path.join(root,'dist/build-receipt.json')));
 for(const group of [receipt.inputs,receipt.outputs])for(const [p,h]of Object.entries(group))assert.equal(h,createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex'));
 fs.writeFileSync(path.join(root,'dist/stale.js'),'stale');
 execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root});assert.equal(fs.existsSync(path.join(root,'dist/stale.js')),false);
 fs.appendFileSync(path.join(root,'src/core/cacheVerify.ts'),'\nconst broken: number = "bad";\n');
 const failed=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:root});assert.notEqual(failed.status,0);assert.equal(fs.existsSync(path.join(root,'dist/build-receipt.json')),false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
