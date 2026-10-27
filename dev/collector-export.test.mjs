import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const storeFile=new URL('../extension/store.js',import.meta.url),zipFile=new URL('../extension/zip.js',import.meta.url),exportFile=new URL('../extension/exporter.js',import.meta.url);
test('collection storage and export modules exist',()=>{for(const f of [storeFile,zipFile,exportFile])assert.ok(existsSync(f),'累积与导出尚未实现');});
if([storeFile,zipFile,exportFile].every(f=>existsSync(f))){
 const {mergeNotes}=await import(storeFile);const {createZip}=await import(zipFile);const {buildExport,safeFilename}=await import(exportFile);
 const note={id:'7365500792104684834',url:'https://www.douyin.com/note/7365500792104684834',title:'烧烤/去哪学?',text:'早餐与烧烤\n第二行',author:'作者',images:['https://p3.douyinpic.com/a.jpg?sign=old'],expectedImages:null,warnings:['无法确认完整'],source:'dom'};
 test('repeat collection merges same note and refreshes signed urls without duplicating images',()=>{
  const notes=mergeNotes([note],{...note,images:['https://p6.douyinpic.com/a.jpg?sign=new','https://p3.douyinpic.com/b.png']});
  assert.equal(notes.length,1);assert.deepEqual(notes[0].images,['https://p6.douyinpic.com/a.jpg?sign=new','https://p3.douyinpic.com/b.png']);assert.equal(note.images.length,1);
 });
 test('complete structured recapture restores original order',()=>{
  const notes=mergeNotes([{...note,images:['https://p3.douyinpic.com/b.png',...note.images]}],{...note,images:[...note.images,'https://p3.douyinpic.com/b.png'],source:'structured',expectedImages:2,warnings:[]});
  assert.deepEqual(notes[0].images,[...note.images,'https://p3.douyinpic.com/b.png']);assert.deepEqual(notes[0].warnings,[]);
 });
 test('partial recapture does not downgrade an already complete structured note',()=>{
  const complete={...note,images:[...note.images,'https://p3.douyinpic.com/b.png'],source:'structured',expectedImages:2,warnings:[]};
  const result=mergeNotes([complete],{...note,images:['https://p3.douyinpic.com/b.png?fresh=1']})[0];
  assert.equal(result.expectedImages,2);assert.equal(result.source,'structured');assert.deepEqual(result.warnings,[]);
 });
 test('names remain Windows safe and do not create paths',()=>{
  for(const name of ['../CON','NUL','..','a/b:c?d*e|f"g<h>','末尾. ','AUX.txt']){
   const result=safeFilename(name);assert.ok(result.length);assert.ok(!/[\\/:*?"<>|]/.test(result));assert.ok(!/[. ]$/.test(result));assert.ok(!/^(CON|NUL|AUX)(\.|$)/i.test(result));
  }
 });
 test('ZIP extracts with correct UTF8 names, CRC and bytes in Python independent reader',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'collector-zip-'));
  try{
   const zip=createZip([{name:'早餐/正文.txt',data:'烧烤去哪学？\n第二行'},{name:'早餐/1.png',data:new Uint8Array([137,80,78,71,13,10,26,10])}]);
   writeFileSync(join(tmp,'test.zip'),zip);
   const p=spawnSync('python',['-c',"import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert z.read('早餐/正文.txt').decode() == '烧烤去哪学？\\n第二行'; assert z.read('早餐/1.png') == bytes([137,80,78,71,13,10,26,10]); print('ok')",join(tmp,'test.zip')],{encoding:'utf8'});
   assert.equal(p.status,0,p.stderr);assert.match(p.stdout,/ok/);
  }finally{rmSync(tmp,{recursive:true,force:true});}
 });
 test('unsafe zip paths and duplicate names are rejected',()=>{
  for(const name of ['../file','/file','a/../file','a\\b'])assert.throws(()=>createZip([{name,data:'x'}]));
  assert.throws(()=>createZip([{name:'x',data:'a'},{name:'x',data:'b'}]));
 });
 test('real HTTP image download exports original bytes and reports HTML/404/private urls',async()=>{
  const {createServer}=await import('node:http');
  const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
  const server=createServer((req,res)=>{
   if(req.url==='/image'){res.writeHead(200,{'content-type':'image/png'});res.end(png);}
   else if(req.url==='/bad'){res.writeHead(200,{'content-type':'image/png'});res.end('<html>blocked</html>');}
   else{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  try{
   // Real fetch; translate only the external image destination into this controlled HTTP service.
   const fetcher=(url,options)=>fetch(base+new URL(url).pathname,options);
   const result=await buildExport([{...note,images:['https://p3.douyinpic.com/image','https://p3.douyinpic.com/bad','https://p3.douyinpic.com/missing','https://evil.example/private']}],{fetcher});
   assert.equal(result.downloaded,1);assert.equal(result.failures.length,3);assert.equal(result.complete,false);
   const entry=result.parts.flatMap(p=>p.entries).find(e=>e.name.endsWith('.png'));assert.deepEqual(Buffer.from(entry.data),png);
   assert.ok(result.parts[0].entries.some(e=>e.name==='导出报告.json'));
  }finally{server.close();}
 });
 test('size cap rejects oversized images and archive splitting retains every file',async()=>{
  const png=new Uint8Array(1500);png.set([137,80,78,71,13,10,26,10]);
  const fetcher=async()=>new Response(png,{headers:{'content-type':'image/png'}});
  const tooBig=await buildExport([note],{fetcher,maxImageBytes:1000});assert.equal(tooBig.downloaded,0);assert.equal(tooBig.failures.length,1);
  const notes=[{...note,images:['https://p3.douyinpic.com/a.png','https://p3.douyinpic.com/b.png','https://p3.douyinpic.com/c.png']}];
  const result=await buildExport(notes,{fetcher,partBytes:6000});assert.equal(result.downloaded,3);assert.ok(result.parts.length>=2);
  const images=result.parts.flatMap(p=>p.entries).filter(e=>e.name.endsWith('.png'));assert.equal(images.length,3);
  for(const part of result.parts)assert.ok(createZip(part.entries).byteLength<=6000);
 });
 test('total limit reports all omitted images rather than silently dropping them',async()=>{
  const png=new Uint8Array(1000);png.set([137,80,78,71,13,10,26,10]);
  const result=await buildExport([{...note,images:['https://p3.douyinpic.com/a.png','https://p3.douyinpic.com/b.png','https://p3.douyinpic.com/c.png']}],{fetcher:async()=>new Response(png,{headers:{'content-type':'image/png'}}),maxTotalBytes:1500});
  assert.equal(result.downloaded,1);assert.equal(result.failures.length,2);assert.equal(result.complete,false);
 });
}
if([storeFile,zipFile,exportFile].every(f=>existsSync(f))){
 const {mergeNotes}=await import(storeFile);const {buildExport}=await import(exportFile);
 const a='https://p3.douyinpic.com/a.png',b='https://p3.douyinpic.com/b.png';
 const note={id:'7365500792104684834',url:'https://www.douyin.com/note/7365500792104684834',title:'早餐',text:'参考',author:'作者',images:[a],source:'structured',expectedImages:1,warnings:[]};
 test('new images from partial recapture invalidate prior completeness',()=>{
  const merged=mergeNotes([note],{...note,images:[b],source:'dom',expectedImages:null,warnings:['页面顺序待确认']})[0];
  assert.equal(merged.images.length,2);assert.ok(merged.warnings.length>0);assert.equal(merged.expectedImages,null);
 });
 test('export independently refuses to label mismatched image counts complete',async()=>{
  const png=new Uint8Array([137,80,78,71,13,10,26,10]);
  const result=await buildExport([{...note,images:[a,b],expectedImages:1}],{fetcher:async()=>new Response(png,{headers:{'content-type':'image/png'}})});
  assert.equal(result.downloaded,2);assert.equal(result.complete,false);assert.ok(result.warnings.length>0);
 });
}
