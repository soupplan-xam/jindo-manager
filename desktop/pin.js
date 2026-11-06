// 바탕화면에 붙이기 (윈도우 전용)
// - 위젯 창의 소유자를 바탕화면(Progman)으로 바꿔 「바탕화면 보기(Win+D)」에도 숨지 않게 하고,
//   다른 창들 뒤 맨 아래에 둔다. 바탕화면 아이콘처럼 늘 깔려 있게 하는 방식이다.
// - user32.dll 함수 몇 개만 koffi 로 부른다. 실패해도 위젯은 그대로 동작한다(그냥 맨 아래 창).
let api = null

function load() {
  if (api !== null) return api
  api = false
  if (process.platform !== 'win32') return api
  try {
    const koffi = require('koffi')
    const u = koffi.load('user32.dll')
    api = {
      FindWindowW: u.func('intptr_t __stdcall FindWindowW(str16 cls, str16 name)'),
      SetWindowLongPtrW: u.func('intptr_t __stdcall SetWindowLongPtrW(intptr_t hwnd, int index, intptr_t value)'),
      SetWindowPos: u.func('bool __stdcall SetWindowPos(intptr_t hwnd, intptr_t after, int x, int y, int cx, int cy, uint32_t flags)'),
    }
  } catch (e) {
    console.error('바탕화면 붙이기를 쓸 수 없습니다:', e)
  }
  return api
}

const hwndOf = win => {
  const b = win.getNativeWindowHandle()
  return b.length >= 8 ? b.readBigInt64LE(0) : BigInt(b.readInt32LE(0))
}

const GWLP_HWNDPARENT = -8
const HWND_BOTTOM = 1
const SWP_NOSIZE = 0x0001
const SWP_NOMOVE = 0x0002
const SWP_NOACTIVATE = 0x0010

// 다른 창들 뒤 맨 아래로
function toBottom(win) {
  const a = load()
  if (!a || !win || win.isDestroyed()) return
  try { a.SetWindowPos(hwndOf(win), HWND_BOTTOM, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE) } catch { /* 무시 */ }
}

// 바탕화면 소유로 만들고 맨 아래로. 됐으면 true
function pinToDesktop(win) {
  const a = load()
  if (!a || !win || win.isDestroyed()) return false
  try {
    const progman = a.FindWindowW('Progman', null)
    if (!progman) return false
    a.SetWindowLongPtrW(hwndOf(win), GWLP_HWNDPARENT, progman)
    toBottom(win)
    return true
  } catch (e) {
    console.error(e)
    return false
  }
}

module.exports = { pinToDesktop, toBottom }
