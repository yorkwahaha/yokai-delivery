'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {createDiagnostics, allowedHost, monitorResources, mountPanel, registerParticleSource} = require('../js/port-performance.js');

test('diagnostics are restricted to loopback and private IPv4 hosts', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]', '192.168.1.2', '10.0.0.2', '172.31.0.2']) assert.ok(allowedHost(host));
  for (const host of ['yorkwahaha.github.io', '192.168.1.999', '172.32.0.2', '192.168.1.2.example.com']) assert.equal(allowedHost(host), false);
});

test('renderer comparisons are independent and resettable', () => {
  const p = createDiagnostics();
  const comparison = {uiShadows:'off', lighting:'direct', damageText:'atlas', fxBatch:'bitmap',
    smoothQuality:'low', gemBatch:'original', terrainCache:'projected', rainBatch:true};
  for (const [key, value] of Object.entries(comparison)) {
    p.configure({[key]:value});
    assert.equal(p.report().config[key],value);
    for (const other of Object.keys(comparison).filter(name => name !== key)) {
      assert.notEqual(p.report().config[other],comparison[other]);
    }
  }
  p.configure({});
  for (const [key,value] of Object.entries(comparison)) assert.notEqual(p.report().config[key],value);
  assert.throws(() => p.configure({fxBatch:'unsupported'}), RangeError);
});

test('rAF percentiles subtract the preceding callback, and exclude hidden gaps and mode changes', () => {
  const p = createDiagnostics();
  const step = (t, work = 5) => { p.begin(t, t + 2); p.end(t + 2 + work, 'play', true); };
  step(100); step(116); step(149); step(169);
  assert.deepEqual(p.report().frame.intervalMs, {p50:20,p95:33,p99:33});
  assert.deepEqual(p.report().frame.outsideCallbackMs, {p50:15,p95:28,p99:28});
  assert.equal(p.report().frame.samples, 3);
  p.invalidate(); step(1000); step(1020);
  assert.equal(p.report().frame.samples, 4);
  p.configure({rain:false}); step(6000); step(6016);
  assert.equal(p.report().frame.samples, 1);
  assert.equal(p.report().config.rain, false);
  assert.throws(()=>p.configure({gems:513}),RangeError);
  assert.throws(()=>p.configure({rank:4}),RangeError);
  assert.throws(()=>p.configure({resolution:.25}),RangeError);
});

test('sampled Canvas images report clipped pixels, effects and largest sources by pass', () => {
  const p = createDiagnostics({sampleEvery:1});
  const calls = [];
  const ctx = {canvas:{width:100,height:100},globalAlpha:.5,globalCompositeOperation:'lighter',shadowBlur:17,
    getTransform:()=>({a:2,b:0,c:0,d:1,e:0,f:0}), drawImage(...args){calls.push(args);}};
  Object.setPrototypeOf(ctx,{filter:'brightness(2)'});
  p.instrument(ctx, 'main');
  p.configure({detail:true});
  p.begin(0, 0);
  p.pass('barrier');
  ctx.drawImage({naturalWidth:1024,naturalHeight:1024,src:'/ring.webp'}, -10, 0, 60, 100);
  ctx.drawImage({naturalWidth:1024,naturalHeight:1024,src:'/ring.webp'}, 100, 0, 10, 10);
  p.end(5, 'play', true);
  assert.equal(calls.length, 2);
  const stats = p.report().draw.passes['main/barrier'];
  assert.equal(stats.drawImage, 2);
  assert.equal(stats.imageBoundsPixels, 10000);
  assert.equal(stats.translucentBoundsPixels, 10000);
  assert.equal(stats.offscreenImages, 1);
  assert.equal(stats.filteredImages, 2);
  assert.equal(stats.shadowedOps, 2);
  const wrapped = ctx.drawImage;
  const replacement = Object.create(ctx);
  p.instrument(replacement,'main');
  assert.notEqual(ctx.drawImage,wrapped);
  assert.ok(Object.hasOwn(replacement,'drawImage'));
  p.configure({});
  assert.ok(!Object.hasOwn(replacement,'drawImage'));
  assert.equal(p.report().drawHistory[0].draw.passes['main/barrier'].filteredImages,2);
});

test('a filter assigned as an own JS property on unsupported Canvas is not a native filter',()=>{
  const p=createDiagnostics({sampleEvery:1});
  const ctx={canvas:{width:100,height:100},filter:'brightness(2)',drawImage(){}};
  p.instrument(ctx,'main');
  p.configure({detail:true,airParticles:false});
  p.begin(0,0);
  ctx.drawImage({width:5,height:5},0,0,5,5);
  p.end(5,'play',true);
  assert.equal(p.report().draw.filterSupport.main,false);
  assert.equal(p.report().draw.passes['main/ui'].filteredImages,0);
});

test('air particle samples group actual draws by shape, backing and blend, and archive on toggle',()=>{
  const p=createDiagnostics({sampleEvery:2});
  const canvas={width:64,height:64}, bitmap={width:48,height:48};
  registerParticleSource(canvas,'glow','canvas');
  registerParticleSource(bitmap,'shard','imageBitmap');
  const ctx={canvas:{width:100,height:100},globalCompositeOperation:'source-over',drawImage(){},
    getTransform:()=>({a:1,b:0,c:0,d:2,e:0,f:0})};
  p.instrument(ctx,'main');
  p.configure({hold:true,detail:true});
  const frame=t=>{
    p.begin(t,t);
    p.pass('particlesAir');
    ctx.globalCompositeOperation='source-over';
    ctx.drawImage(canvas,-10,0,20,20);
    ctx.globalCompositeOperation='lighter';
    ctx.drawImage(bitmap,0,0,30,20);
    ctx.drawImage(bitmap,101,0,30,20);
    ctx.drawImage(canvas,0,0,10,10);
    p.pass('particlesGround');
    ctx.drawImage(canvas,0,0,50,50);
    p.end(t+1,'rain-port/play',true);
  };
  frame(0);
  assert.deepEqual(p.report().draw.airParticleGroups,[]);
  frame(16);
  const groups=p.report().draw.airParticleGroups;
  assert.deepEqual(groups,[
    {kind:'shard',sourceType:'imageBitmap',blend:'lighter',draws:2,boundsPixels:1200,offscreenDraws:1},
    {kind:'glow',sourceType:'canvas',blend:'source-over',draws:1,boundsPixels:400,offscreenDraws:0},
    {kind:'glow',sourceType:'canvas',blend:'lighter',draws:1,boundsPixels:200,offscreenDraws:0}
  ]);
  assert.equal(p.report().draw.sampledFrames,1);
  p.configure({hold:true});
  assert.deepEqual(p.report().draw.airParticleGroups,[]);
  assert.deepEqual(p.report().drawHistory[0].draw.airParticleGroups,groups);
});

test('five-second snapshots stay bounded and include the 5, 10, 15 and 20 minute milestones', () => {
  let snapshots = 0;
  const p = createDiagnostics({snapshot:() => ({calls:++snapshots})});
  for (let t=0;t<=1_200_000;t+=5000) {p.begin(t,t); p.end(t+1,'rain-port/play',true);}
  const history = p.report().history;
  assert.equal(history.length,241);
  assert.deepEqual(history.filter(row=>row.wallSeconds>0&&row.wallSeconds%300===0).map(row=>row.wallSeconds),[300,600,900,1200]);
  for(let t=1_205_000;t<=1_350_000;t+=5000) {p.begin(t,t);p.end(t+1,'rain-port/play',true);}
  assert.equal(p.report().history.length,246);
});

test('public loads stay inert and diagnostic controls select reproducible conditions and export a report', () => {
  const source = fs.readFileSync('js/port-performance.js','utf8');
  const observed = {};
  class Observer {
    static supportedEntryTypes = ['resource','longtask'];
    constructor(callback) { this.callback = callback; }
    observe({type}) { observed[type] = this.callback; }
  }
  const testHost = hostname => {
    const window = {location:{hostname,search:'?perf=1'},PerformanceObserver:Observer};
    vm.runInNewContext(source,{window,URLSearchParams, Blob, URL, setTimeout:callback=>callback()});
    return window.PORT_PERF;
  };
  assert.equal(testHost('example.org'),undefined);
  const perf = testHost('127.0.0.1');
  assert.equal(typeof perf.monitorResources,'function');
  assert.equal(monitorResources({}).supported,false);
  const resources = monitorResources({PerformanceObserver:Observer});
  observed.resource({getEntries:()=>[
    {name:'http://localhost/charm.webp?v=2',duration:12,transferSize:0},
    {name:'http://localhost/music.mp3',duration:8,transferSize:200}
  ]},null,{droppedEntriesCount:1});
  observed.longtask({getEntries:()=>[{duration:55}]});
  assert.equal(resources.imageRequests,1);
  assert.equal(resources.zeroTransfer,1);
  assert.equal(resources.dropped,1);
  assert.equal(resources.longTasks.maxMs,55);
  const node = () => ({
    children:[], events:{}, style:{}, setAttribute(){},
    append(...children) { this.children.push(...children); },
    addEventListener(name,fn) { this.events[name] = fn; },
    click() { clicked = this.download; }, remove() {}
  });
  const doc = {body:node(),createElement:node};
  let config, clicked;
  mountPanel(doc,{configure:value=>{config=value;},report:()=>({result:1})},
    {Blob,URL,setTimeout:callback=>callback()});
  const [,select,label,download] = doc.body.children[0].children;
  select.selectedIndex = 6;
  label.children[0].checked = true;
  select.events.change();
  assert.equal(config.gems,53);
  assert.equal(config.detail,true);
  select.selectedIndex = 2;
  select.events.change();
  assert.equal(config.gems,53);
  assert.equal(config.array,false);
  select.selectedIndex = 0;
  select.events.change();
  assert.equal(config.gems,undefined);
  download.events.click();
  assert.equal(clicked,'yokai-port-performance.json');
});
