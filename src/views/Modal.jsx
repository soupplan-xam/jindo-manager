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
        position: 'fixed', inset: 0, background: 'rgba(25,31,40,0.42)', zIndex: 100,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '7vh 16px 16px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: width, background: '#FFFFFF', border: 'none',
          borderRadius: 20, boxShadow: '0 20px 60px rgba(25,31,40,0.18)', padding: '24px 26px 26px', boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</div>
          <div style={{ flex: 1 }} />
          {!noClose && <button onClick={onClose} style={{ border: 'none', background: 'none', padding: '0 2px', cursor: 'pointer', fontSize: 17, lineHeight: 1, color: '#8B95A1' }}>×</button>}
        </div>
        {children}
      </div>
    </div>
  )
}
