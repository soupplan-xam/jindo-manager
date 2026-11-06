import React, { useState } from 'react'
import { GREEN, INK, SUB, FAINT, LINE, LINE_SOFT, RED, DAYS, fromISO, toISO, addDays, colorOf } from '../logic.js'
import { holidayOn, solarTermOn } from '../kcal.js'
import { TYPE_COLOR } from './ScheduleCalendar.jsx'
import { TODO_COLORS } from './MonthCalendar.jsx'

const SAT = '#185FA5'
const MAKEUP_BG = '#E8EBEF'
const NOTE_FG = '#7A4B12'
// 바탕화면 모드(glass): 흰 면은 비우고, 색 면은 반투명으로. 화면 전체가 반전되므로 선은 어둡게 둔다(반전 뒤 밝은 선)
const tint = (c, glass, a = '73') => (glass && /^#[0-9a-f]{6}$/i.test(c) ? c + a : c)
const lineOf = glass => '1px solid ' + (glass ? 'rgba(0,0,0,0.28)' : LINE_SOFT)
const todoColor = k => (TODO_COLORS.find(x => x.k === (k || '')) || TODO_COLORS[0]).c

// 위젯 — 이번 주 시간표(월~금 × 교시). 칸마다 반 · 차시. 오늘 열과 지금 교시를 강조한다.
// 주말에는 다음 주를 보여 준다. 시간표 탭에서 창 전체를 채운다(글자는 자르지 않고 줄바꿈).
// 수업 칸을 더블클릭하면 그 칸 메모(진도표의 칸 메모와 같은 notes)를 바로 적는다.
export function MiniWeek({ glass = false, data, setData, computed, today, period, periods = 7 }) {
  const [edit, setEdit] = useState(null) // { key, text }
  const notes = data.notes || {}
  const commit = () => {
    if (!edit) return
    const v = edit.text.trim()
    if (v !== (notes[edit.key] || '')) {
      setData(d => {
        const n = { ...(d.notes || {}) }
        if (v) n[edit.key] = v
        else delete n[edit.key]
        return { ...d, notes: n }
      })
    }
    setEdit(null)
  }
  const t = fromISO(today)
  const dow = t.getDay()
  let mon = addDays(t, dow === 0 ? -6 : 1 - dow)
  if (dow === 0 || dow === 6) mon = addDays(mon, 7)
  const days = [0, 1, 2, 3, 4].map(i => toISO(addDays(mon, i)))
  const nowP = period && period.kind === 'class' ? period.period : null
  const line = lineOf(glass)
  return (
    <div className="soft-scroll" style={{ flex: 1, minHeight: 0, overflow: 'auto', border: glass ? line : '1px solid ' + LINE, borderRadius: 10, background: glass ? 'transparent' : '#FFFFFF' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '30px repeat(5, minmax(0, 1fr))', gridTemplateRows: 'auto repeat(' + periods + ', minmax(40px, 1fr))', minHeight: '100%' }}>
        <div style={{ background: glass ? 'transparent' : '#F2F4F6', position: 'sticky', top: 0, zIndex: 1 }} />
        {days.map(iso => {
          const d = fromISO(iso)
          const isToday = iso === today
          return (
            <div key={iso} style={{ textAlign: 'center', padding: '6px 0', fontSize: 13, fontWeight: 700, color: isToday ? GREEN : holidayOn(iso) ? RED : SUB, background: glass ? (isToday ? 'rgba(18,132,202,0.18)' : 'transparent') : isToday ? '#E9F6FE' : '#F2F4F6', borderLeft: line, position: 'sticky', top: 0, zIndex: 1 }}>
              {DAYS[d.getDay()]} {d.getMonth() + 1}.{d.getDate()}
            </div>
          )
        })}
        {Array.from({ length: periods }, (_, k) => k + 1).map(p => (
          <React.Fragment key={p}>
            <div style={{ borderTop: line, fontSize: 12.5, color: nowP === p ? GREEN : FAINT, fontWeight: nowP === p ? 800 : 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p}</div>
            {days.map(iso => {
              const s = computed.sessions[iso + '|' + p]
              const isNow = iso === today && nowP === p
              const bg = !s ? (glass ? 'transparent' : iso === today ? '#FAFCFE' : '#FFFFFF') : tint(s.activity ? '#EFEBFA' : s.makeup ? MAKEUP_BG : s.canceled ? '#FFFFFF' : colorOf(data, s.cls), glass)
              const tag = s && !s.num && !s.activity ? (s.makeup ? '보강' : s.perf ? '수행' : s.reason || '결손') : ''
              return (
                <div key={iso} title={s ? (s.activity ? s.place : s.makeup ? (s.place || '') + ' 보강' : s.cls + (s.num ? ' ' + s.num + '차시' : ' ' + (s.reason || ''))) + ' — 더블클릭해 메모' : ''}
                  data-hit={s ? '' : undefined}
                  onDoubleClick={s ? () => setEdit({ key: iso + '|' + p, text: notes[iso + '|' + p] || '' }) : undefined}
                  style={{ minWidth: 0, borderTop: line, borderLeft: line, padding: '4px 6px', background: bg, boxShadow: isNow ? 'inset 0 0 0 2px ' + GREEN : 'none', cursor: s ? 'pointer' : 'default',
                    display: 'flex', flexWrap: 'wrap', alignItems: 'center', alignContent: 'center', gap: '0 6px', wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
                  {s && (
                    <>
                      <span style={{ fontSize: 13, fontWeight: 700, color: s.canceled && !s.makeup && !s.activity ? FAINT : SUB, lineHeight: 1.25 }}>{s.makeup || s.activity ? s.place || '보강' : s.cls}</span>
                      {s.num ? <span style={{ fontSize: 15, fontWeight: 800, color: INK, lineHeight: 1.25 }}>{s.num}<span style={{ fontSize: 10.5, fontWeight: 600, color: FAINT }}>차시</span></span>
                        : tag && <span style={{ fontSize: 11.5, fontWeight: 700, color: s.perf ? RED : FAINT, lineHeight: 1.25 }}>{tag}</span>}
                      {edit && edit.key === iso + '|' + p ? (
                        <textarea
                          autoFocus
                          rows={2}
                          aria-label={DAYS[fromISO(iso).getDay()] + ' ' + p + '교시 메모'}
                          value={edit.text}
                          onChange={e => setEdit({ ...edit, text: e.target.value })}
                          onDoubleClick={e => e.stopPropagation()}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); commit() }
                            if (e.key === 'Escape') { e.preventDefault(); setEdit(null) }
                          }}
                          onBlur={commit}
                          placeholder="메모 (엔터 저장 · 비우면 지움)"
                          style={{ flexBasis: '100%', width: '100%', boxSizing: 'border-box', resize: 'none', border: '1px solid ' + GREEN, borderRadius: 4, fontSize: 11.5, lineHeight: 1.35, padding: '2px 4px', marginTop: 2, fontFamily: 'inherit', background: '#FFFFFF' }}
                        />
                      ) : notes[iso + '|' + p] && (
                        <span style={{ flexBasis: '100%', fontSize: 11, lineHeight: 1.35, color: NOTE_FG, whiteSpace: 'pre-wrap' }}>✎ {notes[iso + '|' + p]}</span>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

// 위젯 — 이번 달 달력. 날짜마다 학사일정·할 일(눌러서 체크). 날짜를 누르면 아래에서 그 날 할 일을 넣는다.
export function MiniMonth({ glass = false, data, setData, today }) {
  const line = lineOf(glass)
  const t0 = fromISO(today)
  const [ym, setYm] = useState({ y: t0.getFullYear(), m: t0.getMonth() })
  const [sel, setSel] = useState(today)
  const [draft, setDraft] = useState('')
  const [cellEdit, setCellEdit] = useState(null) // 더블클릭한 날 { iso, text }
  const todos = data.todos || {}
  const colors = data.dayColors || {}
  const first = new Date(ym.y, ym.m, 1)
  const start = addDays(first, -first.getDay())
  const weeks = []
  for (let w = 0; w < 6; w++) {
    const row = []
    for (let i = 0; i < 7; i++) row.push(addDays(start, w * 7 + i))
    if (w >= 4 && row[0].getMonth() !== ym.m) break
    weeks.push(row)
  }
  const move = n => setYm(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  const eventsOn = iso => (data.events || []).filter(e => e.start <= iso && iso <= e.end && !e.period && !e.cls)
  const offDay = (iso, dow) => dow === 0 || dow === 6 || holidayOn(iso) || eventsOn(iso).some(e => e.type === '휴업일') || (data.semStart && data.semEnd && (iso < data.semStart || iso > data.semEnd))
  const setTodos = (iso, list) => setData(d => {
    const tt = { ...(d.todos || {}) }
    if (list.length) tt[iso] = list
    else delete tt[iso]
    return { ...d, todos: tt }
  })
  const toggle = (iso, id) => setTodos(iso, (todos[iso] || []).map(x => (x.id === id ? { ...x, done: !x.done } : x)))
  const add = e => {
    e.preventDefault()
    const v = draft.trim()
    if (!v) return
    setTodos(sel, [...(todos[sel] || []), { id: Date.now(), text: v, done: false }])
    setDraft('')
  }
  const selD = fromISO(sel)
  const commitCell = () => {
    if (!cellEdit) return
    const v = cellEdit.text.trim()
    if (v) setTodos(cellEdit.iso, [...(todos[cellEdit.iso] || []), { id: Date.now(), text: v, done: false }])
    setCellEdit(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        <button type="button" onClick={() => move(-1)} aria-label="이전 달" className="hov" style={navBtn}>‹</button>
        <div style={{ fontSize: 16, fontWeight: 800, color: INK, minWidth: 92, textAlign: 'center' }}>{ym.y}.{String(ym.m + 1).padStart(2, '0')}</div>
        <button type="button" onClick={() => move(1)} aria-label="다음 달" className="hov" style={navBtn}>›</button>
        <button type="button" onClick={() => { setYm({ y: t0.getFullYear(), m: t0.getMonth() }); setSel(today) }} style={{ border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF', color: SUB, fontSize: 11.5, padding: '2px 8px', cursor: 'pointer', marginLeft: 4 }}>오늘</button>
      </div>
      {/* 요일 머리와 날짜 칸을 한 격자에 두어 열이 정확히 맞는다. 주(줄) 높이는 같게 나누고,
          할 일이 많은 주만 늘어난다(넘치면 달력 안에서 스크롤) */}
      <div className="soft-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: glass ? line : '1px solid ' + LINE, borderRadius: 10, background: glass ? 'transparent' : '#FFFFFF' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gridTemplateRows: 'auto repeat(' + weeks.length + ', minmax(84px, 1fr))', minHeight: '100%' }}>
          {DAYS.split('').map((w, i) => (
            <div key={w} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, padding: '5px 0', background: glass ? 'transparent' : '#F7F8FA', borderLeft: i ? line : 'none', borderBottom: line, color: i === 0 ? RED : i === 6 ? SAT : SUB, position: 'sticky', top: 0, zIndex: 1 }}>{w}</div>
          ))}
          {weeks.map((row, wi) => row.map((d, i) => {
            const iso = toISO(d)
            const out = d.getMonth() !== ym.m
            const hol = holidayOn(iso)
            const term = solarTermOn(iso)
            const evs = eventsOn(iso)
            const tds = todos[iso] || []
            const isSel = iso === sel
            const bg = colors[iso] ? tint(colors[iso], glass) : offDay(iso, i) ? (glass ? 'rgba(18,132,202,0.10)' : '#EEF5FC') : glass ? 'transparent' : '#FFFFFF'
            return (
              <div key={iso} onClick={() => setSel(iso)} onDoubleClick={() => { setSel(iso); setCellEdit({ iso, text: '' }) }} title="더블클릭하면 할 일을 바로 넣습니다"
                style={{ minWidth: 0, padding: '4px 5px 5px', cursor: 'pointer', background: bg, opacity: out ? 0.45 : 1,
                  borderTop: wi ? line : 'none', borderLeft: i ? line : 'none', boxShadow: isSel ? 'inset 0 0 0 2px ' + GREEN : 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, minHeight: 18 }}>
                  <span data-hit="" title="더블클릭하면 할 일을 바로 넣습니다" style={{ fontSize: 12.5, fontWeight: 800, flex: 'none', lineHeight: '18px', cursor: 'pointer', color: iso === today ? '#FFFFFF' : i === 0 || hol ? RED : i === 6 ? SAT : INK, background: iso === today ? GREEN : 'transparent', borderRadius: 999, padding: iso === today ? '0 6px' : 0 }}>{d.getDate()}</span>
                  {(hol || term) && <span style={{ fontSize: 10, fontWeight: 700, color: hol ? RED : '#2B8A3E', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hol || term}</span>}
                </div>
                {evs.map(e => (
                  <div key={e.id} style={{ fontSize: 10.5, lineHeight: 1.3, color: TYPE_COLOR[e.type] || SUB, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{e.name}</div>
                ))}
                {tds.map(x => (
                  <div key={x.id} data-hit="" onClick={ev => { ev.stopPropagation(); toggle(iso, x.id) }} title={x.done ? '완료 취소' : '눌러서 완료'}
                    style={{ display: 'flex', gap: 3, alignItems: 'flex-start', fontSize: 11.5, lineHeight: 1.35, color: x.done ? FAINT : todoColor(x.color), fontWeight: x.color && !x.done ? 700 : 500, cursor: 'pointer' }}>
                    <span style={{ flex: 'none', width: 9, textAlign: 'center' }}>{x.done ? '✓' : '•'}</span>
                    <span style={{ flex: 1, minWidth: 0, textDecoration: x.done ? 'line-through' : 'none', wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{x.text}</span>
                  </div>
                ))}
                {cellEdit && cellEdit.iso === iso && (
                  <input
                    autoFocus
                    aria-label={(d.getMonth() + 1) + '월 ' + d.getDate() + '일 할 일'}
                    value={cellEdit.text}
                    onChange={e => setCellEdit({ iso, text: e.target.value })}
                    onClick={e => e.stopPropagation()}
                    onDoubleClick={e => e.stopPropagation()}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); commitCell() }
                      if (e.key === 'Escape') setCellEdit(null)
                    }}
                    onBlur={commitCell}
                    placeholder="할 일"
                    style={{ width: '100%', boxSizing: 'border-box', border: '1px solid ' + GREEN, borderRadius: 4, fontSize: 11.5, padding: '2px 4px', marginTop: 1, background: '#FFFFFF' }}
                  />
                )}
              </div>
            )
          }))}
        </div>
      </div>
      <form onSubmit={add} style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: SUB, flex: 'none' }}>{selD.getMonth() + 1}.{selD.getDate()} {DAYS[selD.getDay()]}</span>
        <input aria-label="할 일 추가" value={draft} onChange={e => setDraft(e.target.value)} placeholder="할 일 추가 (날짜 더블클릭해도 돼요)" style={{ flex: 1, minWidth: 0, border: '1px solid ' + LINE, borderRadius: 8, fontSize: 12.5, padding: '5px 8px' }} />
        <button type="submit" style={{ border: 'none', borderRadius: 8, background: draft.trim() ? GREEN : '#D1D6DB', color: '#FFFFFF', fontSize: 12, fontWeight: 700, padding: '6px 10px', cursor: draft.trim() ? 'pointer' : 'default', flex: 'none' }}>추가</button>
      </form>
    </div>
  )
}

const navBtn = { border: 'none', background: 'none', width: 24, height: 24, borderRadius: 6, cursor: 'pointer', fontSize: 17, color: SUB, lineHeight: 1, padding: 0 }
