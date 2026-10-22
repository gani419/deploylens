import {Platform} from 'react-native';
import {fontSizes, themeColors} from '@deploylens/config';

export type AppearanceMode = 'system' | 'light' | 'dark';
export type Palette = typeof themeColors.light;

export function paletteFor(dark: boolean): Palette {
  return {...themeColors.light, ...(dark ? themeColors.dark : {})} as Palette;
}

export const type = {
  heading: Platform.select({ios: 'Avenir Next', android: 'sans-serif-medium', default: 'System'}),
  body: Platform.select({ios: 'Avenir Next', android: 'sans-serif', default: 'System'}),
  size: fontSizes,
};

export const space = {xs: 6, sm: 10, md: 16, lg: 24, xl: 32} as const;
export const radius = {sm: 10, md: 16, lg: 24, pill: 999} as const;
