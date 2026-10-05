// 固定 chunk、VM Canvas 的重烘焙次數比較；不量測 FPS、GC 或實際繪圖耗時。
const fs = require('node:fs');
const vm = require('node:vm');
const fixture = fs.readFileSync('tests/renderer.test.cjs','utf8').split("test('roundRect")[0];
const source = fs.readFileSync('js/renderer.js','utf8');
const original = 'const left = x - 120, top = y - 120, width = area.width + 240, height = area.height + 240;';
if (!source.includes(original)) throw new Error('Terrain padding source changed; update the measurement fixture.');
const result = [];
for (const padding of [120,300]) {
  const alternate = source.replace(original,`const left = x - ${padding}, top = y - ${padding}, width = area.width + ${2*padding}, height = area.height + ${2*padding};`);
  const env = {require:name=>name==='node:fs'?{...fs,readFileSync:(path,...args)=>path==='js/renderer.js'?alternate:fs.readFileSync(path,...args)}:require(name)};
  vm.runInNewContext(fixture+'\nglobalThis.loadRenderer=loadRenderer;',env);
  for (const [width,height] of [[568,320],[900,600],[1920,1080]]) for (const speed of [230,780]) {
    const r = env.loadRenderer(width,height), chunks=[{x:0,y:0,w:900,h:600,cx:0,theme:'market',name:'街',sub:''}];
    r.env.RENDERER.drawGround(0,600,chunks,'ground');
    const terrain = r.canvases.at(-1);let previous=terrain.fills.length,rebuilds=0;
    for (let frame=1;frame<=600;frame++) {
      r.env.RENDERER.setCam(speed*frame/60,0);r.env.RENDERER.drawGround(frame/60,600,chunks,'ground');
      if (terrain.fills.length!==previous) { rebuilds++;previous=terrain.fills.length; }
    }
    result.push({padding,width,height,speed,seconds:10,rebuilds,rebuildsPerSecond:rebuilds/10,backingPixels:terrain.width*terrain.height});
  }
}
const report={kind:'VM invalidation count; fixed chunks; constant camera speed',limitations:['Continuous dash is a stress scenario, not normal dash cooldown behavior','No rasterization, FPS or GC measured','The proposed 80px early-refresh rule was not added','Production padding unchanged'],result};
fs.writeFileSync('artifacts/validation/sakana-terrain-measure.json',JSON.stringify(report,null,2));
console.table(result);
