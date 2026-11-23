const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,
  info: () => ipcRenderer.invoke('desktop:info'),
  retry: () => ipcRenderer.invoke('desktop:retry'),
  saveServer: url => ipcRenderer.invoke('desktop:save-server', url),
  resetServer: () => ipcRenderer.invoke('desktop:reset-server'),
  openServerDialog: () => ipcRenderer.invoke('desktop:open-server-dialog'),
  closeDialog: () => ipcRenderer.invoke('desktop:close-dialog'),
  checkUpdates: () => ipcRenderer.invoke('desktop:check-updates')
});
