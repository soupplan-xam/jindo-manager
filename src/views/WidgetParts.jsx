import React, { useState } from 'react'
import { GREEN, INK, SUB, FAINT, LINE, LINE_SOFT, RED, DAYS, fromISO, toISO, addDays, colorOf } from '../logic.js'
import { holidayOn, solarTermOn } from '../kcal.js'
import { TYPE_COLOR } from './ScheduleCalendar.jsx'
import { TODO_COLORS } from './MonthCalendar.jsx'

const SAT = '#185FA5'
const MAKEUP_BG = '#E8EBEF'
const todoColor = k => (TODO_COLORS.find(x => x.k === (k || '')) || TODO_COLORS[0]).c

// 위젯 — 이번 주 시간표(월~금 × 교시). 칸마다 반 · 차시. 오늘 열과 지금 교시를 강조한다.
// 주말에는 다음 주를 보여 준다.
export function MiniWeek({ data, computed, today, period, periods = 7 }) {
  const t = fromISO(today)
  const dow = t.getDay()
  let mon = addDays(t, dow === 0 ? -6 : 1 - dow)
  if (dow === 0 || dow === 6) mon = addDays(mon, 7)
  const days = [0, 1, 2, 3, 4].map(i => toISO(addDays(mon, i)))
  const nowP = period && period.kind === 'class' ? period.period : null
  const cell = { minWidth: 0, borderTop: '1px solid ' + LINE_SOFT, borderLeft: '1px solid ' + LINE_SOFT, padding: '3px 5px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 3, minHeight: 30 }
  return (
    <div style={{ border: '1px solid ' + LINE, borderRadius: 10, overflow: 'hidden', background: '#FFFFFF' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '22px repeat(5, minmax(0, 1fr))', background: '#F2F4F6', fontSize: 11.5, fontWeight: 700, color: SUB }}>
        <div />
        {days.map((iso, i) => {
          const d = fromISO(iso)
          const isToday = iso === today
          return (
            <div key={iso} style={{ textAlign: 'center', padding: '4px 0', color: isToday ? GREEN : holidayOn(iso) ? RED : SUB, background: isToday ? '#E9F6FE' : 'transparent', borderLeft: '1px solid ' + LINE_SOFT }}>
              {DAYS[d.getDay()]} {d.getDate()}
            </div>
          )
        })}
      </div>
      {Array.from({ length: periods }, (_, k) => k + 1).map(p => (
        <div key={p} style={{ display: 'grid', gridTemplateColumns: '22px repeat(5, minmax(0, 1fr))' }}>
          <div style={{ borderTop: '1px solid ' + LINE_SOFT, fontSize: 10.5, color: nowP === p ? GREEN : FAINT, fontWeight: nowP === p ? 800 : 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p}</div>
          {days.map(iso => {
            const s = computed.sessions[iso + '|' + p]
            const isNow = iso === today && nowP === p
            const bg = !s ? (iso === today ? '#FAFCFE' : '#FFFFFF') : s.makeup ? MAKEUP_BG : s.canceled ? '#FFFFFF' : colorOf(data, s.cls)
            return (
              <div key={iso} title={s ? (s.makeup ? (s.place || '') + ' 보강' : s.cls + (s.num ? ' ' + s.num + '차시' : ' ' + (s.reason || ''))) : ''}
                style={{ ...cell, background: bg, boxShadow: isNow ? 'inset 0 0 0 2px ' + GREEN : 'none' }}>
                {s && (
                  <>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.canceled && !s.makeup ? FAINT : SUB, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{s.makeup ? s.place || '보강' : s.cls}</span>
                    {s.num ? <span style={{ fontSize: 13.5, fontWeight: 800, color: INK, flex: 'none' }}>{s.num}</span>
                      : <span style={{ fontSize: 10, fontWeight: 700, color: s.perf ? RED : FAINT, flex: 'none' }}>{s.makeup ? '보강' : s.perf ? '수행' : '결손'}</span>}
                  </>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// 위젯 — 이번 달 달력. 날짜마다 학사일정·할 일(눌러서 체크). 날짜를 누르면 아래에서 그 날 할 일을 넣는다.
export function MiniMonth({ data, setData, today }) {
  const t0 = fromISO(today)
  const [ym, setYm] = useState({ y: t0.getFullYear(), m: t0.getMonth() })
  const [sel, setSel] = useState(today)
  const [draft, setDraft] = useState('')
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        <button type="button" onClick={() => move(-1)} aria-label="이전 달" className="hov" style={navBtn}>‹</button>
        <div style={{ fontSize: 15, fontWeight: 800, color: INK, minWidth: 92, textAlign: 'center' }}>{ym.y}.{String(ym.m + 1).padStart(2, '0')}</div>
        <button type="button" onClick={() => move(1)} aria-label="다음 달" className="hov" style={navBtn}>›</button>
        <button type="button" onClick={() => { setYm({ y: t0.getFullYear(), m: t0.getMonth() }); setSel(today) }} style={{ border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF', color: SUB, fontSize: 11.5, padding: '2px 8px', cursor: 'pointer', marginLeft: 4 }}>오늘</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', fontSize: 11, fontWeight: 700, textAlign: 'center', paddingBottom: 3 }}>
        {DAYS.split('').map((w, i) => <div key={w} style={{ color: i === 0 ? RED : i === 6 ? SAT : SUB }}>{w}</div>)}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'repeat(' + weeks.length + ', minmax(64px, 1fr))', border: '1px solid ' + LINE, borderRadius: 10, overflow: 'hidden', background: '#FFFFFF' }}>
        {weeks.map((row, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', minHeight: 0 }}>
            {row.map((d, i) => {
              const iso = toISO(d)
              const out = d.getMonth() !== ym.m
              const hol = holidayOn(iso)
              const term = solarTermOn(iso)
              const evs = eventsOn(iso)
              const tds = todos[iso] || []
              const isSel = iso === sel
              const bg = colors[iso] || (offDay(iso, i) ? '#EEF5FC' : '#FFFFFF')
              return (
                <div key={iso} onClick={() => setSel(iso)}
                  style={{ minWidth: 0, minHeight: 0, overflow: 'hidden', padding: '3px 4px', cursor: 'pointer', background: bg, opacity: out ? 0.45 : 1,
                    borderTop: wi ? '1px solid ' + LINE_SOFT : 'none', borderLeft: i ? '1px solid ' + LINE_SOFT : 'none', boxShadow: isSel ? 'inset 0 0 0 2px ' + GREEN : 'none', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, minWidth: 0 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, flex: 'none', color: iso === today ? '#FFFFFF' : i === 0 || hol ? RED : i === 6 ? SAT : INK, background: iso === today ? GREEN : 'transparent', borderRadius: 999, padding: iso === today ? '0 5px' : 0 }}>{d.getDate()}</span>
                    {(hol || term) && <span style={{ fontSize: 9.5, fontWeight: 700, color: hol ? RED : '#2B8A3E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hol || term}</span>}
                  </div>
                  {evs.slice(0, 2).map(e => (
                    <div key={e.id} style={{ fontSize: 10, color: TYPE_COLOR[e.type] || SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                  ))}
                  {tds.map(x => (
                    <div key={x.id} onClick={ev => { ev.stopPropagation(); toggle(iso, x.id) }} title={x.done ? '완료 취소' : '눌러서 완료'}
                      style={{ fontSize: 10.5, lineHeight: 1.3, color: x.done ? FAINT : todoColor(x.color), fontWeight: x.color && !x.done ? 700 : 500, textDecoration: x.done ? 'line-through' : 'none', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'keep-all', cursor: 'pointer' }}>
                      {x.done ? '✓' : '·'} {x.text}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <form onSubmit={add} style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: SUB, flex: 'none' }}>{selD.getMonth() + 1}.{selD.getDate()} {DAYS[selD.getDay()]}</span>
        <input aria-label="할 일 추가" value={draft} onChange={e => setDraft(e.target.value)} placeholder="할 일 추가" style={{ flex: 1, minWidth: 0, border: '1px solid ' + LINE, borderRadius: 8, fontSize: 12.5, padding: '5px 8px' }} />
        <button type="submit" style={{ border: 'none', borderRadius: 8, background: draft.trim() ? GREEN : '#D1D6DB', color: '#FFFFFF', fontSize: 12, fontWeight: 700, padding: '6px 10px', cursor: draft.trim() ? 'pointer' : 'default', flex: 'none' }}>추가</button>
      </form>
    </div>
  )
}

const navBtn = { border: 'none', background: 'none', width: 24, height: 24, borderRadius: 6, cursor: 'pointer', fontSize: 17, color: SUB, lineHeight: 1, padding: 0 }
