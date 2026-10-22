import React from 'react';
import Svg, {Circle, Path, Rect} from 'react-native-svg';

export type IconName = 'home' | 'report' | 'settings' | 'shield' | 'chevron' | 'check' | 'upload';
export function Icon({name, color, size = 22}: {name: IconName; color: string; size?: number}) {
  const common = {stroke: color, strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none'};
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
    {name === 'home' && <><Path {...common} d="M3 11.5 12 4l9 7.5"/><Path {...common} d="M5.5 10.5V20h13v-9.5M9.5 20v-6h5v6"/></>}
    {name === 'report' && <><Rect {...common} x="5" y="3" width="14" height="18" rx="2"/><Path {...common} d="M9 8h6M9 12h6M9 16h4"/></>}
    {name === 'settings' && <><Circle {...common} cx="12" cy="12" r="3"/><Path {...common} d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A8 8 0 0 0 14.8 6L14.5 3h-5L9.2 6a8 8 0 0 0-1.7 1.1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1A8 8 0 0 0 9.2 18l.3 3h5l.3-3a8 8 0 0 0 1.7-1.1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z"/></>}
    {name === 'shield' && <><Path {...common} d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z"/><Path {...common} d="m8.5 12 2.2 2.2 4.8-5"/></>}
    {name === 'chevron' && <Path {...common} d="m9 6 6 6-6 6"/>}
    {name === 'check' && <Path {...common} d="m5 12 4 4L19 6"/>}
    {name === 'upload' && <><Path {...common} d="M12 16V4m0 0L7 9m5-5 5 5"/><Path {...common} d="M5 14v5h14v-5"/></>}
  </Svg>;
}
