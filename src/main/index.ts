import { app, BrowserWindow } from 'electron';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

const isDev = process.env.NODE_ENV === 'development';

// Load .env file - try multiple locations
// In packaged app: process.resourcesPath points to the resources folder
// In development: look relative to the source/dist folders
const getEnvPaths = () => {
  const paths = [];
  
  // For packaged app - check resources folder
  if (process.resourcesPath) {
    paths.push(path.join(process.resourcesPath, '.env'));
  }
  
  // App's executable directory (for portable app with .env next to exe)
  if (app.getPath('exe')) {
    paths.push(path.join(path.dirname(app.getPath('exe')), '.env'));
  }
  
  // User data directory (persistent location for user config)
  paths.push(path.join(app.getPath('userData'), '.env'));
  
  // Development paths
  paths.push(path.resolve(__dirname, '../../.env'));     // From dist/main/ to project root
  paths.push(path.resolve(__dirname, '../.env'));         // One level up
  paths.push(path.resolve(process.cwd(), '.env'));        // Current working directory
  
  return paths;
};

let envLoaded = false;
for (const envPath of getEnvPaths()) {
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log('Loaded .env from:', envPath);
      envLoaded = true;
      break;
    }
  }
}

if (!envLoaded) {
  console.warn('Warning: .env file not found in any of the expected locations');
  console.warn('Expected locations:', getEnvPaths().join(', '));
}

let mainWindow: BrowserWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const startURL = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../renderer/index.html')}`;

  mainWindow.loadURL(startURL);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    app.quit();
  });
};

app.on('ready', async () => {
  createWindow();
  // Import after dotenv is loaded
  try {
    const ipcModule = require('./ipc-handlers');
    // Support named export, default export, or module directly exporting the function
    const register = ipcModule?.registerIpcHandlers || ipcModule?.default || ipcModule;
    if (typeof register === 'function') {
      register();
    } else {
      console.error('registerIpcHandlers is not available. IPC handlers were not registered.', Object.keys(ipcModule || {}));
    }
  } catch (err) {
    console.error('Failed to load ipc-handlers module:', err);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
