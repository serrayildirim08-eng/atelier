/**
 * Electron main process for AKALAN Atelier.
 *
 * Dev:   loads http://localhost:3000 (run `next dev` separately or via npm script).
 * Prod:  spawns the Next.js standalone server on a free port and loads that.
 */
const { app, BrowserWindow, Menu, shell, ipcMain, dialog, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn } = require('node:child_process');
const net = require('node:net');
const http = require('node:http');

const isDev = !app.isPackaged;

/**
 * Load env from a .env-style file. Returns a flat key→value object.
 * Lines starting with # are comments. Values are NOT shell-expanded.
 */
function loadEnvFile(p) {
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const out = {};
    for (const rawLine of raw.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      // Strip wrapping quotes if present.
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Discover env keys (most importantly ANTHROPIC_API_KEY) across the
 * locations the user might have set them. GUI launches from Finder
 * inherit no shell env, so process.env.ANTHROPIC_API_KEY is empty.
 * Search order: project .env.local → ~/.akalan/.env → already in env.
 */
function loadDiscoveredEnv() {
  const candidates = [
    path.join(__dirname, '..', '.env.local'),
    path.join(os.homedir(), 'projects', 'akalan-portal', '.env.local'),
    path.join(os.homedir(), '.akalan', '.env'),
  ];
  let merged = {};
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      merged = { ...loadEnvFile(p), ...merged };
    }
  }
  return merged;
}

const APP_ICON_PATH = path.join(__dirname, '..', 'build', 'icon.png');

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

function probeHttp(url, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode != null && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startNextServer() {
  const port = await findFreePort();
  // In a packaged build the standalone bundle is shipped as an extraResource.
  const standaloneRoot = isDev
    ? path.join(__dirname, '..', '.next', 'standalone')
    : path.join(process.resourcesPath, 'app-standalone');
  const serverEntry = path.join(standaloneRoot, 'server.js');

  // Discover env keys from disk (.env.local, ~/.akalan/.env). GUI launches
  // from Finder inherit no shell env, so ANTHROPIC_API_KEY would otherwise
  // be missing and every model call would 500. Also keeps the user from
  // having to set env in their shell profile.
  const discovered = loadDiscoveredEnv();

  // Polyfills for DOMMatrix / ImageData / Path2D — pdfjs-dist (pulled in
  // by pdf-parse) checks these at module-load and throws on plain Node.
  // The polyfill runs before server.js via Node's --require.
  const polyfillsPath = path.join(__dirname, 'pdf-polyfills.js');

  nextServerProcess = spawn(process.execPath, ['--require', polyfillsPath, serverEntry], {
    cwd: standaloneRoot,
    env: {
      ...process.env,
      ...discovered,
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      // Electron's bundled node honors this; needed because we're invoking via execPath.
      ELECTRON_RUN_AS_NODE: '1',
    },
    // Pipe stdio to a log file under userData so we can debug failures
    // when launched from Finder (no terminal). 'inherit' would tie the
    // child to the parent's UI session and add a Dock icon; 'ignore'
    // breaks ELECTRON_RUN_AS_NODE silently. Pipes are the middle ground.
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });
  try {
    const logPath = path.join(app.getPath('userData'), 'next-server.log');
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    nextServerProcess.stdout?.pipe(logStream);
    nextServerProcess.stderr?.pipe(logStream);
    console.log('next-server log:', logPath);
  } catch (e) {
    console.warn('Could not attach next-server log:', e.message);
  }

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
    title: 'atelier',
    icon: APP_ICON_PATH,
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

ipcMain.handle('dialog:pickFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Choose a folder of PDFs',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

app.whenReady().then(async () => {
  buildMenu();
  // macOS dock icon — BrowserWindow#icon is a no-op on darwin in dev mode;
  // the dock reflects the app bundle's icon when packaged but falls back
  // to Electron's default during `electron .`. Calling app.dock.setIcon
  // overrides that so the dev session shows the atelier mark too.
  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(nativeImage.createFromPath(APP_ICON_PATH));
    } catch (e) {
      console.warn('Could not set dock icon:', e.message);
    }
  }
  try {
    // Even in a packaged build: if a dev server is already running on
    // localhost:3000 (e.g., `npm run dev`), prefer it. That keeps the
    // installed atelier.app reflecting current source instead of frozen
    // build-time code. Falls back to the bundled standalone server.
    let url;
    if (isDev) {
      url = 'http://localhost:3000';
    } else if (await probeHttp('http://localhost:3000')) {
      url = 'http://localhost:3000';
      console.log('atelier: attaching to dev server at localhost:3000');
    } else {
      url = await startNextServer();
    }
    createWindow(url);
  } catch (err) {
    console.error('Failed to start atelier:', err);
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
