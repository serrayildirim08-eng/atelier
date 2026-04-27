const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('akalan', {
  platform: process.platform,
  isDesktop: true,
});
