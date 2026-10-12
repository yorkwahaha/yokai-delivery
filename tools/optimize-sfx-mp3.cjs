// Safe, conditional MP3 bitrate reduction. Sources are saved outside the web asset tree.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const exe=n=>[process.env[n.toUpperCase()],'G:/yt-dlp/'+n+'.exe','I:/yt-dlp/'+n+'.exe',n].filter(Boolean).find(x=>{
  if(x===n)return true;return fs.existsSync(x);
});
const ffmpeg=exe('ffmpeg'),ffprobe=exe('ffprobe');
const inspect=p=>{
 const out=cp.execFileSync(ffprobe,['-v','error','-select_streams','a:0','-show_entries','stream=bit_rate,channels,sample_rate:format=bit_rate,duration','-of','json',p],{encoding:'utf8'});
 const z=JSON.parse(out),a=z.streams?.[0]||{},f=z.format||{};
 return {rate:Number(a.bit_rate||f.bit_rate||0),duration:Number(f.duration||0),channels:Number(a.channels||2),hz:Number(a.sample_rate||44100)};
};
const files=[];
for(const dir of ['assets/audio','assets/audio/words','assets/audio/sfx']){
 if(!fs.existsSync(dir))continue;
 for(const n of fs.readdirSync(dir).filter(x=>x.toLowerCase().endsWith('.mp3')))files.push(path.join(dir,n));
}
let saved=0,count=0;
for(const file of files){
 const info=inspect(file),word=file.includes(path.sep+'words'+path.sep),music=path.dirname(file)==='assets'+path.sep+'audio';
 const target=music?192:word?(info.channels===1?112:160):(info.channels===1?128:160);
 const floor=music?224:word?(info.channels===1?160:208):192;
 if(info.rate<floor*1000||info.rate<=target*1000)continue;
 const temp=file+'.optimized.mp3';
 try{
  cp.execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',file,'-vn','-codec:a','libmp3lame','-b:a',target+'k','-ar',String(info.hz),'-ac',String(info.channels),temp],{timeout:120000});
  const result=inspect(temp),before=fs.statSync(file).size,after=fs.statSync(temp).size;
  if(Math.abs(result.duration-info.duration)>.12||result.channels!==info.channels)throw Error('Audio metadata mismatch '+file);
  if(after<before*.86){
   const backup=path.join('art','media-source-backup',file);
   fs.mkdirSync(path.dirname(backup),{recursive:true});
   if(!fs.existsSync(backup))fs.copyFileSync(file,backup);
   fs.renameSync(temp,file);
   console.log(file+': '+before+' -> '+after+' bytes, '+Math.round(info.rate/1000)+'k -> '+target+'k');
   count++;saved+=before-after;
  }
 }finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
}
console.log('Optimized '+count+' MP3s; saved '+saved+' bytes. 128kbps originals are untouched.');
