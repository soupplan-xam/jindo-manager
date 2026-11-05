import React, { useMemo, useRef, useState } from 'react'
import { GREEN, INK, SUB, FAINT, LINE, LINE_SOFT, RED, WARN, SECTION_TITLE, fromISO, toISO, DAYS } from '../logic.js'
import { holidayOn, solarTermOn } from '../kcal.js'
import { TYPE_COLOR } from './ScheduleCalendar.jsx'
import useWindowWidth from '../useWindowWidth.js'

// 월간 달력 — 학사일정 · 내 할 일 · 기간 색칠 · 공휴일 · 절기.
// 날짜를 누르면 오른쪽(휴대폰은 아래) 칸에서 그 날 할 일을 적고 체크한다.
// [칠하기]를 켜면 날짜를 누르거나 끌어서 색을 칠한다.
export const PAINTS = [
  { c: '#D3EBC0', n: '연두' }, { c: '#D3E3F7', n: '하늘' }, { c: '#FBEFC4', n: '노랑' },
  { c: '#F6DCE3', n: '분홍' }, { c: '#E3E1DC', n: '회색' },
]
const SAT = '#185FA5'

export default function MonthCalendar({ data, setData, setSnack }) {
  const { isMobile } = useWindowWidth()
  const today = toISO(new Date())
  const [ym, setYm] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [sel, setSel] = useState(today)
  const [draft, setDraft] = useState('')
  const [paint, setPaint] = useState(null) // null | 색 | 'erase'
  const drag = useRef(null)
  const todos = data.todos || {}
  const colors = data.dayColors || {}

  const weeks = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1)
    const start = new Date(ym.y, ym.m, 1 - first.getDay())
    const out = []
    for (let w = 0; w < 6; w++) {
      const row = []
      for (let i = 0; i < 7; i++) row.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i))
      if (w >= 4 && row[0].getMonth() !== ym.m) break
      out.push(row)
    }
    return out
  }, [ym])

  const move = n => setYm(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  const goToday = () => { const d = new Date(); setYm({ y: d.getFullYear(), m: d.getMonth() }); setSel(today) }

  const eventsOn = iso => data.events.filter(e => e.start <= iso && iso <= e.end)

  // ---- 할 일 ----
  const setTodos = (iso, list) => setData(d => {
    const t = { ...(d.todos || {}) }
    if (list.length) t[iso] = list
    else delete t[iso]
    return { ...d, todos: t }
  })
  const addTodo = () => {
    const v = draft.trim()
    if (!v) return
    setTodos(sel, [...(todos[sel] || []), { id: Date.now(), text: v, done: false }])
    setDraft('')
  }
  const toggle = id => setTodos(sel, (todos[sel] || []).map(t => (t.id === id ? { ...t, done: !t.done } : t)))
  const remove = id => {
    const prev = data.todos || {}
    setTodos(sel, (todos[sel] || []).filter(t => t.id !== id))
    setSnack({ text: '할 일을 지웠습니다.', kind: 'todos', prev, ms: 4000 })
  }

  // ---- 칠하기: 누른 날부터 손을 뗀 날까지 날짜 순서대로 칠한다(터치도 같다) ----
  const rangeOf = (x, y) => {
    const [lo, hi] = x <= y ? [x, y] : [y, x]
    const out = []
    for (let d = fromISO(lo); toISO(d) <= hi; d.setDate(d.getDate() + 1)) out.push(toISO(d))
    return out
  }
  const paintTo = iso => {
    if (!iso || !drag.current || drag.current.last === iso) return
    drag.current.last = iso
    const days = rangeOf(drag.current.anchor, iso)
    drag.current.count = days.length
    const c = { ...drag.current.prev }
    days.forEach(k => { if (paint === 'erase') delete c[k]; else c[k] = paint })
    setData(d => ({ ...d, dayColors: c }))
  }
  const isoAt = (x, y) => {
    const el = document.elementFromPoint(x, y)
    const cell = el && el.closest && el.closest('[data-iso]')
    return cell ? cell.getAttribute('data-iso') : null
  }
  const onDown = e => {
    if (!paint) return
    const iso = isoAt(e.clientX, e.clientY)
    if (!iso) return
    e.preventDefault()
    drag.current = { anchor: iso, last: null, count: 0, prev: data.dayColors || {} }
    paintTo(iso)
  }
  const onMove = e => { if (paint && drag.current) paintTo(isoAt(e.clientX, e.clientY)) }
  const onUp = () => {
    if (drag.current && drag.current.count) {
      setSnack({ text: drag.current.count + '일을 ' + (paint === 'erase' ? '지웠습니다.' : '칠했습니다.'), kind: 'dayColors', prev: drag.current.prev, ms: 3000 })
    }
    drag.current = null
  }

  const selD = fromISO(sel)
  const selEvents = eventsOn(sel)
  const selHoliday = holidayOn(sel)
  const selTerm = solarTermOn(sel)
  const selTodos = todos[sel] || []

  const cellH = isMobile ? 62 : 104
  const grid = (
    <div
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
            onPointerCancel={onUp}
      style={{ border: '1px solid ' + LINE, borderRadius: 8, overflow: 'hidden', background: '#FFFFFF', touchAction: paint ? 'none' : 'auto', userSelect: paint ? 'none' : 'auto' }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', background: '#F4F2ED', borderBottom: '1px solid ' + LINE }}>
        {DAYS.split('').map((w, i) => (
          <div key={w} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, padding: '6px 0', color: i === 0 ? RED : i === 6 ? SAT : SUB }}>{w}</div>
        ))}
      </div>
      {weeks.map((row, wi) => (
        <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {row.map((d, i) => {
            const iso = toISO(d)
            const out = d.getMonth() !== ym.m
            const hol = holidayOn(iso)
            const term = solarTermOn(iso)
            const evs = eventsOn(iso)
            const tds = todos[iso] || []
            const isSel = iso === sel
            const isToday = iso === today
            const numColor = out ? LINE : i === 0 || hol ? RED : i === 6 ? SAT : INK
            const items = [
              ...evs.map(e => ({ k: 'e' + e.id, t: e.name, c: TYPE_COLOR[e.type] || SUB })),
              ...tds.map(t => ({ k: 't' + t.id, t: t.text, c: t.done ? FAINT : INK, done: t.done, todo: true })),
            ]
            const max = isMobile ? 0 : 3
            return (
              <div
                key={iso}
                data-iso={iso}
                onClick={() => { if (!paint) setSel(iso) }}
                role="button"
                tabIndex={0}
                aria-label={(d.getMonth() + 1) + '월 ' + d.getDate() + '일' + (hol ? ' ' + hol : '') + (tds.length ? ' 할 일 ' + tds.length + '개' : '')}
                aria-pressed={isSel}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(iso) } }}
                style={{
                  minHeight: cellH, minWidth: 0, padding: isMobile ? '4px 4px' : '6px 7px', boxSizing: 'border-box', cursor: paint ? 'crosshair' : 'pointer',
                  borderTop: wi ? '1px solid ' + LINE_SOFT : 'none', borderLeft: i ? '1px solid ' + LINE_SOFT : 'none',
                  background: colors[iso] || (out ? '#FAF9F6' : '#FFFFFF'),
                  boxShadow: isSel ? 'inset 0 0 0 2px ' + GREEN : 'none',
                  opacity: out ? 0.6 : 1, overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: isMobile ? 12 : 13.5, fontWeight: 700, color: isToday ? '#FFFFFF' : numColor, flex: 'none',
                      background: isToday ? GREEN : 'transparent', borderRadius: 999, padding: isToday ? '0 6px' : 0, fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {d.getDate()}
                  </span>
                  {!isMobile && (hol || term) && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: hol ? RED : GREEN, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[hol, term].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
                {isMobile ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 4 }}>
                    {(hol || term) && <span style={{ fontSize: 9, fontWeight: 700, color: hol ? RED : GREEN, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hol || term}</span>}
                    {items.slice(0, 4).map(it => (
                      <span key={it.k} style={{ width: 6, height: 6, borderRadius: '50%', background: it.todo ? (it.done ? LINE : INK) : it.c }} />
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {items.slice(0, max).map(it => (
                      <div key={it.k} title={it.t} style={{ fontSize: 11.5, lineHeight: 1.35, color: it.c, textDecoration: it.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {it.todo ? (it.done ? '✓ ' : '· ') : ''}{it.t}
                      </div>
                    ))}
                    {items.length > max && <div style={{ fontSize: 11, color: FAINT }}>+{items.length - max}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )

  const field = { border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF', fontSize: 14, padding: '7px 10px', boxSizing: 'border-box' }

  const detail = (
    <section aria-label="고른 날" style={{ minWidth: 0 }}>
      <div style={{ ...SECTION_TITLE, fontSize: 16 }}>
        {selD.getMonth() + 1}월 {selD.getDate()}일 <span style={{ color: selD.getDay() === 0 || selHoliday ? RED : selD.getDay() === 6 ? SAT : SUB, fontWeight: 600 }}>{DAYS[selD.getDay()]}요일</span>
      </div>
      {(selHoliday || selTerm) && (
        <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700 }}>
          {selHoliday && <span style={{ color: RED }}>{selHoliday}</span>}
          {selHoliday && selTerm && <span style={{ color: FAINT }}> · </span>}
          {selTerm && <span style={{ color: GREEN }}>{selTerm}</span>}
        </div>
      )}
      {selEvents.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {selEvents.map(e => (
            <div key={e.id} style={{ fontSize: 13, color: INK, display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: TYPE_COLOR[e.type] || SUB, flex: 'none' }} />
              {e.name}
              <span style={{ fontSize: 11.5, color: FAINT }}>{e.type === '휴업일' ? '휴업' : e.type}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 700, color: SUB }}>할 일</div>
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column' }}>
        {selTodos.length === 0 && <div style={{ fontSize: 13, color: FAINT, padding: '4px 0' }}>아직 없습니다.</div>}
        {selTodos.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid ' + LINE_SOFT }}>
            <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} aria-label={t.text + (t.done ? ' 완료 취소' : ' 완료')} style={{ accentColor: GREEN, width: 16, height: 16, margin: 0, flex: 'none' }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: t.done ? FAINT : INK, textDecoration: t.done ? 'line-through' : 'none', wordBreak: 'break-all' }}>{t.text}</span>
            <button type="button" onClick={() => remove(t.id)} aria-label={t.text + ' 지우기'} style={{ border: 'none', background: 'none', padding: '0 4px', cursor: 'pointer', color: FAINT, fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        ))}
      </div>
      <form onSubmit={e => { e.preventDefault(); addTodo() }} style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <input
          id="todo-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="할 일 추가 (예: 자기소개서 채점)"
          style={{ ...field, flex: 1, minWidth: 0 }}
        />
        <button type="submit" style={{ border: 'none', borderRadius: 6, background: draft.trim() ? GREEN : '#D9D5CE', color: '#FFFFFF', padding: '0 14px', fontSize: 14, fontWeight: 700, cursor: draft.trim() ? 'pointer' : 'default', flex: 'none' }}>추가</button>
      </form>
      <div style={{ marginTop: 14, fontSize: 11.5, color: FAINT, lineHeight: 1.6 }}>
        학사일정은 [수정] 화면의 일정에서 넣은 것이 함께 보입니다. 공휴일은 참고용이며 학교 학사일정이 우선입니다.
      </div>
    </section>
  )

  return (
    <div style={{ width: '100%', maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => move(-1)} aria-label="이전 달" className="hov" style={navBtn}>‹</button>
        <div style={{ fontSize: isMobile ? 17 : 19, fontWeight: 800, minWidth: isMobile ? 110 : 130, textAlign: 'center', letterSpacing: '-0.02em' }}>{ym.y}년 {ym.m + 1}월</div>
        <button type="button" onClick={() => move(1)} aria-label="다음 달" className="hov" style={navBtn}>›</button>
        <button type="button" onClick={goToday} style={{ border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF', color: SUB, padding: '5px 10px', fontSize: 13, cursor: 'pointer', marginLeft: 4 }}>오늘</button>
        <div style={{ flex: 1 }} />
        <div role="group" aria-label="기간 색칠" style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: paint ? GREEN : FAINT, fontWeight: 700 }}>{paint ? '칠하는 중' : '칠하기'}</span>
          {PAINTS.map(p => (
            <button
              key={p.c}
              type="button"
              aria-label={p.n + '으로 칠하기'}
              aria-pressed={paint === p.c}
              title={p.n}
              onClick={() => setPaint(paint === p.c ? null : p.c)}
              style={{ width: 24, height: 24, borderRadius: 5, background: p.c, cursor: 'pointer', padding: 0, boxSizing: 'border-box', border: paint === p.c ? '2px solid ' + GREEN : '1px solid rgba(26,26,26,0.15)' }}
            />
          ))}
          <button
            type="button"
            aria-pressed={paint === 'erase'}
            onClick={() => setPaint(paint === 'erase' ? null : 'erase')}
            style={{ border: '1px solid ' + (paint === 'erase' ? GREEN : LINE), borderRadius: 5, background: paint === 'erase' ? '#EAF1EE' : '#FFFFFF', color: paint === 'erase' ? GREEN : SUB, fontSize: 12, padding: '4px 8px', cursor: 'pointer' }}
          >
            지우개
          </button>
          {paint && (
            <button type="button" onClick={() => setPaint(null)} style={{ border: 'none', background: GREEN, color: '#FFFFFF', borderRadius: 5, fontSize: 12, fontWeight: 700, padding: '5px 10px', cursor: 'pointer' }}>다 칠함</button>
          )}
        </div>
      </div>
      {paint && <div style={{ fontSize: 12, color: WARN, marginBottom: 8 }}>시작하는 날을 누른 채 끝나는 날까지 끌면 그 사이가 모두 칠해집니다. 하루만 칠하려면 누르기만 하세요. 다 칠했으면 [다 칠함]을 누르세요.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 300px', gap: isMobile ? 16 : 24, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>{grid}</div>
        {detail}
      </div>
    </div>
  )
}

const navBtn = { border: 'none', background: 'none', width: 32, height: 32, borderRadius: 6, cursor: 'pointer', fontSize: 22, color: SUB, lineHeight: 1 }
