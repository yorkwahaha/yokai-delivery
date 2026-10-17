// Independent post-capture validation of 9 source MP4s and 3 synchronized compares.
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'../artifacts/validation/hd25d-motion'),ffmpeg='C:/ffmpeg/bin/ffmpeg.exe',ffprobe='C:/ffmpeg/bin/ffprobe.exe';
const scenes={movement:12,combat:15,stress:12},types=['2d','070','060'];
const report=JSON.parse(fs.readFileSync(path.join(root,'results.json'),'utf8'));
function call(cmd,args){
 const r=spawnSync(cmd,args,{encoding:null,maxBuffer:10e6,timeout:120000,windowsHide:true});
 if(r.error||r.status!==0)throw Error((r.error||r.stderr.toString()).toString().slice(-1200));
 return r.stdout;
}
const problems=[],proof={};
for(const [scene,duration] of Object.entries(scenes)){
 proof[scene]={};
 for(const variant of [...types,'compare']){
  const file=path.join(root,scene+'-'+variant+'.mp4');
  if(!fs.existsSync(file)){problems.push('Missing '+file);continue;}
  const data=JSON.parse(call(ffprobe,['-v','error','-show_entries','stream=codec_name,width,height,nb_frames,r_frame_rate:format=duration,size','-of','json',file]).toString());
  const v=data.streams?.find(x=>x.codec_name==='h264');
  const length=Number(data.format?.duration),expectedFrames=duration*30;
  if(!v)problems.push('Not H264 '+file);
  if(Math.abs(length-duration)>.07)problems.push('Duration mismatch '+scene+' '+variant+' '+length);
  if(+v.nb_frames!==expectedFrames)problems.push('Frame count '+scene+' '+variant+' '+v.nb_frames+' expected '+expectedFrames);
  const target=variant==='compare'?[1920,440]:[1280,800];
  if(v.width!==target[0]||v.height!==target[1])problems.push('Resolution '+scene+' '+variant);
  const sampled=call(ffmpeg,['-hide_banner','-loglevel','error','-i',file,'-vf','fps=1,scale=120:75:flags=fast_bilinear',
   '-an','-pix_fmt','rgb24','-f','rawvideo','-']);
  const bytes=120*75*3,hashes=[];
  for(let i=0;i+bytes<=sampled.length;i+=bytes){
   hashes.push(crypto.createHash('sha256').update(sampled.subarray(i,i+bytes)).digest('hex').slice(0,14));
  }
  const unique=new Set(hashes).size;
  if(unique<Math.min(3,Math.floor(duration/2)))problems.push('Almost static '+scene+' '+variant+' unique='+unique);
  proof[scene][variant]={duration:length,frames:+v.nb_frames,dimensions:[v.width,v.height],uniqueOneSecondFrames:unique};
 }
 const base=report.scenes?.[scene]?.variants;
 if(base){
  for(const [tilt,rec] of Object.entries(base)){
   if(rec.divergentPlayerFrames!==0)problems.push('Simulation coordinates diverge '+scene+'/'+tilt+' '+rec.divergentPlayerFrames);
   if(rec.exceptions?.length)problems.push('JS exceptions '+scene+'/'+tilt+' '+JSON.stringify(rec.exceptions));
   if(rec.snapshots?.[0]?.p?.join(',')===rec.snapshots?.at(-1)?.p?.join(','))problems.push('Player stationary '+scene+'/'+tilt);
  }
 }
}
fs.writeFileSync(path.join(root,'verification.json'),JSON.stringify({validatedAt:new Date().toISOString(),passed:problems.length===0,proof,problems},null,2));
console.log(JSON.stringify({passed:problems.length===0,proof,problems},null,2));
if(problems.length)process.exitCode=1;