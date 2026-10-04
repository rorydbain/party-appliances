const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
(async () => {
 const data = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-flow-'));
 const app = await electron.launch({args:[path.resolve(__dirname,'..'),'--mode=booth'],env:{...process.env,PARTY_TEST:'1',PARTY_DATA_DIR:data}});
 try {
 const page = await app.firstWindow(); await page.waitForSelector('#connect');
 await app.evaluate(({ipcMain,BrowserWindow}) => {
  const win=BrowserWindow.getAllWindows()[0], event={sender:win.webContents};
  const original=ipcMain._invokeHandlers.get('bootstrap'), capture=ipcMain._invokeHandlers.get('capture-still');
  global.rp={connected:true, starts:0, shots:0, focused:0, timer:null};
  ipcMain.removeHandler('bootstrap'); ipcMain.handle('bootstrap',async e=>({...await original(e),test:false}));
  function replace(n,f){ipcMain.removeHandler(n);ipcMain.handle(n,f);}
  replace('still-camera-status',()=>({connected:global.rp.connected,model:'Canon EOS RP',message:'Test RP'}));
  replace('prepare-still-camera',()=>true);
  replace('stop-still-preview',()=>{clearInterval(global.rp.timer);return true;});
  replace('start-still-preview',async()=>{global.rp.starts++; if(!global.rp.connected)throw Error('Disconnected'); const shot=await capture(event);clearInterval(global.rp.timer);global.rp.timer=setInterval(()=>{if(global.rp.connected)win.webContents.send('still-preview-frame',shot.files[0].data)},80);return true;});
  replace('focus-still',async()=>{global.rp.focused++;clearInterval(global.rp.timer);await new Promise(r=>setTimeout(r,400));});
  replace('capture-still',async()=>{global.rp.shots++;await new Promise(r=>setTimeout(r,700));return capture(event);});
 });
 await page.reload();await page.waitForSelector('#rp-live:visible');
 const gpu = await page.evaluate(async () => {
   const source=document.createElement('canvas');source.width=960;source.height=640;const ctx=source.getContext('2d');
   ctx.fillStyle='rgb(190,140,105)';ctx.fillRect(0,0,960,320);ctx.fillStyle='rgb(30,80,150)';ctx.fillRect(0,320,960,320);
   const identity={size:2,values:[]}; for(let b=0;b<2;b++)for(let g=0;g<2;g++)for(let r=0;r<2;r++)identity.values.push(r,g,b); const identityRenderer=window.partyLut.createRenderer(identity); identityRenderer.draw(source,0); const check=document.createElement('canvas');check.width=960;check.height=640;const cc=check.getContext('2d');cc.drawImage(identityRenderer.canvas,0,0);const identityTop=Array.from(cc.getImageData(10,10,1,1).data);const identityBottom=Array.from(cc.getImageData(10,600,1,1).data);identityRenderer.dispose();
   const looks=await window.party.photoLuts();const lut=window.partyLut.parse(looks[0].data);const renderer=window.partyLut.createRenderer(lut);
   if(!renderer)throw Error('GPU renderer unavailable');
   renderer.draw(source,0);const copy=document.createElement('canvas');copy.width=960;copy.height=640;const c=copy.getContext('2d');c.drawImage(renderer.canvas,0,0);
   const top=Array.from(c.getImageData(10,10,1,1).data);const bottom=Array.from(c.getImageData(10,600,1,1).data);
   const output=window.partyLut.apply(source,lut,0);c.clearRect(0,0,960,640);c.drawImage(output,0,0);const saved=Array.from(c.getImageData(10,10,1,1).data);
   const gl=renderer.canvas.getContext('webgl2'); const start=performance.now();for(let i=0;i<60;i++){renderer.draw(source,3.2);gl.finish();}const ms=(performance.now()-start)/60;renderer.dispose();return {top,bottom,saved,ms,identityTop,identityBottom};
 });
 assert.deepEqual(gpu.identityTop,[190,140,105,255]);assert.deepEqual(gpu.identityBottom,[30,80,150,255]);assert.deepEqual(gpu.top,gpu.saved);assert.notDeepEqual(gpu.top.slice(0,3),[190,140,105]);assert.notDeepEqual(gpu.top,gpu.bottom);console.log('GPU LUT preview/export match; 960x640 average milliseconds:',gpu.ms.toFixed(2));
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('still-health',{battery:20,checkedAt:Date.now()}));
 await page.waitForSelector('#battery-health.battery-low');

 await app.evaluate(()=>{global.rp.connected=false;});
 await page.waitForFunction(()=>document.querySelector('#booth-message').textContent.includes('Reconnect the Canon'),{timeout:20000});
 await app.evaluate(()=>{global.rp.connected=true;});
 await page.waitForFunction(()=>document.querySelector('#booth-message').textContent==='Ready' && !document.querySelector('#capture').disabled,{timeout:15000});
 assert.equal(await app.evaluate(()=>global.rp.shots),0);
 await page.locator('#capture').click();await page.waitForSelector('.shutter-prep');
 await page.waitForSelector('.developing');assert.equal(await page.locator('#review-photo').isVisible(),false);
 await page.waitForFunction(()=>document.querySelector('#booth-message').textContent==='Saved');
 assert.equal(await app.evaluate(()=>global.rp.focused),1);
 await page.waitForFunction(()=>document.querySelector('#booth-message').textContent==='Ready',{timeout:10000});
 assert.equal(await page.locator('#mode-video').count(),0);assert.equal(await page.locator('#review-video').count(),0);assert.equal(await page.locator('#microphone').count(),0);
 await page.locator('#disconnect').click(); const starts=await app.evaluate(()=>global.rp.starts);await new Promise(r=>setTimeout(r,6500));assert.equal(await app.evaluate(()=>global.rp.starts),starts);
 console.log('PASS: unplug/replug recovers without a photo; countdown fade; no ungraded review; single focus; return to preview; deliberate shutdown stays off.');
 } finally {await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
