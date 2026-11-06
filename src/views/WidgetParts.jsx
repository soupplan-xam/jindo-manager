import React, { useEffect, useRef, useState } from 'react'
import { GREEN, INK, SUB, FAINT, LINE, LINE_SOFT, RED, DAYS, fromISO, toISO, addDays, colorOf } from '../logic.js'
import { holidayOn, solarTermOn } from '../kcal.js'
import { TYPE_COLOR } from './ScheduleCalendar.jsx'
import { TODO_COLORS, OFF_BG, offReasonOf } from './MonthCalendar.jsx'

const SAT = '#185FA5'
const MAKEUP_BG = '#E8EBEF'
const NOTE_FG = '#7A4B12'
// 바탕화면 모드(glass): 흰 면은 비우고 색 면은 반투명으로.
// inv(어두운 바탕): 화면 전체를 반전(invert + hue-rotate 180° + 밝기 BRIGHT)해 흰 글씨로 보인다(.wg-glass).
//   그래서 색을 그대로 보이게 하려면 반전을 미리 거꾸로 건 색(pre)을 쓴다.
// inv 가 아니면(밝은 바탕) 반전 없이 원래 색 그대로.
const BRIGHT = 1.35 // index.css 의 .wg-glass brightness 와 같게
const HUE180 = [[-0.574, 1.43, 0.144], [0.426, 0.43, 0.144], [0.426, 1.43, -0.856]]
const rgbOf = hex => { const m = /^#([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255] }
function pre(hex, a = 1) {
  const c = rgbOf(hex)
  if (!c) return hex
  const t = c.map(v => v / BRIGHT)
  const h = HUE180.map(r => r[0] * t[0] + r[1] * t[1] + r[2] * t[2])
  return 'rgba(' + h.map(v => Math.max(0, Math.min(255, Math.round(255 - v)))).join(',') + ',' + a + ')'
}
const rgbaOf = (hex, a) => { const c = rgbOf(hex); return c ? 'rgba(' + c.join(',') + ',' + a + ')' : hex }
// 면 색: 반전이면 미리 거꾸로, 아니면 그대로(반투명)
const paintOf = (hex, a, inv) => (inv ? pre(hex, a) : rgbaOf(hex, a))
// 글씨 색: 어두운 바탕에서는 같은 계열의 밝은 색으로
const LIGHT_INK = { [RED]: '#FF9A9A', '#185FA5': '#8CCBFF', '#2B8A3E': '#86E3A2', '#A32D2D': '#FFA3A3', '#BA7517': '#FFC37A', '#3F5C4C': '#9BE8B0' }
const inkOf = (hex, inv) => (inv && LIGHT_INK[hex] ? pre(LIGHT_INK[hex]) : hex)
// 연한 반 색을 같은 색 계열의 진한 색으로 — 어두운 유리 위에서 반끼리 구분되고 흰 글씨가 읽힌다
function vivid(hex, S0 = 0.36, L0 = 0.34) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  let h = 0
  if (mx !== mn) {
    const d = mx - mn
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const S = mx === mn ? 0 : S0, L = L0
  const C = (1 - Math.abs(2 * L - 1)) * S, X = C * (1 - Math.abs(((h / 60) % 2) - 1)), M = L - C / 2
  const [r1, g1, b1] = h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X] : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X]
  const to = v => Math.round((v + M) * 255).toString(16).padStart(2, '0')
  return '#' + to(r1) + to(g1) + to(b1)
}
// 바탕화면 모드에서 「지금」 칸(고른 날·지금 교시) — 흰 네온 테두리. 반전 화면에서는 검정이 흰빛이 된다.
// 밝은 바탕에서는 흰빛이 안 보이므로 짙은 빛으로. strong=false 면 옅게(다음 교시)
function neon(glass, inv, strong = true) {
  if (!glass) return strong ? 'inset 0 0 0 2px ' + GREEN : 'inset 0 0 0 1px ' + GREEN
  const c = inv ? '0,0,0' : '25,31,40'
  const a = strong ? 1 : 0.5
  return 'inset 0 0 0 1.5px rgba(' + c + ',' + 0.95 * a + '), inset 0 0 12px rgba(' + c + ',' + 0.45 * a + '), 0 0 10px rgba(' + c + ',' + 0.7 * a + '), 0 0 22px rgba(' + c + ',' + 0.35 * a + ')'
}
const lineOf = (glass, inv) => '1px solid ' + (inv ? 'rgba(0,0,0,0.28)' : glass ? 'rgba(0,0,0,0.13)' : LINE_SOFT)
const todoColor = k => (TODO_COLORS.find(x => x.k === (k || '')) || TODO_COLORS[0]).c

// 위젯 — 이번 주 시간표(월~금 × 교시). 칸마다 반 · 차시. 오늘 열과 지금 교시를 강조한다.
// 주말에는 다음 주를 보여 준다. 시간표 탭에서 창 전체를 채운다(글자는 자르지 않고 줄바꿈).
// 칸을 더블클릭하면 그 칸 메모(진도표의 칸 메모와 같은 notes)를 바로 적는다. 수업 없는 빈 시간도 된다.
export function MiniWeek({ glass = false, inv = false, data, setData, computed, today, period, periods = 7 }) {
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
  // 메모 우클릭 메뉴 [고치기 · 삭제], 삭제 뒤 잠깐 [되돌리기]
  const boxRef = useRef(null)
  const [ctx, setCtx] = useState(null) // { key, x, y }
  const [removed, setRemoved] = useState(null) // { key, text }
  const undoTimer = useRef(null)
  const openCtx = (ev, key) => {
    ev.preventDefault()
    ev.stopPropagation()
    const r = boxRef.current.getBoundingClientRect()
    setCtx({ key, x: Math.min(ev.clientX - r.left, r.width - 130), y: Math.min(ev.clientY - r.top, r.height - 80) })
  }
  const removeNote = key => {
    const text = notes[key]
    setData(d => { const n = { ...(d.notes || {}) }; delete n[key]; return { ...d, notes: n } })
    setRemoved({ key, text })
    clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setRemoved(null), 6000)
  }
  const undoRemove = () => {
    if (!removed) return
    setData(d => ({ ...d, notes: { ...(d.notes || {}), [removed.key]: removed.text } }))
    setRemoved(null)
  }
  useCtxClose(ctx, setCtx)
  const t = fromISO(today)
  const dow = t.getDay()
  let mon = addDays(t, dow === 0 ? -6 : 1 - dow)
  if (dow === 0 || dow === 6) mon = addDays(mon, 7)
  const days = [0, 1, 2, 3, 4].map(i => toISO(addDays(mon, i)))
  const nowP = period && period.kind === 'class' ? period.period : null
  const line = lineOf(glass, inv)
  return (
    <div ref={boxRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
    <div className="soft-scroll" style={{ flex: 1, minHeight: 0, overflow: 'auto', border: glass ? line : '1px solid ' + LINE, borderRadius: 10, background: glass ? 'transparent' : '#FFFFFF' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '30px repeat(5, minmax(0, 1fr))', gridTemplateRows: 'auto repeat(' + periods + ', minmax(40px, 1fr))', minHeight: '100%' }}>
        <div style={{ background: glass ? 'transparent' : '#F2F4F6', position: 'sticky', top: 0, zIndex: 1 }} />
        {days.map(iso => {
          const d = fromISO(iso)
          const isToday = iso === today
          return (
            <div key={iso} style={{ textAlign: 'center', padding: '6px 0', fontSize: 13, fontWeight: 700, color: isToday ? (glass ? INK : GREEN) : holidayOn(iso) ? inkOf(RED, inv) : SUB, fontWeight: isToday && glass ? 800 : 700, background: glass ? (isToday ? (inv ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.4)') : 'transparent') : isToday ? '#E9F6FE' : '#F2F4F6', borderLeft: line, position: 'sticky', top: 0, zIndex: 1 }}>
              {DAYS[d.getDay()]} {d.getMonth() + 1}.{d.getDate()}
            </div>
          )
        })}
        {Array.from({ length: periods }, (_, k) => k + 1).map(p => (
          <React.Fragment key={p}>
            <div style={{ borderTop: line, fontSize: 12.5, color: nowP === p ? (glass ? INK : GREEN) : FAINT, fontWeight: nowP === p ? 800 : 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p}</div>
            {days.map(iso => {
              const s = computed.sessions[iso + '|' + p]
              const isNow = iso === today && nowP === p
              const isNext = !nowP && iso === today && period && period.next === p && period.kind !== 'after'
              const base = s ? (s.activity || s.makeup ? MAKEUP_BG : s.canceled ? null : colorOf(data, s.cls)) : null
              // 바탕화면 모드: 반 색은 고른 색 그대로 반투명, 수행·결손 칸은 옅은 막만
              const bg = glass
                ? (s && (s.activity || s.makeup) ? (inv ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.35)') : base ? (inv ? pre(vivid(base, 0.5, 0.6), 0.55) : rgbaOf(base, 0.75)) : s ? 'rgba(0,0,0,0.05)' : 'transparent')
                : !s ? (iso === today ? '#FAFCFE' : '#FFFFFF') : base || '#FFFFFF'
              const tag = s && !s.num && !s.activity ? (s.makeup ? '보강' : s.perf ? '수행' : s.reason || '결손') : ''
              return (
                <div key={iso} title={(s ? (s.activity ? s.place : s.makeup ? (s.place || '') + ' 보강' : s.cls + (s.num ? ' ' + s.num + '차시' : ' ' + (s.reason || ''))) + ' — ' : '') + '더블클릭해 메모'}
                  data-hit=""
                  onDoubleClick={() => setEdit({ key: iso + '|' + p, text: notes[iso + '|' + p] || '' })}
                  style={{ minWidth: 0, borderTop: line, borderLeft: line, padding: '4px 6px', background: bg, boxShadow: isNow ? neon(glass, inv) : isNext && glass ? neon(glass, inv, false) : 'none', position: isNow || isNext ? 'relative' : undefined, zIndex: isNow || isNext ? 1 : undefined, cursor: 'pointer',
                    display: 'flex', flexWrap: 'wrap', alignItems: 'center', alignContent: 'center', gap: '0 6px', wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
                  {s && (
                    <>
                      <span className={glass ? 'wg-strong' : ''} style={{ fontSize: 13, fontWeight: 700, color: s.canceled && !s.makeup && !s.activity ? FAINT : SUB, lineHeight: 1.25 }}>{s.makeup || s.activity ? s.place || '보강' : s.cls}</span>
                      {s.num ? <span style={{ fontSize: 15, fontWeight: 800, color: INK, lineHeight: 1.25 }}>{s.num}<span className="wg-faint" style={{ fontSize: 10.5, fontWeight: 600, color: FAINT }}>차시</span></span>
                        : tag && <span className={s.perf ? '' : 'wg-faint'} style={{ fontSize: 11.5, fontWeight: 700, color: s.perf ? inkOf(RED, inv) : FAINT, lineHeight: 1.25 }}>{tag}</span>}
                    </>
                  )}
                  {/* 칸 메모 — 수업 없는 빈 시간에도 그 시간에 할 일을 적어 둔다 */}
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
                          placeholder="메모 · 엔터로 저장"
                          className="wg-input"
                          style={{ flexBasis: '100%', marginTop: 3 }}
                        />
                      ) : notes[iso + '|' + p] && (
                        <span onContextMenu={ev => openCtx(ev, iso + '|' + p)} title="우클릭하면 메뉴" style={{ flexBasis: '100%', fontSize: s ? 11 : 12, lineHeight: 1.35, color: s ? NOTE_FG : INK, fontWeight: s ? 400 : 600, whiteSpace: 'pre-wrap', borderRadius: 3, outline: ctx && ctx.key === iso + '|' + p ? '1px dashed ' + GREEN : 'none' }}>✎ {notes[iso + '|' + p]}</span>
                      )}
                </div>
              )
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
      {ctx && notes[ctx.key] && (
        <CtxMenu x={ctx.x} y={ctx.y} items={[
          ['메모 고치기', () => { setEdit({ key: ctx.key, text: notes[ctx.key] || '' }); setCtx(null) }],
          ['삭제', () => { removeNote(ctx.key); setCtx(null) }, true],
        ]} />
      )}
      {removed && <UndoToast text={'메모 「' + removed.text.split('\n')[0] + '」 지웠어요'} onUndo={undoRemove} />}
    </div>
  )
}

// 우클릭 메뉴 — 바깥을 누르거나 Esc 로 닫는다
function useCtxClose(ctx, setCtx) {
  useEffect(() => {
    if (!ctx) return
    const close = e => { if (!(e.target.closest && e.target.closest('[data-ctx]'))) setCtx(null) }
    const esc = e => { if (e.key === 'Escape') setCtx(null) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [ctx])
}
function CtxMenu({ x, y, items }) {
  const mi = { display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '7px 12px', fontSize: 12.5, cursor: 'pointer', color: INK }
  return (
    <div data-ctx="" data-hit="" role="menu" style={{ position: 'absolute', left: x, top: y, zIndex: 6, minWidth: 120, background: '#FFFFFF', border: '1px solid ' + LINE, borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.18)', padding: '4px 0' }}>
      {items.map(([label, fn, danger]) => (
        <button key={label} type="button" role="menuitem" className="hov2" style={danger ? { ...mi, color: RED, fontWeight: 700 } : mi} onClick={fn}>{label}</button>
      ))}
    </div>
  )
}
function UndoToast({ text, onUndo }) {
  return (
    <div role="status" data-hit="" style={{ position: 'absolute', left: '50%', bottom: 10, transform: 'translateX(-50%)', zIndex: 5, display: 'flex', alignItems: 'center', gap: 12, background: INK, color: '#FFFFFF', borderRadius: 999, padding: '7px 8px 7px 14px', fontSize: 12.5, boxShadow: '0 4px 14px rgba(0,0,0,0.25)', whiteSpace: 'nowrap', maxWidth: '90%' }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
      <button type="button" onClick={onUndo} style={{ border: 'none', background: 'rgba(255,255,255,0.16)', color: '#FFFFFF', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>되돌리기</button>
    </div>
  )
}

// 위젯 — 이번 달 달력. 날짜마다 학사일정·할 일(눌러서 체크). 날짜를 더블클릭해 그 칸에서 바로 할 일을 넣는다.
export function MiniMonth({ glass = false, inv = false, data, setData, today }) {
  const line = lineOf(glass, inv)
  const boxRef = useRef(null)
  const [ctx, setCtx] = useState(null) // 우클릭 메뉴 { iso, id, x, y }
  const [drag, setDrag] = useState(null) // 끌고 있는 할 일 { iso, id }
  const [over, setOver] = useState(null) // 끌어다 놓을 날
  const t0 = fromISO(today)
  const [ym, setYm] = useState({ y: t0.getFullYear(), m: t0.getMonth() })
  const [sel, setSel] = useState(today)
  const [cellEdit, setCellEdit] = useState(null) // 더블클릭한 날 { iso, text }
  const [removed, setRemoved] = useState(null) // 방금 우클릭으로 지운 할 일 { iso, item, index }
  const undoTimer = useRef(null)
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
  // 쉬는 날 자동 색 — 달력 탭과 같은 규칙·설정(쉬는 날 자동 색 끄기 포함)
  const autoOff = data.cfg.autoOff !== false
  const setTodos = (iso, list) => setData(d => {
    const tt = { ...(d.todos || {}) }
    if (list.length) tt[iso] = list
    else delete tt[iso]
    return { ...d, todos: tt }
  })
  // 지우기(우클릭 메뉴의 [삭제]) — 잠깐 [되돌리기]를 띄운다
  const remove = (iso, id) => {
    const list = todos[iso] || []
    const index = list.findIndex(x => x.id === id)
    if (index < 0) return
    setTodos(iso, list.filter(x => x.id !== id))
    setRemoved({ iso, item: list[index], index })
    clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setRemoved(null), 6000)
  }
  const undoRemove = () => {
    if (!removed) return
    setData(d => {
      const list = [...((d.todos || {})[removed.iso] || [])]
      list.splice(Math.min(removed.index, list.length), 0, removed.item)
      return { ...d, todos: { ...(d.todos || {}), [removed.iso]: list } }
    })
    setRemoved(null)
  }
  // 끌어서 다른 날로 옮기기
  const moveTodo = (from, id, to) => {
    if (!from || from === to) return
    setData(d => {
      const tt = { ...(d.todos || {}) }
      const item = (tt[from] || []).find(x => x.id === id)
      if (!item) return d
      const rest = (tt[from] || []).filter(x => x.id !== id)
      if (rest.length) tt[from] = rest
      else delete tt[from]
      tt[to] = [...(tt[to] || []), item]
      return { ...d, todos: tt }
    })
  }
  const openCtx = (ev, iso, id) => {
    ev.preventDefault()
    ev.stopPropagation()
    const r = boxRef.current.getBoundingClientRect()
    setCtx({ iso, id, x: Math.min(ev.clientX - r.left, r.width - 130), y: Math.min(ev.clientY - r.top, r.height - 80) })
  }
  useCtxClose(ctx, setCtx)
  const toggle = (iso, id) => setTodos(iso, (todos[iso] || []).map(x => (x.id === id ? { ...x, done: !x.done } : x)))
  const commitCell = () => {
    if (!cellEdit) return
    const v = cellEdit.text.trim()
    if (v) setTodos(cellEdit.iso, [...(todos[cellEdit.iso] || []), { id: Date.now(), text: v, done: false }])
    setCellEdit(null)
  }

  return (
    <div ref={boxRef} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        <button type="button" onClick={() => move(-1)} aria-label="이전 달" className="hov" style={navBtn}>‹</button>
        <div style={{ fontSize: 16, fontWeight: 800, color: INK, minWidth: 92, textAlign: 'center' }}>{ym.y}.{String(ym.m + 1).padStart(2, '0')}</div>
        <button type="button" onClick={() => move(1)} aria-label="다음 달" className="hov" style={navBtn}>›</button>
        <button type="button" onClick={() => { setYm({ y: t0.getFullYear(), m: t0.getMonth() }); setSel(today) }} className="wg-btn" style={{ border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF', color: SUB, fontSize: 11.5, padding: '2px 8px', cursor: 'pointer', marginLeft: 4 }}>오늘</button>
      </div>
      {/* 요일 머리와 날짜 칸을 한 격자에 두어 열이 정확히 맞는다. 주(줄) 높이는 같게 나누고,
          할 일이 많은 주만 늘어난다(넘치면 달력 안에서 스크롤) */}
      <div className="soft-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: glass ? line : '1px solid ' + LINE, borderRadius: 10, background: glass ? 'transparent' : '#FFFFFF' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gridTemplateRows: 'auto repeat(' + weeks.length + ', minmax(84px, 1fr))', minHeight: '100%' }}>
          {DAYS.split('').map((w, i) => (
            <div key={w} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, padding: '5px 0', background: glass ? 'transparent' : '#F7F8FA', borderLeft: i ? line : 'none', borderBottom: line, color: i === 0 ? inkOf(RED, inv) : i === 6 ? inkOf(SAT, inv) : SUB, position: 'sticky', top: 0, zIndex: 1 }}>{w}</div>
          ))}
          {weeks.map((row, wi) => row.map((d, i) => {
            const iso = toISO(d)
            const out = d.getMonth() !== ym.m
            const hol = holidayOn(iso)
            const term = solarTermOn(iso)
            const evs = eventsOn(iso)
            const tds = todos[iso] || []
            const isSel = iso === sel
            // 칠한 색(흰색은 '칠 지움') > 쉬는 날 자동 색 > 바탕 — 달력 탭과 같다.
            // 어두운 바탕에서 쉬는 날은 차분하게, 직접 칠한 날은 밝은 같은 계열 색으로 눈에 띄게
            const painted = colors[iso] && colors[iso].toUpperCase() !== '#FFFFFF' ? colors[iso] : null
            const fill = painted || (!colors[iso] && autoOff && offReasonOf(data, iso, i) ? OFF_BG : null)
            const bg = fill
              ? (glass ? (inv ? (painted ? pre(vivid(fill, 0.5, 0.6), 0.55) : pre(vivid(fill), 0.32)) : rgbaOf(fill, painted ? 0.7 : 0.5)) : fill)
              : glass ? 'transparent' : '#FFFFFF'
            return (
              <div key={iso} data-hit="" onClick={() => setSel(iso)} onDoubleClick={() => { setSel(iso); setCellEdit({ iso, text: '' }) }} title="더블클릭하면 할 일을 바로 넣습니다"
                onDragOver={drag ? e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== iso) setOver(iso) } : undefined}
                onDrop={drag ? e => { e.preventDefault(); moveTodo(drag.iso, drag.id, iso); setDrag(null); setOver(null); setSel(iso) } : undefined}
                style={{ minWidth: 0, padding: '4px 5px 5px', cursor: 'pointer', background: bg, opacity: out ? (glass ? 0.6 : 0.45) : 1,
                  borderTop: wi ? line : 'none', borderLeft: i ? line : 'none', boxShadow: over === iso && drag ? 'inset 0 0 0 2px ' + GREEN + ', inset 0 0 0 999px rgba(18,132,202,0.12)' : isSel ? neon(glass, inv) : 'none', position: isSel ? 'relative' : undefined, zIndex: isSel ? 1 : undefined, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, minHeight: 18 }}>
                  <span data-hit="" title="더블클릭하면 할 일을 바로 넣습니다" style={{ fontSize: 12.5, fontWeight: 800, flex: 'none', lineHeight: '18px', cursor: 'pointer', color: iso === today ? '#FFFFFF' : i === 0 || hol ? inkOf(RED, inv) : i === 6 ? inkOf(SAT, inv) : INK, background: iso === today ? (glass ? INK : GREEN) : 'transparent', borderRadius: 999, padding: iso === today ? '0 6px' : 0 }}>{d.getDate()}</span>
                  {(hol || term) && <span style={{ fontSize: 10.5, fontWeight: 700, color: hol ? inkOf(RED, inv) : inkOf('#2B8A3E', inv), minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hol || term}</span>}
                </div>
                {evs.map(e => (
                  <div key={e.id} style={{ fontSize: 10.5, lineHeight: 1.3, fontWeight: glass ? 700 : 400, color: inkOf(TYPE_COLOR[e.type] || SUB, inv), wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{e.name}</div>
                ))}
                {tds.map(x => (
                  <div key={x.id} data-hit="" className={x.done ? 'wg-faint' : ''} draggable
                    onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', x.text); setDrag({ iso, id: x.id }); setCtx(null) }}
                    onDragEnd={() => { setDrag(null); setOver(null) }}
                    onClick={ev => { ev.stopPropagation(); toggle(iso, x.id) }} onDoubleClick={ev => ev.stopPropagation()} onContextMenu={ev => openCtx(ev, iso, x.id)}
                    title={(x.done ? '눌러서 완료 취소' : '눌러서 완료') + ' · 끌어서 다른 날로 옮기기 · 우클릭하면 메뉴'}
                    style={{ display: 'flex', gap: 3, alignItems: 'flex-start', fontSize: 11.5, lineHeight: 1.35, color: x.done ? FAINT : inkOf(todoColor(x.color), inv), fontWeight: x.color && !x.done ? 700 : 500, cursor: 'grab', opacity: drag && drag.id === x.id ? 0.4 : 1, outline: ctx && ctx.id === x.id ? '1px dashed ' + GREEN : 'none', borderRadius: 3 }}>
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
                    placeholder="할 일 · 엔터로 저장"
                    className="wg-input"
                    style={{ marginTop: 2 }}
                  />
                )}
              </div>
            )
          }))}
        </div>
      </div>
      {ctx && (() => {
        const item = (todos[ctx.iso] || []).find(x => x.id === ctx.id)
        if (!item) return null
        return <CtxMenu x={ctx.x} y={ctx.y} items={[
          [item.done ? '완료 취소' : '완료', () => { toggle(ctx.iso, ctx.id); setCtx(null) }],
          ['삭제', () => { remove(ctx.iso, ctx.id); setCtx(null) }, true],
        ]} />
      })()}
      {removed && <UndoToast text={'「' + removed.item.text + '」 지웠어요'} onUndo={undoRemove} />}
    </div>
  )
}

const navBtn = { border: 'none', background: 'none', width: 24, height: 24, borderRadius: 6, cursor: 'pointer', fontSize: 17, color: SUB, lineHeight: 1, padding: 0 }
