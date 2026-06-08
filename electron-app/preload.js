'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  apply:     (params) => ipcRenderer.invoke('ae:apply', params),
  applyGlow: (params) => ipcRenderer.invoke('glow:apply', params),
  checkAE:   ()       => ipcRenderer.invoke('ae:status'),
  minimize:  ()       => ipcRenderer.send('win:minimize'),
  close:     ()       => ipcRenderer.send('win:close'),
});
