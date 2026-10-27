import './collector.js';
const encoder = new TextEncoder();
export function imageKey(url) {
  const u = new URL(url); return u.pathname.replace(/~[^/]*$/, '');
}
export function mergeNotes(existing, incoming) {
  if (!incoming || !/^\d{6,22}$/.test(incoming.id) || !Array.isArray(incoming.images) || !incoming.images.length) throw Error('采集数据无效。');
  const images = incoming.images.map(globalThis.DouyinCollector.safeMediaUrl);
  if (images.some(url => !url) || images.length > 100) throw Error('图片地址无效或数量过多。');
  const notes = existing.slice(); const index = notes.findIndex(n => n.id === incoming.id); const old = index >= 0 ? notes[index] : null;
  const complete = incoming.source === 'structured' && incoming.expectedImages === images.length;
  const priorComplete = old && old.source === 'structured' && old.expectedImages === old.images.length;
  const latest = new Map(images.map(url => [imageKey(url), url]));
  const merged = [];
  const order = complete ? images : (old ? old.images.concat(images) : images);
  for (const url of order) {
    const fresh = latest.get(imageKey(url)) || url;
    if (!merged.some(value => imageKey(value) === imageKey(fresh))) merged.push(fresh);
  }
  const value = Object.assign({}, old || {}, incoming, { images: merged, text: incoming.text || (old && old.text) || '', author: incoming.author || (old && old.author) || '' });
  if (priorComplete && !complete) {
    const oldKeys = new Set(old.images.map(imageKey));
    if (images.every(url => oldKeys.has(imageKey(url)))) { value.source = old.source; value.expectedImages = old.expectedImages; value.warnings = old.warnings.slice(); }
    else { value.source = 'dom'; value.expectedImages = null; value.warnings = Array.from(new Set((incoming.warnings || []).concat('补充采集发现新图片，完整张数和顺序需要重新核对。'))); }
  }
  if (index < 0) notes.push(value); else notes[index] = value;
  if (notes.length > 200 || encoder.encode(JSON.stringify(notes)).length > 4 * 1024 * 1024) throw Error('本地记录已满，请先导出并删除部分笔记。');
  return notes;
}
export function chromeCall(fn, ...args) {
  return new Promise((resolve, reject) => fn(...args, result => {
    const error = chrome.runtime.lastError;
    if (error) reject(Error(error.message)); else resolve(result);
  }));
}
export async function loadNotes() { const result = await chromeCall(chrome.storage.local.get.bind(chrome.storage.local), 'notes'); return Array.isArray(result.notes) ? result.notes : []; }
export async function saveNotes(notes) { await chromeCall(chrome.storage.local.set.bind(chrome.storage.local), {notes}); }
