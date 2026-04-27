const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('akalan', {
  platform: process.platform,
  isDesktop: true,
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
});
