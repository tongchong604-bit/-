import {chromeCall,loadNotes} from './store.js';
const capture=document.getElementById('capture'),status=document.getElementById('status');
function show(text,error){status.textContent=text;status.className='status'+(error?' error':'');}
document.getElementById('library').onclick=()=>chrome.tabs.create({url:chrome.runtime.getURL('library.html')});
capture.onclick=async()=>{
 capture.disabled=true;show('正在读取当前笔记…');
 try{
  const tabs=await chromeCall(chrome.tabs.query.bind(chrome.tabs),{active:true,currentWindow:true});const tab=tabs[0];
  if(!tab || !tab.id || !/^https:\/\/(www\.)?douyin\.com\//.test(tab.url || ''))throw Error('请先打开具体的抖音图文页面，再点采集。');
  await chromeCall(chrome.scripting.executeScript.bind(chrome.scripting),{target:{tabId:tab.id},files:['collector.js']});
  const results=await chromeCall(chrome.scripting.executeScript.bind(chrome.scripting),{target:{tabId:tab.id},func:()=>{
   try{return {ok:true,note:globalThis.DouyinCollector.extractNote(document,location.href)};}catch(error){return {ok:false,error:error.message};}
  }});
  const result=results && results[0] && results[0].result;if(!result || !result.ok)throw Error((result && result.error) || '页面读取失败，请重新打开笔记。');
  const saved=await chromeCall(chrome.runtime.sendMessage.bind(chrome.runtime),{type:'save-note',note:result.note});if(!saved || !saved.ok)throw Error((saved && saved.error)||'保存失败。');
  show('已保存 '+result.note.images.length+' 张图片地址；共 '+saved.noteCount+' 篇。\n图片尚未下载，请及时进入素材库导出。'+(result.note.warnings.length?'\n提示：'+result.note.warnings.join('\n'):''));
 }catch(error){show(error.message,true);}finally{capture.disabled=false;}
};
loadNotes().then(notes=>show('已采集 '+notes.length+' 篇。')).catch(error=>show(error.message,true));

document.getElementById('pick').onclick=async()=>{
 const button=document.getElementById('pick');button.disabled=true;
 try{
  const tabs=await chromeCall(chrome.tabs.query.bind(chrome.tabs),{active:true,currentWindow:true});const tab=tabs[0];
  if(!tab || !tab.id || !/^https:\/\/(www\.)?douyin\.com\//.test(tab.url || ''))throw Error('请先打开具体的抖音图文页面。');
  await chromeCall(chrome.scripting.executeScript.bind(chrome.scripting),{target:{tabId:tab.id},files:['collector.js','picker.js']});
  window.close();
 }catch(error){show(error.message,true);button.disabled=false;}
};

document.getElementById('diagnose').onclick=async()=>{
 const button=document.getElementById('diagnose');button.disabled=true;show('正在生成页面布局诊断；不读取密码或 Cookie…');
 try{
  const tabs=await chromeCall(chrome.tabs.query.bind(chrome.tabs),{active:true,currentWindow:true});const tab=tabs[0];
  if(!tab || !tab.id || !/^https:\/\/(www\.)?douyin\.com\//.test(tab.url || ''))throw Error('请先打开抖音账号主页或图文页面。');
  await chromeCall(chrome.scripting.executeScript.bind(chrome.scripting),{target:{tabId:tab.id},files:['diagnostics.js']});
  const results=await chromeCall(chrome.scripting.executeScript.bind(chrome.scripting),{target:{tabId:tab.id},func:()=>globalThis.DouyinDiagnostics.collect(document)});
  const data=results && results[0] && results[0].result;if(!data)throw Error('未读取到页面结构。');
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  await chromeCall(chrome.downloads.download.bind(chrome.downloads),{url,filename:'douyin-page-diagnostics.json',saveAs:true});
  setTimeout(()=>URL.revokeObjectURL(url),60000);show('已交给浏览器保存 douyin-page-diagnostics.json。请把文件发给我，不需要账号密码。');
 }catch(error){show(error.message,true);}finally{button.disabled=false;}
};
