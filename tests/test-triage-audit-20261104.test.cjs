'use strict';
// Maintain a provable disposition for each file in the original 130-test sweep.
// Historical cases are not made green, deleted or silently dropped.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
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
  assert.equal(legacy.size,audit.final.legacy_files,'archived lane count drift');
  for(const r of records){
    assert.ok(fs.existsSync(path.join(ROOT,'tests',r.file)),r.file+' may not be deleted');
    assert.ok(typeof r.reason==='string' && r.reason.length>=12,r.file+' needs rationale');
    assert.ok(typeof r.replacement==='string' && r.replacement.length>=8,r.file+' needs replacement or provenance');
    if(r.disposition==='ACTIVE'){
      assert.ok(active.has(r.file),r.file+' should be actively tested');
      assert.ok(!legacy.has(r.file),r.file+' must not be duplicated');
    }else{
      assert.ok(legacy.has(r.file),r.file+' must remain explicitly runnable through legacy mode');
      assert.ok(!active.has(r.file),r.file+' may not silently block the current gate');
      assert.ok(audit.groups[r.category],r.file+' needs a recognized archive group');
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
