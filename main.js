const { app, BrowserWindow, dialog } = require('electron');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

const root = path.join(__dirname, '..');
let staticServer = null;
let mainWindow = null;
let lastWindowUrl = '';
let logFilePath = '';

app.setName('Tokyo Personal AI');

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

function setupLogging() {
  const logDir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  logFilePath = path.join(logDir, 'main.log');
  logLine('Tokyo Personal AI desktop starting.');
}

function logLine(message, error) {
  const line = `[${new Date().toISOString()}] ${message}${error ? `\n${error.stack || error.message || String(error)}` : ''}\n`;
  if (logFilePath) {
    try {
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
  throw new Error(`No free localhost port found starting at ${startPort}.`);
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

function startApi(apiPort) {
  const serverPath = path.join(root, 'server', 'index.js');
  if (!fs.existsSync(serverPath)) return null;

  process.env.API_PORT = String(apiPort);
  logLine(`Starting local API on port ${apiPort}.`);
  require(serverPath);
  return true;
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
    const actualApiPort = await findFreePort(apiPort);
    apiBaseUrl = `http://127.0.0.1:${actualApiPort}`;
    startApi(actualApiPort);
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
  boot().catch((error) => {
    logLine('Tokyo Personal AI desktop startup failed.', error);
    dialog.showErrorBox(
      'Tokyo Personal AI startup failed',
      `${error.message || String(error)}\n\nA startup log was written to:\n${logFilePath}`,
    );
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

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

process.on('uncaughtException', (error) => {
  logLine('Uncaught main-process exception.', error);
  dialog.showErrorBox('Tokyo Personal AI error', `${error.message || String(error)}\n\nLog:\n${logFilePath}`);
});

process.on('unhandledRejection', (error) => {
  logLine('Unhandled main-process rejection.', error);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (staticServer) staticServer.close();
});
