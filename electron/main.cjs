const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

let mainWindow = null;
let backendProcess = null;

const PORT = 39281;
const isDev = !app.isPackaged;

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
  if (!fs.existsSync(targetDb)) {
    // Seed from template db in resources
    const possibleSeedPaths = [
      path.join(process.resourcesPath, 'dev.db'),
      path.join(process.resourcesPath, 'backend', 'prisma', 'dev.db'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'prisma', 'dev.db'),
      path.join(__dirname, '../backend/prisma/dev.db'),
    ];

    for (const seedPath of possibleSeedPaths) {
      if (fs.existsSync(seedPath)) {
        try {
          fs.copyFileSync(seedPath, targetDb);
          console.log(`[Electron] Initialized database from seed: ${seedPath} -> ${targetDb}`);
          break;
        } catch (err) {
          console.error('[Electron] Failed to copy seed database:', err);
        }
      }
    }
  }

  return targetDb;
}

function checkServerHealth(url, timeoutMs = 25000) {
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

      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startTime > timeoutMs) {
        resolve(false);
      } else {
        setTimeout(check, 300);
      }
    };

    check();
  });
}

async function startBackend() {
  const isHealthy = await checkServerHealth(`http://localhost:${PORT}/api/health`, 1500);
  if (isHealthy) {
    console.log(`[Electron] Backend is already running on port ${PORT}`);
    return;
  }

  const dbPath = getDatabasePath();
  const dbUrl = `file:${dbPath}`;

  let backendEntry = null;
  let frontendPath = null;

  if (isDev) {
    backendEntry = path.resolve(__dirname, '../backend/dist/main.js');
    frontendPath = path.resolve(__dirname, '../frontend/dist');
  } else {
    const baseResources = process.resourcesPath;
    backendEntry = path.join(baseResources, 'backend', 'dist', 'main.js');
    frontendPath = path.join(baseResources, 'frontend');
  }

  console.log(`[Electron] Starting backend from: ${backendEntry}`);
  console.log(`[Electron] Database URL: ${dbUrl}`);

  const env = {
    ...process.env,
    PORT: String(PORT),
    DATABASE_URL: dbUrl,
    FRONTEND_PATH: frontendPath,
    ELECTRON_RUN_AS_NODE: '1',
  };

  try {
    // In production, process.execPath is the Electron executable running as node
    // In dev, we can use process.execPath or standard node
    const execPath = isDev ? process.execPath : process.execPath;

    backendProcess = spawn(execPath, [backendEntry], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    backendProcess.stdout.on('data', (data) => {
      console.log(`[Backend STDOUT] ${data.toString().trim()}`);
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`[Backend STDERR] ${data.toString().trim()}`);
    });

    backendProcess.on('exit', (code, signal) => {
      console.log(`[Backend Process Exited] code=${code} signal=${signal}`);
      backendProcess = null;
    });
  } catch (err) {
    console.error('[Electron] Failed to spawn backend process:', err);
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
    // Wait for backend to be ready
    const ready = await checkServerHealth(`http://localhost:${PORT}/api/health`, 20000);
    if (!ready) {
      dialog.showErrorBox(
        'خطأ في تشغيل النظام',
        'تعذر الاتصال بقاعدة البيانات أو الخادم المحلي. الرجاء إعادة تشغيل التطبيق.'
      );
      return;
    }

    if (isDev) {
      // Check if Vite dev server is running on 5175
      const viteRunning = await checkServerHealth('http://localhost:5175', 1000);
      if (viteRunning) {
        mainWindow.loadURL('http://localhost:5175');
      } else {
        mainWindow.loadURL(`http://localhost:${PORT}`);
      }
    } else {
      mainWindow.loadURL(`http://localhost:${PORT}`);
    }
  };

  loadApp();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('get-app-version', () => app.getVersion());

app.whenReady().then(async () => {
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
      console.log('[Electron] Terminating backend process...');
      backendProcess.kill();
      backendProcess = null;
    } catch (e) {
      console.error('[Electron] Error terminating backend:', e);
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
