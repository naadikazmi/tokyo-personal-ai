const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

const root = path.join(__dirname, '..');
const isWindows = process.platform === 'win32';

const processes = [];

async function findFreePort(startPort) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (await isPortFree(port)) return port;
    console.log(`Port ${port} is busy, trying ${port + 1}...`);
  }
  throw new Error(`No free localhost port found starting at ${startPort}.`);
}

async function findExistingTokyoApi(startPort) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (await probeTokyoApi(port)) return port;
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

function start(command, args, env = {}) {
  const launch = getLaunchCommand(command, args);
  const child = spawn(launch.command, launch.args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...env },
  });
  processes.push(child);
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
  for (const child of processes) {
    if (!child.killed) child.kill();
  }
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});

async function main() {
  console.log('Starting Tokyo Personal AI...');
  const preferredApiPort = Number(process.env.API_PORT || 8083);
  const existingApiPort = await findExistingTokyoApi(preferredApiPort);
  const apiPort = existingApiPort || await findFreePort(preferredApiPort);
  const webPort = await findFreePort(Number(process.env.TOKYO_WEB_PORT || 8082));
  const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
  const appUrl = `http://127.0.0.1:${webPort}`;

  if (existingApiPort) {
    console.log(`Reusing existing Tokyo local API at ${apiBaseUrl}.`);
  } else {
    console.log('Starting local API...');
    start(process.execPath, [path.join(root, 'server', 'index.js')], { API_PORT: String(apiPort) });
    await waitForUrl(`${apiBaseUrl}/api/settings/status`, 'Local API', 45000);
  }

  console.log('Starting Expo web...');
  start(isWindows ? 'npx.cmd' : 'npx', ['expo', 'start', '--web', '--port', String(webPort)], {
    EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
  });
  await waitForUrl(appUrl, 'Tokyo web app', 120000);

  const openUrl = `${appUrl}/?apiBaseUrl=${encodeURIComponent(apiBaseUrl)}`;
  console.log(`Opening app: ${openUrl}`);
  const opener = isWindows ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const openerArgs = isWindows ? ['/c', 'start', '', openUrl] : [openUrl];
  spawn(opener, openerArgs, { detached: true, stdio: 'ignore' }).unref();
}

main().catch((error) => {
  console.error(error.message);
  shutdown();
  process.exit(1);
});
