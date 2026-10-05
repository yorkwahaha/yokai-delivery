const fs=require('node:fs');
const {chromium}=require('C:/Users/York/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1884,height:869}}),errors=[];
 await page.addInitScript(()=>localStorage.setItem('yokai-tutorial-v1','"skip"'));
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/js/game.js*',async route=>{
   let s=fs.readFileSync('js/game.js','utf8'),end=s.lastIndexOf('})();');
   const hook=`UI.drawPauseMenu=()=>{};window.review={start,openOverworld:()=>enterOverworld(true),end:s=>{tutorial=null;state=s;ended=true;score=6570;delivered=4;runSummary={prevBest:52745,learning:{practiced:5,review:5,gained:4,lost:0}};misses=ALL.slice(0,5);},delivery:()=>{makeOrder();inter=orders[0];interact();P.x=job.to.x;P.y=job.to.y+200;RENDERER.setCam(P.x-W/2,P.y-H/2);job.sanctuaryT=2;state='pause';},boss:()=>{job=null;enemies=[{x:P.x+100,y:P.y,type:'boss',hp:999,max:999,speed:0,slam:{x:P.x+100,y:P.y,t:0.7},shield:false}];},draw:drawWorld};`;
   // Use existing map entry function name from source.
   await route.fulfill({contentType:'application/javascript',body:s.slice(0,end)+hook+s.slice(end)});
 });
 await page.goto('http://127.0.0.1:8796/');
 await page.evaluate(()=>loadGameArt());
 await page.waitForFunction(()=>ART_READY);
 await page.evaluate(()=>document.fonts.ready);
 for(const state of ['won','lost']){
   await page.evaluate(s=>{review.start();review.end(s)},state);
   await page.waitForTimeout(650);
   await page.screenshot({path:`artifacts/validation/round22-${state}.png`});
 }
 await page.evaluate(()=>{review.start();review.delivery();});
 await page.waitForTimeout(650);
 await page.evaluate(()=>review.draw());
 await page.screenshot({path:'artifacts/validation/round22-delivery.png'});
 await page.evaluate(()=>review.boss());await page.evaluate(()=>review.draw());
 await page.screenshot({path:'artifacts/validation/round22-boss.png'});
 await page.evaluate(()=>review.openOverworld());
 await page.waitForTimeout(650);
 await page.screenshot({path:'artifacts/validation/round22-map.png'});
 await page.setViewportSize({width:844,height:390});
 for(const state of ['won','lost']){
   await page.evaluate(s=>{review.start();review.end(s)},state);await page.waitForTimeout(650);
   await page.screenshot({path:`artifacts/validation/round22-${state}-mobile.png`});
 }
 console.log(JSON.stringify({errors,asset:await page.evaluate(()=>({width:ART.overworld_night_v2.naturalWidth,failed:ART_PROGRESS.failed})),screenshots:7}));
 await page.goto('http://127.0.0.1:8796/artifacts/validation/max-skill-concepts.html');
 await page.waitForFunction(()=>document.querySelectorAll('canvas').length===12 && document.querySelector('canvas').getContext('2d').getImageData(110,98,1,1).data[3]>0);
 await page.getByRole('button',{name:'暫停動態'}).click();
 await page.screenshot({path:'artifacts/validation/round22-max-concepts.png',fullPage:true});
 if(errors.length)throw new Error(errors.join('; '));
 console.log(JSON.stringify({conceptCanvases:await page.locator('canvas').count(),errors}));
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
