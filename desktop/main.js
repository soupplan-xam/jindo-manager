// 진도계획표 바탕화면 위젯 (윈도우)
// - 배포된 진도계획표(#widget)를 테두리 없는 작은 창으로 띄운다. 웹을 고치면 위젯도 바로 바뀐다.
//   (윈도우에서 투명 창은 크기 조절이 안 되므로 불투명 창 + 창 투명도(setOpacity)를 쓴다)
// - 알림 영역(트레이) 아이콘: 위젯 보이기/숨기기, 진도계획표 열기, 항상 위, 자동 실행, 종료.
// - 창 위치·크기·항상 위 설정을 기억한다.
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage, screen } = require('electron')
const path = require('path')
const fs = require('fs')

// JINDO_URL 은 시험용(로컬 화면으로 띄울 때)
const APP_URL = process.env.JINDO_URL || 'https://soupplan-xam.github.io/jindo-manager/'
const ORIGIN = new URL(APP_URL).origin
// 구글 로그인 창 등 앱 안에서 열어도 되는 주소
const AUTH_HOSTS = [/(^|\.)accounts\.google\.com$/, /(^|\.)firebaseapp\.com$/, /(^|\.)googleapis\.com$/]

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

// 구글 로그인이 '안전하지 않은 브라우저'로 막지 않도록 일반 크롬과 같은 이름을 쓴다
app.userAgentFallback = app.userAgentFallback.replace(/ Electron\/\S+/, '').replace(/ jindo-desktop\/\S+/, '').replace(/ 진도계획표 위젯\/\S+/, '')

const stateFile = () => path.join(app.getPath('userData'), 'widget-state.json')
function readState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')) } catch { return {} }
}
function writeState(p) {
  try { fs.writeFileSync(stateFile(), JSON.stringify({ ...readState(), ...p })) } catch { /* 무시 */ }
}

let widget = null
let main = null
let tray = null
const icon = () => nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png'))

const webPreferences = {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  spellcheck: false,
}

// 진도계획표 밖으로 나가는 링크는 기본 브라우저로, 로그인 창만 앱 안에서 연다
function guard(win) {
  win.webContents.on('will-navigate', (e, url) => {
    if (new URL(url).origin !== ORIGIN) { e.preventDefault(); shell.openExternal(url) }
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    let host = ''
    try { host = new URL(url).hostname } catch { /* 잘못된 주소 */ }
    if (url.startsWith(ORIGIN) || AUTH_HOSTS.some(r => r.test(host))) {
      return { action: 'allow', overrideBrowserWindowOptions: { width: 520, height: 680, autoHideMenuBar: true, webPreferences: { contextIsolation: true, sandbox: true } } }
    }
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  // 인터넷이 끊겨 불러오지 못하면 30초 뒤 다시 시도한다
  win.webContents.on('did-fail-load', (e, code, desc, url, isMain) => {
    if (!isMain || code === -3) return
    setTimeout(() => { if (!win.isDestroyed()) win.loadURL(url) }, 30000)
  })
}

function createWidget() {
  const st = readState()
  const area = screen.getPrimaryDisplay().workArea
  const b = st.bounds || { width: 340, height: 560, x: area.x + area.width - 360, y: area.y + 40 }
  widget = new BrowserWindow({
    ...b,
    minWidth: 260, minHeight: 220,
    frame: false, resizable: true, thickFrame: true,
    skipTaskbar: true, alwaysOnTop: !!st.onTop, show: !st.hidden,
    title: '진도계획표 위젯', icon: icon(), backgroundColor: '#FFFFFF',
    opacity: st.opacity || 1,
    webPreferences,
  })
  guard(widget)
  widget.loadURL(APP_URL + '#widget')
  let t = null
  const save = () => { clearTimeout(t); t = setTimeout(() => { if (!widget.isDestroyed()) writeState({ bounds: widget.getBounds() }) }, 400) }
  widget.on('move', save)
  widget.on('resize', save)
  widget.on('closed', () => { widget = null })
}

function openMain() {
  if (main && !main.isDestroyed()) { main.show(); main.focus(); return }
  main = new BrowserWindow({ width: 1400, height: 900, title: '진도계획표', icon: icon(), autoHideMenuBar: true, webPreferences })
  guard(main)
  main.loadURL(APP_URL)
  main.on('closed', () => { main = null })
}

function showWidget(show) {
  if (!widget) createWidget()
  if (show) { widget.show(); writeState({ hidden: false }) } else { widget.hide(); writeState({ hidden: true }) }
  buildTray()
}

function setOnTop(on) {
  if (widget) widget.setAlwaysOnTop(on)
  writeState({ onTop: on })
  buildTray()
  return on
}
const autoStartOn = () => app.getLoginItemSettings().openAtLogin
function setAutoStart(on) {
  app.setLoginItemSettings({ openAtLogin: on })
  buildTray()
  return autoStartOn()
}

function buildTray() {
  if (!tray) {
    tray = new Tray(icon().resize({ width: 16, height: 16 }))
    tray.setToolTip('진도계획표 위젯')
    tray.on('click', () => showWidget(!(widget && widget.isVisible())))
  }
  const visible = !!(widget && widget.isVisible())
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: visible ? '위젯 숨기기' : '위젯 보이기', click: () => showWidget(!visible) },
    { label: '진도계획표 열기', click: openMain },
    { type: 'separator' },
    { label: '항상 위에 두기', type: 'checkbox', checked: !!readState().onTop, click: m => setOnTop(m.checked) },
    { label: '컴퓨터 켤 때 자동 실행', type: 'checkbox', checked: autoStartOn(), click: m => setAutoStart(m.checked) },
    { label: '위젯 위치 처음으로', click: () => { writeState({ bounds: null }); if (widget) { widget.destroy(); widget = null } showWidget(true) } },
    { label: '위젯 새로 고침', click: () => widget && widget.webContents.reload() },
    { type: 'separator' },
    { label: '종료', click: () => { app.isQuitting = true; app.quit() } },
  ]))
}

ipcMain.handle('desk:getOnTop', () => !!readState().onTop)
ipcMain.handle('desk:setOnTop', (e, on) => setOnTop(on))
ipcMain.handle('desk:getAutoStart', () => autoStartOn())
ipcMain.handle('desk:setAutoStart', (e, on) => setAutoStart(on))
ipcMain.handle('desk:openMain', () => openMain())
ipcMain.handle('desk:hideWidget', () => showWidget(false))
ipcMain.handle('desk:setOpacity', (e, v) => {
  const o = Math.min(1, Math.max(0.4, Number(v) || 1))
  if (widget) widget.setOpacity(o)
  writeState({ opacity: o })
  return o
})

app.on('second-instance', () => showWidget(true))
app.whenReady().then(() => {
  app.setAppUserModelId('io.github.soupplan-xam.jindo')
  createWidget()
  buildTray()
})
// 창을 모두 닫아도 알림 영역에 남는다 — 종료는 트레이 메뉴에서
app.on('window-all-closed', e => { if (!app.isQuitting) e.preventDefault?.() })
