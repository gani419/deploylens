import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ToolExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runToolSafe(
  command: string,
  args: string[],
  timeoutMs = 15000,
  maxBuffer = 5 * 1024 * 1024
): Promise<ToolExecResult> {
  try {
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

export async function verifyWithApksigner(
  apksignerPath: string,
  apkPath: string
): Promise<{ verified: boolean; v1: boolean; v2: boolean; v3: boolean; v4: boolean; rawOutput: string }> {
  const result = await runToolSafe(apksignerPath, ['verify', '--verbose', '--print-certs', apkPath]);
  const out = result.stdout + '\n' + result.stderr;

  const verified = result.success && !out.toLowerCase().includes('failed');
  const v1 = /Verified using v1 scheme \(JAR signing\): true/i.test(out);
  const v2 = /Verified using v2 scheme \(APK Signature Scheme v2\): true/i.test(out);
  const v3 = /Verified using v3 scheme \(APK Signature Scheme v3\): true/i.test(out);
  const v4 = /Verified using v4 scheme \(APK Signature Scheme v4\): true/i.test(out);

  return {
    verified,
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
): Promise<{ aligned: boolean; rawOutput: string }> {
  // zipalign -c -v 4 <apk>
  const result = await runToolSafe(zipalignPath, ['-c', '-v', '4', apkPath]);
  const out = result.stdout + '\n' + result.stderr;
  const aligned = result.success && out.includes('Verification succesful');
  return { aligned, rawOutput: out };
}
