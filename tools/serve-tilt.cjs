// Local-only interactive game preview. Never commits or deploys.
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const port=Number(process.env.YOKAI_PREVIEW_PORT||8788);
const host='127.0.0.1';
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
  '.webp':'image/webp','.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg',
  '.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg',
  '.woff2':'font/woff2','.ttf':'font/ttf','.ico':'image/x-icon','.mp4':'video/mp4'};
const server=http.createServer((req,res)=>{
  let url;
  try { url=new URL(req.url,'http://localhost'); }
  catch { res.writeHead(400).end('Bad request');return; }
  let name;
  try { name=decodeURIComponent(url.pathname); }
  catch { res.writeHead(400).end('Bad path');return; }
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)&&file!==path.join(root,'index.html')){
    res.writeHead(403).end('Forbidden');return;
  }
  fs.stat(file,(err,stat)=>{
    if(err||!stat.isFile()){res.writeHead(404).end('Not found');return;}
    res.writeHead(200,{'content-type':types[path.extname(file).toLowerCase()]||'application/octet-stream',
      'cache-control':'no-store','content-length':stat.size,
      'x-content-type-options':'nosniff'});
    fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  });
});
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
server.listen(port,host,()=>{
  console.log('YOKAI_LOCAL_PREVIEW_READY http://'+host+':'+port+'/');
  console.log('0.60 + 20% Y spacing: http://'+host+':'+port+'/');
  console.log('0.60 without spacing: http://'+host+':'+port+'/?tilt=0.6&spacing=1');
  console.log('Original 2D: http://'+host+':'+port+'/?tilt=1');
});
