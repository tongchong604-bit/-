import {loadNotes,chromeCall} from './store.js';
import {buildExport} from './exporter.js';
import {createZip} from './zip.js';
const list=document.getElementById('list'),status=document.getElementById('status'),downloads=document.getElementById('downloads');
let notes=[],busy=false,parts=[];const urls=[];
function show(text,error){status.textContent=text;status.className='status'+(error?' error':'');}
function element(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
function selected(){return Array.from(list.querySelectorAll('input:checked')).map(el=>el.value);}
function resetDownloads(){parts=[];downloads.replaceChildren();for(const url of urls)URL.revokeObjectURL(url);urls.length=0;}
async function mutate(message){const reply=await chromeCall(chrome.runtime.sendMessage.bind(chrome.runtime),message);if(!reply || !reply.ok)throw Error(reply && reply.error || '保存失败。');}
function setBusy(value){busy=value;for(const button of document.querySelectorAll('.toolbar button'))button.disabled=value;for(const input of list.querySelectorAll('input,button'))input.disabled=value;}
async function render(){
 const checked=new Set(selected());notes=await loadNotes();list.replaceChildren();document.getElementById('summary').textContent=notes.length+' 篇 · '+notes.reduce((n,note)=>n+note.images.length,0)+' 张图片地址';
 if(!notes.length){list.append(element('div','还没有参考图文。请先打开抖音笔记，点击浏览器右上角插件“采集当前图文”。','empty'));return;}
 for(const note of notes){
  const card=element('article'),row=element('div',undefined,'row'),label=element('label'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=note.id;checkbox.checked=checked.has(note.id);label.append(checkbox,element('span',note.title));
  const remove=element('button','删除','danger');remove.onclick=async()=>{try{await mutate({type:'remove-note',id:note.id});await render();}catch(error){show(error.message,true);}};row.append(label,remove);card.append(row,element('div',(note.author || '作者未读取')+' · '+note.images.length+' 张'+(note.expectedImages?' / 预期 '+note.expectedImages+' 张':' / 总张数未确认'),'muted'),element('div',note.text || '正文未读取','caption'));
  const link=element('a','打开原笔记');link.href='https://www.douyin.com/note/'+note.id;link.target='_blank';link.rel='noopener';card.append(link);for(const warning of note.warnings || [])card.append(element('div',warning,'warning'));list.append(card);
 }
}
document.getElementById('select-all').onclick=()=>{const inputs=Array.from(list.querySelectorAll('input'));const value=!inputs.every(input=>input.checked);for(const input of inputs)input.checked=value;};
document.getElementById('clear').onclick=async()=>{if(!confirm('确定清空本地采集记录？已下载到电脑的 ZIP 不受影响。'))return;try{await mutate({type:'clear-notes'});resetDownloads();await render();show('本地记录已清空。');}catch(error){show(error.message,true);}};
document.getElementById('export').onclick=async()=>{
 const ids=selected();if(!ids.length){show('请先勾选至少一篇图文。',true);return;}setBusy(true);resetDownloads();show('正在下载原图，请不要关闭此页…');
 try{
  const result=await buildExport(notes.filter(note=>ids.includes(note.id)),{onProgress:progress=>show('已处理 '+progress.attempted+' / '+progress.count+' 张；成功 '+progress.downloaded+' 张…')});
  parts=result.parts;const total=parts.length;
  for(let i=0;i<total;i++){
   const bytes=createZip(parts[i].entries),blob=new Blob([bytes],{type:'application/zip'}),url=URL.createObjectURL(blob);urls.push(url);
   const row=element('div',undefined,'part'),caption=element('span','参考包 '+(i+1)+' / '+total+' · '+(blob.size/1024/1024).toFixed(1)+' MB'),button=element('button','下载这一包','primary');
   button.onclick=async()=>{
    button.disabled=true;
    try{await chromeCall(chrome.downloads.download.bind(chrome.downloads),{url,filename:'douyin-references-'+new Date().toISOString().slice(0,10)+'-part-'+(i+1)+'.zip',saveAs:true});button.textContent='再次下载';show('已交给浏览器保存，请查看下载列表；其余分包也要分别下载。');}
    catch(error){show('下载未开始：'+error.message,true);}finally{button.disabled=false;}
   };
   row.append(caption,button);downloads.append(row);
  }
  let message='已生成 '+total+' 个分包，成功下载原图 '+result.downloaded+' / '+result.requested+' 张。请点击上方按钮保存每一包。';
  if(result.failures.length)message+='\n有 '+result.failures.length+' 张失败，详见包内“导出报告.json”；可重新打开原笔记采集后重试。';
  if(result.warnings.length)message+='\n部分笔记尚未确认完整性或顺序，请核对原笔记。';
  show(message,!result.complete);
 }catch(error){resetDownloads();show('导出未完成：'+error.message,true);}finally{setBusy(false);}
};
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local' && changes.notes && !busy)render().catch(error=>show(error.message,true));});
window.addEventListener('pagehide',()=>{for(const url of urls)URL.revokeObjectURL(url);});
render().catch(error=>show(error.message,true));
