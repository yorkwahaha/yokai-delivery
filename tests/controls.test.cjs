const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function controls(saved = null) {
  const context = { window: {}, localStorage: { getItem: () => saved, setItem() {} } };
  vm.runInNewContext(fs.readFileSync('js/controls.js', 'utf8'), context);
  return context.window.CONTROLS;
}
test('default controls, arrows and left-handed preset map to actions', () => {
  const c = controls();
  assert.equal(c.action('KeyW'), 'u');
  assert.equal(c.action('ArrowLeft'), 'l');
  assert.equal(c.action('ShiftRight'), 'dash');
  c.preset('left');
  assert.equal(c.action('KeyI'), 'u');
  assert.equal(c.action('KeyW'), undefined);
  assert.equal(c.action('KeyU'), 'interact');
});
test('rebinding rejects duplicate and reserved keys, and replaces the old key', () => {
  const c = controls();
  assert.equal(c.bind('u', 'KeyD'), false);
  assert.equal(c.bind('u', 'Digit1'), false);
  assert.equal(c.bind('u', 'Numpad1'), false);
  assert.equal(c.bind('u', 'Escape'), false);
  assert.equal(c.bind('u', 'KeyT'), true);
  assert.equal(c.action('KeyT'), 'u');
  assert.equal(c.action('KeyW'), undefined);
});
test('malformed or duplicate saved bindings fall back safely', () => {
  assert.equal(controls('{').action('KeyW'), 'u');
  assert.equal(controls('{"u":"KeyD"}').action('KeyW'), 'u');
});
test('misdelivery enemies approach a readable distance without overshoot and retreat if crowded', () => {
  const cfg = require('../js/config.js');
  assert.equal(cfg.chaseStep(90, 210, 0.05, 'mis'), 4);
  assert.equal(cfg.chaseStep(86, 210, 0.05, 'mis'), 0);
  assert.equal(cfg.chaseStep(20, 210, 0.05, 'mis'), -10.5);
  assert.equal(cfg.chaseStep(90, 210, 0.05, 'ghost'), 10.5);
});

test('gamepad can navigate presets and leave the native controls dialog',()=>{
 const env={window:{},localStorage:{getItem:()=>null,setItem(){}}};const events={};let clicked=0;
 const buttons=Array.from({length:3},()=>({focus(){env.document.activeElement=this;},click(){clicked++;}}));
 const dialog={open:false,querySelectorAll:s=>s==='button'?buttons:[],showModal(){this.open=true;env.document.activeElement=buttons[0];},close(){this.open=false;events.close();},addEventListener:(k,f)=>events[k]=f};
 const opener={};env.document={getElementById:id=>id==='controls-dialog'?dialog:id==='controls-open'?opener:{focus(){}},activeElement:null};
 vm.runInNewContext(fs.readFileSync('js/controls.js','utf8'),env);const c=env.window.CONTROLS;c.mount();opener.onclick();
 const gp={buttons:Array.from({length:16},()=>({pressed:false}))};const press=i=>{gp.buttons[i].pressed=true;c.gamepad(gp,[]);gp.buttons[i].pressed=false;};
 press(13);assert.equal(env.document.activeElement,buttons[1]);press(0);assert.equal(clicked,1);press(1);assert.equal(dialog.open,false);opener.onclick();events.keydown({code:'Escape',preventDefault(){},stopPropagation(){}});assert.equal(dialog.open,false);
 opener.onclick();env.document.activeElement=null;press(12);assert.equal(env.document.activeElement,buttons[2]);
 env.document.activeElement=null;press(13);assert.equal(env.document.activeElement,buttons[0]);
});
test('display labels track presets, custom bindings and saved controls',()=>{
 const c=controls(); assert.equal(c.label('dash'),'空白鍵');
 c.preset('left');assert.equal(c.label('interact'),'U');assert.equal(c.label('hint'),'O');
 c.bind('interact','KeyT');assert.equal(c.label('interact'),'T');
});
