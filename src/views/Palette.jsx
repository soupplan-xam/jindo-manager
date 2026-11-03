import React, { useState } from 'react'
import { GREEN, LINE_SOFT, FAINT, TINTS, CLASS_TINTS } from '../logic.js'

// 30색 팔레트 — 반 색과 과목 색이 같은 판을 쓴다.
// 첫 줄은 추천 6색, 그 아래는 같은 색상 계열을 채도별로 나눈 네 줄.
const REC = 6

// simple: 반 색 빠른 선택(파랑 3 · 노랑 3)을 먼저 보여 주고, 30색은 [다른 색 더 보기]로 편다
export default function Palette({ value, onPick, size = 20, simple = false }) {
  const [more, setMore] = useState(false)
  if (simple && !more) {
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
          {CLASS_TINTS.map(({ c, n }) => (
            <button
              key={c}
              type="button"
              onClick={() => onPick(c)}
              title={n}
              aria-label={n}
              aria-pressed={value === c}
              style={{
                height: size + 8, borderRadius: 5, background: c, cursor: 'pointer', boxSizing: 'border-box', padding: 0,
                border: value === c ? '2px solid ' + GREEN : '1px solid rgba(26,26,26,0.14)',
                fontSize: 11, color: 'rgba(26,26,26,0.62)',
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setMore(true)} style={{ border: 'none', background: 'none', padding: 0, marginTop: 9, cursor: 'pointer', fontSize: 12, color: FAINT }}>
          다른 색 더 보기
        </button>
      </>
    )
  }
  const swatch = t => (
    <span
      key={t}
      onClick={() => onPick(t)}
      title={t}
      style={{
        height: size, borderRadius: 4, background: t, cursor: 'pointer', boxSizing: 'border-box',
        border: value === t ? '2px solid ' + GREEN : '1px solid rgba(26,26,26,0.14)',
      }}
    />
  )
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 5 }
  return (
    <>
      <div style={grid}>{TINTS.slice(0, REC).map(swatch)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '9px 0 8px' }}>
        <span style={{ fontSize: 10.5, color: FAINT, flex: 'none' }}>채도</span>
        <span style={{ flex: 1, height: 1, background: LINE_SOFT }} />
      </div>
      <div style={{ ...grid, rowGap: 5 }}>{TINTS.slice(REC).map(swatch)}</div>
    </>
  )
}
