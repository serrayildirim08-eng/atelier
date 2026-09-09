const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('atelier', {
  platform: process.platform,
  isDesktop: true,
});
