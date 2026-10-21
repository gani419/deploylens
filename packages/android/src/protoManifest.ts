import type { ParsedXmlElement } from './axmlParser.js';

// AAPT2 Resources.proto: XmlNode -> XmlElement -> XmlAttribute / XmlNode.
// Schema: https://android.googlesource.com/platform/frameworks/base/+/master/tools/aapt2/Resources.proto
// Only the fields required for manifest inspection are decoded; unknown fields are skipped.
type Field = { id: number; value: Buffer | number };
function fields(buf: Buffer): Field[] {
  const result: Field[] = [];
  let offset = 0;
  const varint = () => {
    let value = 0;
    for (let shift = 0; shift < 70; shift += 7) {
      if (offset >= buf.length) throw new Error('Truncated protobuf manifest');
      const byte = buf[offset++]!;
      value += (byte & 127) * 2 ** shift;
      if (!(byte & 128)) return value;
    }
    throw new Error('Invalid protobuf varint');
  };
  while (offset < buf.length) {
    const tag = varint();
    const id = Math.floor(tag / 8);
    const wire = tag & 7;
    if (!id) throw new Error('Invalid protobuf field');
    if (wire === 0) result.push({ id, value: varint() });
    else if (wire === 2) {
      const length = varint();
      if (length > buf.length - offset) throw new Error('Truncated protobuf field');
      result.push({ id, value: buf.subarray(offset, offset + length) });
      offset += length;
    } else if (wire === 5 || wire === 1) {
      offset += wire === 5 ? 4 : 8;
      if (offset > buf.length) throw new Error('Truncated protobuf value');
    } else throw new Error('Unsupported protobuf wire type');
  }
  return result;
}
const bytes = (items: Field[], id: number) => items.find(f => f.id === id && Buffer.isBuffer(f.value))?.value as Buffer | undefined;
const string = (items: Field[], id: number) => bytes(items, id)?.toString('utf8') ?? '';

export function parseProtoManifest(buffer: Buffer): ParsedXmlElement | null {
  let nodes = 0;
  const node = (buf: Buffer, depth: number): ParsedXmlElement | null => {
    if (depth > 128 || ++nodes > 50000) throw new Error('Manifest complexity limit exceeded');
    const element = bytes(fields(buf), 1);
    if (!element) return null;
    const data = fields(element);
    const name = string(data, 3);
    if (!name) return null;
    const attributes: Record<string, string> = {};
    for (const attr of data.filter(f => f.id === 4 && Buffer.isBuffer(f.value))) {
      const values = fields(attr.value as Buffer);
      const key = string(values, 2);
      let value = string(values, 3);
      const item = bytes(values, 6);
      if (!value && item) {
        const compiled = fields(item);
        const reference = bytes(compiled, 1);
        const id = reference ? fields(reference).find(f => f.id === 2 && typeof f.value === 'number')?.value : undefined;
        if (typeof id === 'number') value = `@0x${id.toString(16)}`;
        const compiledString = bytes(compiled, 2) ?? bytes(compiled, 3);
        if (compiledString) value = string(fields(compiledString), 1);
        const primitive = bytes(compiled, 7);
        const typed = primitive ? fields(primitive).find(f => typeof f.value === 'number') : undefined;
        if (typed) value = typed.id === 8 ? (typed.value ? 'true' : 'false') : String(typed.value);
      }
      if (key) attributes[key] = value;
    }
    const children = data.filter(f => f.id === 5 && Buffer.isBuffer(f.value))
      .map(f => node(f.value as Buffer, depth + 1)).filter((v): v is ParsedXmlElement => v !== null);
    return { name, attributes, rawAttributes: [], children };
  };
  const root = node(buffer, 0);
  return root?.name === 'manifest' ? root : null;
}

export { fields as decodeProtoFields, bytes as protoBytes, string as protoString };
