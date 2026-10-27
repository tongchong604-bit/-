const encoder = new TextEncoder();
const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) { let c = i; for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[i] = c >>> 0; }
function crc32(bytes) { let crc = 0xffffffff; for (const b of bytes) crc = table[(crc ^ b) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function dataBytes(data) { return typeof data === 'string' ? encoder.encode(data) : new Uint8Array(data); }
export function zipSize(entries) { return 22 + entries.reduce((n, e) => n + 76 + encoder.encode(e.name).length * 2 + dataBytes(e.data).length, 0); }
export function createZip(entries) {
  if (entries.length > 65535) throw Error('ZIP条目过多，请分批导出。');
  const total = zipSize(entries); if (total > 0xffffffff) throw Error('ZIP过大，请分批导出。');
  const output = new Uint8Array(total); const view = new DataView(output.buffer); let offset = 0; const directory = []; const names = new Set();
  for (const entry of entries) {
    if (!entry.name || entry.name.startsWith('/') || entry.name.includes('\\') || entry.name.split('/').some(v => v === '..' || !v) || names.has(entry.name)) throw Error('ZIP文件名不安全或重复。');
    names.add(entry.name); const name = encoder.encode(entry.name); const bytes = dataBytes(entry.data); if (name.length > 65535) throw Error('ZIP文件名过长。');
    const crc = crc32(bytes); const start = offset;
    view.setUint32(offset, 0x04034b50, true); view.setUint16(offset+4,20,true); view.setUint16(offset+6,0x0800,true);
    view.setUint16(offset+12,0x21,true);view.setUint32(offset+14,crc,true);view.setUint32(offset+18,bytes.length,true);view.setUint32(offset+22,bytes.length,true);view.setUint16(offset+26,name.length,true);
    output.set(name,offset+30);output.set(bytes,offset+30+name.length);offset+=30+name.length+bytes.length;
    directory.push({name,bytes:bytes.length,crc,start});
  }
  const centralStart=offset;
  for(const e of directory){
    view.setUint32(offset,0x02014b50,true);view.setUint16(offset+4,20,true);view.setUint16(offset+6,20,true);view.setUint16(offset+8,0x0800,true);view.setUint16(offset+14,0x21,true);
    view.setUint32(offset+16,e.crc,true);view.setUint32(offset+20,e.bytes,true);view.setUint32(offset+24,e.bytes,true);view.setUint16(offset+28,e.name.length,true);view.setUint32(offset+42,e.start,true);
    output.set(e.name,offset+46);offset+=46+e.name.length;
  }
  view.setUint32(offset,0x06054b50,true);view.setUint16(offset+8,directory.length,true);view.setUint16(offset+10,directory.length,true);view.setUint32(offset+12,offset-centralStart,true);view.setUint32(offset+16,centralStart,true);
  return output;
}
