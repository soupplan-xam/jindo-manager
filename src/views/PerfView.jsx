import React, { useState } from 'react'
import { GREEN, INK, SUB, FAINT, LINE, LINE_SOFT, WARN, SECTION_TITLE, colorOf } from '../logic.js'

// 수행평가 — 평가 이름을 적고, 반마다 결시 번호만 적는다(날짜는 따지지 않는다).
// 재시험을 보면 번호를 눌러 완료로 바꾼다. 학생 이름은 저장하지 않는다.
// data.perfs = [{ id, title, absent: { '반': [{ no, done }] } }]
export default function PerfView({ data, setData }) {
  const perfs = data.perfs || []
  const classes = data.classes || []
  const [draft, setDraft] = useState('')
  const save = fn => setData(d => ({ ...d, perfs: fn(d.perfs || []) }))
  const add = () => {
    const title = draft.trim()
    if (!title) return
    save(list => [...list, { id: 'p' + Date.now().toString(36), title, absent: {} }])
    setDraft('')
  }
  const patch = (id, p) => save(list => list.map(x => (x.id === id ? { ...x, ...p } : x)))
  const setAbs = (id, cls, fn) => save(list => list.map(x => {
    if (x.id !== id) return x
    const next = fn(x.absent[cls] || [])
    const absent = { ...x.absent }
    if (next.length) absent[cls] = next
    else delete absent[cls]
    return { ...x, absent }
  }))
  const addNos = (id, cls, text) => setAbs(id, cls, cur => {
    const nos = [...new Set(String(text).split(/[^\d]+/).filter(Boolean).map(Number))].filter(n => n > 0 && n < 100 && !cur.some(a => a.no === n))
    return [...cur, ...nos.map(no => ({ no, done: false }))].sort((a, b) => a.no - b.no)
  })
  const remove = x => {
    const n = Object.values(x.absent).reduce((s, l) => s + l.length, 0)
    if (n && !window.confirm('「' + x.title + '」과 결시 기록 ' + n + '명을 지울까요?')) return
    save(list => list.filter(y => y.id !== x.id))
  }
  // 반 목록에 없는 반의 기록(예전 기록 등)도 보이게
  const clsOf = x => [...classes, ...Object.keys(x.absent).filter(c => !classes.includes(c))]
  const left = perfs.flatMap(x => clsOf(x).map(c => ({ x, c, nos: (x.absent[c] || []).filter(a => !a.done) })).filter(r => r.nos.length))
  const field = { border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', fontSize: 14, padding: '6px 10px', boxSizing: 'border-box', minWidth: 0 }

  return (
    <div style={{ width: '100%', maxWidth: 860, margin: '0 auto' }}>
      <div style={{ ...SECTION_TITLE, fontSize: 19 }}>수행평가</div>
      <div style={{ fontSize: 12.5, color: FAINT, margin: '4px 0 14px', lineHeight: 1.5 }}>
        수행평가 이름을 적고 반마다 결시 번호를 적습니다(이름은 저장하지 않습니다). 재시험을 보면 번호를 눌러 완료로 바꿉니다.
      </div>
      <form onSubmit={e => { e.preventDefault(); add() }} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input aria-label="새 수행평가 이름" value={draft} onChange={e => setDraft(e.target.value)} placeholder="수행평가 이름 (예: 서술형 2회)" style={{ ...field, flex: 1 }} />
        <button type="submit" style={{ border: 'none', borderRadius: 8, background: draft.trim() ? GREEN : '#D1D6DB', color: '#FFFFFF', padding: '0 16px', fontSize: 14, fontWeight: 700, cursor: draft.trim() ? 'pointer' : 'default', flex: 'none' }}>추가</button>
      </form>
      {left.length > 0 && (
        <section aria-label="재시험 남은 학생" style={{ background: '#FFF4E6', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
          <b style={{ fontSize: 13.5, color: WARN }}>재시험이 남은 학생 {left.reduce((n, r) => n + r.nos.length, 0)}명</b>
          {left.map(r => (
            <div key={r.x.id + r.c} style={{ fontSize: 13, color: INK, marginTop: 3 }}>
              <span style={{ color: SUB }}>{r.x.title}</span> · <b>{r.c}</b> — {r.nos.map(a => a.no + '번').join(', ')}
            </div>
          ))}
        </section>
      )}
      {perfs.length === 0 && <div style={{ fontSize: 14, color: FAINT, padding: '16px 0' }}>아직 수행평가가 없습니다. 위에 이름을 적고 [추가]를 누르세요.</div>}
      {[...perfs].reverse().map(x => (
        <section key={x.id} aria-label={x.title} style={{ border: '1px solid ' + LINE, borderRadius: 12, background: '#FFFFFF', marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F7F8FA', borderBottom: '1px solid ' + LINE_SOFT }}>
            <input aria-label="수행평가 이름" value={x.title} onChange={e => patch(x.id, { title: e.target.value })} style={{ ...field, flex: 1, fontWeight: 700, fontSize: 14.5 }} />
            <button type="button" onClick={() => remove(x)} style={{ border: 'none', background: 'none', padding: '0 4px', cursor: 'pointer', fontSize: 12.5, color: WARN, flex: 'none' }}>지우기</button>
          </div>
          {clsOf(x).map(c => {
            const list = x.absent[c] || []
            return (
              <div key={c} style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 8px', alignItems: 'center', padding: '7px 12px', borderTop: '1px solid ' + LINE_SOFT }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: 64, flex: 'none', fontSize: 13.5, fontWeight: 700, color: INK }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: colorOf(data, c), border: '1px solid rgba(26,26,26,0.16)', display: 'inline-block' }} />{c}
                </span>
                {list.map(a => (
                  <span key={a.no} style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, border: '1px solid ' + (a.done ? LINE : '#F3C6A5'), background: a.done ? '#F2F4F6' : '#FFF4E6' }}>
                    <button type="button" onClick={() => setAbs(x.id, c, cur => cur.map(y => (y.no === a.no ? { ...y, done: !y.done } : y)))}
                      title={a.done ? '재시험 완료 — 누르면 되돌립니다' : '누르면 재시험 완료로 바꿉니다'} aria-pressed={a.done}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '3px 4px 3px 9px', fontSize: 12.5, fontWeight: 700, color: a.done ? FAINT : WARN, textDecoration: a.done ? 'line-through' : 'none' }}>
                      {a.done ? '✓ ' : ''}{a.no}번
                    </button>
                    <button type="button" onClick={() => setAbs(x.id, c, cur => cur.filter(y => y.no !== a.no))} aria-label={c + ' ' + a.no + '번 빼기'} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '3px 7px 3px 2px', fontSize: 13, color: FAINT, lineHeight: 1 }}>×</button>
                  </span>
                ))}
                <NoInput label={x.title + ' ' + c + ' 결시 번호'} onAdd={t => addNos(x.id, c, t)} style={field} />
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
      placeholder="결시 번호 (예: 3, 15)" inputMode="numeric" style={{ ...style, width: 150, fontSize: 13, padding: '4px 8px' }} />
  )
}
