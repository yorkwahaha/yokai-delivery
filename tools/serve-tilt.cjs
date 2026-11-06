// Local-only interactive game preview. Never commits or deploys.
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=fs.realpathSync(path.resolve(__dirname,'..'));
const port=Number(process.env.YOKAI_PREVIEW_PORT||8788);
const host='127.0.0.1';
const allowedHosts=[host,'localhost'].map(name=>port===80?name:name+':'+port);
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
  '.webp':'image/webp','.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg',
  '.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg',
  '.woff2':'font/woff2','.ttf':'font/ttf','.ico':'image/x-icon','.mp4':'video/mp4'};
const server=http.createServer((req,res)=>{
  if(!allowedHosts.includes(req.headers.host?.toLowerCase()))return res.writeHead(403).end('Forbidden');
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
  const publicPath=name==='/index.html'||name==='/service-worker.js'
    || /^\/(?:js|assets|art\/(?:stage2-rain-port\/scene|stage8-yomi\/sliced_v2|fusion\/candidates|delivery-icons))\//.test(name);
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
      res.writeHead(200,{'content-type':types[path.extname(file).toLowerCase()]||'application/octet-stream',
        'cache-control':'no-store','content-length':stat.size,
        'x-content-type-options':'nosniff'});
      if(req.method==='HEAD')return res.end();
      fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
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
