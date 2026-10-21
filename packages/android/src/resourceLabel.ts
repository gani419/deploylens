import { decodeProtoFields as fields, protoBytes as bytes, protoString as string } from './protoManifest.js';

interface ResourceValue { id: number; name: string; value?: string; reference?: number; rank: number }
const uint = (items: ReturnType<typeof fields>, id: number) => items.find(f => f.id === id && typeof f.value === 'number')?.value as number | undefined;
const nestedId = (buffer?: Buffer) => buffer ? uint(fields(buffer), 1) ?? 0 : undefined;
const referenceId = (label: string) => /^@(?:0x)?[\da-f]{8}$/i.test(label) ? parseInt(label.replace(/^@(?:0x)?/, ''), 16)
  : /^\d+$/.test(label) ? Number(label) : undefined;

function resolve(values: ResourceValue[], label: string, depth = 0): string | undefined {
  if (depth > 8) return undefined;
  const id = referenceId(label);
  const name = label.replace(/^@(?:[^:]+:)?/, '');
  const value = values.filter(value => id !== undefined ? value.id === id : value.name === name).sort((a, b) => a.rank - b.rank)[0];
  if (value?.value) return value.value;
  if (value?.reference !== undefined) return resolve(values, `@0x${value.reference.toString(16).padStart(8, '0')}`, depth + 1);
  return undefined;
}

export const isResourceLabel = (label?: string): boolean => Boolean(label?.startsWith('@'));

/** Resolve labels from an AAPT2 ResourceTable (base/resources.pb in an AAB). */
export function resolveProtoLabel(buffer: Buffer, label: string): string | undefined {
  const values: ResourceValue[] = [];
  for (const pkgField of fields(buffer).filter(f => f.id === 2 && Buffer.isBuffer(f.value))) {
    const pkg = fields(pkgField.value as Buffer);
    const packageId = nestedId(bytes(pkg, 1));
    for (const typeField of pkg.filter(f => f.id === 3 && Buffer.isBuffer(f.value))) {
      const type = fields(typeField.value as Buffer);
      const typeId = nestedId(bytes(type, 1));
      for (const entryField of type.filter(f => f.id === 3 && Buffer.isBuffer(f.value))) {
        const entry = fields(entryField.value as Buffer);
        const entryId = nestedId(bytes(entry, 1));
        if (packageId === undefined || typeId === undefined || entryId === undefined) continue;
        for (const configField of entry.filter(f => f.id === 6 && Buffer.isBuffer(f.value))) {
          const config = fields(configField.value as Buffer);
          const valueBuffer = bytes(config, 2);
          const itemBuffer = valueBuffer ? bytes(fields(valueBuffer), 4) : undefined;
          if (!itemBuffer) continue;
          const item = fields(itemBuffer);
          const text = bytes(item, 2) ?? bytes(item, 3);
          const ref = bytes(item, 1);
          values.push({ id: (packageId * 0x1000000 + typeId * 0x10000 + entryId) >>> 0,
            name: `${string(type, 2)}/${string(entry, 2)}`, value: text ? string(fields(text), 1) : undefined,
            reference: ref ? uint(fields(ref), 2) : undefined, rank: bytes(config, 1)?.length ? 1 : 0 });
        }
      }
    }
  }
  return resolve(values, label);
}

/** Resolve common simple string/alias entries in an APK's binary resources.arsc. */
export function resolveArscLabel(buffer: Buffer, label: string): string | undefined {
  const values: ResourceValue[] = [];
  function chunk(offset: number) {
    if (offset + 8 > buffer.length) throw new Error('Truncated resource table');
    const type = buffer.readUInt16LE(offset), header = buffer.readUInt16LE(offset + 2), size = buffer.readUInt32LE(offset + 4);
    if (header < 8 || size < header || offset + size > buffer.length) throw new Error('Invalid resource chunk');
    return { type, header, size };
  }
  function pool(offset: number): string[] {
    const c = chunk(offset);
    if (c.type !== 1 || c.header < 28) return [];
    const count = buffer.readUInt32LE(offset + 8), utf8 = Boolean(buffer.readUInt32LE(offset + 16) & 256);
    if (count > 1000000 || c.header + count * 4 > c.size) throw new Error('Invalid string pool');
    const base = offset + buffer.readUInt32LE(offset + 20);
    return Array.from({ length: count }, (_, index) => {
      let current = base + buffer.readUInt32LE(offset + c.header + index * 4);
      const end = offset + c.size;
      const length = (wide: boolean) => {
        const width = wide ? 2 : 1;
        if (current + width > end) throw new Error('Truncated string');
        let n = wide ? buffer.readUInt16LE(current) : buffer[current]!; current += width;
        const mask = wide ? 0x8000 : 0x80;
        if (n & mask) {
          if (current + width > end) throw new Error('Truncated string length');
          n = (n & (mask - 1)) * (wide ? 65536 : 256) + (wide ? buffer.readUInt16LE(current) : buffer[current]!); current += width;
        }
        return n;
      };
      let byteLength;
      if (utf8) { length(false); byteLength = length(false); } else byteLength = length(true) * 2;
      if (current + byteLength > end) throw new Error('String exceeds resource chunk');
      return buffer.toString(utf8 ? 'utf8' : 'utf16le', current, current + byteLength);
    });
  }
  const table = chunk(0);
  if (table.type !== 2) return undefined;
  let strings: string[] = [];
  for (let offset = table.header; offset < table.size;) {
    const c = chunk(offset);
    if (c.type === 1) strings = pool(offset);
    if (c.type === 0x0200 && c.header >= 284) {
      const packageId = buffer.readUInt32LE(offset + 8);
      const typeNames = pool(offset + buffer.readUInt32LE(offset + 268));
      const keys = pool(offset + buffer.readUInt32LE(offset + 276));
      const typeIdOffset = c.header >= 288 ? buffer.readUInt32LE(offset + 284) : 0;
      for (let current = offset + c.header; current < offset + c.size;) {
        const t = chunk(current);
        if (t.type === 0x0201 && t.header >= 24) {
          const typeId = buffer[current + 8]!, flags = buffer[current + 9]!;
          const count = buffer.readUInt32LE(current + 12), dataStart = current + buffer.readUInt32LE(current + 16);
          const config = buffer.subarray(current + 24, current + t.header);
          const rank = config.some(byte => byte !== 0) ? 1 : 0;
          const width = flags & 1 ? 4 : flags & 2 ? 2 : 4;
          if (count > 1000000 || t.header + count * width > t.size) throw new Error('Invalid resource entries');
          for (let index = 0; index < count; index++) {
            const position = current + t.header + index * width;
            const entryIndex = flags & 1 ? buffer.readUInt16LE(position) : index;
            const valueOffset = flags & 1 ? buffer.readUInt16LE(position + 2) * 4 : flags & 2 ? buffer.readUInt16LE(position) * 4 : buffer.readUInt32LE(position);
            if (valueOffset === 0xffffffff || ((flags & 2) && valueOffset === 0x3fffc)) continue;
            const entry = dataStart + valueOffset;
            if (entry + 8 > current + t.size) throw new Error('Resource entry outside chunk');
            const entrySize = buffer.readUInt16LE(entry), entryFlags = buffer.readUInt16LE(entry + 2);
            if ((entryFlags & 9) || entrySize < 8) continue; // complex or compact entries require a different decoder
            const key = buffer.readUInt32LE(entry + 4), value = entry + entrySize;
            if (value + 8 > current + t.size) throw new Error('Truncated resource value');
            const dataType = buffer[value + 3]!, data = buffer.readUInt32LE(value + 4);
            if (dataType === 3 || dataType === 1) values.push({ id: (packageId * 0x1000000 + (typeId + typeIdOffset) * 0x10000 + entryIndex) >>> 0,
              name: `${typeNames[typeId - 1]}/${keys[key]}`, value: dataType === 3 ? strings[data] : undefined, reference: dataType === 1 ? data : undefined, rank });
          }
        }
        current += t.size;
      }
    }
    offset += c.size;
  }
  return resolve(values, label);
}
