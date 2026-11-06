const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const saved=require('../js/overworld-layout.js');
const path=require('node:path');
function load(layout){
  const browser={OVERWORLD_LAYOUT:layout};
  vm.runInNewContext(fs.readFileSync('js/overworld.js','utf8'),{window:browser,console},{filename:'js/overworld.js'});
  return browser;
}
test('layout config has 17 routes and all eight independently editable art and label anchors',()=>{
  assert.equal(saved.version,1);
  assert.equal(Object.keys(saved.nodes).length,17);
  assert.ok(saved.background.width>800);
  for(const id of ['night-town','rain-port','sakura-pass','bamboo-maze','hyakki-kyoto','snow-temple','spirit-ferry','yomi']){
    const n=saved.nodes[id];assert.ok(n.route&&n.art&&n.label,id);
  }
});
test('moving label or art in editor config never changes travel waypoint and independently affects click targets',()=>{
  const data=structuredClone(saved),a=data.nodes['sakura-pass'];
  a.route={x:1100,y:900};
  a.art={x:1430,y:605,scale:1.5};
  a.label={x:1525,y:720,width:230};
  const {OVERWORLD:ow}=load(data);
  const node=ow.NODES.find(n=>n.id==='sakura-pass');
  assert.equal(node.x,1100);assert.equal(node.y,900);
  assert.equal(node.art.x,1430);assert.equal(node.art.y,605);assert.equal(node.art.scale,1.5);
  assert.equal(node.labelPlacement.x,1525);assert.equal(node.labelPlacement.width,230);
  const s=ow.createState(node.id);
  assert.equal(ow.hitTest(s,node.labelPlacement.x-s.camX,node.labelPlacement.y+24-s.camY)?.id,node.id);
  assert.equal(ow.hitTest(s,node.art.x-s.camX,node.art.y-s.camY)?.id,node.id);
  const translated=[],g={addColorStop(){}};
  const ctx=new Proxy({translate:(...args)=>translated.push(args),createLinearGradient:()=>g,createRadialGradient:()=>g},{get:(o,k)=>o[k]||(()=>{})});
  ow.draw(ctx,s,0);
  assert.ok(translated.some(([x,y])=>x===1430&&y===605),'real rendering must use separate art position');
});
test('background scaling/translation comes from editor config without changing world route size',()=>{
  const data=structuredClone(saved);data.background={x:180,y:110,width:1890};
  const root=load(data),image={naturalWidth:1672,naturalHeight:941};
  root.ART={overworld_approved_v2:image};
  const images=[],g={addColorStop(){}};
  const ctx=new Proxy({drawImage:(...p)=>images.push(p),createLinearGradient:()=>g,createRadialGradient:()=>g},{get:(o,k)=>o[k]||(()=>{})});
  root.OVERWORLD.draw(ctx,root.OVERWORLD.createState('gate'),0);
  const hit=images.find(x=>x[0]===image&&x.length===5);
  assert.deepEqual(Array.from(hit).slice(1),[180,110,1890,Math.round(1890*941/1672)]);
  assert.equal(root.OVERWORLD.MAP_W,3000);assert.equal(root.OVERWORLD.MAP_H,2200);
});

test('local tools reject unexpected hosts, internal files and invalid request targets',async()=>{
  for(const [file,port] of [['serve-tilt.cjs',8788],['map-editor-server.cjs',8766]]){
    let handle;
    const dirname=path.resolve('tools');
    const testFs={
      ...fs,
      readFile(file,done){fs.stat(file,(error,stat)=>done(error||(!stat.isFile()?Error():null),Buffer.alloc(0)));},
      createReadStream(){return {on(){return this;},pipe(response){response.end();}};}
    };
    vm.runInNewContext(fs.readFileSync(path.join(dirname,file),'utf8'),{
      __dirname:dirname,URL,console,process:{env:{},argv:[],platform:process.platform},
      require(name){
        if(name==='node:fs')return testFs;
        if(name==='node:http')return {createServer(listener){handle=listener;return {listen(){},on(){}};}};
        return require(name);
      }
    });
    const head=(url,host='localhost:'+port)=>new Promise(resolve=>{
      const res={writeHead(status){this.status=status;return this;},end(){resolve(this.status);}};
      handle({url,method:'HEAD',headers:{host}},res);
    });
    assert.equal(await head('/'),200,file);
    assert.equal(await head('/','untrusted.example:'+port),403,file);
    assert.equal(await head('/.git/HEAD'),403,file);
    assert.equal(await head('/README.md'),403,file);
    assert.equal(await head('http://['),400,file);
  }
});
