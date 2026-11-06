// 위젯 화면이 쓸 수 있는 몇 가지 창 조작만 열어 준다(파일·시스템 접근 없음)
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('jindoDesktop', {
  getAlwaysOnTop: () => ipcRenderer.invoke('desk:getOnTop'),
  setAlwaysOnTop: on => ipcRenderer.invoke('desk:setOnTop', !!on),
  getAutoStart: () => ipcRenderer.invoke('desk:getAutoStart'),
  setAutoStart: on => ipcRenderer.invoke('desk:setAutoStart', !!on),
  openMain: () => ipcRenderer.invoke('desk:openMain'),
  hideWidget: () => ipcRenderer.invoke('desk:hideWidget'),
  setOpacity: v => ipcRenderer.invoke('desk:setOpacity', v),
  getMode: () => ipcRenderer.invoke('desk:getMode'),
  setMode: m => ipcRenderer.invoke('desk:setMode', m),
  setHit: on => ipcRenderer.send('desk:hit', !!on),
})
