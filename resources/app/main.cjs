const { app, BrowserWindow, dialog, session, ipcMain, shell } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { existsSync } = require('node:fs');

const root = path.dirname(process.execPath);
const name = existsSync(path.join(root, 'release-channel.txt')) ? 'Local Post Studio' : 'Local Post Studio Development';
app.setName(name);
app.setPath('userData', path.join(app.getPath('appData'), name));
if (!app.requestSingleInstanceLock()) app.exit(0);
let worker;
let quitting = false;
let errorText = '';

function stopWorker() {
  if (!worker || worker.exitCode !== null) return;
  worker.stdin.end();
  const processToStop = worker;
  setTimeout(() => {
    if (processToStop.exitCode === null) processToStop.kill();
  }, 5000).unref();
}

function fail(message) {
  if (quitting) return;
  quitting = true;
  stopWorker();
  dialog.showErrorBox('采访工作台', message);
  app.quit();
}

app.whenReady().then(() => {
  ipcMain.handle('choose-output-directory', async event => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return null;
    const result = await dialog.showOpenDialog(window, {properties: ['openDirectory', 'createDirectory']});
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle('open-output-directory', async (event, directory) => {
    if (!BrowserWindow.fromWebContents(event.sender) || typeof directory !== 'string' || !path.isAbsolute(directory)) return '无效路径';
    return shell.openPath(directory);
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  const env = { ...process.env, PYTHONNOUSERSITE: '1' };
  delete env.PYTHONHOME;
  delete env.PYTHONPATH;
  worker = spawn(path.join(root, 'runtime', 'python.exe'),
    ['-I', '-B', '-u', '-X', 'utf8', path.join(root, 'local_app.py'), '--no-browser', '--managed'],
    { cwd: root, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  worker.stderr.setEncoding('utf8');
  worker.stderr.on('data', chunk => { errorText = (errorText + chunk).slice(-8000); });
  worker.once('error', error => fail('无法启动本地转录服务：' + error.message));
  worker.once('exit', code => {
    if (!quitting) fail('本地转录服务已退出（代码 ' + code + '）。\n' + errorText);
  });
  let output = '';
  const timeout = setTimeout(() => fail('本地转录服务启动超时。'), 20000);
  worker.stdout.setEncoding('utf8');
  worker.stdout.on('data', chunk => {
    output += chunk;
    if (!output.includes('\n')) return;
    const address = output.split(/\r?\n/)[0].trim();
    worker.stdout.removeAllListeners('data');
    worker.stdout.resume();
    clearTimeout(timeout);
    let url;
    try { url = new URL(address); } catch (_) { fail('本地服务返回了无效地址。'); return; }
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') {
      fail('本地服务地址无效。');
      return;
    }
    const window = new BrowserWindow({
      width: 1420, height: 920, minWidth: 760, minHeight: 600,
      title: name, backgroundColor: '#201e1c', show: false,
      ...(existsSync(path.join(root,'local-post-studio.ico')) ? {icon:path.join(root,'local-post-studio.ico')} : {}),
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true,
                        preload: path.join(__dirname, 'preload.cjs') }
    });
    window.once('ready-to-show', () => window.show());
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, destination) => {
      if (new URL(destination).origin !== url.origin) event.preventDefault();
    });
    window.loadURL(address).catch(error => fail('界面加载失败：' + error.message));
  });
});

app.on('window-all-closed', () => { quitting = true; stopWorker(); app.quit(); });
app.on('before-quit', () => { quitting = true; stopWorker(); });
app.on('second-instance', () => {
  const window = BrowserWindow.getAllWindows()[0];
  if (window) {
    if (window.isMinimized()) window.restore();
    window.focus();
  }
});
