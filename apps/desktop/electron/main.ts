import { app, BrowserWindow, ipcMain, dialog, shell, clipboard } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DeployLensEngine } from '@deploylens/core';
import type { ScanRequest, ArtifactIdentity, Platform, ArtifactType } from '@deploylens/contracts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
const engine = new DeployLensEngine();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 950,
    minHeight: 700,
    title: 'DeployLens',
    backgroundColor: '#090d16',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Security: Block all in-app navigation outside renderer
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Security: Deny window.open popups, open external safe URLs in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (process.env['VITE_DEV_SERVER_URL']) {
    mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL']);
  } else {
    // In production build, load index.html from dist
    const prodPath = path.join(__dirname, '../dist/index.html');
    if (fs.existsSync(prodPath)) {
      mainWindow.loadFile(prodPath);
    } else {
      mainWindow.loadURL('http://localhost:5173');
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler: Select file
ipcMain.handle('deploylens:select-file', async (): Promise<ArtifactIdentity | null> => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Mobile App Build Artifact',
    properties: ['openFile'],
    filters: [
      { name: 'Mobile Application Archives', extensions: ['apk', 'aab', 'ipa'] },
      { name: 'Android APK', extensions: ['apk'] },
      { name: 'Android App Bundle', extensions: ['aab'] },
      { name: 'iOS App Archive', extensions: ['ipa'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const selectedPath = result.filePaths[0]!;
  const stat = fs.statSync(selectedPath);
  const ext = path.extname(selectedPath).toLowerCase();

  let platform: Platform = 'android';
  let artifactType: ArtifactType = 'apk';

  if (ext === '.ipa') {
    platform = 'ios';
    artifactType = 'ipa';
  } else if (ext === '.aab') {
    platform = 'android';
    artifactType = 'aab';
  }

  return {
    path: selectedPath,
    fileName: path.basename(selectedPath),
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
  if (!request || typeof request !== 'object') {
    throw new Error('Invalid scan request payload');
  }

  const scanReq = request as ScanRequest;
  if (!scanReq.artifactPath || typeof scanReq.artifactPath !== 'string') {
    throw new Error('Invalid artifact path parameter');
  }

  return engine.inspectArtifact(scanReq, (scanEvent) => {
    if (event.sender && !event.sender.isDestroyed()) {
      event.sender.send('deploylens:scan-event', scanEvent);
    }
  });
});

// IPC Handler: Cancel scan
ipcMain.handle('deploylens:cancel-scan', async (_, scanId: unknown) => {
  if (typeof scanId === 'string') {
    engine.cancelScan(scanId);
  }
});

// IPC Handler: Open external link (only http/https)
ipcMain.handle('deploylens:open-external', async (_, url: unknown) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});

// IPC Handler: Copy to clipboard (explicit user action)
ipcMain.handle('deploylens:copy-clipboard', async (_, text: unknown) => {
  if (typeof text === 'string') {
    clipboard.writeText(text);
  }
});
