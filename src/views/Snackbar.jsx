import React from 'react'
import { GREEN } from '../logic.js'

export default function Snackbar({ snack, setSnack, data, setData }) {
  if (!snack) return null
  const sn = snack

  const undo = () => {
    if (sn.kind === 'cancel') {
      const c = { ...data.cancels }
      delete c[sn.key]
      setData(d => ({ ...d, cancels: c }))
    } else if (sn.kind === 'event') {
      setData(d => ({ ...d, events: d.events.filter(ev => ev.id !== sn.id) }))
    } else if (sn.kind === 'pattern') {
      setData(d => ({ ...d, pattern: sn.prev, classes: sn.prevClasses || d.classes }))
    } else if (sn.kind === 'extras') {
      setData(d => ({ ...d, extras: sn.prev, extraKind: sn.prevKind || d.extraKind, classes: sn.prevClasses || d.classes }))
    } else if (sn.kind === 'makeups') {
      setData(d => ({ ...d, makeups: sn.prev }))
    } else if (sn.kind === 'events') {
      setData(d => ({ ...d, events: sn.prev }))
    } else if (sn.kind === 'all') {
      setData(sn.prev)
    }
    setSnack(null)
  }

  const saveReason = () => {
    setData(d => {
      const c = { ...d.cancels }
      if (c[sn.key]) c[sn.key] = { reason: sn.draft || '' }
      return { ...d, cancels: c }
    })
    setSnack(null)
  }

  return (
    <div
      onClick={e => e.stopPropagation()}
      data-print="hide"
      style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 26,
        background: '#FFFFFF', border: '1px solid #E7E5E0', borderRadius: 6,
        boxShadow: '0 8px 24px rgba(26,26,26,0.10)', padding: '12px 18px',
        display: 'flex', gap: 26, alignItems: 'center', width: 'max-content', minWidth: 'min(440px, calc(100vw - 32px))',
        maxWidth: 'min(680px, calc(100vw - 32px))', zIndex: 60, boxSizing: 'border-box',
        // 모바일에서 달력 아래쪽을 덮으므로, 알림 자체는 터치를 가로채지 않는다 (버튼만 받는다)
        pointerEvents: 'none',
      }}
    >
      {sn.reasonMode ? (
        <>
          <input
            value={sn.draft || ''}
            onChange={e => setSnack({ ...sn, draft: e.target.value })}
            placeholder="결손 사유"
            autoFocus
            style={{ flex: 1, border: 'none', borderBottom: '1px solid #D9D9D9', background: 'transparent', fontSize: 13, padding: '3px 0', pointerEvents: 'auto' }}
          />
          <button onClick={saveReason} style={btnGreen}>저장</button>
        </>
      ) : (
        <>
          <div style={{ flex: 1, fontSize: 13 }}>{sn.text}</div>
          {sn.canReason && (
            <button onClick={() => setSnack({ ...sn, reasonMode: true, draft: '' })} style={{ ...btnGreen, fontWeight: 400 }}>사유 입력</button>
          )}
          {sn.kind !== 'none' && (
            <button onClick={undo} style={btnGreen}>되돌리기</button>
          )}
        </>
      )}
    </div>
  )
}

const btnGreen = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: GREEN, pointerEvents: 'auto' }
