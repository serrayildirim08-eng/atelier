const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('akalan', {
  platform: process.platform,
  isDesktop: true,
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  // Resolve a dropped File / DataTransferItem to its absolute filesystem
  // path. Electron 32+ exposes this via webUtils; the renderer cannot
  // access it directly under contextIsolation. Returns '' if the item
  // is not a real filesystem entry (e.g., a clipboard item).
  pathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file) || '';
    } catch {
      return '';
    }
  },
});
