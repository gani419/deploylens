import { Resvg } from '@resvg/resvg-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(desktopRoot, '../web/public/brand/deploylens-icon.svg');
const output = path.join(desktopRoot, 'build');
const svg = await readFile(source, 'utf8');
await mkdir(output, { recursive: true });
const render = (width) => new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
await writeFile(path.join(output, 'icon.png'), render(512));

const png = render(256);
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(0, 6);
header.writeUInt8(0, 7);
header.writeUInt8(0, 8);
header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(header.length, 18);
await writeFile(path.join(output, 'icon.ico'), Buffer.concat([header, png]));
