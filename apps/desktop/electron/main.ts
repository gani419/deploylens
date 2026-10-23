import { app, BrowserWindow, ipcMain, dialog, shell, clipboard, session, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { product } from '@deploylens/config';
import { DeployLensEngine } from '@deploylens/core';
import type { ScanRequest, ArtifactIdentity, Platform, ArtifactType } from '@deploylens/contracts';
import { createWebServer } from '../../server/src/index.mjs';
import type { Server } from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let selectedArtifactPath: string | null = null;
let localServer: Server | null = null;
const engine = new DeployLensEngine();

if (process.env.DEPLOYLENS_DESKTOP_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.DEPLOYLENS_DESKTOP_USER_DATA));
}
if (process.env.DEPLOYLENS_DISABLE_GPU === '1') {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
}

function getLocalServerPort() {
  const configured = Number(process.env.DEPLOYLENS_DESKTOP_PORT ?? 0);
  return Number.isInteger(configured) && configured >= 1024 && configured <= 65535 ? configured : 0;
}

function isTrusted(event: IpcMainInvokeEvent) {
  return !!mainWindow && event.sender === mainWindow.webContents && event.senderFrame === mainWindow.webContents.mainFrame;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 950,
    minHeight: 700,
    title: product.name,
    backgroundColor: '#090d16',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  });

  // Security: Block all in-app navigation outside renderer
  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
  });

  // Security: Deny window.open popups, open external safe URLs in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const staticDir = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.resolve(__dirname, '../../web/dist');
  const workerPath = path.join(__dirname, 'worker.mjs');
  localServer = createWebServer({ staticDir, workerPath, localDevices: true });
  localServer.listen(getLocalServerPort(), '127.0.0.1', () => {
    const address = localServer?.address();
    if (mainWindow && address && typeof address === 'object') void mainWindow.loadURL(`http://127.0.0.1:${address.port}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.deploylens.desktop');
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  localServer?.close(); localServer = null;
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler: Select file
ipcMain.handle('deploylens:select-file', async (event): Promise<ArtifactIdentity | null> => {
  if (!isTrusted(event) || !mainWindow) throw new Error('Untrusted file selection request');

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Mobile App Build Artifact',
    properties: ['openFile'],
    filters: [
      { name: 'Mobile Application Archives', extensions: ['apk', 'aab', 'ipa'] },
      { name: 'Android APK', extensions: ['apk'] },
      { name: 'Android App Bundle', extensions: ['aab'] },
      { name: 'iOS App Archive', extensions: ['ipa'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const selectedPath = result.filePaths[0]!;
  const ext = path.extname(selectedPath).toLowerCase();
  if (!['.apk', '.aab', '.ipa'].includes(ext)) {
    await dialog.showMessageBox(mainWindow, { type: 'warning', title: 'Unsupported build', message: 'Choose an APK, AAB or IPA archive.' });
    return null;
  }
  const trustedPath = fs.realpathSync(selectedPath);
  const stat = fs.statSync(trustedPath);
  if (!stat.isFile()) throw new Error('The selected build is not a regular file.');

  let platform: Platform = 'android';
  let artifactType: ArtifactType = 'apk';

  if (ext === '.ipa') {
    platform = 'ios';
    artifactType = 'ipa';
  } else if (ext === '.aab') {
    platform = 'android';
    artifactType = 'aab';
  }

  selectedArtifactPath = trustedPath;
  return {
    path: trustedPath,
    fileName: path.basename(trustedPath),
    sizeBytes: stat.size,
    platform,
    artifactType,
  };
});

// IPC Handler: Detect capabilities
ipcMain.handle('deploylens:detect-capabilities', async () => {
  return engine.detectCapabilities();
});

// IPC Handler: Inspect artifact
ipcMain.handle('deploylens:inspect-artifact', async (event, request: unknown) => {
  if (!isTrusted(event)) {
    throw new Error('Untrusted scan request');
  }
  if (!request || typeof request !== 'object') {
    throw new Error('Invalid scan request payload');
  }

  const scanReq = request as ScanRequest;
  if (!scanReq.artifactPath || typeof scanReq.artifactPath !== 'string') {
    throw new Error('Invalid artifact path parameter');
  }
  let requestedPath: string;
  try { requestedPath = fs.realpathSync(scanReq.artifactPath); }
  catch { throw new Error('The selected build is no longer available.'); }
  if (!selectedArtifactPath || requestedPath !== selectedArtifactPath) {
    throw new Error('Select the build through DeployLens before inspecting it.');
  }
  scanReq.artifactPath = requestedPath;

  return engine.inspectArtifact(scanReq, (scanEvent) => {
    if (event.sender && !event.sender.isDestroyed()) {
      event.sender.send('deploylens:scan-event', scanEvent);
    }
  });
});

// IPC Handler: Cancel scan
ipcMain.handle('deploylens:cancel-scan', async (event, scanId: unknown) => {
  if (!isTrusted(event)) throw new Error('Untrusted cancellation request');
  if (typeof scanId === 'string') {
    engine.cancelScan(scanId);
  }
});

// IPC Handler: Open external link (only http/https)
ipcMain.handle('deploylens:open-external', async (event, url: unknown) => {
  if (!isTrusted(event)) throw new Error('Untrusted external-link request');
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});

// IPC Handler: Copy to clipboard (explicit user action)
ipcMain.handle('deploylens:copy-clipboard', async (event, text: unknown) => {
  if (!isTrusted(event)) throw new Error('Untrusted clipboard request');
  if (typeof text === 'string') {
    clipboard.writeText(text);
  }
});
