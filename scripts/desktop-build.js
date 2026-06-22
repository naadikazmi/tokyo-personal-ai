const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const mode = process.argv[2] === 'build' ? 'build' : 'pack';
const target = mode === 'build' ? 'nsis' : 'dir';
const runtimeDir = path.join(root, '.tokyo-runtime');
const finalReleaseDir = path.join(root, 'release');
const tempReleaseDir = path.join(os.tmpdir(), 'tokyo-personal-ai-electron-release');

function run(command, args) {
  const executable = process.platform === 'win32' && !command.endsWith('.cmd') ? `${command}.cmd` : command;
  const launchCommand = process.platform === 'win32' ? 'cmd.exe' : executable;
  const launchArgs = process.platform === 'win32' ? ['/d', '/s', '/c', executable, ...args] : args;
  const result = spawnSync(launchCommand, launchArgs, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    process.exitCode = 1;
    throw new Error(`${command} ${args.join(' ')} failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    throw new Error(`${command} ${args.join(' ')} failed.`);
  }
}

function removePath(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function prepareBuilderConfig() {
  fs.mkdirSync(runtimeDir, { recursive: true });
  const baseConfig = JSON.parse(fs.readFileSync(path.join(root, 'electron-builder.json'), 'utf8'));
  baseConfig.directories = {
    ...(baseConfig.directories || {}),
    output: tempReleaseDir,
  };
  const tempConfigPath = path.join(runtimeDir, `electron-builder.${mode}.json`);
  fs.writeFileSync(tempConfigPath, JSON.stringify(baseConfig, null, 2));
  return tempConfigPath;
}

function removeStaleBuildTemps() {
  for (const name of ['win-unpacked.tmp', 'builder-debug.yml', 'builder-effective-config.yaml']) {
    removePath(path.join(finalReleaseDir, name));
  }
  removePath(tempReleaseDir);
}

function publishTempOutput() {
  fs.mkdirSync(finalReleaseDir, { recursive: true });
  const tempEntries = new Set(fs.readdirSync(tempReleaseDir));
  for (const entry of fs.readdirSync(finalReleaseDir)) {
    if (!tempEntries.has(entry)) {
      removePath(path.join(finalReleaseDir, entry));
    }
  }
  for (const entry of fs.readdirSync(tempReleaseDir)) {
    const source = path.join(tempReleaseDir, entry);
    const destination = path.join(finalReleaseDir, entry);
    if (fs.existsSync(destination) && !fs.statSync(destination).isDirectory()) {
      removePath(destination);
    }
    fs.cpSync(source, destination, { recursive: true, force: true });
  }
}

try {
  removeStaleBuildTemps();
  const tempConfigPath = prepareBuilderConfig();
  run('npm', ['run', 'build:web']);
  run('npx', ['electron-builder', '--win', target, '--config', tempConfigPath, '--publish', 'never']);
  publishTempOutput();
  console.log(`Tokyo Personal AI desktop ${mode} finished. Output is in release/.`);
} catch (error) {
  console.error('');
  console.error('Tokyo Personal AI desktop packaging did not finish.');
  console.error(error.message);
  console.error('');
  console.error('If the output mentions EPERM or a rename failure on Windows:');
  console.error('1. Close any Explorer window opened inside the release folder.');
  console.error('2. Stop antivirus scanning this project temporarily if it is locking files.');
  console.error('3. Delete the release folder.');
  console.error('4. Run the same desktop command again.');
  process.exit(process.exitCode || 1);
}
