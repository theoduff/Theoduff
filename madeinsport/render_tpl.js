const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
for(const [n,w,h] of [['madeinsport_template_1080x1440',1080,1440],['madeinsport_template_1080x1350',1080,1350],['madeinsport_template_story_1080x1920',1080,1920]]){
 const p=await b.newPage({viewport:{width:w,height:h}});
 await p.addInitScript(`document.documentElement.style.setProperty('--w','${w}px');document.documentElement.style.setProperty('--h','${h}px')`);
 await p.goto('file://'+__dirname+'/template.html');await p.waitForTimeout(300);
 await p.screenshot({path:n+'.png',omitBackground:true});
 if(w==1080&&h==1440){await p.evaluate(()=>document.body.style.background='linear-gradient(160deg,#2a3cc9,#121b65)');await p.screenshot({path:'/tmp/claude-0/-home-user-Theoduff/8a6737b8-83b2-5ed8-bf89-a125ae0d2462/scratchpad/preview.png'});}
 console.log(n);}
await b.close();})();
