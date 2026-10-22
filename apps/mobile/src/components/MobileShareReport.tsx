import React, {useState} from 'react';
import {StyleSheet, Switch, Text, TextInput, View} from 'react-native';
import type {ScanSummary} from '@deploylens/contracts';
import type {SharingDraft, ReportSessionState} from '@deploylens/store';
import {useApp} from '../app/AppContext';
import {copyText, shareReport, type ReportFormat} from '../adapters/collaboration';
import type {MobileArchive} from '../adapters/documentPicker';
import {Button} from './Button';
import {Body, Card, Eyebrow, Title} from './Screen';
import {radius, space, type} from '../theme/tokens';

type Props = {
  summary: ScanSummary; archive: MobileArchive | null; draft: SharingDraft;
  annotations: ReportSessionState;
  onDraftChange(value: SharingDraft): void; onRemoveOriginal(): void;
};
export function MobileShareReport({summary, archive, draft, annotations, onDraftChange, onRemoveOriginal}: Props) {
  const {palette} = useApp();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState<ReportFormat>('html');
  const update = (change: Partial<SharingDraft>) => onDraftChange({...draft, ...change});
  const share = async () => {
    if (busy) return;
    setBusy(true); setNotice('');
    try {
      const result = await shareReport(summary, draft.subject, draft.body, archive, draft.includeBuild, format, annotations);
      setNotice(result === 'cancelled' ? 'Sharing cancelled. Your report and draft are still available.' : 'Share handoff completed. Confirm delivery and attachments in the selected app.');
    } catch (error) {
      setNotice(`${error instanceof Error ? error.message : 'Sharing is unavailable.'} Try the report alone or copy the message into another app.`);
    } finally { setBusy(false); }
  };
  return <>
    <Eyebrow>Keep your team informed</Eyebrow><Title>Share report & build</Title>
    <Body muted>Edit the context, then choose a mail, chat or storage app from the native share sheet.</Body>
    <Card>
      <Text style={[styles.label, {color: palette.text}]}>Subject</Text>
      <TextInput accessibilityLabel="Share subject" value={draft.subject} onChangeText={subject => update({subject})} style={[styles.input, {color: palette.text, borderColor: palette.line}]}/>
      <Text style={[styles.label, {color: palette.text}]}>Message</Text>
      <TextInput accessibilityLabel="Share message" multiline value={draft.body} onChangeText={body => update({body})} style={[styles.input, styles.message, {color: palette.text, borderColor: palette.line}]}/>
      <Text style={[styles.label, {color: palette.text}]}>Report format</Text>
      <View style={styles.row}>
        <Button secondary={format !== 'html'} label="Readable HTML" onPress={() => setFormat('html')}/>
        <Button secondary={format !== 'json'} label="JSON" onPress={() => setFormat('json')}/>
      </View>
      <Body muted>{format === 'html' ? 'An offline report with evidence, fixes, edited listing drafts and session review markers. Save it using a compatible Files or storage target.' : 'The original structured inspection data. Listing drafts and review markers are available in the HTML report.'}</Body>
      <View style={styles.row}>
        <View style={styles.grow}>
          <Text style={[styles.label, {color: palette.text}]}>Include original {summary.artifact.artifactType.toUpperCase()}</Text>
          <Body muted>{archive ? 'A temporary copy is available until you clear the report or remove it below.' : 'The original build is no longer available.'}</Body>
        </View>
        <Switch accessibilityLabel="Include original build" value={draft.includeBuild && !!archive} disabled={!archive || busy} onValueChange={includeBuild => update({includeBuild})} trackColor={{true: palette.primary}}/>
      </View>
      <Body muted>Receiving apps may reject archive types, large attachments or text with files. Check the receiving app before sending. Shared temporary files are cleaned up on the next app launch.</Body>
      <Button secondary label="Copy message" onPress={() => { copyText(`${draft.subject}\n\n${draft.body}`); setNotice('Message copied to clipboard.'); }}/>
      <Button busy={busy} label="Share report" onPress={() => void share()}/>
      {archive && <Button secondary busy={busy} label="Remove cached original build" onPress={() => { onRemoveOriginal(); setNotice('The original build was removed from this inspection. The report remains available.'); }}/>}
    </Card>
    {!!notice && <Text accessibilityRole="text" accessibilityLiveRegion="polite" style={[styles.notice, {color: palette['text-secondary']}]}>{notice}</Text>}
  </>;
}
const styles = StyleSheet.create({
  grow: {flex: 1}, row: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm},
  label: {fontFamily: type.heading, fontSize: 15},
  input: {minHeight: 48, borderWidth: 1, borderRadius: radius.sm, padding: space.sm, fontFamily: type.body, fontSize: 15},
  message: {minHeight: 260, textAlignVertical: 'top', lineHeight: 22},
  notice: {fontFamily: type.body, fontSize: 14, lineHeight: 20},
});
