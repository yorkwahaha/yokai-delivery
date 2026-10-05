// PNG source stays intact; only encode distribution WebP files. Optional argv: bundled sharp module path.
const fs=require('node:fs'),sharp=require(process.argv[2]||'sharp');
(async()=>{
  let sourceBytes=0,webpBytes=0;
  for(const name of fs.readdirSync('assets/img').filter(n=>n.endsWith('_v1.png'))){
    const source='assets/img/'+name,target=source.replace(/\.png$/,'.webp');
    await sharp(source).webp({quality:90,alphaQuality:100}).toFile(target);
    sourceBytes+=fs.statSync(source).size;webpBytes+=fs.statSync(target).size;
  }
  console.log(JSON.stringify({sourceBytes,webpBytes,quality:90,alphaQuality:100,resized:false}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
