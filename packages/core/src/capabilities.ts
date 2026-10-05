import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CapabilityReport, ToolCapability } from '@deploylens/contracts';

const execFileAsync = promisify(execFile);

export async function detectAllCapabilities(): Promise<CapabilityReport> {
  const [apkanalyzer, bundletool, apksigner, zipalign, readelf, codesign, security] =
    await Promise.all([
      detectApkanalyzer(),
      detectBundletool(),
      detectApksigner(),
      detectZipalign(),
      detectReadelf(),
      detectCodesign(),
      detectSecurityTool(),
    ]);

  return {
    apkanalyzer,
    bundletool,
    apksigner,
    zipalign,
    readelf,
    codesign,
    security,
  };
}

function findAndroidSdkPath(): string | null {
  const envSdk = process.env['ANDROID_HOME'] || process.env['ANDROID_SDK_ROOT'];
  if (envSdk && fs.existsSync(envSdk)) return envSdk;

  const userHome = process.env['USERPROFILE'] || process.env['HOME'];
  if (userHome) {
    const candidateWin = path.join(userHome, 'AppData', 'Local', 'Android', 'Sdk');
    if (fs.existsSync(candidateWin)) return candidateWin;
    const candidateMac = path.join(userHome, 'Library', 'Android', 'sdk');
    if (fs.existsSync(candidateMac)) return candidateMac;
  }
  return null;
}

function findLatestInBuildTools(sdkPath: string, binaryName: string): string | null {
  const btDir = path.join(sdkPath, 'build-tools');
  if (!fs.existsSync(btDir)) return null;

  try {
    const versions = fs.readdirSync(btDir).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const v of versions) {
      const isWin = process.platform === 'win32';
      const ext = isWin ? (binaryName.endsWith('.bat') || binaryName.endsWith('.exe') ? '' : '.bat') : '';
      const full = path.join(btDir, v, binaryName + ext);
      if (fs.existsSync(full)) return full;
      const fullExe = path.join(btDir, v, binaryName + '.exe');
      if (fs.existsSync(fullExe)) return fullExe;
    }
  } catch {
    // Ignore read errors
  }
  return null;
}

function findInCmdlineTools(sdkPath: string, binaryName: string): string | null {
  const ctDir = path.join(sdkPath, 'cmdline-tools');
  if (!fs.existsSync(ctDir)) return null;

  try {
    const subdirs = ['latest', ...fs.readdirSync(ctDir).filter((d) => d !== 'latest')];
    for (const sub of subdirs) {
      const isWin = process.platform === 'win32';
      const ext = isWin ? '.bat' : '';
      const full = path.join(ctDir, sub, 'bin', binaryName + ext);
      if (fs.existsSync(full)) return full;
    }
  } catch {
    // Ignore
  }
  return null;
}

async function detectApkanalyzer(): Promise<ToolCapability> {
  const sdk = findAndroidSdkPath();
  let bin = sdk ? findInCmdlineTools(sdk, 'apkanalyzer') : null;
  if (!bin) bin = 'apkanalyzer';

  try {
    const { stdout } = await execFileAsync(bin, ['--version'], { timeout: 4000, windowsHide: true });
    return {
      tool: 'apkanalyzer',
      available: true,
      version: stdout.trim() || 'Android SDK cmdline-tools',
      path: bin,
      supportedFeatures: ['Manifest dump', 'Package analysis', 'DEX analysis'],
      limitations: [],
    };
  } catch {
    if (bin && bin !== 'apkanalyzer' && fs.existsSync(bin)) {
      return {
        tool: 'apkanalyzer',
        available: true,
        version: 'Installed in SDK cmdline-tools',
        path: bin,
        supportedFeatures: ['Manifest dump', 'Package analysis'],
        limitations: [],
      };
    }
    return {
      tool: 'apkanalyzer',
      available: false,
      version: null,
      path: null,
      supportedFeatures: [],
      limitations: ['apkanalyzer not found; DeployLens uses built-in TypeScript AXML parser fallback.'],
    };
  }
}

async function detectBundletool(): Promise<ToolCapability> {
  try {
    const { stdout } = await execFileAsync('bundletool', ['version'], { timeout: 4000, windowsHide: true });
    return {
      tool: 'bundletool',
      available: true,
      version: stdout.trim(),
      path: 'bundletool',
      supportedFeatures: ['AAB manifest dump', 'APK generation', 'Device configuration simulation'],
      limitations: [],
    };
  } catch {
    return {
      tool: 'bundletool',
      available: false,
      version: null,
      path: null,
      supportedFeatures: [],
      limitations: [
        'bundletool jar not found on PATH. DeployLens uses built-in ZIP/AXML parser for AAB inspection.',
      ],
    };
  }
}

async function detectApksigner(): Promise<ToolCapability> {
  const sdk = findAndroidSdkPath();
  let bin = sdk ? findLatestInBuildTools(sdk, 'apksigner') : null;
  if (!bin) bin = 'apksigner';

  try {
    const { stdout } = await execFileAsync(bin, ['version'], { timeout: 4000, windowsHide: true });
    return {
      tool: 'apksigner',
      available: true,
      version: stdout.trim() || 'Android SDK build-tools',
      path: bin,
      supportedFeatures: ['APK Signature Scheme v1/v2/v3/v4 verification', 'Signer certificate extraction'],
      limitations: [],
    };
  } catch {
    if (bin && bin !== 'apksigner' && fs.existsSync(bin)) {
      return {
        tool: 'apksigner',
        available: true,
        version: 'Detected in build-tools',
        path: bin,
        supportedFeatures: ['APK signature verification'],
        limitations: [],
      };
    }
    return {
      tool: 'apksigner',
      available: false,
      version: null,
      path: null,
      supportedFeatures: [],
      limitations: ['apksigner not found; DeployLens uses built-in binary APK Signing Block verifier.'],
    };
  }
}

async function detectZipalign(): Promise<ToolCapability> {
  const sdk = findAndroidSdkPath();
  let bin = sdk ? findLatestInBuildTools(sdk, 'zipalign') : null;
  if (!bin) bin = 'zipalign';

  try {
    await execFileAsync(bin, ['-c', '-v', '4'], { timeout: 4000, windowsHide: true });
    return {
      tool: 'zipalign',
      available: true,
      version: 'Android build-tools',
      path: bin,
      supportedFeatures: ['4-byte alignment check', 'Uncompressed entry verification'],
      limitations: [],
    };
  } catch (err: any) {
    // zipalign returns exit code 1 or 2 when run without files, but if binary exists:
    if (bin && bin !== 'zipalign' && fs.existsSync(bin)) {
      return {
        tool: 'zipalign',
        available: true,
        version: 'Detected in build-tools',
        path: bin,
        supportedFeatures: ['4-byte alignment check'],
        limitations: [],
      };
    }
    return {
      tool: 'zipalign',
      available: false,
      version: null,
      path: null,
      supportedFeatures: [],
      limitations: ['zipalign not found; packaging alignment marked as not checked.'],
    };
  }
}

async function detectReadelf(): Promise<ToolCapability> {
  try {
    const { stdout } = await execFileAsync('readelf', ['-v'], { timeout: 4000, windowsHide: true });
    return {
      tool: 'readelf',
      available: true,
      version: stdout.split('\n')[0]?.trim() || 'GNU readelf',
      path: 'readelf',
      supportedFeatures: ['ELF header parsing', 'Program header alignment analysis'],
      limitations: [],
    };
  } catch {
    return {
      tool: 'readelf',
      available: false,
      version: null,
      path: null,
      supportedFeatures: [],
      limitations: ['System readelf not present; DeployLens uses built-in TypeScript ELF header & segment analyzer.'],
    };
  }
}

async function detectCodesign(): Promise<ToolCapability> {
  if (process.platform !== 'darwin') {
    return {
      tool: 'codesign',
      available: false,
      version: null,
      path: null,
      supportedFeatures: [],
      limitations: [`codesign requires macOS host (current OS is ${process.platform})`],
    };
  }

  try {
    const { stdout } = await execFileAsync('codesign', ['--version'], { timeout: 4000, windowsHide: true });
    return {
      tool: 'codesign',
      available: true,
      version: stdout.trim(),
      path: '/usr/bin/codesign',
      supportedFeatures: ['iOS IPA cryptographic signature verification', 'Sealed resources validation'],
      limitations: [],
    };
  } catch {
    return {
      tool: 'codesign',
      available: false,
      version: null,
      path: null,
      supportedFeatures: [],
      limitations: ['codesign tool not available or inaccessible on macOS host.'],
    };
  }
}

async function detectSecurityTool(): Promise<ToolCapability> {
  if (process.platform !== 'darwin') {
    return {
      tool: 'security',
      available: false,
      version: null,
      path: null,
      supportedFeatures: [],
      limitations: [`security CMS inspection requires macOS host (current OS is ${process.platform})`],
    };
  }

  try {
    await execFileAsync('security', ['help'], { timeout: 4000, windowsHide: true });
    return {
      tool: 'security',
      available: true,
      version: 'macOS Security Subsystem',
      path: '/usr/bin/security',
      supportedFeatures: ['CMS mobileprovision decoding', 'Certificate trust validation'],
      limitations: [],
    };
  } catch {
    return {
      tool: 'security',
      available: false,
      version: null,
      path: null,
      supportedFeatures: [],
      limitations: ['security CLI not available'],
    };
  }
}
