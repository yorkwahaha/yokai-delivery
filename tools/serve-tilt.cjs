// Interactive game preview for loopback or an explicitly selected private address.
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=fs.realpathSync(path.resolve(__dirname,'..'));
const port=Number(process.env.YOKAI_PREVIEW_PORT||8788);
const host=process.env.YOKAI_PREVIEW_HOST||'127.0.0.1';
const devGate=require('../js/dev-mode.js');
const stageAudio=require('../js/stage58-audio.js');
const skillExpansion=require('../js/game-skill-expansion.js');
const stageAudioPaths=new Set(stageAudio.entries.map(row=>'/'+row.path));
// Only exact selected DEV art from the generated review index is served.
const devStageArtIndex = path.join(root,'docs/stage-art-review/assets.json');
const devStageArtPaths = new Set(fs.existsSync(devStageArtIndex) ? Object.values(JSON.parse(fs.readFileSync(devStageArtIndex,'utf8'))).flat().map(row=>'/'+row.path).filter(p=>p.startsWith('/art/dev-runtime/img/')) : []);
const extraAudioPaths=[
  'assets/audio/bgm/stages/night-town/night-town__parade.mp3',
  'assets/audio/bgm/stages/night-town/night-town__battle.mp3',
  'assets/audio/bgm/stages/night-town/night-town__boss.mp3',
  'assets/audio/bgm/stages/rain-port/rain-port__battle.mp3',
  'assets/audio/bgm/stages/rain-port/rain-port__boss.mp3',
  'assets/audio/bgm/stages/sakura-pass/sakura-pass__battle.mp3',
  'assets/audio/bgm/stages/sakura-pass/sakura-pass__boss.mp3',
  'assets/audio/bgm/stages/bamboo-maze/bamboo-maze__battle.mp3',
  'assets/audio/bgm/stages/bamboo-maze/bamboo-maze__boss.mp3',
  'assets/audio/bgm/boss/boss__encounter.mp3',
  ...Object.values(skillExpansion.sfxCatalog||{}).map(row=>row.path)
];
const privateHost=hostname=>devGate.isSakuraPlaytest({hostname,search:'?s3play=1'});
if(host!=='0.0.0.0'&&!privateHost(host))throw new Error('Preview host must be loopback or private IPv4');
const localHosts=['127.0.0.1','localhost'].map(name=>port===80?name:name+':'+port);
const boundHost=port===80?host:host+':'+port;
const reviewPath='/docs/first-four-stages-phase-e-20261125/';
const audioReview='/stage-audio-review/';
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
  '.webp':'image/webp','.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg',
  '.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg',
  '.woff2':'font/woff2','.ttf':'font/ttf','.ico':'image/x-icon','.mp4':'video/mp4'};
function sendFile(req,res,file,size){
  const contentType=types[path.extname(file).toLowerCase()]||'application/octet-stream';
  const headers={'content-type':contentType,'cache-control':'no-store',
    'content-length':size,'x-content-type-options':'nosniff'};
  const media=/^(audio|video)\//.test(contentType);
  if(media)headers['accept-ranges']='bytes';
  const range=media&&req.method==='GET'&&/^bytes=(\d*)-(\d*)$/.exec(req.headers.range||'');
  let status=200,streamOptions;
  if(range&&(range[1]||range[2])){
    const start=range[1]?Number(range[1]):Math.max(0,size-Number(range[2]));
    const end=range[1]&&range[2]?Math.min(size-1,Number(range[2])):size-1;
    if(start>end)return res.writeHead(416,{...headers,'content-range':`bytes */${size}`,'content-length':0}).end();
    headers['content-range']=`bytes ${start}-${end}/${size}`;
    headers['content-length']=end-start+1;
    status=206;
    streamOptions={start,end};
  }
  res.writeHead(status,headers);
  if(req.method==='HEAD')return res.end();
  fs.createReadStream(file,streamOptions).on('error',()=>res.destroy()).pipe(res);
}
async function stageAudioFiles(req,res) {
  const metadata=await fs.promises.readFile(path.join(root,stageAudio.base,'production.json'),'utf8')
    .then(JSON.parse).catch(()=>({}));
  const expMeta=await fs.promises.readFile(path.join(root,'art/audio/skill-expansion-10-13/production.json'),'utf8')
    .then(JSON.parse).then(doc=>doc?.files||{}).catch(()=>({}));
  const allPaths=[...stageAudio.entries.map(row=>row.path), ...extraAudioPaths];
  const entries=await Promise.all(allPaths.map(async rel=>{
    const stat=await fs.promises.lstat(path.join(root,rel)).catch(()=>null);
    if (!stat?.isFile() || !stat.size) return null;
    const info=metadata?.[rel] || expMeta?.[rel];
    return [rel,info?.bytes===stat.size ? info : {bytes:stat.size}];
  }));
  const available=entries.filter(Boolean);
  const body=JSON.stringify({files:available.map(([file])=>file),metadata:Object.fromEntries(available)});
  res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',
    'content-length':Buffer.byteLength(body),'x-content-type-options':'nosniff'});
  res.end(req.method==='HEAD' ? undefined : body);
}
const server=http.createServer((req,res)=>{
  const requestHost=req.headers.host?.toLowerCase()||'';
  const peer=req.socket.remoteAddress?.replace(/^::ffff:/,'');
  const privatePeer=privateHost(peer);
  if(!privatePeer)return res.writeHead(403).end('Forbidden');
  const hostParts=requestHost.split(':');
  const lanHost=host==='0.0.0.0' && hostParts.length<3 &&
    (hostParts[1]||'80')===String(port) && privateHost(hostParts[0]);
  const localRequest=localHosts.includes(requestHost) && peer==='127.0.0.1';
  const boundRequest=host!=='0.0.0.0' && requestHost===boundHost;
  if(!localRequest&&!boundRequest&&!lanHost)return res.writeHead(403).end('Forbidden');
  if(req.method!=='GET'&&req.method!=='HEAD')return res.writeHead(405).end('Method not allowed');
  let url;
  try { url=new URL(req.url,'http://localhost'); }
  catch { res.writeHead(400).end('Bad request');return; }
  if(!req.url.startsWith('/')||req.url.startsWith('//')||url.origin!=='http://localhost')
    return res.writeHead(400).end('Bad request');
  let name;
  try { name=decodeURIComponent(url.pathname); }
  catch { res.writeHead(400).end('Bad path');return; }
  if(name==='/')name='/index.html';
  if(name===audioReview+'files.json') {
    stageAudioFiles(req,res).catch(()=>res.writeHead(500).end('Audio catalog unavailable'));
    return;
  }
  if(name===audioReview.slice(0,-1))
    return res.writeHead(307,{location:audioReview,'cache-control':'no-store'}).end();
  const localAudioReview=name===audioReview || name===audioReview+'review.js';
  if(localAudioReview) {
    if(!localRequest)return res.writeHead(403).end('Forbidden');
    name='/docs/stage-audio-review/'+(name===audioReview ? 'index.html' : 'review.js');
  }
  if(name==='/phase-f'||name==='/phase-f/')name='/docs/phase-f-playtest-20261127.html';
  const phaseFReview=name==='/docs/phase-f-playtest-20261127.html';
  if(name==='/phase-e'||name==='/phase-e/')
    return res.writeHead(307,{location:reviewPath+'index.html','cache-control':'no-store'}).end();
  if(name==='/font-v2'||name==='/font-v2/')
    return res.writeHead(307,{location:'/font-v2/index.html','cache-control':'no-store'}).end();
  const fontReview=/^\/font-v2\/(?:index\.html|preview\.(?:js|css)|coverage\.json|missing-glyphs\.md|captures\/[a-z0-9-]+\.webp|fonts\/[a-z]+\.woff2|sources\/ofl-[a-z]+\.txt)$/.test(name);
  if(fontReview)name='/scratch'+name;
  const review=name.startsWith(reviewPath)&&/^(?:index\.html|[a-z0-9-]+\.jpg)$/.test(name.slice(reviewPath.length));
  const lateReview=/^\/docs\/stage-art-review\/(?:index\.html|assets\.json)$/.test(name);
  const expansionReview=/^\/art\/skill-expansion-10-13\/(?:manifest\.json|(?:cards|icons|vfx)\/[a-z0-9_-]+\.webp)$/.test(name);
  if (name==='/stage-art-review'||name==='/stage-art-review/')
    return res.writeHead(307,{location:'/docs/stage-art-review/index.html','cache-control':'no-store'}).end();
  const stageTrial=(
    /^\/art\/stage5-hyakki-kyoto\/scene\/hyakki-kyoto__(ground(?:-grid|-[0-5])?|perimeter-ground|grocery|sweets-house|noodle-house|tea-house|three-tier-pagoda|stall|crate-stack|stone-lantern|double-lantern|block-frontage|block-wall|maple|footbridge|festival-kiosk|festival-banners|red-railing|maple-leaves|perimeter-gate|cloth-merchant|market-shrine|rear-townhouses|stone-basin|lantern-stand|komainu|maple-shrub)\.webp$/.test(name)
    || /^\/art\/stage5-hyakki-kyoto\/characters\/poses\/kyoto-(straw-sandal|crow-bell-courier|rice-bale-oni|box-bellows|taiko-warden|brocade-puppeteer|procession-marshal)__sprite__(idle|windup|action)\.webp$/.test(name)
    || /^\/art\/stage5-hyakki-kyoto\/characters\/poses\/kyoto-(straw-sandal|crow-bell-courier|rice-bale-oni|box-bellows)__sprite__walk\.webp$/.test(name)
    || /^\/art\/stage5-hyakki-kyoto\/characters\/vfx\/kyoto-(taiko|pennant|procession)__(warning|impact)\.webp$/.test(name)
    || /^\/art\/stage5-hyakki-kyoto\/characters\/vfx\/kyoto-(shooter__projectile|boss__arrival)\.webp$/.test(name)
    || /^\/art\/stage6-snow-temple\/scene\/snow-temple__(ground-[0-5]|shrine|temple|torii|stone-lantern|steps|bridge|boulders|pine|ice-cliff|offertory|paper-lantern|cedar-fence|ice-patch|snowdrift|octagonal-shrine|juniper)\.webp$/.test(name)
    || /^\/art\/stage6-snow-temple\/characters\/poses\/snow-(rabbit|kamaitachi|ice-badger|lantern-monk|frost-bell-guardian|white-kimono|mountain-lion)__sprite__(idle|windup|action)\.webp$/.test(name)
    || /^\/art\/stage6-snow-temple\/characters\/vfx\/snow-(frost-bell|ice-gale|blizzard-claws)__(warning|impact)\.webp$/.test(name)
    || /^\/art\/stage6-snow-temple\/characters\/vfx\/snow-(shooter__projectile|boss__arrival)\.webp$/.test(name)
    || /^\/art\/(?:stage7-spirit-ferry\/scene\/spirit-ferry|stage8-yomi\/scene\/yomi)__[a-z0-9-]+\.webp$/.test(name)
    || /^\/art\/(?:stage7-spirit-ferry\/characters\/(?:poses|vfx)\/ferry|stage8-yomi\/characters\/(?:poses|vfx)\/yomi)-[a-z0-9-]+__(?:sprite__(?:idle|windup|action)|warning|impact|projectile|arrival)\.webp$/.test(name)
  );
  const publicPath=name==='/index.html'||name==='/service-worker.js'
    || /^\/(?:js|assets|art\/(?:stage2-rain-port\/scene|stage8-yomi\/sliced_v2|fusion\/candidates|delivery-icons))\//.test(name)
    || stageTrial || devStageArtPaths.has(name) || review || phaseFReview || lateReview || expansionReview || localAudioReview || fontReview || stageAudioPaths.has(name);
  if(!publicPath||/[\\:\x00]/.test(name)||name.split('/').some(part=>part.startsWith('.'))){
    res.writeHead(403).end('Forbidden');return;
  }
  const file=path.resolve(root,'.'+name);
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end('Forbidden');
  fs.realpath(file,(error,real)=>{
    if(error)return res.writeHead(404).end('Not found');
    if(path.relative(file,real)!=='')return res.writeHead(403).end('Forbidden');
    fs.stat(file,(err,stat)=>{
      if(err||!stat.isFile()){res.writeHead(404).end('Not found');return;}
      sendFile(req,res,file,stat.size);
    });
  });
});
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
server.listen(port,host,()=>{
  console.log('YOKAI_LOCAL_PREVIEW_READY http://'+host+':'+port+'/');
  console.log('0.60 + 20% Y spacing: http://'+host+':'+port+'/');
  console.log('0.60 without spacing: http://'+host+':'+port+'/?tilt=0.6&spacing=1');
  console.log('Original 2D: http://'+host+':'+port+'/?tilt=1');
});
