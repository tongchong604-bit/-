// Offline browser integration: Chrome APIs are adapted because this cloud browser
// is managed and prohibits loading unpacked extensions. Real extension API/Win7
// installation remains unverified. Actual extraction, fetch, ZIP and UI code run.
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || new URL('../dev/node_modules/playwright-core/index.mjs',import.meta.url).href);
const root=fileURLToPath(new URL('../extension',import.meta.url));
const server=createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname.slice(1);
 if(!/^[a-z-]+\.(html|js|css)$/.test(name)){res.writeHead(404);res.end();return;}
 try{const content=readFileSync(resolve(root,name));res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(content);}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,timeout:15000,args:['--no-sandbox','--disable-dev-shm-usage'],env:{...process.env,HOME:'/tmp/collector-ui-test-home',XDG_CACHE_HOME:'/tmp/collector-ui-test-cache'}});
 const context=await browser.newContext({acceptDownloads:true});const errors=[];const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const listeners=[];const note={id:'7365500792104684834',title:'烧烤参考',author:'参考作者',url:'https://www.douyin.com/note/7365500792104684834',text:'第三方介绍参考',images:['https://p3.douyinpic.com/original.png'],expectedImages:1,warnings:[],source:'structured'};
  const notes=[note];
  window.chrome={runtime:{lastError:undefined,sendMessage:(message,callback)=>{
   if(message.type==='remove-note'){const i=notes.findIndex(n=>n.id===message.id);if(i>=0)notes.splice(i,1);}
   if(message.type==='clear-notes')notes.length=0;
   callback({ok:true});listeners.forEach(fn=>fn({notes:{}},'local'));
  }},storage:{local:{get:(key,cb)=>cb({notes:JSON.parse(JSON.stringify(notes))})},onChanged:{addListener:fn=>listeners.push(fn)}},downloads:{download:(options,cb)=>{
   window.lastDownloadOptions=options;const a=document.createElement('a');a.href=options.url;a.download=options.filename;document.body.append(a);a.click();a.remove();cb(1);
  }}};
 });
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9l8AAAAASUVORK5CYII=','base64');
 await page.route('https://p3.douyinpic.com/**',route=>route.fulfill({status:200,headers:{'content-type':'image/png','access-control-allow-origin':'*'},body:png}));
 await page.goto(`http://127.0.0.1:${server.address().port}/library.html`);
 await page.getByText('烧烤参考',{exact:true}).waitFor();
 await page.getByRole('button',{name:'生成所选 ZIP'}).click();assert.match(await page.locator('#status').innerText(),/请先勾选/);
 await page.getByRole('button',{name:'全选',exact:true}).click();await page.getByRole('button',{name:'生成所选 ZIP'}).click();
 await page.getByRole('button',{name:'下载这一包'}).waitFor();assert.match(await page.locator('#status').innerText(),/1 \/ 1/);
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'下载这一包'}).click();const download=await downloading;await download.saveAs('/tmp/collector-ui-reference.zip');assert.equal(await download.failure(),null);
 const opts=await page.evaluate(()=>window.lastDownloadOptions);assert.equal(opts.saveAs,true);assert.match(opts.filename,/\.zip$/);
 await page.screenshot({path:'/tmp/collector-library-ready.png',fullPage:true});
 await page.getByRole('button',{name:'删除',exact:true}).click();await page.getByText('还没有参考图文。',{exact:false}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS: real Chromium renders library, validates selection, fetches image, generates ZIP, triggers browser save, and deletes record. Chrome APIs are test adapters.');
}catch(error){console.error(error);process.exitCode=1;}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
