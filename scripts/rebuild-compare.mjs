import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const digest=b=>createHash('sha256').update(b).digest('hex');
const run=(cmd,args,cwd)=>execFileSync(cmd,args,{cwd,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']});
const notice='Rebuild comparison under this environment; trusts the compiler, dependencies and host. Not verifier execution attestation or independent authentication. Source-to-build binding remains unverified.';
export function compareRebuild({repository,revision,receiptPath},execute=run){
 let temporary,stage='validate';
 const result={status:'could_not_reproduce',revision,node_version:process.version,notice};
 try{
  if(!/^[a-f0-9]{40}$/.test(revision))throw Error('An exact 40-character commit is required');
  const receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
  if(receipt.version!=='backsolve-local-build-v1'||receipt.source_revision!==revision||receipt.source_dirty!==false||receipt.node_version!==process.version||typeof receipt.typescript_version!=='string')throw Error('Receipt revision, clean source or Node version does not match');
  for(const group of ['inputs','outputs']){
   const values=receipt[group];
   if(!values||Array.isArray(values)||!Object.keys(values).length)throw Error('Missing manifest');
   for(const [p,h]of Object.entries(values))if(!/^[a-f0-9]{64}$/.test(h)||p.includes('\\')||path.isAbsolute(p)||p.split('/').some(x=>!x||x==='..'||x==='.')||(group==='outputs'&&(!p.startsWith('dist/')||!p.endsWith('.js'))))throw Error('Invalid manifest');
  }
  if(!receipt.outputs['dist/core/cacheVerify.js'])throw Error('Missing verifier output');
  temporary=fs.mkdtempSync(path.join(os.tmpdir(),'backsolve-rebuild-'));
  const checkout=path.join(temporary,'checkout');
  stage='checkout';execute('git',['clone','--no-checkout','--no-hardlinks','--',path.resolve(repository),checkout],temporary);
  execute('git',['checkout','--detach',revision],checkout);
  const actual=execute('git',['rev-parse','HEAD'],checkout).trim();if(actual!==revision)throw Error('Checkout revision mismatch');
  const canonical=x=>JSON.stringify(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)));
  const list=dir=>{
   if(fs.lstatSync(path.join(checkout,dir)).isSymbolicLink())throw Error('Symlink directory');
   return fs.readdirSync(path.join(checkout,dir),{withFileTypes:true}).flatMap(e=>{
    if(e.isSymbolicLink()||(!e.isDirectory()&&!e.isFile()))throw Error('Unsupported file');
    const p=dir+'/'+e.name;return e.isDirectory()?list(p):[p];
   }).sort();
  };
  const inputs=()=>Object.fromEntries([...list('src'),'package.json','package-lock.json','tsconfig.json','scripts/build.mjs'].sort().map(p=>{
   if(fs.lstatSync(path.join(checkout,p)).isSymbolicLink())throw Error('Symlink input');
   return [p,digest(fs.readFileSync(path.join(checkout,p)))];
  }));
  // Require the complete pinned input set before dependency installation or build execution.
  if(canonical(inputs())!==canonical(receipt.inputs))throw Error('Pinned input set differs from receipt');
  for(const [p,h]of Object.entries(receipt.inputs)){
   const f=path.join(checkout,p),real=fs.realpathSync(f);
   if(!real.startsWith(fs.realpathSync(checkout)+path.sep)||digest(fs.readFileSync(real))!==h)throw Error('Pinned source differs from receipt');
  }
  stage='install';execute('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],checkout);
  const compiler=JSON.parse(fs.readFileSync(path.join(checkout,'node_modules/typescript/package.json'))).version;
  result.typescript_version=compiler;if(compiler!==receipt.typescript_version)throw Error('Compiler version differs');
  stage='build';execute(process.execPath,['scripts/build.mjs'],checkout);
  const built=JSON.parse(fs.readFileSync(path.join(checkout,'dist/build-receipt.json')));
  if(built.version!=='backsolve-local-build-v1'||built.source_revision!==revision||built.node_version!==process.version||built.typescript_version!==compiler)throw Error('Unsupported rebuilt receipt');
  if(canonical(inputs())!==canonical(receipt.inputs))throw Error('Inputs changed during rebuild');
  if(canonical(built.inputs)!==canonical(receipt.inputs))throw Error('Input sets differ');
  if(receipt.verifier_dependencies!==undefined && canonical(built.verifier_dependencies??{})!==canonical(receipt.verifier_dependencies))throw Error('Recorded dependency manifest differs');
  stage='compare';
  const outputs=Object.fromEntries(list('dist').filter(p=>p.endsWith('.js')).map(p=>[p,digest(fs.readFileSync(path.join(checkout,p)))]));
  const names=new Set([...Object.keys(outputs),...Object.keys(receipt.outputs)]);
  result.differences=[...names].sort().filter(p=>outputs[p]!==receipt.outputs[p]).map(p=>({path:p,kind:!(p in outputs)?'missing':!(p in receipt.outputs)?'extra':'changed'}));
  result.status=result.differences.length?'mismatch':'matches';result.output_count=Object.keys(outputs).length;
 }catch(error){result.stage=stage;result.diagnostic=stage==='validate'?error.message:`Could not complete ${stage}; no reproducibility claim.`;}
 finally{if(temporary)try{fs.rmSync(temporary,{recursive:true,force:true});}catch{result.status='could_not_reproduce';result.stage='cleanup';result.diagnostic='Temporary checkout cleanup failed; no completed reproduction claim.';}}
 return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [repository,revision,receiptPath,...extra]=process.argv.slice(2);
 if(!repository||!revision||!receiptPath||extra.length){console.error('Usage: node scripts/rebuild-compare.mjs <local-repository> <full-commit> <receipt.json>');process.exitCode=2;}
 else{const result=compareRebuild({repository,revision,receiptPath});console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='matches'?0:result.status==='mismatch'?1:2;}
}
