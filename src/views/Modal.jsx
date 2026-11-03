import React, { useEffect } from 'react'
import { LINE } from '../logic.js'

export default function Modal({ title, onClose, children, width = 560, noClose = false }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(26,26,26,0.35)', zIndex: 100,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '7vh 16px 16px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: width, background: '#FCFCFA', border: '1px solid ' + LINE,
          borderRadius: 8, boxShadow: '0 16px 48px rgba(26,26,26,0.2)', padding: '22px 26px 26px', boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
          <div style={{ flex: 1 }} />
          {!noClose && <button onClick={onClose} style={{ border: 'none', background: 'none', padding: '0 2px', cursor: 'pointer', fontSize: 17, lineHeight: 1, color: '#8F8B86' }}>×</button>}
        </div>
        {children}
      </div>
    </div>
  )
}
