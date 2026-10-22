import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {useColorScheme} from 'react-native';
import type {InspectionServiceHealth} from '@deploylens/contracts';
import {loadPreferences, normalizeServiceUrl, saveAppearance, saveServiceUrl} from './preferences';
import {paletteFor, type AppearanceMode, type Palette} from '../theme/tokens';

type Connection = {state: 'unchecked' | 'checking' | 'connected' | 'error'; message?: string; health?: InspectionServiceHealth};
type AppContextValue = {
  palette: Palette; dark: boolean; appearance: AppearanceMode; setAppearance(value: AppearanceMode): void;
  serviceUrl: string; connection: Connection; updateServiceUrl(value: string): Promise<void>; checkConnection(candidate?: string): Promise<void>;
};
const AppContext = createContext<AppContextValue | null>(null);

function isHealth(value: unknown): value is InspectionServiceHealth {
  const data = value as Partial<InspectionServiceHealth> | null;
  return !!data && data.status === 'ok' && typeof data.maxUploadBytes === 'number' && Array.isArray(data.acceptedFormats) && data.retainsHistory === false;
}

export function AppProvider({children}: React.PropsWithChildren) {
  const systemDark = useColorScheme() === 'dark';
  const [appearance, setAppearanceState] = useState<AppearanceMode>('system');
  const [serviceUrl, setServiceUrl] = useState('');
  const [connection, setConnection] = useState<Connection>({state: 'unchecked'});
  useEffect(() => { loadPreferences().then(p => { setAppearanceState(p.appearance); setServiceUrl(p.serviceUrl); }).catch(() => setServiceUrl('http://10.0.2.2:3000')); }, []);
  const dark = appearance === 'system' ? systemDark : appearance === 'dark';
  const setAppearance = (value: AppearanceMode) => { setAppearanceState(value); void saveAppearance(value); };
  const updateServiceUrl = async (value: string) => { const normalized = normalizeServiceUrl(value); setServiceUrl(normalized); setConnection({state: 'unchecked'}); await saveServiceUrl(normalized); };
  const checkConnection = async (candidate?: string) => {
    const base = normalizeServiceUrl(candidate ?? serviceUrl);
    setConnection({state: 'checking'});
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${base}/api/health`, {signal: controller.signal});
      if (!response.ok) throw new Error(`Service returned HTTP ${response.status}.`);
      const health: unknown = await response.json();
      if (!isHealth(health)) throw new Error('This address did not return a DeployLens health response.');
      setConnection({state: 'connected', message: `Ready for ${health.acceptedFormats.map(v => v.toUpperCase()).join(', ')}`, health});
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError' ? 'Connection timed out after 8 seconds.' : error instanceof Error ? error.message : 'Connection failed.';
      setConnection({state: 'error', message});
    } finally { clearTimeout(timer); }
  };
  const value = useMemo(() => ({palette: paletteFor(dark), dark, appearance, setAppearance, serviceUrl, connection, updateServiceUrl, checkConnection}), [appearance, connection, dark, serviceUrl]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() { const value = useContext(AppContext); if (!value) throw new Error('useApp must be inside AppProvider'); return value; }
