export function varint(value: number): Buffer {
  const bytes: number[] = [];
  do { const byte = value & 127; value = Math.floor(value / 128); bytes.push(byte | (value ? 128 : 0)); } while (value);
  return Buffer.from(bytes);
}
export function pb(id: number, value: Buffer | string | number): Buffer {
  if (typeof value === 'number') return Buffer.concat([varint(id * 8), varint(value)]);
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return Buffer.concat([varint(id * 8 + 2), varint(bytes.length), bytes]);
}
export const message = (...values: Buffer[]) => Buffer.concat(values);
