import {loadNotes,saveNotes,mergeNotes} from './store.js';
let pending=Promise.resolve();
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id || !message || !['save-note','remove-note','clear-notes'].includes(message.type))return;
  const operation=pending.then(async()=>{
    const notes=await loadNotes();let next;
    if(message.type==='save-note')next=mergeNotes(notes,message.note);
    if(message.type==='remove-note')next=notes.filter(note=>note.id!==message.id);
    if(message.type==='clear-notes')next=[];
    await saveNotes(next);return {ok:true,noteCount:next.length};
  });
  pending=operation.catch(()=>{});
  operation.then(respond,error=>respond({ok:false,error:error.message}));
  return true;
});
