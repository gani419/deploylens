import { themeColors, fontFamilies, fontSizes } from '@deploylens/config';
import { writeFile } from 'node:fs/promises';

const block = (selector, colors) => `${selector} {\n${Object.entries(colors).map(([key, value]) => `  --${key}: ${value};`).join('\n')}\n}`;
const typography = { 'font-heading-name': JSON.stringify(fontFamilies.heading), 'font-content-name': JSON.stringify(fontFamilies.content), ...Object.fromEntries(Object.entries(fontSizes).map(([key, value]) => [`font-${key}`, `${value}px`])) };
const css = `/* Generated from @deploylens/config. Edit the shared tokens, then rebuild. */\n${block(':root', typography)}\n${block(':root, [data-theme="light"]', themeColors.light)}\n${block('[data-theme="dark"]', themeColors.dark)}\n`;
await writeFile(new URL('../src/styles/theme-colors.css', import.meta.url), css, 'utf8');
