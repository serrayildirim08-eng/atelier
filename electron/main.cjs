/**
 * Electron main process for Atelier.
 *
 * Dev:   loads http://localhost:3000 (run `next dev` separately or via npm script).
 * Prod:  spawns the Next.js standalone server on a free port and loads that.
 */
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const net = require('node:net');
const http = require('node:http');

const isDev = !app.isPackaged;

let mainWindow = null;
let nextServerProcess = null;

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForHttp(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error('Server did not start in time'));
        else setTimeout(tick, 250);
      });
    };
    tick();
  });
}

async function startNextServer() {
  const port = await findFreePort();
  // In a packaged build the standalone bundle is shipped as an extraResource.
  const standaloneRoot = isDev
    ? path.join(__dirname, '..', '.next', 'standalone')
    : path.join(process.resourcesPath, 'app-standalone');
  const serverEntry = path.join(standaloneRoot, 'server.js');

  nextServerProcess = spawn(process.execPath, [serverEntry], {
    cwd: standaloneRoot,
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      // Electron's bundled node honors this; needed because we're invoking via execPath.
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: 'inherit',
  });

  nextServerProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error('Next server exited with code', code);
    }
  });

  await waitForHttp(`http://127.0.0.1:${port}`);
  return `http://127.0.0.1:${port}`;
}

function createWindow(targetUrl) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#F1E9D6',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    title: 'Atelier',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(targetUrl);

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  buildMenu();
  try {
    const url = isDev ? 'http://localhost:3000' : await startNextServer();
    createWindow(url);
  } catch (err) {
    console.error('Failed to start Atelier:', err);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (nextServerProcess && !nextServerProcess.killed) {
    nextServerProcess.kill();
  }
});
