import { app, BrowserWindow } from 'electron';
import path from 'path';
import dotenv from 'dotenv';

const isDev = process.env.NODE_ENV === 'development';

// Load .env file - try multiple locations
const envPaths = [
  path.resolve(__dirname, '../../.env'),     // From dist/main/ to project root
  path.resolve(__dirname, '../.env'),         // One level up
  path.resolve(process.cwd(), '.env'),        // Current working directory
];

for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    console.log('Loaded .env from:', envPath);
    break;
  }
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
