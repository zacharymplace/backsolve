import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {compareRebuild} from '../scripts/rebuild-compare.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
test('comparison distinguishes output differences and unavailable reproduction without changing source',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rebuild-test-'));const repo=path.join(root,'repo');fs.mkdirSync(repo);
 const put=(base,p,s)=>{fs.mkdirSync(path.dirname(path.join(base,p)),{recursive:true});fs.writeFileSync(path.join(base,p),s);};
 try{
 const sources={'src/core.ts':'source','scripts/build.mjs':'builder','package.json':'{}','package-lock.json':'{}','tsconfig.json':'{}'};for(const [p,s]of Object.entries(sources))put(repo,p,s);execFileSync('git',['init','-q'],{cwd:repo});execFileSync('git',['add','.'],{cwd:repo});execFileSync('git',['-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','fixture'],{cwd:repo});
 const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();const receipt={version:'backsolve-local-build-v1',source_revision:revision,source_dirty:false,node_version:process.version,typescript_version:'test',inputs:Object.fromEntries(Object.entries(sources).map(([p,s])=>[p,hash(s)])),outputs:{'dist/core/cacheVerify.js':hash('output')}};
 const receiptPath=path.join(root,'receipt.json');const save=()=>fs.writeFileSync(receiptPath,JSON.stringify(receipt));save();
 let mode='match',checkout;
 const execute=(cmd,args,cwd)=>{
  if(cmd==='git'){if(args[0]==='clone')checkout=args.at(-1);return execFileSync(cmd,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']});}
  if(cmd==='npm'){if(mode==='install-fail')throw Error('offline');put(cwd,'node_modules/typescript/package.json',JSON.stringify({version:mode==='compiler-mismatch'?'other':'test'}));return '';}
  if(mode==='build-fail')throw Error('compile failed');
  if(mode==='mutate-input')put(cwd,'src/core.ts','changed');
  const built=structuredClone(receipt);if(mode==='dependency-mismatch')built.verifier_dependencies={version:'different'};
  put(cwd,'dist/build-receipt.json',JSON.stringify(built));
  if(mode!=='missing')put(cwd,'dist/core/cacheVerify.js',mode==='changed'?'tampered':'output');
  if(mode==='extra')put(cwd,'dist/extra.js','extra');
  if(mode==='symlink-output'){fs.renameSync(path.join(cwd,'dist'),path.join(cwd,'output-backup'));fs.symlinkSync(path.join(cwd,'output-backup'),path.join(cwd,'dist'),'dir');}return '';
 };
 const options={repository:repo,revision,receiptPath};
 assert.equal(compareRebuild(options,execute).status,'matches');assert.equal(fs.existsSync(checkout),false);
 for(mode of ['changed','missing','extra']){const r=compareRebuild(options,execute);assert.equal(r.status,'mismatch');assert.equal(r.differences[0].kind,mode);assert.equal(fs.existsSync(checkout),false);}
 for(mode of ['mutate-input','symlink-output','compiler-mismatch'])assert.equal(compareRebuild(options,execute).status,'could_not_reproduce');
 for(mode of ['install-fail','build-fail']){const r=compareRebuild(options,execute);assert.equal(r.status,'could_not_reproduce');assert.equal(r.stage,mode.split('-')[0]);assert.equal(fs.existsSync(checkout),false);}
 receipt.verifier_dependencies={version:'fixture'};mode='match';save();assert.equal(compareRebuild(options,execute).status,'matches');mode='dependency-mismatch';assert.equal(compareRebuild(options,execute).status,'could_not_reproduce');delete receipt.verifier_dependencies;
 const removed=receipt.inputs['src/core.ts'];delete receipt.inputs['src/core.ts'];save();assert.equal(compareRebuild(options,execute).stage,'checkout');receipt.inputs['src/core.ts']=removed;
 receipt.source_dirty=true;save();assert.equal(compareRebuild(options,execute).stage,'validate');receipt.source_dirty=false;receipt.inputs['src/core.ts']=hash('wrong');save();assert.equal(compareRebuild(options,execute).stage,'checkout');
 assert.equal(execFileSync('git',['status','--porcelain'],{cwd:repo,encoding:'utf8'}),'');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
