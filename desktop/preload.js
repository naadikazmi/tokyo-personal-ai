const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tokyoDesktop', {
  chooseFolder: () => ipcRenderer.invoke('tokyo:choose-folder'),
  choosePdf: () => ipcRenderer.invoke('tokyo:choose-pdf'),
});
