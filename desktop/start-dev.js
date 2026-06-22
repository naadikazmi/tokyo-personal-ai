const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

const root = path.join(__dirname, '..');
const isWindows = process.platform === 'win32';
const children = [];

async function findFreePort(startPort) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (await isPortFree(port)) return port;
    console.log(`Port ${port} is busy, trying ${port + 1}...`);
  }
  throw new Error(`No free localhost port found starting at ${startPort}.`);
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
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, host);
  });
}

function waitForUrl(url, label, timeoutMs = 120000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode >= 200 && response.statusCode < 500) {
          console.log(`${label} is ready.`);
          resolve();
          return;
        }
        retry();
      });
      request.on('error', retry);
      request.setTimeout(3000, () => {
        request.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`${label} was not ready at ${url}.`));
        return;
      }
      setTimeout(tick, 1500);
    };

    tick();
  });
}

function spawnChild(command, args, env = {}) {
  const launch = getLaunchCommand(command, args);
  const child = spawn(launch.command, launch.args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...env },
  });
  children.push(child);
  child.on('error', (error) => {
    console.error(`Failed to start ${command}: ${error.message}`);
    shutdown();
    process.exit(1);
  });
  child.on('exit', (code) => {
    if (code && code !== 0) {
      shutdown();
      process.exit(code);
    }
  });
  return child;
}

function getLaunchCommand(command, args) {
  if (isWindows && command.toLowerCase().endsWith('.cmd')) {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', command, ...args],
    };
  }
  return { command, args };
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

async function main() {
  console.log('Starting Tokyo Personal AI desktop development mode...');
  const apiPort = await findFreePort(Number(process.env.API_PORT || 8083));
  const webPort = await findFreePort(Number(process.env.TOKYO_WEB_PORT || 8082));
  const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
  const appUrl = `http://127.0.0.1:${webPort}`;

  console.log('Starting local API...');
  spawnChild(process.execPath, [path.join(root, 'server', 'index.js')], { API_PORT: String(apiPort) });
  await waitForUrl(`${apiBaseUrl}/api/settings/status`, 'Local API', 45000);

  console.log('Starting Expo web...');
  spawnChild(isWindows ? 'npx.cmd' : 'npx', ['expo', 'start', '--web', '--port', String(webPort)], {
    EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
  });
  await waitForUrl(appUrl, 'Expo web', 120000);

  console.log('Opening Electron window...');
  spawnChild(isWindows ? 'npx.cmd' : 'npx', ['electron', path.join(root, 'desktop', 'main.js')], {
    TOKYO_DESKTOP_DEV: '1',
    TOKYO_APP_URL: `${appUrl}/`,
    TOKYO_API_BASE_URL: apiBaseUrl,
    TOKYO_SKIP_API_START: '1',
  });
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});
process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});

main().catch((error) => {
  console.error(error.message);
  shutdown();
  process.exit(1);
});
