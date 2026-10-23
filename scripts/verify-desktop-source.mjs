import { _electron } from '@playwright/test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const env = {
  ...process.env,
  ELECTRON_ENABLE_LOGGING: '1',
  DEPLOYLENS_DESKTOP_USER_DATA: path.resolve('test-results/electron-verification-user-data'),
  DEPLOYLENS_DISABLE_GPU: '1',
};
delete env.ELECTRON_RUN_AS_NODE;

let application;
let exitCode = 1;
try {
  application = await _electron.launch({
    args: [path.resolve('apps/desktop'), '--no-sandbox', '--disable-gpu', '--disable-software-rasterizer'],
    env,
  });
  const window = await application.firstWindow();
  await window.waitForFunction(() => Boolean(window.deployLens));
  const capabilities = await window.evaluate(() => window.deployLens.detectCapabilities());
  assert.ok(Object.hasOwn(capabilities, 'apksigner'), 'Preload bridge did not return desktop capabilities.');

  await window.locator('#build-file').setInputFiles(path.resolve('fixtures/android/valid-app.apk'));
  await window.getByRole('button', { name: 'Inspect build', exact: true }).click();
  await window.getByRole('heading', { name: 'SampleApp', exact: true }).waitFor({ timeout: 20000 });
  await window.getByRole('button', { name: 'Share report & build', exact: true }).first().waitFor();
  await window.getByRole('button', { name: 'Compare builds', exact: true }).waitFor();
  await window.getByRole('button', { name: 'Install on Android', exact: true }).click();
  await window.getByRole('heading', { name: 'Local device connection', exact: true }).waitFor();
  console.log('Desktop source shell and local inspection passed.');
  exitCode = 0;
} finally {
  const child = application?.process();
  if (child?.pid && child.exitCode === null) {
    if (process.platform === 'win32') {
      try { execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch {}
    } else {
      child.kill('SIGKILL');
    }
  }
  process.exit(exitCode);
}
