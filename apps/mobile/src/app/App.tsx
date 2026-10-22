import React from 'react';
import {StatusBar} from 'react-native';
import {NavigationContainer, type Theme} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppProvider, useApp} from './AppContext';
import {Icon, type IconName} from '../components/Icon';
import {HomeScreen} from '../screens/HomeScreen';
import {ReportsScreen} from '../screens/ReportsScreen';
import {SettingsScreen} from '../screens/SettingsScreen';
import {type} from '../theme/tokens';
import {InspectionProvider} from './InspectionContext';

export type RootTabs = {Home: undefined; Reports: undefined; Settings: undefined};
const Tabs = createBottomTabNavigator<RootTabs>();
const icons: Record<keyof RootTabs, IconName> = {Home:'home', Reports:'report', Settings:'settings'};

function Navigation() {
  const {palette, dark} = useApp();
  const theme: Theme = {dark, colors:{primary:palette.primary,background:palette.bg,card:palette.surface,text:palette.text,border:palette.line,notification:palette.danger},fonts:{regular:{fontFamily:type.body,fontWeight:'400'},medium:{fontFamily:type.heading,fontWeight:'500'},bold:{fontFamily:type.heading,fontWeight:'700'},heavy:{fontFamily:type.heading,fontWeight:'800'}}};
  return <NavigationContainer theme={theme}><StatusBar barStyle={dark?'light-content':'dark-content'}/><Tabs.Navigator screenOptions={({route})=>({headerShown:false,tabBarIcon:({color,size})=><Icon name={icons[route.name]} color={color} size={size}/>,tabBarActiveTintColor:palette.primary,tabBarInactiveTintColor:palette['text-muted'],tabBarStyle:{height:68,paddingTop:7,paddingBottom:8,backgroundColor:palette.surface,borderTopColor:palette.line},tabBarLabelStyle:{fontFamily:type.heading,fontSize:12}})}><Tabs.Screen name="Home" component={HomeScreen}/><Tabs.Screen name="Reports" component={ReportsScreen}/><Tabs.Screen name="Settings" component={SettingsScreen}/></Tabs.Navigator></NavigationContainer>;
}
export default function App() { return <SafeAreaProvider><AppProvider><InspectionProvider><Navigation/></InspectionProvider></AppProvider></SafeAreaProvider>; }
