import React from 'react';
import {ScrollView, StyleSheet, Text, View, type ViewStyle} from 'react-native';
import {useApp} from '../app/AppContext';
import {radius, space, type} from '../theme/tokens';

export function Screen({children}: React.PropsWithChildren) {
  const {palette} = useApp();
  return <ScrollView style={{backgroundColor: palette.bg}} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">{children}</ScrollView>;
}
export function Eyebrow({children}: React.PropsWithChildren) { const {palette} = useApp(); return <Text style={[styles.eyebrow, {color: palette.primary}]}>{children}</Text>; }
export function Title({children}: React.PropsWithChildren) { const {palette} = useApp(); return <Text style={[styles.title, {color: palette.text}]}>{children}</Text>; }
export function Body({children, muted = false}: React.PropsWithChildren<{muted?: boolean}>) { const {palette} = useApp(); return <Text style={[styles.body, {color: muted ? palette['text-secondary'] : palette.text}]}>{children}</Text>; }
export function Card({children, style}: React.PropsWithChildren<{style?: ViewStyle}>) { const {palette} = useApp(); return <View style={[styles.card, {backgroundColor: palette.surface, borderColor: palette.line}, style]}>{children}</View>; }

const styles = StyleSheet.create({
  screen: {padding: space.lg, paddingBottom: 48, gap: space.md},
  eyebrow: {fontFamily: type.heading, fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase'},
  title: {fontFamily: type.heading, fontSize: 30, lineHeight: 38},
  body: {fontFamily: type.body, fontSize: 16, lineHeight: 24},
  card: {borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: space.sm},
});
