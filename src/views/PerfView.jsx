import React, { useMemo, useState } from 'react'
import { compute, fromISO, DAYS, GREEN, INK, SUB, FAINT, LINE, LINE_SOFT, RED, WARN, SECTION_TITLE, colorOf } from '../logic.js'

// 수행평가 — 진도표에서 [수행평가]로 표시한 칸을 반별로 모아, 평가 이름·결시자 번호·재시험 여부를 적는다.
// 학생 이름은 저장하지 않고 번호만(data.perf['날짜|교시'] = { title, absent: [{ no, done }] }).
export default function PerfView({ data, setData }) {
  const computed = useMemo(() => compute(data), [data])
  const perf = data.perf || {}
  const notes = data.notes || {}
  const rows = Object.keys(computed.sessions).filter(k => computed.sessions[k].perf).sort()
    .map(k => { const [iso, p] = k.split('|'); return { key: k, iso, p, cls: computed.sessions[k].cls } })
  const classes = data.classes.filter(c => rows.some(r => r.cls === c))
  const set = (key, patch) => setData(d => {
    const cur = { title: '', absent: [], ...((d.perf || {})[key] || {}) }
    const next = { ...cur, ...patch }
    const all = { ...(d.perf || {}) }
    if (!next.title && !next.absent.length) delete all[key]
    else all[key] = next
    return { ...d, perf: all }
  })
  const addNos = (key, text) => {
    const cur = (perf[key] && perf[key].absent) || []
    const nos = [...new Set(String(text).split(/[^\d]+/).filter(Boolean).map(Number))].filter(n => n > 0 && n < 100 && !cur.some(a => a.no === n))
    if (nos.length) set(key, { absent: [...cur, ...nos.map(no => ({ no, done: false }))].sort((a, b) => a.no - b.no) })
  }
  const when = r => { const d = fromISO(r.iso); return (d.getMonth() + 1) + '.' + d.getDate() + ' ' + DAYS[d.getDay()] + ' ' + r.p + '교시' }
  const left = rows.map(r => ({ r, nos: ((perf[r.key] || {}).absent || []).filter(a => !a.done) })).filter(x => x.nos.length)
  const field = { border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', fontSize: 13.5, padding: '5px 8px', boxSizing: 'border-box', minWidth: 0 }

  return (
    <div style={{ width: '100%', maxWidth: 980, margin: '0 auto' }}>
      <div style={{ ...SECTION_TITLE, fontSize: 19 }}>수행평가</div>
      <div style={{ fontSize: 12.5, color: FAINT, margin: '4px 0 14px', lineHeight: 1.5 }}>
        진도표에서 수업 칸을 눌러 [수행평가]로 표시한 시간이 반별로 모입니다. 결시자는 번호만 적고(이름은 저장하지 않습니다), 재시험을 보면 번호를 눌러 완료로 바꿉니다.
      </div>
      <section aria-label="재시험 남은 학생" style={{ background: left.length ? '#FFF4E6' : '#F5F8FB', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
        <b style={{ fontSize: 13.5, color: left.length ? WARN : SUB }}>{left.length ? '재시험이 남은 학생 ' + left.reduce((n, x) => n + x.nos.length, 0) + '명' : '재시험이 남은 학생이 없습니다.'}</b>
        {left.map(({ r, nos }) => (
          <div key={r.key} style={{ fontSize: 13, color: INK, marginTop: 4 }}>
            <b>{r.cls}</b> <span style={{ color: FAINT }}>{when(r)}{(perf[r.key] || {}).title ? ' · ' + perf[r.key].title : ''}</span> — {nos.map(a => a.no + '번').join(', ')}
          </div>
        ))}
      </section>
      {rows.length === 0 && <div style={{ fontSize: 14, color: FAINT, padding: '20px 0' }}>아직 수행평가로 표시한 시간이 없습니다.</div>}
      {classes.map(c => (
        <section key={c} aria-label={c + ' 수행평가'} style={{ border: '1px solid ' + LINE, borderRadius: 12, background: '#FFFFFF', marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: '#F7F8FA', borderBottom: '1px solid ' + LINE_SOFT }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: colorOf(data, c), border: '1px solid rgba(26,26,26,0.16)' }} />
            <b style={{ fontSize: 14.5 }}>{c}</b>
            <span style={{ fontSize: 12, color: FAINT }}>{rows.filter(r => r.cls === c).length}회</span>
          </div>
          {rows.filter(r => r.cls === c).map(r => {
            const rec = perf[r.key] || { title: '', absent: [] }
            return (
              <div key={r.key} style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', alignItems: 'center', padding: '9px 14px', borderTop: '1px solid ' + LINE_SOFT }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: SUB, width: 104, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>{when(r)}</span>
                <input aria-label={c + ' ' + when(r) + ' 평가 이름'} value={rec.title || ''} onChange={e => set(r.key, { title: e.target.value })} placeholder="평가 이름 (예: 서술형 2회)" style={{ ...field, width: 190 }} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', flex: 1, minWidth: 220 }}>
                  <span style={{ fontSize: 12, color: FAINT }}>결시</span>
                  {rec.absent.map(a => (
                    <span key={a.no} style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, border: '1px solid ' + (a.done ? LINE : '#F3C6A5'), background: a.done ? '#F2F4F6' : '#FFF4E6' }}>
                      <button type="button" onClick={() => set(r.key, { absent: rec.absent.map(x => (x.no === a.no ? { ...x, done: !x.done } : x)) })}
                        title={a.done ? '재시험 완료 — 누르면 되돌립니다' : '누르면 재시험 완료로 바꿉니다'} aria-pressed={a.done}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '3px 4px 3px 9px', fontSize: 12.5, fontWeight: 700, color: a.done ? FAINT : WARN, textDecoration: a.done ? 'line-through' : 'none' }}>
                        {a.done ? '✓ ' : ''}{a.no}번
                      </button>
                      <button type="button" onClick={() => set(r.key, { absent: rec.absent.filter(x => x.no !== a.no) })} aria-label={a.no + '번 빼기'} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '3px 7px 3px 2px', fontSize: 13, color: FAINT, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                  <NoInput label={c + ' ' + when(r) + ' 결시 번호'} onAdd={t => addNos(r.key, t)} style={field} />
                </div>
                {notes[r.key] && <div style={{ flexBasis: '100%', fontSize: 12, color: '#7A4B12' }}>✎ {notes[r.key]}</div>}
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}

function NoInput({ label, onAdd, style }) {
  const [v, setV] = useState('')
  const commit = () => { if (v.trim()) { onAdd(v); setV('') } }
  return (
    <input aria-label={label} value={v} onChange={e => setV(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); commit() } }}
      placeholder="번호 (예: 3, 15)" inputMode="numeric" style={{ ...style, width: 118 }} />
  )
}
