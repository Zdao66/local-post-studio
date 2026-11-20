const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('localPost', {
  chooseOutputDirectory: () => ipcRenderer.invoke('choose-output-directory'),
  openOutputDirectory: path => ipcRenderer.invoke('open-output-directory', path),
});
