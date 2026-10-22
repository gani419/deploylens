import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import {product} from '@deploylens/config';
import {size} from '@deploylens/utils';
import {useApp} from '../app/AppContext';
import {useInspection} from '../app/InspectionContext';
import {Button} from '../components/Button';
import {Icon} from '../components/Icon';
import {Body, Card, Eyebrow, Screen, Title} from '../components/Screen';
import {radius, space, type} from '../theme/tokens';
import type {RootTabs} from '../app/App';

export function HomeScreen({navigation}: {navigation: BottomTabNavigationProp<RootTabs, 'Home'>}) {
  const {palette, connection} = useApp();
  const inspection = useInspection();
  const connected = connection.state === 'connected';
  const run = () => { if (inspection.start()) navigation.navigate('Reports'); };
  return <Screen>
    <View style={[styles.heroIcon, {backgroundColor: palette['primary-soft']}]}><Icon name="shield" color={palette.primary} size={34}/></View>
    <Eyebrow>Mobile release inspection</Eyebrow>
    <Title>Check a build before it reaches the store.</Title>
    <Body muted>Select one APK, AAB or IPA. The temporary phone copy is removed when the inspection ends.</Body>
    <Card>
      <View style={styles.statusRow}><View style={[styles.dot, {backgroundColor: connected ? palette.success : palette.warning}]}/><Text style={[styles.status, {color: palette.text}]}>{connected ? 'Inspection service ready' : 'Service setup required'}</Text></View>
      <Body muted>{connection.message ?? 'Connect this app to a running DeployLens service before selecting a build.'}</Body>
      {!connected && <Button label="Set up inspection service" onPress={() => navigation.navigate('Settings')}/>} 
    </Card>
    <Card>
      <View style={styles.uploadHeading}><Icon name="upload" color={palette.primary}/><View style={styles.grow}><Text style={[styles.status,{color:palette.text}]}>Build archive</Text><Body muted>Single-build inspection is the default.</Body></View></View>
      {inspection.archive ? <View style={[styles.file,{backgroundColor:palette['surface-muted']}]}><View style={[styles.format,{backgroundColor:palette.primary}]}><Text style={[styles.formatText,{color:palette['on-primary']}]}>{inspection.archive.type.toUpperCase()}</Text></View><View style={styles.grow}><Text numberOfLines={1} style={[styles.fileName,{color:palette.text}]}>{inspection.archive.name}</Text><Text style={[styles.fileMeta,{color:palette['text-muted']}]}>Uploaded type: {inspection.archive.type.toUpperCase()} · {size(inspection.archive.size)}</Text></View></View> : <Body muted>No build selected. Files outside APK, AAB and IPA are rejected before upload.</Body>}
      <Button secondary label={inspection.archive ? 'Choose another build' : 'Choose build'} onPress={() => void inspection.choose()}/>
      {inspection.archive && <Button label="Start inspection" onPress={run}/>} 
      {!!inspection.error && <Text style={[styles.error,{color:palette.danger}]}>{inspection.error}</Text>}
    </Card>
    <View style={styles.metrics}>{['APK', 'AAB', 'IPA'].map(format => <View key={format} style={[styles.metric, {backgroundColor: palette['surface-muted']}]}><Text style={[styles.metricText, {color: palette.text}]}>{format}</Text><Text style={[styles.metricLabel, {color: palette['text-muted']}]}>supported</Text></View>)}</View>
    <Text style={[styles.version, {color: palette['text-muted']}]}>{product.name} · version {product.version}</Text>
  </Screen>;
}
const styles = StyleSheet.create({heroIcon:{width:64,height:64,borderRadius:20,alignItems:'center',justifyContent:'center'},statusRow:{flexDirection:'row',alignItems:'center',gap:space.sm},dot:{width:9,height:9,borderRadius:radius.pill},status:{fontFamily:type.heading,fontSize:18},uploadHeading:{flexDirection:'row',gap:space.sm,alignItems:'center'},grow:{flex:1},file:{borderRadius:radius.sm,padding:space.sm,flexDirection:'row',alignItems:'center',gap:space.sm},format:{borderRadius:8,paddingHorizontal:9,paddingVertical:7},formatText:{fontFamily:type.heading,fontSize:12},fileName:{fontFamily:type.heading,fontSize:16},fileMeta:{fontFamily:type.body,fontSize:13,marginTop:3},error:{fontFamily:type.body,fontSize:14,lineHeight:20},metrics:{flexDirection:'row',gap:space.sm},metric:{flex:1,borderRadius:radius.sm,padding:space.sm},metricText:{fontFamily:type.heading,fontSize:17},metricLabel:{fontFamily:type.body,fontSize:13,marginTop:2},version:{fontFamily:type.body,fontSize:13,textAlign:'center',marginTop:space.md}});
