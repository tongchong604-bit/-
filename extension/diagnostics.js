(function(root){
 'use strict';
 function cleanUrl(value,base,media){
  try{const url=new URL(value,base);if(url.protocol!=='https:' || url.username || url.password)return null;
   if(media){
    if(!['douyinpic.com','byteimg.com','ibytedtos.com','pstatp.com'].some(domain=>url.hostname===domain || url.hostname.endsWith('.'+domain)))return null;
    return url.origin+'/[image-path-omitted]';
   }
   if(!['www.douyin.com','douyin.com'].includes(url.hostname))return null;
   if(/^\/(note|video)\/\d{6,22}\/?$/.test(url.pathname) || /^\/user\/[A-Za-z0-9_.-]+\/?$/.test(url.pathname))return url.origin+url.pathname;
   const modal=url.searchParams.get('modal_id');if(modal && /^\d{6,22}$/.test(modal))return url.origin+'/note/'+modal;
   return url.pathname==='/'?url.origin+'/':null;
  }catch{return null;}
 }
 function excluded(el,win){
  for(let node=el;node && node.nodeType===1;node=node.parentElement){
   if(node.tagName==='FORM' || node.hidden || node.getAttribute('aria-hidden')==='true')return true;
   const marker=[node.id,typeof node.className==='string'?node.className:'',node.getAttribute('data-e2e') || ''].join(' ');
   if(/login|sign[-_]?in|passport|captcha|qrcode|qr[-_]?code|verif|challenge|oauth|authentication/i.test(marker))return true;
   const style=win.getComputedStyle(node);if(style.display==='none' || style.visibility==='hidden')return true;
   if(node.getAttribute('role')==='dialog' && node.querySelector('input[type="password"]'))return true;
  }
  return false;
 }
 function collect(doc){
  const win=doc.defaultView,viewport={width:win.innerWidth,height:win.innerHeight};
  const pool=new Set(Array.from(doc.querySelectorAll('img,video,canvas,[data-e2e],a[href*="/note/"],a[href*="/video/"],a[href*="/user/"]')).slice(0,700));
  if(doc.elementsFromPoint)for(const x of [.25,.5,.75])for(const y of [.2,.5,.8])for(const el of doc.elementsFromPoint(viewport.width*x,viewport.height*y).slice(0,6))pool.add(el);
  function describe(el){
   const attrs={};for(const key of ['data-e2e','role','data-aweme-id','data-id']){const value=el.getAttribute(key);if(value && (!['data-id','data-aweme-id'].includes(key) || /^\d{6,22}$/.test(value)))attrs[key]=value.slice(0,150);}
   return {tag:el.tagName,className:typeof el.className==='string'?el.className.slice(0,250):'',attributes:attrs};
  }
  const elements=[];
  for(const el of pool){
   if(excluded(el,win))continue;
   const rect=el.getBoundingClientRect(),style=win.getComputedStyle(el);const item=describe(el);
   item.rect={x:Math.round(rect.left),y:Math.round(rect.top),width:Math.round(rect.width),height:Math.round(rect.height)};
   item.visible=style.display!=='none' && style.visibility!=='hidden' && rect.width>0 && rect.height>0 && rect.right>0 && rect.bottom>0 && rect.left<viewport.width && rect.top<viewport.height;
   const media=el.tagName==='IMG'?(el.currentSrc || el.getAttribute('src') || el.getAttribute('data-src')):null;
   if(media)item.image=cleanUrl(media,doc.location.href,true);
   if(el.tagName==='A')item.link=cleanUrl(el.getAttribute('href'),doc.location.href);
   const match=(style.backgroundImage || '').match(/url\(["']?([^"')]+)["']?\)/);if(match)item.background=cleanUrl(match[1],doc.location.href,true);
   item.parents=[];let parent=el.parentElement;for(let i=0;parent && i<4;i++,parent=parent.parentElement)item.parents.push(describe(parent));
   elements.push(item);if(elements.length>=800)break;
  }
  return {version:1,url:cleanUrl(doc.location.href),title:doc.title.slice(0,200),viewport,counts:{images:doc.images.length,videos:doc.querySelectorAll('video').length,canvases:doc.querySelectorAll('canvas').length},elements};
 }
 root.DouyinDiagnostics={collect};
})(globalThis);
