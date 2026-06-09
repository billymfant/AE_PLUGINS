'use strict';

// Standalone Electron window for the CURRENT 3-tool suite panel (Dist · Color ·
// Glow, incl. Color Lab curves). Loads the repo's preview.html (mock CEP bridge)
// so the panel is fully interactive as a desktop app — UI realtime, not AE-
// connected. For realtime GRADING, use the CEP panel inside After Effects.
// Run:  node_modules\.bin\electron.cmd suite-preview.js

const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 360,
    height: 740,
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    title: 'AE Plugin Suite — Live Panel',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, '..', 'preview.html'));
}

app.whenReady().then(createWindow);
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
