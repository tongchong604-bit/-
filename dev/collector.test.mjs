import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const script=new URL('../extension/collector.js',import.meta.url);
test('collector implementation exists',()=>assert.ok(existsSync(script),'采集逻辑尚未实现'));
if(existsSync(script)){
 const context=vm.createContext({URL});vm.runInContext(readFileSync(script,'utf8'),context);
 const {extractNote}=context.DouyinCollector;
 const url='https://www.douyin.com/note/7365500792104684834';
 const pic='https://p3-pc-sign.douyinpic.com/tos-cn-i-0813/food.jpeg?sign=abc';
 function doc(body){return new JSDOM(body,{url}).window.document;}
 function data(value){return `<script id="RENDER_DATA" type="application/json">${encodeURIComponent(JSON.stringify(value))}</script>`;}
 test('only matching structured note supplies images and caption, not recommended notes',()=>{
  const page=doc(data({items:[{aweme_id:'1111111111111111111',desc:'推荐广告',images:[{url_list:['https://p3.douyinpic.com/other.jpeg']}]},{aweme_id:'7365500792104684834',desc:'烧烤培训参考 #烧烤',author:{nickname:'作者甲'},images:[{url_list:[pic]},{url_list:['https://p3.douyinpic.com/b.webp']}]}]})+'<img src="https://p3.douyinpic.com/avatar.jpeg">');
  const note=extractNote(page,url);assert.equal(note.text,'烧烤培训参考 #烧烤');assert.equal(note.author,'作者甲');assert.deepEqual(Array.from(note.images),[pic,'https://p3.douyinpic.com/b.webp']);assert.equal(note.id,'7365500792104684834');assert.equal(note.source,'structured');
 });
 test('nested rehydration data is tied to requested note and preserves captions',()=>{
  const page=doc('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">'+JSON.stringify({scope:{aweme_detail:{aweme_id:'7365500792104684834',desc:'早餐\n怎么学',images:[{display_image:{url_list:[pic]}}]}}})+'</script>');
  assert.equal(extractNote(page,url).text,'早餐\n怎么学');
 });
 test('empty, verification, and unrelated pages never become successful collections',()=>{
  for(const body of ['<p>Please wait...</p>','<p>请完成验证</p>','<img src="'+pic+'">',data({aweme_id:'1111111111111111111',images:[{url_list:[pic]}]})])assert.throws(()=>extractNote(doc(body),url));
  assert.throws(()=>extractNote(doc(''),'https://evil.example/note/7365500792104684834'));
  assert.throws(()=>extractNote(doc(''),'https://www.douyin.com/video/7365500792104684834'));
 });
 test('scoped DOM collection excludes avatar and recommendations and reads lazy images',()=>{
  const page=doc(`<div data-e2e="note-detail" data-aweme-id="7365500792104684834"><div data-e2e="user-title">作者乙</div><div data-e2e="video-desc">学小吃</div><img class="avatar" src="https://p3.douyinpic.com/avatar.jpeg"><div data-e2e="note-images"><img data-src="${pic}"><img src="data:image/gif;base64,xx" data-original="https://p3.douyinpic.com/two.png"></div></div><aside><img src="https://p3.douyinpic.com/recommend.jpeg"></aside>`);
  const note=extractNote(page,url);assert.deepEqual(Array.from(note.images),[pic,'https://p3.douyinpic.com/two.png']);assert.equal(note.author,'作者乙');assert.equal(note.source,'dom');
 });
 test('DOM root with another note id is rejected instead of collecting wrong note',()=>{
  const page=doc(`<div data-e2e="note-detail" data-aweme-id="9999999999999999999"><div data-e2e="note-images"><img src="${pic}"></div></div>`);
  assert.throws(()=>extractNote(page,url));
 });
 test('untrusted image urls and unknown image counts fail or warn, never silently complete',()=>{
  for(const bad of ['https://evil.example/a.jpg','http://p3.douyinpic.com/a.jpg','https://p3.douyinpic.com.evil.example/a.jpg','https://user:pass@p3.douyinpic.com/a.jpg']){
   assert.throws(()=>extractNote(doc(data({aweme_id:'7365500792104684834',images:[{url_list:[bad]}]})),url));
  }
  const note=extractNote(doc(`<div data-e2e="note-detail"><div data-e2e="note-images"><img src="${pic}"></div></div>`),url);
  assert.equal(note.expectedImages,null);assert.ok(note.warnings.length>0);
 });
}
if(existsSync(script)){
 const context=vm.createContext({URL});vm.runInContext(readFileSync(script,'utf8'),context);const {extractNote}=context.DouyinCollector;
 const url='https://www.douyin.com/note/7365500792104684834',pic='https://p3.douyinpic.com/food.jpg';
 const payload='<script id="RENDER_DATA" type="application/json">'+JSON.stringify({aweme_id:'7365500792104684834',desc:'参考正文',images:[{url_list:[pic]}]})+'</script>';
 test('visible verification dialog blocks structured capture while hidden dialog does not',()=>{
  for(const style of ['', 'style="display:none"','hidden']){
   const doc=new JSDOM(`<div role="dialog" ${style}>请完成验证</div>${payload}`,{url}).window.document;
   if(!style)assert.throws(()=>extractNote(doc,url),/验证/);else assert.equal(extractNote(doc,url).images.length,1);
  }
 });
 test('structured explicit original is preferred over display preview',()=>{
  const data={aweme_id:'7365500792104684834',desc:'参考',images:[{display_image:{url_list:['https://p3.douyinpic.com/thumb.jpg']},origin_image:{url_list:[pic]}}]};
  const doc=new JSDOM('<script id="RENDER_DATA">'+JSON.stringify(data)+'</script>',{url}).window.document;
  assert.equal(extractNote(doc,url).images[0],pic);
 });
 test('nested foreign note cannot contribute DOM fallback images',()=>{
  const doc=new JSDOM(`<div data-e2e="note-detail" data-aweme-id="7365500792104684834"><div data-e2e="note-images"><img src="${pic}"></div><div data-aweme-id="9999999999999999999"><div data-e2e="image-list"><img src="https://p3.douyinpic.com/foreign.jpg"></div></div></div>`,{url}).window.document;
  assert.deepEqual(Array.from(extractNote(doc,url).images),[pic]);
 });
}
