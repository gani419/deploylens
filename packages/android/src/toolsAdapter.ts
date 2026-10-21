import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { buildCertificateMetadata } from './signingInspector.js';
import type { CertificateMetadata } from '@deploylens/contracts';

const execFileAsync = promisify(execFile);

export interface ToolExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | string;
}

export async function runToolSafe(
  command: string,
  args: string[],
  timeoutMs = 15000,
  maxBuffer = 5 * 1024 * 1024
): Promise<ToolExecResult> {
  try {
    // Launch the JAR behind the Windows SDK batch wrapper without using a shell.
    if (process.platform === 'win32' && /apksigner\.bat$/i.test(command)) {
      const jar = path.join(path.dirname(command), 'lib', 'apksigner.jar');
      if (!fs.existsSync(jar)) throw new Error('apksigner.jar is unavailable');
      command = javaTool('java');
      args = ['-jar', jar, ...args];
    }
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: timeoutMs,
      maxBuffer,
      windowsHide: true,
    });
    return {
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
    };
  } catch (err: any) {
    return {
      success: false,
      stdout: (err.stdout || '').toString().trim(),
      stderr: (err.stderr || err.message || '').toString().trim(),
      exitCode: err.code ?? -1,
    };
  }
}

export function javaTool(name: string): string {
  const home = process.env['JAVA_HOME'];
  const binary = process.platform === 'win32' ? `${name}.exe` : name;
  return home ? path.join(home, 'bin', binary) : binary;
}

export async function verifyAabSignature(aabPath: string): Promise<{
  outcome: 'pass' | 'fail' | 'not-checked'; rawOutput: string; signers: CertificateMetadata[];
}> {
  const result = await runToolSafe(javaTool('jarsigner'), ['-J-Duser.language=en', '-J-Duser.country=US', '-verify', '-verbose', '-certs', aabPath]);
  const rawOutput = result.stdout + '\n' + result.stderr;
  // A successful process alone is insufficient: jarsigner exits 0 for unsigned JARs.
  const verified = result.success && /jar verified\./i.test(rawOutput)
    && !/jar is unsigned|unsigned entries|not signed|digest error|signature.*(invalid|failed)/i.test(rawOutput);
  const signers: CertificateMetadata[] = [];
  if (verified) {
    const certs = await runToolSafe(javaTool('keytool'), ['-printcert', '-rfc', '-jarfile', aabPath]);
    const pem = certs.stdout.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
    for (const certificate of pem) {
      try { signers.push(buildCertificateMetadata(Buffer.from(certificate))); } catch { /* No invented certificate metadata. */ }
    }
  }
  return { outcome: verified ? 'pass' : typeof result.exitCode === 'number' ? 'fail' : 'not-checked', rawOutput, signers };
}

export async function verifyWithApksigner(
  apksignerPath: string,
  apkPath: string
): Promise<{ verified: boolean; outcome: 'pass' | 'fail' | 'not-checked'; v1: boolean; v2: boolean; v3: boolean; v4: boolean; rawOutput: string }> {
  const result = await runToolSafe(apksignerPath, ['verify', '--verbose', '--print-certs', apkPath]);
  const out = result.stdout + '\n' + result.stderr;

  const verified = result.success && !out.toLowerCase().includes('failed');
  const v1 = /Verified using v1 scheme \(JAR signing\): true/i.test(out);
  const v2 = /Verified using v2 scheme \(APK Signature Scheme v2\): true/i.test(out);
  const v3 = /Verified using v3(?:\.1)? scheme \(APK Signature Scheme v3(?:\.1)?\): true/i.test(out);
  const v4 = /Verified using v4 scheme \(APK Signature Scheme v4\): true/i.test(out);

  return {
    verified,
    outcome: verified ? 'pass' : typeof result.exitCode === 'number' ? 'fail' : 'not-checked',
    v1,
    v2,
    v3,
    v4,
    rawOutput: out,
  };
}

export async function verifyWithZipalign(
  zipalignPath: string,
  apkPath: string
): Promise<{ aligned: boolean | null; rawOutput: string }> {
  // zipalign -c -v 4 <apk>
  const result = await runToolSafe(zipalignPath, ['-c', '-P', '16', '-v', '4', apkPath]);
  const out = result.stdout + '\n' + result.stderr;
  const aligned = result.success ? true : typeof result.exitCode === 'number' ? false : null;
  return { aligned, rawOutput: out };
}
