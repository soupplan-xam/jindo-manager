import React, { useState } from 'react'
import { GREEN, INK, SUB, FAINT, LINE, WARN, toISO } from '../logic.js'
import { readNotify, saveNotify, notifySupported, showNote } from '../useNotifier.js'
import { morningSummary } from '../todos.js'
import TimeInput from './TimeInput.jsx'

// 설정 > 할 일 · 알림 — 지난 할 일 넘겨 보이기(모든 기기), 아침 알림(이 기기만)
export default function NotifySettings({ data, setData }) {
  const [pref, setPref] = useState(readNotify)
  const [msg, setMsg] = useState('')
  const carry = data.cfg.carry !== false
  const perm = notifySupported() ? Notification.permission : 'unsupported'
  const turn = async on => {
    setMsg('')
    if (on) {
      if (!notifySupported()) { setMsg('이 브라우저는 알림을 지원하지 않습니다. 아이폰은 홈 화면에 추가한 앱에서만 됩니다.'); return }
      const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
      if (p !== 'granted') { setMsg('알림이 막혀 있습니다. 브라우저(또는 휴대폰 설정)에서 이 사이트의 알림을 허용해 주세요.'); return }
    }
    setPref(saveNotify({ on }))
  }
  const test = async () => {
    const s = morningSummary(data, toISO(new Date())) || { title: '오늘 할 일 0개', body: '알릴 할 일이 없는 날은 알림을 보내지 않습니다.' }
    setMsg((await showNote(s.title, s.body)) ? '알림을 보냈습니다.' : '알림을 띄우지 못했습니다.')
  }
  const row = { display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 14, color: INK }
  return (
    <div style={{ padding: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={row}>
        <input type="checkbox" checked={carry} onChange={() => setData(d => ({ ...d, cfg: { ...d.cfg, carry: !carry } }))} style={{ accentColor: GREEN, margin: 0 }} />
        끝내지 못한 할 일을 오늘 칸에 함께 보이기
      </label>
      <div style={{ fontSize: 12, color: FAINT, marginTop: -6, lineHeight: 1.5 }}>지난 14일 동안 안 끝낸 할 일이 달력과 위젯의 오늘 칸에 ↩ 표시로 보입니다. 원래 날짜에도 그대로 남고, 끝내면 사라집니다.</div>
      <label style={row}>
        <input type="checkbox" checked={pref.on && perm === 'granted'} onChange={e => turn(e.target.checked)} style={{ accentColor: GREEN, margin: 0 }} />
        아침 알림 (이 기기)
        <TimeInput aria-label="아침 알림 시각" value={pref.time} onChange={v => setPref(saveNotify({ time: v }))} style={{ border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', fontSize: 13, padding: '3px 6px' }} />
        <button type="button" onClick={e => { e.preventDefault(); test() }} disabled={perm !== 'granted'} style={{ border: 'none', background: 'none', padding: 0, cursor: perm === 'granted' ? 'pointer' : 'default', fontSize: 12.5, color: perm === 'granted' ? GREEN : FAINT }}>지금 보내 보기</button>
      </label>
      <div style={{ fontSize: 12, color: FAINT, marginTop: -6, lineHeight: 1.5 }}>
        정한 시각이 지나면 하루 한 번 「오늘 할 일 · 지난 할 일 · D-day(오늘·내일)」를 알립니다.
        <b style={{ color: SUB }}> 진도계획표나 위젯이 열려 있을 때만 옵니다</b> — 앱을 닫아 둔 휴대폰으로는 오지 않습니다. 알릴 것이 없는 날은 보내지 않습니다.
      </div>
      {msg && <div role="status" style={{ fontSize: 12.5, color: /보냈/.test(msg) ? SUB : WARN }}>{msg}</div>}
    </div>
  )
}
