import { useEffect, useRef } from 'react'
import { toISO } from './logic.js'
import { morningSummary } from './todos.js'

// 아침 알림 — 정한 시각이 지나면 하루 한 번 「오늘 할 일 · 지난 할 일 · D-day」를 알린다.
// 서버가 없어서 앱(또는 위젯)이 열려 있을 때만 보낼 수 있다. 설정은 기기마다 따로(알림 허용이 기기별이라).
const KEY = 'jindo.notify'
const SENT = 'jindo.notified'
export const readNotify = () => { try { return { on: false, time: '08:20', ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { on: false, time: '08:20' } } }
export const saveNotify = p => { const n = { ...readNotify(), ...p }; try { localStorage.setItem(KEY, JSON.stringify(n)) } catch { /* 무시 */ } return n }
export const notifySupported = () => typeof Notification !== 'undefined'

export async function showNote(title, body) {
  const opt = { body, tag: 'jindo-morning', icon: import.meta.env.BASE_URL + 'icon-192.png' }
  try {
    // 휴대폰 크롬은 서비스 워커를 거쳐야만 알림을 띄울 수 있다
    const reg = navigator.serviceWorker && (await Promise.race([navigator.serviceWorker.getRegistration(), new Promise(r => setTimeout(() => r(null), 1500))]))
    if (reg && reg.showNotification) { await reg.showNotification(title, opt); return true }
  } catch { /* 아래로 */ }
  try { new Notification(title, opt); return true } catch { return false }
}

export default function useNotifier(data, enabled = true) {
  const ref = useRef(data)
  ref.current = data
  useEffect(() => {
    if (!enabled || !notifySupported()) return
    const tick = () => {
      const pref = readNotify()
      if (!pref.on || Notification.permission !== 'granted') return
      const now = new Date()
      const today = toISO(now)
      const hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
      let sent = ''
      try { sent = localStorage.getItem(SENT) || '' } catch { /* 무시 */ }
      if (sent === today || hm < pref.time) return
      try { localStorage.setItem(SENT, today) } catch { /* 무시 */ } // 다른 창과 겹쳐 보내지 않게 먼저 적는다
      const s = morningSummary(ref.current, today)
      if (s) showNote(s.title, s.body)
    }
    const t0 = setTimeout(tick, 4000) // 기기 연동으로 최신 내용을 받을 틈을 준다
    const t = setInterval(tick, 30000)
    return () => { clearTimeout(t0); clearInterval(t) }
  }, [enabled])
}
