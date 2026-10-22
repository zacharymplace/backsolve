import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createSession,saveSession,getCurrentSession} from '../dist/storage/projectStore.js';
import {attachProvenance,readManifest,verifyBundle,sha256,CONFIDENCE_NOTICE} from '../dist/core/provenance.js';
import {writeWhyfile} from '../dist/core/whyfileBuilder.js';
import {exportCache} from '../dist/core/cacheExport.js';
import {verifyCache} from '../dist/core/cacheVerify.js';
import {loadProvenance} from '../dist/core/provenance.js';
import {captureTest} from '../dist/core/testCapture.js';

test('retrospective provenance round-trips with complete failing output and rejects broken evidence',()=>{
 const before=process.cwd(), dir=fs.mkdtempSync(path.join(os.tmpdir(),'backsolve-provenance-'));process.chdir(dir);
 try{
 const s=createSession('retrospective');s.outcome='bounded outcome';saveSession(s);
 const body='historical report';fs.writeFileSync('report.txt',body);
 const manifest={provenance_version:'0.1',session_id:s.id,reconstruction_mode:'retrospective',reconstructed_at:new Date().toISOString(),subject:{repository:'example',release_revision:'old-release'},evidence:[{id:'E1',path:'report.txt',sha256:sha256(body),kind:'operator_report',collected_at:new Date().toISOString()}],claims:[{id:'C1',claim:'historical assertion',evidence_refs:['E1'],limitation:'operator-attested'}],validations:[]};
 fs.writeFileSync('manifest.json',JSON.stringify(manifest));attachProvenance(s,'manifest.json');
 fs.writeFileSync('report.txt','later modification'); // Attached snapshot is immutable relative to external edits.
 const command=`"${process.execPath}" -e "process.stdout.write('x'.repeat(5001));process.exit(7)"`;
 assert.equal(captureTest(command,'explicit-test-revision').exitCode,7);
 const captured=getCurrentSession();const {whyfile}=writeWhyfile(captured);const cache=JSON.parse(fs.readFileSync(exportCache(captured,whyfile)));
 assert.deepEqual(verifyCache(cache),{hasProvenance:true});
 const changedTest=structuredClone(cache);changedTest.evidence.tests[0].exit_code=0;assert.throws(()=>verifyCache(changedTest),/differs from provenance/);
 const removedTest=structuredClone(cache);removedTest.evidence.tests=[];assert.throws(()=>verifyCache(removedTest),/Whyfile validation/);
 const changedMarkdown=structuredClone(cache);changedMarkdown.whyfile_markdown+='changed';assert.throws(()=>verifyCache(changedMarkdown),/hash mismatch/);
 const changedWhyfile=structuredClone(cache);changedWhyfile.whyfile.outcome='another outcome';assert.throws(()=>verifyCache(changedWhyfile),/does not match bound/);
 const b=verifyBundle(cache.provenance,cache.whyfile_markdown);
 assert.equal(b.manifest.reconstruction_mode,'retrospective');assert.equal(b.manifest.evidence[0].observed_at,undefined);
 assert.equal(Buffer.from(b.files.E1,'base64').toString(),body);
 assert.equal(b.manifest.validations[0].exit_code,7);assert.equal(b.manifest.validations[0].tested_revision,'explicit-test-revision');assert.equal(b.manifest.validations[0].captured_at,captured.tests[0].captured_at);
 assert.equal(Buffer.from(b.files['validation-1'],'base64').length,5001);
 const sidecar=path.join('.backsolve','whyfiles',`${s.id}.provenance.json`);assert.deepEqual(readManifest(sidecar),b);attachProvenance(captured,sidecar);assert.deepEqual(JSON.parse(fs.readFileSync(exportCache(captured,whyfile))).provenance,b);
 const altered=structuredClone(b);altered.files.E1=Buffer.from('tampered').toString('base64');assert.throws(()=>verifyBundle(altered),/changed evidence/);
 const missing=structuredClone(b);delete missing.files.E1;assert.throws(()=>verifyBundle(missing),/Missing or changed/);
 const ref=structuredClone(b);ref.manifest.claims[0].evidence_refs=['missing'];assert.throws(()=>verifyBundle(ref),/Missing evidence reference/);
 assert.throws(()=>verifyBundle(b,'changed markdown'),/Whyfile hash/);
 assert.throws(()=>readManifest('manifest.json'),/changed evidence/);
 const unsafe=structuredClone(manifest);unsafe.evidence[0].path='../outside';fs.writeFileSync('unsafe.json',JSON.stringify(unsafe));assert.throws(()=>readManifest('unsafe.json'),/Unsafe/);
 const duplicate=structuredClone(b);duplicate.manifest.validations.push(duplicate.manifest.validations[0]);assert.throws(()=>verifyBundle(duplicate),/Duplicate validation/);
 const duplicateClaim=structuredClone(b);duplicateClaim.manifest.claims.push(duplicateClaim.manifest.claims[0]);assert.throws(()=>verifyBundle(duplicateClaim),/Duplicate claim/);
 fs.symlinkSync(before,'outside-link','dir');const symlink=structuredClone(manifest);symlink.evidence[0].path='outside-link/package.json';fs.writeFileSync('symlink.json',JSON.stringify(symlink));assert.throws(()=>readManifest('symlink.json'),/escapes root/);
 const stored=JSON.parse(fs.readFileSync('.backsolve/provenance/'+s.id+'.json'));stored.manifest.session_id='other-session';fs.writeFileSync('.backsolve/provenance/'+s.id+'.json',JSON.stringify(stored));assert.throws(()=>loadProvenance(s),/session_id/);
 assert.match(CONFIDENCE_NOTICE,/not a probability/);
 }finally{process.chdir(before);fs.rmSync(dir,{recursive:true,force:true});}
});
test('0.1 session without provenance exports without invented provenance',()=>{
 const before=process.cwd(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'backsolve-legacy-'));process.chdir(dir);
 try{const s=createSession('legacy');s.outcome='recorded';saveSession(s);const {whyfile}=writeWhyfile(s);const c=JSON.parse(fs.readFileSync(exportCache(s,whyfile)));assert.deepEqual(verifyCache(c),{hasProvenance:false});const broken=structuredClone(c);delete broken.evidence;assert.throws(()=>verifyCache(broken));const absent=structuredClone(c);delete absent.evidence.tests;assert.throws(()=>verifyCache(absent));assert.equal(c.bscache_version,'0.1');assert.equal(c.provenance,undefined);assert.equal(c.whyfile.schema_version,'0.1');assert.match(c.confidence_notice,/heuristic/);}finally{process.chdir(before);fs.rmSync(dir,{recursive:true,force:true});}
});

test('successful captures retain stderr and unknown revisions remain unknown',()=>{
 const before=process.cwd(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'backsolve-stderr-'));process.chdir(dir);
 try {
 createSession('capture success');
 const result=captureTest(`"${process.execPath}" -e "process.stdout.write('stdout');process.stderr.write('warning')"`);
 assert.equal(result.exitCode,0);assert.equal(result.output,'stdoutwarning');
 assert.equal(getCurrentSession().tests[0].tested_revision,undefined);
 }finally{process.chdir(before);fs.rmSync(dir,{recursive:true,force:true});}
});
