// Rebuild 3-up MP4s from the REAL recorded clips; independent of capture.
'use strict';
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const dir=path.resolve(__dirname,'../artifacts/validation/hd25d-motion');
const ffmpeg='C:/ffmpeg/bin/ffmpeg.exe';
const names=['2D','2.5D 0.70','2.5D 0.60'];
for(const scene of process.argv.slice(2).length?process.argv.slice(2):['movement','combat','stress']){
 const videos=['2d','070','060'].map(id=>path.join(dir,scene+'-'+id+'.mp4'));
 for(const p of videos)if(!fs.existsSync(p))throw Error('Missing original clip '+p);
 const filters=names.map((label,i)=>'['+i+':v]scale=640:400,pad=640:440:0:40:color=0x181a1e,drawtext=fontfile=C\\\\:/Windows/Fonts/arial.ttf:text='+JSON.stringify(label)+':x=(w-text_w)/2:y=8:fontcolor=white:fontsize=24[v'+i+']').join(';');
 const name=path.join(dir,scene+'-compare.mp4');
 const args=['-hide_banner','-loglevel','error','-y',...videos.flatMap(v=>['-i',v]),
   '-filter_complex',filters+';[v0][v1][v2]hstack=inputs=3[v]',
   '-map','[v]','-an','-c:v','libx264','-preset','veryfast',
   '-pix_fmt','yuv420p','-crf','26','-movflags','+faststart',name];
 const run=spawnSync(ffmpeg,args,{encoding:'utf8',timeout:180000,maxBuffer:20e6});
 if(run.error||run.status!==0)throw Error(scene+' compare: '+(run.error||run.stderr));
 console.log('COMPARE '+scene+' '+fs.statSync(name).size+' bytes '+name);
 const report=path.join(dir,'results.json');
 if(fs.existsSync(report)){const json=JSON.parse(fs.readFileSync(report,'utf8'));
   if(json.scenes?.[scene])json.scenes[scene].compare=path.basename(name);
   fs.writeFileSync(report,JSON.stringify(json,null,2));}
}