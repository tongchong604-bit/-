import {chromium} from '../dev/node_modules/playwright-core/index.mjs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../extension',import.meta.url));let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,timeout:15000,args:['--no-sandbox','--disable-dev-shm-usage'],env:{...process.env,HOME:'/tmp/collector-picker-home',XDG_CACHE_HOME:'/tmp/collector-picker-cache'}});
 const context=await browser.newContext({viewport:{width:1280,height:900}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='https://www.douyin.com/note/7365500792104684834',pic='https://p3.douyinpic.com/selected.png';
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9l8AAAAASUVORK5CYII=','base64');
 await page.route('https://p3.douyinpic.com/**',route=>route.fulfill({status:200,contentType:'image/png',body:png}));
 await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<html><body style="background:#eee;margin:0"><div class="unknown-player"><img id="main" src="'+pic+'" style="display:block;width:600px;height:800px;margin:auto"></div><aside style="position:fixed;right:5px;top:300px"><img src="https://p3.douyinpic.com/avatar.png" width="40" height="40"></aside></body></html>'}));
 await page.goto(url);await page.addScriptTag({path:resolve(root,'collector.js')});
 assert.equal(await page.evaluate(()=>{try{DouyinCollector.extractNote(document,location.href);return false;}catch{return true;}}),true,'Fixture reproduces old unsupported-layout failure');
 await page.evaluate(()=>{window.captured=[];window.chrome={runtime:{lastError:undefined,sendMessage:(message,callback)=>{window.captured.push(message);callback({ok:true});}}};});
 await page.addScriptTag({path:resolve(root,'picker.js')});await page.mouse.move(640,400);await page.mouse.click(640,400);
 const saved=await page.evaluate(()=>window.captured);assert.equal(saved.length,1);assert.equal(saved[0].type,'save-note');assert.deepEqual(saved[0].note.images,[pic]);assert.equal(saved[0].note.source,'manual');assert.equal(saved[0].note.expectedImages,null);
 // Restarting picker cleans the old listener; Escape exits without adding a record.
 await page.addScriptTag({path:resolve(root,'picker.js')});await page.keyboard.press('Escape');await page.mouse.click(640,400);
 assert.equal(await page.evaluate(()=>window.captured.length),1);assert.equal(await page.evaluate(()=>!!window.__douyinPickerCleanup),false);assert.deepEqual(errors,[]);
 await page.addScriptTag({path:resolve(root,'diagnostics.js')});const diag=await page.evaluate(()=>DouyinDiagnostics.collect(document));assert.equal(diag.viewport.width,1280);assert.ok(diag.elements.some(el=>el.tag==='IMG' && el.visible && el.image==='https://p3.douyinpic.com/[image-path-omitted]'));
 console.log('PASS: unsupported player fixture fails automatic capture; actual browser click selects only the current picture, saves partial note, and Escape removes picker. Chrome messaging is a test adapter.');
}finally{if(browser)await browser.close();}
