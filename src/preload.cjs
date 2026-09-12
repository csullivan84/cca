const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld(
  'cca',
  Object.freeze({
    load: () => ipcRenderer.invoke('cca:load'),
    save: (state) => ipcRenderer.invoke('cca:save', state),
    copy: (text) => ipcRenderer.invoke('cca:copy', text),
    export: (rows, type) => ipcRenderer.invoke('cca:export', rows, type),
    openHelp: (key) => ipcRenderer.invoke('cca:openHelp', key),
    updates: () => ipcRenderer.invoke('cca:updates'),
    downloadUpdate: () => ipcRenderer.invoke('cca:downloadUpdate'),
    onAction: (callback) => {
      const fn = (_, action) => callback(action)
      ipcRenderer.on('cca:action', fn)
      return () => ipcRenderer.removeListener('cca:action', fn)
    },
    onNotice: (callback) => {
      const fn = (_, message) => callback(message)
      ipcRenderer.on('cca:notice', fn)
      return () => ipcRenderer.removeListener('cca:notice', fn)
    }
  })
)
