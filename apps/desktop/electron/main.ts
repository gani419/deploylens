import { app, BrowserWindow, shell, session } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { product } from '@deploylens/config';
import { createWebServer } from '../../server/src/index.mjs';
import type { Server } from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let localServer: Server | null = null;

if (process.env.DEPLOYLENS_DESKTOP_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.DEPLOYLENS_DESKTOP_USER_DATA));
}
if (process.env.DEPLOYLENS_DISABLE_GPU === '1') {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

function getLocalServerPort() {
  const configured = Number(process.env.DEPLOYLENS_DESKTOP_PORT ?? 0);
  return Number.isInteger(configured) && configured >= 1024 && configured <= 65535 ? configured : 0;
}

function closeLocalServer() {
  if (!localServer) return;
  localServer.close();
  localServer.closeAllConnections();
  localServer = null;
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

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

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
}

app.on('window-all-closed', () => {
  closeLocalServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
