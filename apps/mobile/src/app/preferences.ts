import {createAsyncStorage} from '@react-native-async-storage/async-storage';
import type {AppearanceMode} from '../theme/tokens';

const storage = createAsyncStorage('deploylensPreferences');
const appearanceKey = 'appearance';
const serviceUrlKey = 'inspectionServiceUrl';

export type Preferences = {appearance: AppearanceMode; serviceUrl: string};
export const defaultServiceUrl = 'http://10.0.2.2:3000';

export async function loadPreferences(): Promise<Preferences> {
  const [appearance, serviceUrl] = await Promise.all([
    storage.getItem(appearanceKey), storage.getItem(serviceUrlKey),
  ]);
  return {
    appearance: appearance === 'light' || appearance === 'dark' ? appearance : 'system',
    serviceUrl: serviceUrl || defaultServiceUrl,
  };
}

export async function saveAppearance(value: AppearanceMode) { await storage.setItem(appearanceKey, value); }
export async function saveServiceUrl(value: string) { await storage.setItem(serviceUrlKey, value); }

export function normalizeServiceUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) throw new Error('Enter a complete http:// or https:// address.');
  const parsed = new URL(trimmed);
  if (parsed.username || parsed.password) throw new Error('Do not include credentials in the service URL.');
  if (parsed.search || parsed.hash) throw new Error('Remove query text and fragments from the service URL.');
  return trimmed;
}
