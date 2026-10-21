import zlib from 'node:zlib';
import { crc32 } from '../../packages/core/src/safeZip.js';

export function zip(entries: Array<{ name: string; data: Buffer; deflate?: boolean; declaredSize?: number }>): Buffer {
  const local: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const compressed = entry.deflate ? zlib.deflateRawSync(entry.data) : entry.data;
    const lh = Buffer.alloc(30 + name.length), cd = Buffer.alloc(46 + name.length);
    lh.writeUInt32LE(0x04034b50); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(entry.deflate ? 8 : 0, 8);
    lh.writeUInt32LE(crc32(entry.data), 14); lh.writeUInt32LE(compressed.length, 18); lh.writeUInt32LE(entry.declaredSize ?? entry.data.length, 22); lh.writeUInt16LE(name.length, 26); name.copy(lh, 30);
    cd.writeUInt32LE(0x02014b50); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(entry.deflate ? 8 : 0, 10);
    cd.writeUInt32LE(crc32(entry.data), 16); cd.writeUInt32LE(compressed.length, 20); cd.writeUInt32LE(entry.declaredSize ?? entry.data.length, 24); cd.writeUInt16LE(name.length, 28); cd.writeUInt32LE(offset, 42); name.copy(cd, 46);
    local.push(lh, compressed); central.push(cd); offset += lh.length + compressed.length;
  }
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(central.reduce((n, b) => n + b.length, 0), 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}
