import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
function files(dir){return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>{const p=dir+'/'+e.name;if(e.isSymbolicLink())throw Error('Symlink build input/output');return e.isDirectory()?files(p):[p];}).sort();}
const manifest=names=>Object.fromEntries(names.map(p=>[p,hash(fs.readFileSync(path.join(root,p)))]));
// Invalidate the old receipt before any fallible build work; clean output prevents stale modules.
fs.rmSync(path.join(root,'dist'),{recursive:true,force:true});
for(const dir of ['src','scripts'])if(fs.lstatSync(path.join(root,dir)).isSymbolicLink())throw Error('Symlink build input root');
const inputs=manifest([...files('src'),'package.json','package-lock.json','tsconfig.json','scripts/build.mjs'].sort());
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const dirty=Boolean(execFileSync('git',['status','--porcelain','--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim());
const compilerVersion=JSON.parse(fs.readFileSync(path.join(root,'node_modules/typescript/package.json'))).version;
execFileSync(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc')],{cwd:root,stdio:'inherit'});
if(JSON.stringify(inputs)!==JSON.stringify(manifest([...files('src'),'package.json','package-lock.json','tsconfig.json','scripts/build.mjs'].sort())))throw Error('Build inputs changed during compilation');
if(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()!==revision)throw Error('Source revision changed during compilation');
if(JSON.parse(fs.readFileSync(path.join(root,'node_modules/typescript/package.json'))).version!==compilerVersion)throw Error('Compiler version changed during compilation');
const receipt={version:'backsolve-local-build-v1',built_at:new Date().toISOString(),source_revision:revision,source_dirty:dirty,node_version:process.version,typescript_version:compilerVersion,inputs,outputs:manifest(files('dist').filter(p=>p.endsWith('.js'))),notice:'Trusted local build observation; not independent reproducibility, dependency authentication, or execution attestation.'};
fs.writeFileSync(path.join(root,'dist/build-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
