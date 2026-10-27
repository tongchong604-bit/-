(function (root) {
  'use strict';
  const imageDomains = ['douyinpic.com', 'byteimg.com', 'ibytedtos.com', 'pstatp.com'];
  function safeMediaUrl(value) {
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
      if (!imageDomains.some(domain => u.hostname === domain || u.hostname.endsWith('.' + domain))) return null;
      return u.href;
    } catch (_) { return null; }
  }
  function noteId(pageUrl) {
    const u = new URL(pageUrl);
    if (u.protocol !== 'https:' || !['www.douyin.com', 'douyin.com'].includes(u.hostname)) throw Error('请先打开抖音图文笔记页面。');
    const match = u.pathname.match(/^\/note\/(\d{6,22})\/?$/);
    const modal = u.searchParams.get('modal_id');
    if (match) return match[1];
    if (modal && /^\d{6,22}$/.test(modal)) return modal;
    throw Error('未识别到图文链接，请进入具体图文笔记，不要停留在首页或视频页。');
  }
  function imageUrl(item) {
    if (typeof item === 'string') return safeMediaUrl(item);
    if (!item || typeof item !== 'object') return null;
    const values = [];
    for (const key of ['origin_image', 'original_image', 'originImage']) {
      if (item[key]) values.push(...[].concat(item[key].url_list || [], item[key].url || []));
    }
    values.push(...[].concat(item.url_list || [], item.urlList || [], item.url || []));
    for (const key of ['image_url', 'display_image', 'displayImage']) {
      if (item[key]) values.push(...[].concat(item[key].url_list || [], item[key].url || []));
    }
    for (const value of values) { const url = safeMediaUrl(value); if (url) return url; }
    return null;
  }
  function findStructured(data, id) {
    const stack = [data]; let scanned = 0; let best = null;
    while (stack.length && ++scanned <= 30000) {
      const obj = stack.pop();
      if (!obj || typeof obj !== 'object') continue;
      const objId = String(obj.aweme_id || obj.awemeId || obj.item_id || '');
      if (objId === id) {
        const items = Array.isArray(obj.images) ? obj.images : (obj.image_post_info && obj.image_post_info.images);
        if (Array.isArray(items) && items.length && items.length <= 100) {
          const images = Array.from(new Set(items.map(imageUrl).filter(Boolean)));
          if (images.length && (!best || images.length > best.images.length)) {
            best = { text: String(obj.desc || obj.description || '').slice(0, 40000), author: String((obj.author || {}).nickname || '').slice(0, 200), images, expectedImages: items.length,
              warnings: images.length < items.length ? ['部分图片地址无法读取，请翻图后重新采集或检查结果。'] : [] };
          }
        }
      }
      for (const key of Object.keys(obj)) { if (obj[key] && typeof obj[key] === 'object') stack.push(obj[key]); }
    }
    return best;
  }
  function parseData(text) {
    try { return JSON.parse(text); } catch (_) {
      try { return JSON.parse(decodeURIComponent(text)); } catch (_) { return null; }
    }
  }
  function textFrom(parent, selectors) {
    for (const selector of selectors) { const el = parent.querySelector(selector); if (el && el.textContent.trim()) return el.textContent.trim(); }
    return '';
  }
  function accessBlocked(doc) {
    const selectors = '[data-e2e="verify-dialog"],[data-e2e="login-dialog"],[role="dialog"],[id*="captcha"],[class*="captcha"]';
    for (const el of doc.querySelectorAll(selectors)) {
      if (!/请.{0,12}(验证|登录)|安全验证|验证码|扫码登录|Please wait/i.test(el.textContent)) continue;
      let visible = true;
      for (let parent = el; parent && parent.nodeType === 1; parent = parent.parentElement) {
        if (parent.hidden || parent.getAttribute('aria-hidden') === 'true') { visible = false; break; }
        const style = doc.defaultView && doc.defaultView.getComputedStyle(parent);
        if (style && (style.display === 'none' || style.visibility === 'hidden')) { visible = false; break; }
      }
      if (visible) return true;
    }
    return false;
  }
  function extractNote(doc, pageUrl) {
    const id = noteId(pageUrl);
    if (accessBlocked(doc)) throw Error('页面有登录或验证提示，请在浏览器正常完成后再采集。');
    let result = null;
    for (const script of doc.querySelectorAll('script#RENDER_DATA,script#__UNIVERSAL_DATA_FOR_REHYDRATION__,script[type="application/json"]')) {
      const text = script.textContent;
      if (!text || text.length > 5 * 1024 * 1024) continue;
      const found = findStructured(parseData(text), id);
      if (found && (!result || found.images.length > result.images.length)) result = found;
    }
    let source = 'structured';
    if (!result) {
      source = 'dom';
      const roots = Array.from(doc.querySelectorAll('[data-e2e="note-detail"],[data-e2e="aweme-detail"],[data-e2e="video-detail"],[data-e2e="detail-container"]'));
      const matched = roots.filter(el => String(el.getAttribute('data-aweme-id') || el.getAttribute('data-id') || '') === id);
      const candidates = matched.length ? matched : roots.filter(el => !el.hasAttribute('data-aweme-id') && !el.hasAttribute('data-id'));
      const parent = candidates.length === 1 ? candidates[0] : null;
      if (!parent) throw Error('当前布局未能自动识别。若图片已显示，请使用“点选当前大图”，不必重复登录。');
      const imageContainers = Array.from(parent.querySelectorAll('[data-e2e="note-images"],[data-e2e="note-content"],[data-e2e="image-list"],[data-e2e="note-image"]'));
      const images = [];
      for (const container of imageContainers) for (const el of container.querySelectorAll('img')) {
        if (el.closest('[data-e2e="user-avatar"],[data-e2e="recommend-list"],.avatar')) continue;
        let foreign = false;
        for (let ancestor = el; ancestor && ancestor !== parent; ancestor = ancestor.parentElement) {
          const owner = ancestor.getAttribute('data-aweme-id') || ancestor.getAttribute('data-id');
          if (owner && /^\d{6,22}$/.test(owner) && owner !== id) { foreign = true; break; }
        }
        if (foreign) continue;
        const candidates = [el.getAttribute('data-original'), el.getAttribute('data-src'), el.currentSrc, el.getAttribute('src')];
        for (const value of candidates) {
          const url = safeMediaUrl(value);
          if (url) { if (!images.includes(url)) images.push(url); break; }
        }
      }
      if (!images.length || images.length > 100) throw Error('未找到可确认的图文配图。请先翻看整组图片后重试；此版本可能尚不支持该页面布局。');
      const text = textFrom(parent, ['[data-e2e="video-desc"]', '[data-e2e="note-desc"]', '[data-e2e="aweme-desc"]']).slice(0, 40000);
      const author = textFrom(parent, ['[data-e2e="user-title"]', '[data-e2e="user-name"]']).slice(0, 200);
      result = { text, author, images, expectedImages: null, warnings: ['使用页面后备采集，无法确认完整张数及原始顺序。请翻完图片再次采集并检查结果。'] };
    }
    if (!result.text) result.warnings.push('没有读到正文，请核对原笔记并补充说明。');
    return Object.assign(result, { id, url: 'https://www.douyin.com/note/' + id, title: result.text.split('\n')[0].slice(0, 80) || '抖音图文 ' + id, source, capturedAt: new Date().toISOString() });
  }
  function extractSelected(doc, pageUrl, selected) {
    const id = noteId(pageUrl);
    if (accessBlocked(doc)) throw Error('页面有登录或验证提示，请正常完成后再采集。');
    if (!selected || selected.ownerDocument !== doc || selected.tagName === 'VIDEO') throw Error('请点选图文中的图片。');
    for (let node = selected; node && node.nodeType === 1; node = node.parentElement) {
      const owner = node.getAttribute('data-aweme-id') || node.getAttribute('data-id');
      if (owner && /^\d{6,22}$/.test(owner) && owner !== id) throw Error('这张图片属于另一篇内容，请选择当前笔记的大图。');
    }
    const candidates = [];
    if (selected.tagName === 'IMG') candidates.push(selected.getAttribute('data-original'), selected.currentSrc, selected.getAttribute('src'), selected.getAttribute('data-src'));
    const style = doc.defaultView && doc.defaultView.getComputedStyle(selected);
    const background = style && style.backgroundImage || '';
    const pattern = /url\(["']?([^"')]+)["']?\)/g; let match;
    while ((match = pattern.exec(background))) candidates.push(match[1]);
    const url = candidates.map(safeMediaUrl).find(Boolean);
    if (!url) throw Error('这里没有可直接读取的图片地址，请点击图片本身；若仍失败，该图可能使用了画布或特殊格式。');
    const scope = selected.closest('[data-e2e="note-detail"],[data-e2e="aweme-detail"],[role="dialog"],main') || selected.parentElement || selected;
    const text = textFrom(scope, ['[data-e2e="video-desc"]','[data-e2e="note-desc"]']).slice(0,40000);
    const author = textFrom(scope, ['[data-e2e="user-title"]','[data-e2e="user-name"]']).slice(0,200);
    return {id,url:'https://www.douyin.com/note/'+id,title:text.split('\n')[0].slice(0,80) || '手动采集 '+id,text,author,images:[url],source:'manual',expectedImages:null,
      warnings:['手动采集当前一张图，未确认整篇张数和顺序。请逐张翻图并重复点选；正文也请核对。'],capturedAt:new Date().toISOString()};
  }
  root.DouyinCollector = { extractNote, extractSelected, safeMediaUrl, imageDomains };
})(globalThis);
