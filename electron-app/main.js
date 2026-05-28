'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const AEBridge = require('./bridge/ae');

let mainWindow;
const bridge = new AEBridge();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 760,
    minWidth: 380,
    minHeight: 560,
    frame: false,
    backgroundColor: '#111111',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    resizable: true,
    maximizable: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('ae:apply', async (_e, params) => {
    return await bridge.applyColorGrade(params);
  });

  ipcMain.handle('ae:status', async () => {
    return await bridge.isAERunning();
  });

  ipcMain.on('win:minimize', () => mainWindow && mainWindow.minimize());
  ipcMain.on('win:close',    () => mainWindow && mainWindow.close());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
