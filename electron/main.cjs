const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

let mainWindow = null;
let backendProcess = null;

const PORT = 39281;
const HOST = '127.0.0.1';
const isDev = !app.isPackaged;

let logStream = null;
let recentErrors = [];

function getLogPath() {
  const userData = app.getPath('userData');
  if (!fs.existsSync(userData)) {
    fs.mkdirSync(userData, { recursive: true });
  }
  return path.join(userData, 'kittab-app.log');
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  try {
    if (!logStream) {
      logStream = fs.createWriteStream(getLogPath(), { flags: 'a' });
    }
    logStream.write(line);
  } catch (e) {
    console.error('Failed to write to log:', e);
  }
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function getDatabasePath() {
  if (isDev) {
    return path.resolve(__dirname, '../backend/prisma/dev.db');
  }

  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  const targetDb = path.join(userDataPath, 'kittab.db');
  let needSeed = false;

  if (!fs.existsSync(targetDb)) {
    needSeed = true;
  } else {
    try {
      const stat = fs.statSync(targetDb);
      if (stat.size === 0) {
        needSeed = true;
      }
    } catch {
      needSeed = true;
    }
  }

  if (needSeed) {
    // Seed from template db in resources
    const possibleSeedPaths = [
      path.join(process.resourcesPath, 'dev.db'),
      path.join(process.resourcesPath, 'backend', 'prisma', 'dev.db'),
      path.join(process.resourcesPath, 'backend', 'dev.db'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'prisma', 'dev.db'),
      path.join(__dirname, '../backend/prisma/dev.db'),
    ];

    for (const seedPath of possibleSeedPaths) {
      if (fs.existsSync(seedPath)) {
        try {
          fs.copyFileSync(seedPath, targetDb);
          try {
            fs.chmodSync(targetDb, 0o666);
          } catch {}
          log(`[Electron] Initialized database from seed: ${seedPath} -> ${targetDb}`);
          break;
        } catch (err) {
          log(`[Electron] Failed to copy seed database: ${err.message}`);
        }
      }
    }
  }

  return targetDb;
}

function checkServerHealth(url, timeoutMs = 30000) {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(true);
        } else {
          retry();
        }
      });

      req.on('error', () => {
        retry();
      });

      req.setTimeout(1500, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startTime > timeoutMs) {
        resolve(false);
      } else {
        setTimeout(check, 400);
      }
    };

    check();
  });
}

async function startBackend() {
  const isHealthy = await checkServerHealth(`http://${HOST}:${PORT}/api/health`, 1500);
  if (isHealthy) {
    log(`[Electron] Backend is already running on port ${PORT}`);
    return;
  }

  const dbPath = getDatabasePath();
  // Ensure forward slashes for SQLite connection URL on Windows
  const normalizedDbPath = path.resolve(dbPath).replace(/\\/g, '/');
  const dbUrl = `file:${normalizedDbPath}`;

  let backendEntry = null;
  let frontendPath = null;
  let backendCwd = null;

  if (isDev) {
    backendEntry = path.resolve(__dirname, '../backend/dist/main.js');
    frontendPath = path.resolve(__dirname, '../frontend/dist');
    backendCwd = path.resolve(__dirname, '../backend');
  } else {
    const baseResources = process.resourcesPath;
    backendEntry = path.join(baseResources, 'backend', 'dist', 'main.js');
    frontendPath = path.join(baseResources, 'frontend');
    backendCwd = path.join(baseResources, 'backend');
  }

  log(`[Electron] Starting backend from: ${backendEntry}`);
  log(`[Electron] Backend CWD: ${backendCwd}`);
  log(`[Electron] Database URL: ${dbUrl}`);

  const env = {
    ...process.env,
    PORT: String(PORT),
    DATABASE_URL: dbUrl,
    FRONTEND_PATH: frontendPath,
    ELECTRON_RUN_AS_NODE: '1',
  };

  try {
    const execPath = process.execPath;

    backendProcess = spawn(execPath, [backendEntry], {
      cwd: backendCwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    backendProcess.stdout.on('data', (data) => {
      const str = data.toString().trim();
      log(`[Backend STDOUT] ${str}`);
    });

    backendProcess.stderr.on('data', (data) => {
      const str = data.toString().trim();
      log(`[Backend STDERR] ${str}`);
      recentErrors.push(str);
      if (recentErrors.length > 10) {
        recentErrors.shift();
      }
    });

    backendProcess.on('exit', (code, signal) => {
      log(`[Backend Process Exited] code=${code} signal=${signal}`);
      backendProcess = null;
    });

    backendProcess.on('error', (err) => {
      log(`[Backend Process Error] ${err.message}`);
      recentErrors.push(err.message);
    });
  } catch (err) {
    log(`[Electron] Failed to spawn backend process: ${err.message}`);
    recentErrors.push(err.message);
  }
}

function createWindow() {
  const iconPath = path.join(__dirname, 'resources', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'نظام كُتّاب - منظومة إدارة حلقات القرآن الكريم',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Decide URL
  const loadApp = async () => {
    // Wait for backend to be ready with 35 second timeout
    const ready = await checkServerHealth(`http://${HOST}:${PORT}/api/health`, 35000);
    if (!ready) {
      const errDetails = recentErrors.length > 0 ? `\n\nتفاصيل الخطأ:\n${recentErrors.slice(-3).join('\n')}` : '';
      dialog.showErrorBox(
        'خطأ في تشغيل النظام',
        `تعذر الاتصال بقاعدة البيانات أو الخادم المحلي. الرجاء إعادة تشغيل التطبيق.${errDetails}\n\nملف السجل: ${getLogPath()}`
      );
      return;
    }

    if (isDev) {
      const viteRunning = await checkServerHealth('http://localhost:5175', 1000);
      if (viteRunning) {
        mainWindow.loadURL('http://localhost:5175');
      } else {
        mainWindow.loadURL(`http://${HOST}:${PORT}`);
      }
    } else {
      mainWindow.loadURL(`http://${HOST}:${PORT}`);
    }
  };

  loadApp();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('get-app-version', () => app.getVersion());

app.whenReady().then(async () => {
  log(`[Electron] Kittab app starting (packaged=${app.isPackaged})`);
  await startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

function cleanupBackend() {
  if (backendProcess) {
    try {
      log('[Electron] Terminating backend process...');
      backendProcess.kill();
      backendProcess = null;
    } catch (e) {
      log(`[Electron] Error terminating backend: ${e.message}`);
    }
  }
}

app.on('before-quit', cleanupBackend);
app.on('window-all-closed', () => {
  cleanupBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
