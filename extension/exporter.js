import './collector.js';
import {zipSize} from './zip.js';
const encoder = new TextEncoder();
export function safeFilename(value) {
  let name = String(value || '').normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^[. ]+|[. ]+$/g, '');
  if (!name || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(name)) name = '图文_' + (name || '未命名');
  return Array.from(name).slice(0, 65).join('').replace(/[. ]+$/g, '') || '图文';
}
function imageType(bytes) {
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) return 'png';
  if (bytes.length >= 3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'jpg';
  const ascii = (a,b)=>String.fromCharCode(...bytes.slice(a,b));
  if (bytes.length >= 12 && ascii(0,4)==='RIFF' && ascii(8,12)==='WEBP') return 'webp';
  if (bytes.length >= 6 && ['GIF87a','GIF89a'].includes(ascii(0,6))) return 'gif';
  if (bytes.length >= 16 && ascii(4,8)==='ftyp' && /avif|avis/.test(ascii(8,Math.min(64,bytes.length)))) return 'avif';
  throw Error('响应不是可识别的图片，可能是登录或拦截页面。');
}
async function fetchImage(url, options) {
  const safe = globalThis.DouyinCollector.safeMediaUrl(url); if (!safe) throw Error('图片域名不在允许范围。');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),options.timeoutMs || 20000);
  try {
    const res=await options.fetcher(safe,{credentials:'omit',redirect:'error',signal:controller.signal});
    if (!res.ok) throw Error('图片请求失败，HTTP '+res.status);
    if (!/^image\//i.test(res.headers.get('content-type') || '')) throw Error('返回的不是图片类型。');
    if (Number(res.headers.get('content-length')) > options.maxImageBytes) throw Error('单张图片超过大小限制。');
    const chunks=[];let size=0;
    if (res.body && res.body.getReader) {
      const reader=res.body.getReader();
      try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>options.maxImageBytes){await reader.cancel();throw Error('单张图片超过大小限制。');}chunks.push(value);} }
      finally { reader.releaseLock(); }
    } else { const value=new Uint8Array(await res.arrayBuffer());size=value.length;if(size>options.maxImageBytes)throw Error('单张图片超过大小限制。');chunks.push(value); }
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    return {bytes,extension:imageType(bytes)};
  } finally {clearTimeout(timer);}
}
export async function buildExport(notes, supplied) {
  const options=Object.assign({fetcher:(url,init)=>fetch(url,init),partBytes:20*1024*1024,maxImageBytes:15*1024*1024,maxTotalBytes:100*1024*1024},supplied || {});
  if (!Array.isArray(notes) || !notes.length || notes.length > 200) throw Error('请先选择要导出的笔记。');
  const entries=[],failures=[],warnings=[];let downloaded=0,total=0,attempted=0;
  const count=notes.reduce((n,v)=>n+v.images.length,0);
  for(const note of notes){
    const folder=note.id+'-'+safeFilename(note.title);warnings.push(...(note.warnings || []).map(message=>({id:note.id,message})));
    if (note.source !== 'structured' || note.expectedImages !== note.images.length) warnings.push({id:note.id,message:'当前图片张数或顺序未经完整结构数据确认，请核对原笔记。'});
    const text='标题：'+note.title+'\n作者：'+(note.author || '未读取')+'\n来源：'+note.url+'\n采集时间：'+(note.capturedAt || '')+'\n\n'+note.text+'\n\n采集提示：\n'+(note.warnings || []).join('\n');
    entries.push({name:folder+'/正文.txt',data:encoder.encode(text)});
    for(let i=0;i<note.images.length;i++){
      const url=note.images[i];
      try {
        if(total>=options.maxTotalBytes)throw Error('本次导出已达到总大小限制，请减少选择后重试。');
        const image=await fetchImage(url,options);
        if(total+image.bytes.length>options.maxTotalBytes)throw Error('本次导出已达到总大小限制，请减少选择后重试。');
        entries.push({name:folder+'/'+String(i+1).padStart(2,'0')+'.'+image.extension,data:image.bytes});total+=image.bytes.length;downloaded++;
      } catch(error){failures.push({id:note.id,index:i+1,url,message:error.name==='AbortError'?'图片请求超时，请重试。':error.message});}
      attempted++;if(options.onProgress)options.onProgress({attempted,count,downloaded});
    }
  }
  const report={noteCount:notes.length,requested:count,downloaded,complete:failures.length===0 && warnings.length===0,failures,warnings};
  const common=[{name:'参考目录.json',data:encoder.encode(JSON.stringify({version:1,notes},null,2))},{name:'导出报告.json',data:encoder.encode(JSON.stringify(report,null,2))}];
  const parts=[];let current=common.slice();
  if(zipSize(current)>options.partBytes)throw Error('参考目录过大，请减少选择后重试。');
  for(const entry of entries){
    if(zipSize(common.concat(entry))>options.partBytes)throw Error('单个文件无法放入分包，请减少笔记数量后重试。');
    if(zipSize(current.concat(entry))>options.partBytes){parts.push({entries:current});current=common.slice();}
    current.push(entry);
  }
  if(current.length>common.length || !parts.length)parts.push({entries:current});
  return Object.assign(report,{parts});
}
