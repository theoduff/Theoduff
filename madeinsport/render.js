const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
for(const [n,w,h] of [['madeinsport_post_1080x1350',1080,1350],['madeinsport_story_1080x1920',1080,1920],['madeinsport_carre_1080x1080',1080,1080]]){
 const p=await b.newPage({viewport:{width:w,height:h}});
 await p.goto('file://'+__dirname+'/bg.html',{waitUntil:'networkidle'}).catch(()=>{});
 await p.addStyleTag({content:`:root{--w:${w}px;--h:${h}px}`});
 await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(400);
 await p.screenshot({path:n+'.png'});console.log(n, await p.evaluate(()=>document.fonts.check('300 italic 34px "Cormorant Garamond"')));}
await b.close();})();
