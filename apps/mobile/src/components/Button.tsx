import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text} from 'react-native';
import {useApp} from '../app/AppContext';
import {radius, space, type} from '../theme/tokens';

export function Button({label, onPress, secondary = false, busy = false}: {label: string; onPress(): void; secondary?: boolean; busy?: boolean}) {
  const {palette} = useApp();
  const bg = secondary ? palette['primary-soft'] : palette.primary; const fg = secondary ? palette.primary : palette['on-primary'];
  return <Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={({pressed}) => [styles.button, {backgroundColor: bg, opacity: pressed || busy ? .72 : 1}]}>
    {busy ? <ActivityIndicator color={fg}/> : <Text style={[styles.label, {color: fg}]}>{label}</Text>}
  </Pressable>;
}
const styles = StyleSheet.create({button: {minHeight: 50, paddingHorizontal: space.md, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center'}, label: {fontFamily: type.heading, fontSize: 16}});
