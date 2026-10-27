(function(){
 'use strict';
 if(globalThis.__douyinPickerCleanup)globalThis.__douyinPickerCleanup();
 const host=document.createElement('div');host.id='douyin-reference-picker';const shadow=host.attachShadow({mode:'closed'});
 host.style.cssText='position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
 const bar=document.createElement('div');bar.style.cssText='position:fixed;left:50%;top:18px;transform:translateX(-50%);max-width:80vw;padding:14px 22px;background:#fff8ee;color:#493323;font:16px/1.6 "Microsoft YaHei",sans-serif;border:2px solid #b7522d;border-radius:10px;box-shadow:0 4px 24px #0004;';
 bar.textContent='请点击要采集的那张大图。一次采集一张，按 Esc 退出。';
 const border=document.createElement('div');border.style.cssText='position:fixed;border:3px solid #f98431;border-radius:3px;display:none;pointer-events:none;';shadow.append(bar,border);document.documentElement.append(host);
 let saving=false,timer;
 function cleanup(){clearTimeout(timer);document.removeEventListener('click',click,true);document.removeEventListener('mousemove',move,true);document.removeEventListener('keydown',key,true);host.remove();if(globalThis.__douyinPickerCleanup===cleanup)delete globalThis.__douyinPickerCleanup;}
 globalThis.__douyinPickerCleanup=cleanup;
 function key(event){if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cleanup();}}
 function candidate(x,y){
  let error;
  for(const element of document.elementsFromPoint(x,y)){
   if(element===host || element.tagName==='BODY' || element.tagName==='HTML')continue;
   try{return {element,note:globalThis.DouyinCollector.extractSelected(document,location.href,element)};}catch(e){error=e;}
  }
  return {error:error || Error('没有找到图片地址，请点图片本身。')};
 }
 function move(event){if(saving)return;const item=candidate(event.clientX,event.clientY);if(!item.element){border.style.display='none';return;}
  const rect=item.element.getBoundingClientRect();border.style.display='block';border.style.left=rect.left+'px';border.style.top=rect.top+'px';border.style.width=rect.width+'px';border.style.height=rect.height+'px';
 }
 function click(event){
  event.preventDefault();event.stopImmediatePropagation();if(saving)return;
  const item=candidate(event.clientX,event.clientY);if(!item.note){bar.textContent=item.error.message+' 按 Esc 退出。';return;}
  saving=true;bar.textContent='正在保存这张图片地址…';
  chrome.runtime.sendMessage({type:'save-note',note:item.note},reply=>{
   const error=chrome.runtime.lastError;
   if(error || !reply || !reply.ok){bar.textContent='保存失败：'+(error && error.message || reply && reply.error || '未知错误')+'；可再点一次，或按 Esc 退出。';saving=false;return;}
   bar.textContent='已保存这张图！翻到下一张后，再打开插件“点选当前大图”。最后到素材库导出 ZIP。';
   document.removeEventListener('click',click,true);document.removeEventListener('mousemove',move,true);border.style.display='none';timer=setTimeout(cleanup,4500);
  });
 }
 document.addEventListener('click',click,true);document.addEventListener('mousemove',move,true);document.addEventListener('keydown',key,true);
})();
