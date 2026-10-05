import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { IosSigningInfo } from '@deploylens/contracts';
import { parsePlistBuffer } from './plistParser.js';

const execFileAsync = promisify(execFile);

export interface ProvisioningProfileDetails {
  name?: string;
  teamName?: string;
  teamId?: string;
  type: 'development' | 'ad-hoc' | 'enterprise' | 'app-store' | 'unknown';
  entitlements?: Record<string, unknown>;
  provisionsAllDevices?: boolean;
  hasDeviceList: boolean;
}

export function parseMobileProvisionBuffer(buffer: Buffer): ProvisioningProfileDetails | null {
  const parsed = parsePlistBuffer(buffer);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const name = typeof parsed['Name'] === 'string' ? parsed['Name'] : undefined;
  const teamName = typeof parsed['TeamName'] === 'string' ? parsed['TeamName'] : undefined;
  const teamIds = Array.isArray(parsed['TeamIdentifier']) ? parsed['TeamIdentifier'].map(String) : [];
  const teamId = teamIds[0] ?? (typeof parsed['TeamIdentifier'] === 'string' ? parsed['TeamIdentifier'] : undefined);

  const entitlements = (parsed['Entitlements'] && typeof parsed['Entitlements'] === 'object')
    ? (parsed['Entitlements'] as Record<string, unknown>)
    : undefined;

  const devices = parsed['ProvisionedDevices'];
  const hasDeviceList = Array.isArray(devices) && devices.length > 0;
  const provisionsAllDevices = Boolean(parsed['ProvisionsAllDevices']);
  const getTaskAllow = Boolean(entitlements?.['get-task-allow']);

  let type: ProvisioningProfileDetails['type'] = 'unknown';
  if (provisionsAllDevices) {
    type = 'enterprise';
  } else if (hasDeviceList && getTaskAllow) {
    type = 'development';
  } else if (hasDeviceList && !getTaskAllow) {
    type = 'ad-hoc';
  } else if (!hasDeviceList && !getTaskAllow) {
    type = 'app-store';
  }

  return {
    name,
    teamName,
    teamId,
    type,
    entitlements,
    provisionsAllDevices,
    hasDeviceList,
  };
}

export async function runMacOsCodesignVerify(appBundlePath: string): Promise<{
  isSigned: boolean;
  codesignCheckOutcome: 'pass' | 'fail' | 'not-checked';
  signerIdentity?: string;
  authorityNames: string[];
  limitations: string[];
}> {
  if (process.platform !== 'darwin') {
    return {
      isSigned: false,
      codesignCheckOutcome: 'not-checked',
      authorityNames: [],
      limitations: ['Apple codesign verification requires macOS host'],
    };
  }

  try {
    const { stdout, stderr } = await execFileAsync('codesign', ['-dvvv', appBundlePath], {
      timeout: 10000,
      windowsHide: true,
    });
    const combined = stdout + '\n' + stderr;
    const authorityMatches = Array.from(combined.matchAll(/Authority=([^\n]+)/g)).map((m) => m[1]?.trim() ?? '');
    const teamIdMatch = /TeamIdentifier=([^\n]+)/.exec(combined);

    return {
      isSigned: true,
      codesignCheckOutcome: 'pass',
      signerIdentity: authorityMatches[0] || teamIdMatch?.[1] || 'Apple Signed',
      authorityNames: authorityMatches,
      limitations: [],
    };
  } catch (err: any) {
    return {
      isSigned: false,
      codesignCheckOutcome: 'fail',
      authorityNames: [],
      limitations: [(err.message || 'codesign verification failed').trim()],
    };
  }
}

export function synthesizeIosSigningInfo(options: {
  hasCodeSignature: boolean;
  mobileProvisionBuffer?: Buffer;
  codesignResult?: {
    isSigned: boolean;
    codesignCheckOutcome: 'pass' | 'fail' | 'not-checked';
    signerIdentity?: string;
    authorityNames: string[];
    limitations: string[];
  };
}): IosSigningInfo {
  const { hasCodeSignature, mobileProvisionBuffer, codesignResult } = options;
  const limitations: string[] = [];

  const profile = mobileProvisionBuffer ? parseMobileProvisionBuffer(mobileProvisionBuffer) : null;

  if (process.platform !== 'darwin') {
    limitations.push(`Host platform is ${process.platform}. macOS tools (codesign/security) unavailable; cryptographic verification produced "Not checked".`);
  }

  if (codesignResult?.limitations) {
    limitations.push(...codesignResult.limitations);
  }

  return {
    isSigned: hasCodeSignature || Boolean(codesignResult?.isSigned),
    signerIdentity: codesignResult?.signerIdentity || profile?.teamName,
    authorityNames: codesignResult?.authorityNames,
    teamId: profile?.teamId,
    provisioningProfilePresent: Boolean(profile),
    provisioningProfileType: profile?.type,
    entitlements: profile?.entitlements,
    codesignCheckOutcome: codesignResult ? codesignResult.codesignCheckOutcome : 'not-checked',
    limitations,
  };
}
