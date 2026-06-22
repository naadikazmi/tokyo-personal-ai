const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

const root = path.join(__dirname, '..');
let staticServer = null;
let localApiServer = null;
let localApiStartedByApp = false;
let mainWindow = null;
let lastWindowUrl = '';
let logFilePath = fallbackLogPath();

app.setName('Tokyo Personal AI');

process.on('uncaughtException', (error) => {
  logLine('Uncaught main-process exception.', error);
  dialog.showErrorBox('Tokyo Personal AI error', `${error.message || String(error)}\n\nLog:\n${logFilePath}`);
});

process.on('unhandledRejection', (error) => {
  logLine('Unhandled main-process rejection.', error);
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  process.exit(0);
}

function setupLogging() {
  const logDir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  logFilePath = path.join(logDir, 'main.log');
  logLine('Tokyo Personal AI desktop starting.');
}

function fallbackLogPath() {
  const appData = process.env.APPDATA || process.env.LOCALAPPDATA || process.cwd();
  return path.join(appData, 'Tokyo Personal AI', 'logs', 'main.log');
}

function logLine(message, error) {
  const line = `[${new Date().toISOString()}] ${message}${error ? `\n${error.stack || error.message || String(error)}` : ''}\n`;
  if (logFilePath) {
    try {
      fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
      fs.appendFileSync(logFilePath, line, 'utf8');
    } catch {
      // Logging must never prevent startup.
    }
  }
  console.log(message, error || '');
}

async function findFreePort(startPort) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (await isPortFree(port)) return port;
  }
  throw startupError(
    `Tokyo could not find an available local port from ${startPort} to ${startPort + 49}.`,
    'NO_FREE_PORT',
    { startPort, endPort: startPort + 49 },
  );
}

function startupError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

async function findExistingTokyoApi(startPort) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    const status = await probeTokyoApi(port);
    if (status) {
      return { port, url: `http://127.0.0.1:${port}` };
    }
  }
  return null;
}

function probeTokyoApi(port) {
  return new Promise((resolve) => {
    const request = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/settings/status',
        timeout: 800,
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
          if (body.length > 4096) request.destroy();
        });
        response.on('end', () => {
          try {
            const payload = JSON.parse(body);
            resolve(payload?.app?.id === 'tokyo-personal-ai');
          } catch {
            resolve(false);
          }
        });
      },
    );
    request.on('error', () => resolve(false));
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
  });
}

function isPortFree(port) {
  return Promise.all([isPortFreeOnHost(port, '127.0.0.1'), isPortFreeOnHost(port, '::')]).then((results) =>
    results.every(Boolean),
  );
}

function isPortFreeOnHost(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (error) => {
      if (error.code === 'EADDRNOTAVAIL') {
        resolve(true);
        return;
      }
      resolve(false);
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function startApi(apiPort) {
  const serverPath = path.join(root, 'server', 'index.js');
  if (!fs.existsSync(serverPath)) return null;

  process.env.API_PORT = String(apiPort);
  process.env.API_HOST = '127.0.0.1';
  logLine(`Starting local API on port ${apiPort}.`);
  const apiModule = require(serverPath);
  if (apiModule && typeof apiModule.startServer === 'function') {
    return apiModule.startServer({ preferredPort: apiPort, host: '127.0.0.1' });
  }
  return { port: apiPort, host: '127.0.0.1' };
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.js') return 'text/javascript; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.json') return 'application/json; charset=utf-8';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.ico') return 'image/x-icon';
  if (extension === '.woff') return 'font/woff';
  if (extension === '.woff2') return 'font/woff2';
  return 'application/octet-stream';
}

function startStaticServer(webPort) {
  const distDir = path.join(root, 'dist');
  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error('Web build not found. Run npm run build:web before starting the packaged desktop app.');
  }

  staticServer = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || '/', `http://127.0.0.1:${webPort}`);
    const safePath = path
      .normalize(decodeURIComponent(requestUrl.pathname))
      .replace(/^(\.\.[/\\])+/, '')
      .replace(/^[/\\]/, '');
    const candidate = path.join(distDir, safePath || 'index.html');
    const filePath = candidate.startsWith(distDir) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
      ? candidate
      : indexPath;

    response.writeHead(200, { 'Content-Type': contentType(filePath) });
    fs.createReadStream(filePath).pipe(response);
  });

  return new Promise((resolve, reject) => {
    staticServer.once('error', reject);
    staticServer.listen(webPort, '127.0.0.1', resolve);
  });
}

function createWindow(url) {
  lastWindowUrl = url;
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    title: 'Tokyo Personal AI',
    backgroundColor: '#070A12',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL(url);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  return mainWindow;
}

async function boot() {
  let apiBaseUrl = process.env.TOKYO_API_BASE_URL || '';
  if (!apiBaseUrl && process.env.TOKYO_SKIP_API_START !== '1') {
    const apiPort = Number(process.env.TOKYO_API_PORT || process.env.API_PORT || 8083);
    const existingApi = await findExistingTokyoApi(apiPort);
    if (existingApi) {
      apiBaseUrl = existingApi.url;
      logLine(`Reusing existing Tokyo local API at ${apiBaseUrl}.`);
    } else {
      const actualApiPort = await findFreePort(apiPort);
      if (actualApiPort !== apiPort) {
        logLine(`Preferred API port ${apiPort} is busy. Using ${actualApiPort} instead.`);
      }
      const apiInfo = await startApi(actualApiPort);
      localApiServer = apiInfo?.server || null;
      localApiStartedByApp = Boolean(localApiServer);
      apiBaseUrl = `http://127.0.0.1:${apiInfo?.port || actualApiPort}`;
      logLine(`Local API ready at ${apiBaseUrl}.`);
    }
  }
  if (!apiBaseUrl) {
    apiBaseUrl = 'http://127.0.0.1:8083';
  }

  if (process.env.TOKYO_APP_URL) {
    const url = new URL(process.env.TOKYO_APP_URL);
    url.searchParams.set('apiBaseUrl', apiBaseUrl);
    createWindow(url.toString());
    return;
  }

  const webPort = await findFreePort(Number(process.env.TOKYO_WEB_PORT || 8082));
  logLine(`Starting static web server on port ${webPort}.`);
  await startStaticServer(webPort);
  createWindow(`http://127.0.0.1:${webPort}/?apiBaseUrl=${encodeURIComponent(apiBaseUrl)}`);
}

app.whenReady().then(() => {
  setupLogging();
  registerDesktopBridge();
  boot().catch((error) => {
    logLine('Tokyo Personal AI desktop startup failed.', error);
    showStartupError(error);
    app.quit();
  });

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      return;
    }
    if (lastWindowUrl) {
      createWindow(lastWindowUrl);
    }
  });
});

function registerDesktopBridge() {
  ipcMain.handle('tokyo:choose-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow || undefined, {
      title: 'Choose Tokyo safe workspace folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? { canceled: true } : { canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle('tokyo:choose-pdf', async () => {
    const result = await dialog.showOpenDialog(mainWindow || undefined, {
      title: 'Choose PDF for Tokyo Notes Studio',
      properties: ['openFile'],
      filters: [{ name: 'PDF files', extensions: ['pdf'] }],
    });
    return result.canceled ? { canceled: true } : { canceled: false, path: result.filePaths[0] };
  });
}

function showStartupError(error) {
  if (error?.code === 'NO_FREE_PORT') {
    const { startPort, endPort } = error.details || {};
    dialog.showMessageBoxSync({
      type: 'warning',
      title: 'Tokyo Personal AI needs a free local port',
      message: 'Tokyo could not start because all checked local ports are busy.',
      detail: [
        startPort && endPort ? `Checked ports: ${startPort}-${endPort}.` : error.message,
        'Close extra Tokyo windows or other local servers, then open Tokyo again.',
        `Startup log: ${logFilePath}`,
      ].join('\n\n'),
      buttons: ['OK'],
      defaultId: 0,
    });
    return;
  }

  dialog.showErrorBox(
    'Tokyo Personal AI startup failed',
    `${error.message || String(error)}\n\nA startup log was written to:\n${logFilePath}`,
  );
}

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (staticServer) staticServer.close();
  if (localApiStartedByApp && localApiServer) {
    logLine('Stopping local API started by this app.');
    localApiServer.close((error) => {
      if (error) logLine('Local API did not close cleanly.', error);
    });
  }
});
