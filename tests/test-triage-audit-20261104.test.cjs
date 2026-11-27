'use strict';
// Maintain a provable disposition for each file in the original 130-test sweep.
// Historical cases are not made green, deleted or silently dropped.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const crypto=require('node:crypto');
const retiredManifest=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/HISTORICAL_TESTS.json'),'utf8'));
const retired=new Map(retiredManifest.files.map(r=>[r.file,r]));
const audit=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/TEST_TRIAGE_20261104.json'),'utf8'));

function lanes(){
  const output=cp.execFileSync(process.execPath,['tools/run-tests.cjs','list'],{
    cwd:ROOT,encoding:'utf8',timeout:10000
  });
  const active=output.split('Current (actively maintained):\n')[1]
    .split('\nHistorical (unmigrated):\n')[0].trim().split(/\r?\n/);
  const legacy=output.split('Historical (unmigrated):\n')[1].trim().split(/\r?\n/);
  return {active:new Set(active),legacy:new Set(legacy)};
}

test('original 130 historical files are individually classified with a grounded disposition',()=>{
  const records=audit.cases;
  assert.equal(audit.source_revision,'f88362b');
  assert.equal(records.length,130);
  assert.equal(new Set(records.map(x=>x.file)).size,130,'no duplicates');
  assert.equal(records.filter(x=>x.disposition==='ACTIVE').length,59);
  assert.equal(records.filter(x=>x.disposition==='ARCHIVED').length,71);
  const {active,legacy}=lanes();
  // The audit records the historical 130-file baseline, not a ceiling on
  // future Phase30+ test additions to the current lane.
  assert.ok(active.size>=audit.final.active_files,'current lane may grow after audit');
  assert.ok(legacy.size>=audit.final.legacy_files,'legacy lane may grow after audit');
  // The classroom release preserved this pre-release snapshot in the legacy lane.
  const laterArchived=new Set(['agy-m1-n4.test.cjs']);
  for(const r of records){
    const original=path.join(ROOT,'tests',r.file);
    if(retired.has(r.file)){
      const row=retired.get(r.file);
      assert.match(row.sha256,/^[a-f0-9]{64}$/);
      assert.ok(row.bytes>0);
      const stored=path.join(ROOT,retiredManifest.archive_root,r.file);
      if(fs.existsSync(stored))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(stored)).digest('hex'),row.sha256);
    }else assert.ok(fs.existsSync(original),r.file+' must remain present or explicitly retired');
    assert.ok(typeof r.reason==='string' && r.reason.length>=12,r.file+' needs rationale');
    assert.ok(typeof r.replacement==='string' && r.replacement.length>=8,r.file+' needs replacement or provenance');
    if(r.disposition==='ACTIVE' && !laterArchived.has(r.file)){
      assert.ok(active.has(r.file),r.file+' should be actively tested');
      assert.ok(!legacy.has(r.file),r.file+' must not be duplicated');
    }else{
      assert.ok(legacy.has(r.file),r.file+' must remain explicitly runnable through legacy mode');
      assert.ok(!active.has(r.file),r.file+' may not silently block the current gate');
      if(r.disposition==='ARCHIVED')assert.ok(audit.groups[r.category],r.file+' needs a recognized archive group');
    }
  }
});

test('initial failure counts are preserved rather than changed to false PASS',()=>{
  assert.deepEqual(audit.baseline,{
    files:130,passing_files:37,failed_or_timeout_files:93,
    assertions:974,failures:366
  });
  const records=audit.cases;
  assert.equal(records.filter(x=>x.baseline.timed_out || x.baseline.failed>0 || x.baseline.tests===0).length,93);
  assert.equal(records.reduce((n,x)=>n+x.baseline.tests,0),974);
  assert.equal(records.reduce((n,x)=>n+x.baseline.failed,0),366);
});

test('retirement preserves all previously current files and byte-exact historical inventory',()=>{
  const {active,legacy}=lanes();
  assert.equal(retired.size,retiredManifest.files.length);
  for(const name of retiredManifest.current_at_retirement)assert.ok(active.has(name),name+' current regression cannot disappear');
  for(const name of retiredManifest.promoted)assert.ok(active.has(name),name+' newly verified regression must remain active');
  for(const [name,row] of retired){
    assert.ok(legacy.has(name)&&!active.has(name),name+' explicit historical lane');
    assert.match(row.sha256,/^[a-f0-9]{64}$/);
    const file=path.join(ROOT,retiredManifest.archive_root,name);
    if(fs.existsSync(file))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),row.sha256);
  }
});
