const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('festosDesktop', {
  isDesktop: true,
  platform: process.platform,
  appVersion: '1.3.6',
  // Avisa únicamente cuando React ya pintó su primer frame.
  notifyReady: () => ipcRenderer.send('festos:ui-ready')
});
