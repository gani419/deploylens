import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, TextInput, View} from 'react-native';
import {useApp} from '../app/AppContext';
import type {AppearanceMode} from '../theme/tokens';
import {Button} from '../components/Button';
import {Body, Card, Eyebrow, Screen, Title} from '../components/Screen';
import {radius, space, type} from '../theme/tokens';

export function SettingsScreen() {
  const {palette, appearance, setAppearance, serviceUrl, updateServiceUrl, checkConnection, connection} = useApp();
  const [draft, setDraft] = useState(serviceUrl); const [error, setError] = useState('');
  useEffect(() => { setDraft(serviceUrl); }, [serviceUrl]);
  const saveAndTest = async () => { try { setError(''); await updateServiceUrl(draft); await checkConnection(draft.trim().replace(/\/+$/, '')); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save the address.'); } };
  return <Screen><Eyebrow>Connection & appearance</Eyebrow><Title>Settings</Title>
    <Card><Text style={[styles.heading,{color:palette.text}]}>Inspection service</Text><Body muted>The Android emulator reaches this PC through 10.0.2.2. A physical phone needs your computer’s LAN address; production should use HTTPS.</Body>
      <Text style={[styles.label,{color:palette['text-secondary']}]}>Service URL</Text><TextInput accessibilityLabel="Inspection service URL" autoCapitalize="none" autoCorrect={false} keyboardType="url" value={draft} onChangeText={setDraft} placeholder="https://inspect.example.com" placeholderTextColor={palette['text-muted']} style={[styles.input,{color:palette.text,backgroundColor:palette['surface-raised'],borderColor:error?palette.danger:palette['line-strong']}]} />
      {!!error && <Text style={[styles.message,{color:palette.danger}]}>{error}</Text>}{!!connection.message && <Text style={[styles.message,{color:connection.state==='connected'?palette.success:palette.danger}]}>{connection.message}</Text>}
      <Button label={connection.state === 'checking' ? 'Checking…' : 'Save and test connection'} busy={connection.state === 'checking'} onPress={() => void saveAndTest()}/>
    </Card>
    <Card><Text style={[styles.heading,{color:palette.text}]}>Appearance</Text><View style={styles.choices}>{(['system','light','dark'] as AppearanceMode[]).map(value => <Text key={value} accessibilityRole="button" onPress={() => setAppearance(value)} style={[styles.choice,{color:appearance===value?palette['on-primary']:palette.text,backgroundColor:appearance===value?palette.primary:palette['surface-muted']}]}>{value[0].toUpperCase()+value.slice(1)}</Text>)}</View></Card>
    <Card><Text style={[styles.heading,{color:palette.text}]}>Privacy</Text><Body muted>Only theme and service-address preferences are stored on this device. Uploaded archives and reports are not kept as mobile history.</Body></Card>
  </Screen>;
}
const styles=StyleSheet.create({heading:{fontFamily:type.heading,fontSize:19},label:{fontFamily:type.heading,fontSize:14,marginTop:space.sm},input:{fontFamily:type.body,fontSize:16,borderWidth:1,borderRadius:radius.sm,paddingHorizontal:14,minHeight:50},message:{fontFamily:type.body,fontSize:14,lineHeight:20},choices:{flexDirection:'row',gap:space.sm},choice:{flex:1,textAlign:'center',overflow:'hidden',fontFamily:type.heading,fontSize:14,paddingVertical:12,borderRadius:radius.pill}});
