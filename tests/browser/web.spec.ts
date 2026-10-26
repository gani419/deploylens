import { test, expect } from '@playwright/test';
import { zip } from '../helpers/zip.js';

test('uploads a build, reports findings and downloads an ephemeral report', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ship with fewer');
  await expect(page.getByRole('button', { name: 'Inspect build' })).toBeDisabled();
  await page.locator('#build-file').setInputFiles('fixtures/android/test-app.aab');
  await page.getByRole('button', { name: 'Inspect build' }).click();
  await expect(page.getByRole('heading', { name: 'ACTION REQUIRED', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SampleApp', exact: true })).toBeVisible();
  await expect(page.locator('.app-identity')).toContainText('Android App Bundle');
  await expect(page.locator('.app-identity')).toContainText('test-app.aab');
  await expect(page.locator('.report-header')).toContainText('com.deploylens.sampleaab');
  await page.getByRole('button', { name: 'Findings & fixes' }).click();
  await expect(page.getByText('WHAT THIS MEANS', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Observed evidence' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How to verify' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Build details', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Signing evidence' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Package footprint' })).toBeVisible();
  await page.getByRole('button', { name: 'Android diagnostics' }).click();
  await expect(page.getByRole('heading', { name: '16 KB page-size inspection' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Native libraries packaged in this build' })).toContainText('libmath.so');
  await page.getByRole('link', { name: 'Documentation', exact: true }).click();
  await expect(page).toHaveURL('/documentation');
  await expect(page.getByRole('heading', { name: 'Does DeployLens use Android Profiler?' })).toBeVisible();
  await page.getByRole('link', { name: 'Inspect a build', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'SampleApp', exact: true })).toBeVisible();
  await expect(page.getByText('Original AAB upload signature verified.', { exact: false })).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON report' }).click();
  expect((await download).suggestedFilename()).toBe('test-app.aab.deploylens.json');
  await page.getByRole('button', { name: 'All checks' }).click();
  await expect(page.locator('.check-stage').getByText('AAB Bundle Signing Verification', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Store preparation' }).click();
  await expect(page.getByText('Use these as a starting point.', { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Download JSON report' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Inspect build' })).toBeDisabled();
});

test('documentation supports direct links, refresh and phone layouts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/documentation');
  await expect(page.getByRole('heading', { name: 'Understand your build report.' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Start with a build archive' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('privacy policy is directly addressable and explains temporary processing', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Development tooling without accounts or tracking' })).toBeVisible();
  await expect(page.getByText('DeployLens currently has no saved upload history or persistent report database.')).toBeVisible();
  await expect(page.getByText('loopback-only connection')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'No accounts, advertising or analytics' })).toBeVisible();
});

test('handles malformed builds visibly', async ({ page }) => {
  await page.goto('/'); await page.locator('#build-file').setInputFiles('fixtures/corrupt/corrupt.apk');
  await page.getByRole('button', { name: 'Inspect build' }).click();
  await expect(page.getByRole('alert')).toContainText('No readiness verdict');
  await expect(page.getByRole('button', { name: 'Inspect build' })).toBeEnabled();
});

test('home page works on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await expect(page.getByRole('button', { name: 'Drop your build here' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/web-mobile.png', fullPage: true });
});

test('full-width workspace supports both themes and an accessible mobile drawer', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Light theme', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.locator('.workspace').evaluate(element => element.getBoundingClientRect().right)).toBe(1600);
  await page.screenshot({ path: 'test-results/workspace-light.png', fullPage: true });
  await page.getByRole('button', { name: 'Dark theme', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'test-results/workspace-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Documentation', exact: true }).click();
  await expect(page).toHaveURL('/documentation');
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('iOS reports expose SDK, privacy and provisioning facts without runtime claims', async ({ page }) => {
  await page.goto('/');
  await page.locator('#build-file').setInputFiles('fixtures/ios/valid-app.ipa');
  await page.getByRole('button', { name: 'Inspect build', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sample iOS App', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'iOS diagnostics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Privacy & transport declarations' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Signing evidence' })).toBeVisible();
  await expect(page.getByText('Not performed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Manual verification', exact: true }).click();
  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: 'Build details', exact: true }).click();
  await page.getByRole('button', { name: 'Manual verification', exact: true }).click();
  await expect(page.getByRole('checkbox').first()).toBeChecked();
  await page.getByRole('button', { name: 'Findings & fixes' }).click();
  await page.getByRole('combobox', { name: 'Filter findings by result' }).selectOption('not-checked');
  await expect(page.getByText('WHAT THIS MEANS', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.meaning-block').first()).toContainText('verification gap');
  await page.screenshot({ path: 'test-results/ios-findings.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Dark theme', exact: true }).click();
  await page.screenshot({ path: 'test-results/ios-findings-mobile-dark.png', fullPage: true });
});

test('sharing keeps editable context and exports real report and email attachments', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.workspace-footer')).toContainText('DeployLens v1.0.0');
  await page.locator('#build-file').setInputFiles('fixtures/android/valid-app.apk');
  await page.getByRole('button', { name: 'Inspect build', exact: true }).click();
  await page.getByRole('button', { name: 'Share report & build', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Share report & build', exact: true })).toBeVisible();
  const message = page.getByRole('textbox', { name: 'Message', exact: true });
  expect(await message.inputValue()).toContain('Hello team,');
  await message.fill('Hello team,\nPlease fix this build.\nRegards, Ganesh');
  await page.context().route('https://mail.google.com/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Mock email composer</title>' }));
  const popupEvent = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Copy & open selected app' }).click();
  const popup = await popupEvent;
  await popup.waitForURL('https://mail.google.com/**');
  // Inspect the outgoing compose URL without relying on a Google account or network.
  const compose = new URL(popup.url());
  expect(compose.hostname).toBe('mail.google.com');
  expect(compose.searchParams.get('body')).toContain('Regards, Ganesh');
  await popup.close();
  const reportEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download readable report' }).click();
  const report = await reportEvent; expect(report.suggestedFilename()).toBe('valid-app.apk.deploylens.html');
  const fs = await import('node:fs/promises');
  const html = await fs.readFile((await report.path())!, 'utf8');
  expect(html).toContain('Recommended fix:'); expect(html).toContain('Developer verification still required');
  const draftEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download email with report attached (.eml)', exact: true }).click();
  const draft = await draftEvent;
  expect(await fs.readFile((await draft.path())!, 'utf8')).toContain('Content-Disposition: attachment;');
  await page.getByRole('checkbox', { name: 'Also share the original APK' }).check();
  const buildEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download original build' }).click();
  const build = await buildEvent;
  expect(await fs.readFile((await build.path())!)).toEqual(await fs.readFile('fixtures/android/valid-app.apk'));
  await page.getByRole('button', { name: 'All checks', exact: true }).click();
  await page.locator('.sidebar').getByRole('button', { name: 'Share report & build', exact: true }).click();
  await expect(message).toHaveValue('Hello team,\nPlease fix this build.\nRegards, Ganesh');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/share-mobile.png', fullPage: true, animations: 'disabled' });
});

test('optional comparison reports confirmed fixes while keeping the current build', async ({ page }) => {
  await page.goto('/');
  await page.locator('#build-file').setInputFiles('fixtures/android/valid-app.apk');
  await page.getByRole('button', { name: 'Inspect build', exact: true }).click();
  await page.getByRole('button', { name: 'Compare builds', exact: true }).click();
  const baseline = zip([
    { name: 'AndroidManifest.xml', data: Buffer.from('<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.deploylens.sample" android:versionCode="9" android:versionName="0.9"><uses-sdk android:minSdkVersion="24" android:targetSdkVersion="28"/><application android:debuggable="true" android:label="Sample"/></manifest>') },
    { name: 'classes.dex', data: Buffer.from('dex\n035\0baseline') },
  ]);
  await page.getByLabel('Previous build archive').setInputFiles({ name: 'previous.apk', mimeType: 'application/octet-stream', buffer: baseline });
  await page.getByRole('button', { name: 'Inspect previous build', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Build changes', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Confirmed fixed/ })).not.toContainText('(0)');
  await expect(page.locator('.report-header')).toContainText('valid-app.apk');
  await expect(page.locator('.workspace')).toHaveCSS('margin-left', '300px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
  await page.screenshot({ path: 'test-results/comparison.png', fullPage: true, animations: 'disabled' });
  await page.getByLabel('Previous build archive').setInputFiles('fixtures/ios/valid-app.ipa');
  await page.getByRole('button', { name: 'Inspect previous build', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('same platform');
  await page.getByRole('button', { name: 'Inspect another build' }).click();
  await expect(page.getByRole('button', { name: 'Inspect build', exact: true })).toBeDisabled();
});

test('device installer explains local requirements and does not enable installation without confirmation', async ({ page }) => {
  await page.goto('/'); await page.locator('#build-file').setInputFiles('fixtures/android/valid-app.apk');
  await page.getByRole('button', { name: 'Inspect build', exact: true }).click();
  await page.getByRole('button', { name: 'Install on Android', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Install APK on selected device' })).toBeDisabled();
  await page.getByRole('button', { name: 'Refresh connected devices' }).click();
  await expect(page.getByRole('alert')).toContainText('Local device access is disabled');
  await expect(page.getByRole('button', { name: 'Install APK on selected device' })).toBeDisabled();
});


test('desktop navigation collapses to an accessible icon rail while remaining scrollable', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 720 }); await page.goto('/');
  await expect(page.locator('.sidebar')).toHaveCSS('width', '300px');
  await expect(page.locator('.workspace-header').getByRole('button', { name: 'Collapse navigation' })).toHaveCount(0);
  await page.locator('.sidebar').getByRole('button', { name: 'Collapse navigation' }).click();
  await expect(page.getByRole('button', { name: 'Expand navigation' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.sidebar')).toHaveCSS('width', '84px');
  await expect(page.locator('.sidebar-link .nav-label').first()).toBeHidden();
  await page.getByRole('link', { name: 'Documentation', exact: true }).click();
  await expect(page).toHaveURL('/documentation');
  await page.screenshot({ path: 'test-results/navigation-collapsed.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Expand navigation' }).click();
  await expect(page.locator('.sidebar')).toHaveCSS('width', '300px');
  expect(await page.locator('.sidebar').evaluate(element => getComputedStyle(element).scrollbarWidth)).toBe('none');
  await page.locator('.sidebar').evaluate(element => { element.scrollTop = element.scrollHeight; });
  expect(await page.locator('.sidebar').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
});

test('store drafts edit directly and survive report navigation, and issues offer a research draft', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/'); await page.locator('#build-file').setInputFiles('fixtures/android/valid-app.apk');
  await page.getByRole('button', { name: 'Inspect build', exact: true }).click();
  await page.getByRole('button', { name: 'Store preparation', exact: true }).click();
  await expect(page.locator('.listing-editor')).toHaveCount(0);
  await page.locator('.listing-preview').first().click();
  const editor = page.locator('.listing-editor').first();
  await editor.fill('Edited release description');
  await page.getByRole('button', { name: /^Copy / }).first().click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Edited release description');
  await page.getByRole('button', { name: 'Build details', exact: true }).click();
  await expect(page.locator('.masonry-details')).toHaveCSS('column-count', '2');
  await expect(page.locator('.workspace')).toHaveCSS('margin-left', '300px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
  await page.screenshot({ path: 'test-results/build-details-flow.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Store preparation', exact: true }).click();
  await expect(page.locator('.listing-editor')).toHaveCount(0);
  await expect(page.locator('.listing-preview').first()).toHaveText('Edited release description');
  await page.locator('.listing-preview').first().click();
  await editor.fill('Discard this edit'); await editor.press('Escape');
  await expect(page.locator('.listing-preview').first()).toHaveText('Edited release description');
  await page.getByRole('button', { name: 'Findings & fixes', exact: true }).click();
  await page.getByRole('button', { name: 'Research this issue', exact: true }).first().click();
  const draft = page.getByRole('textbox', { name: 'Issue description' }).first();
  expect(await draft.inputValue()).toContain('### Reproduction details');
  expect(await draft.inputValue()).toContain('Suggested fix');
  await draft.fill('## Edited research question');
  await page.getByRole('button', { name: 'Copy issue description' }).first().click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('## Edited research question');
});

test('permission diagnostics flags API/declaration mismatches and switches platform views', async ({ page }) => {
  const apk = zip([
    { name: 'AndroidManifest.xml', data: Buffer.from('<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.camera.sample" android:versionCode="1" android:versionName="1.0"><uses-sdk android:minSdkVersion="24" android:targetSdkVersion="36"/><application android:label="Camera Sample"/></manifest>') },
    { name: 'classes.dex', data: Buffer.from('dex\n035\0 Landroid/hardware/camera2/CameraManager; openCamera requestPermissions android.settings.APPLICATION_DETAILS_SETTINGS') },
  ]);
  await page.goto('/'); await page.locator('#build-file').setInputFiles({ name: 'camera.apk', mimeType: 'application/octet-stream', buffer: apk });
  await page.getByRole('button', { name: 'Inspect build', exact: true }).click();
  await page.getByRole('button', { name: 'Android diagnostics', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Referenced features and declarations' })).toContainText('android.permission.CAMERA');
  await expect(page.getByRole('table', { name: 'Referenced features and declarations' })).toContainText('Missing');
  await expect(page.getByRole('heading', { name: 'Exported component exposure' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'iOS diagnostics', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Inspect another build' }).click();
  await page.locator('#build-file').setInputFiles('fixtures/ios/valid-app.ipa');
  await page.getByRole('button', { name: 'Inspect build', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Android diagnostics', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'iOS diagnostics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'API usage & permission declarations', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Install on iPhone', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Install on iPhone', exact: true })).toBeVisible();
  await expect(page.getByText('libimobiledevice', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Install IPA on selected device' })).toBeDisabled();
});


test('one Share action hands the selected report and original archive to system sharing', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', { value: async (data: ShareData) => { (window as unknown as { shared: unknown }).shared = { title: data.title, text: data.text, files: data.files?.map(file => ({ name: file.name, size: file.size })) }; }, configurable: true });
  });
  await page.goto('/'); await page.locator('#build-file').setInputFiles('fixtures/android/valid-app.apk');
  await page.getByRole('button', { name: 'Inspect build', exact: true }).click();
  await page.getByRole('button', { name: 'Share report & build', exact: true }).first().click();
  await page.getByRole('checkbox', { name: 'Also share the original APK' }).check();
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const shared = await page.evaluate(() => (window as unknown as { shared: { text: string; files: Array<{ name: string; size: number }> } }).shared);
  expect(shared.text).toContain('Hello team,'); expect(shared.files.map(file => file.name)).toEqual(['valid-app.apk.deploylens.html', 'valid-app.apk']);
  await expect(page.getByRole('status')).toContainText('Share handoff completed');
});


test('an interrupted inspection stream never creates a successful report', async ({ page }) => {
  await page.route('**/api/scans?*', route => route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: '{"type":"scan.completed"' }));
  await page.goto('/'); await page.locator('#build-file').setInputFiles('fixtures/android/valid-app.apk');
  await page.getByRole('button', { name: 'Inspect build', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('interrupted');
  await expect(page.getByRole('button', { name: 'Download JSON report' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Inspect build', exact: true })).toBeEnabled();
});

test('cancelling browser transport leaves the selected archive ready for retry', async ({ page }) => {
  let pending: import('@playwright/test').Route | undefined;
  await page.route('**/api/scans?*', route => { pending = route; });
  await page.goto('/'); await page.locator('#build-file').setInputFiles('fixtures/android/valid-app.apk');
  await page.getByRole('button', { name: 'Inspect build', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel inspection' }).click();
  await expect(page.getByRole('alert')).toContainText('cancelled');
  await expect(page.getByRole('button', { name: 'Inspect build', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Download JSON report' })).toHaveCount(0);
  await pending?.abort().catch(() => {});
});
