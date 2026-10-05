// Re-run only the timing test against the pre-feature game path; no production edits.
const fs=require('node:fs'),vm=require('node:vm');
const testSource=fs.readFileSync('tests/input-runtime.test.cjs','utf8');
const start=testSource.indexOf("test('enemy attack drawings"),end=testSource.indexOf("test('exhausted upgrades");
const oldGame=fs.readFileSync('js/game.js','utf8').replace(/^[ \t]*e\.attackT = .*\r?\n/gm,'').replace(/^[ \t]*e\.walking = .*\r?\n/gm,'');
const env={require:n=>n==='node:fs'?{...fs,readFileSync:(p,...a)=>p==='js/game.js'?oldGame:fs.readFileSync(p,...a)}:require(n)};
vm.runInNewContext(testSource.slice(0,start)+testSource.slice(start,end),env);
