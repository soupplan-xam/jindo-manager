// 할 일 — 날짜별 할 일(data.todos) + 반복 할 일(data.repeats) + 끝내지 못해 오늘로 넘어온 할 일.
// 달력 탭과 위젯 달력이 같이 쓴다.
//
// data.repeats = [{ id, text, color?, kind: 'weekly' | 'monthly' | 'daily', dow?, dom?, start, end?, done: {iso: true}, skip: {iso: true} }]
//  - weekly: 매주 dow 요일, monthly: 매달 dom 일(그 달에 없는 날이면 말일), daily: 평일(월~금) 매일
//  - 반복 할 일은 날짜마다 저장하지 않고 그 날 보일 때 만들어 낸다. 한 날의 완료는 done[iso], 그 날만 빼기는 skip[iso]
import { fromISO, toISO, addDays } from './logic.js'
import { dayOvertime, fmtMin } from './overtime.js'

export const REPEAT_KINDS = [['weekly', '매주'], ['monthly', '매달'], ['daily', '평일 매일']]
const RID = 'r:'
export const isRepeatId = id => typeof id === 'string' && id.startsWith(RID)

function repeatHits(r, iso) {
  if (!r || iso < r.start || (r.end && iso > r.end) || (r.skip && r.skip[iso])) return false
  const d = fromISO(iso)
  if (r.kind === 'daily') return d.getDay() >= 1 && d.getDay() <= 5
  if (r.kind === 'monthly') {
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    return d.getDate() === Math.min(r.dom, last)
  }
  return d.getDay() === r.dow
}

export function repeatLabel(r) {
  if (r.kind === 'daily') return '평일 매일'
  if (r.kind === 'monthly') return '매달 ' + r.dom + '일'
  return '매주 ' + '일월화수목금토'[r.dow] + '요일'
}

// 그 날 보일 할 일: 직접 넣은 것 + 반복. 반복은 { id: 'r:<id>', repeat: true, label }
export function todosOn(data, iso) {
  const own = (data.todos || {})[iso] || []
  const rep = (data.repeats || []).filter(r => repeatHits(r, iso))
    .map(r => ({ id: RID + r.id, text: r.text, color: r.color, done: !!(r.done && r.done[iso]), repeat: true, label: repeatLabel(r) }))
  return [...own, ...rep]
}

// 끝내지 못해 오늘로 넘어온 할 일 — 지난 days 일 동안의 직접 넣은 할 일 중 안 끝낸 것(반복은 다음에 또 오므로 빼고).
// 데이터는 옮기지 않고 오늘 칸에 함께 보여 주기만 한다. [{ ...todo, from: 'iso' }] 오래된 것부터
export function carriedTo(data, today, days = 14) {
  if (data.cfg && data.cfg.carry === false) return []
  const out = []
  const t = fromISO(today)
  for (let i = days; i >= 1; i--) {
    const iso = toISO(addDays(t, -i))
    for (const x of (data.todos || {})[iso] || []) if (!x.done) out.push({ ...x, from: iso })
  }
  return out
}

const withTodos = (d, iso, list) => {
  const tt = { ...(d.todos || {}) }
  if (list.length) tt[iso] = list
  else delete tt[iso]
  return { ...d, todos: tt }
}
const mapRepeat = (d, id, fn) => ({ ...d, repeats: (d.repeats || []).map(r => (RID + r.id === id ? fn(r) : r)).filter(Boolean) })

export function toggleTodo(d, iso, id) {
  if (isRepeatId(id)) {
    return mapRepeat(d, id, r => { const done = { ...(r.done || {}) }; if (done[iso]) delete done[iso]; else done[iso] = true; return { ...r, done } })
  }
  return withTodos(d, iso, ((d.todos || {})[iso] || []).map(x => (x.id === id ? { ...x, done: !x.done } : x)))
}

// 지우기. 반복 할 일은 그 날만 빼거나(mode 'one'), 그 날부터 끝낸다(mode 'rest' — 앞선 날의 기록은 남는다)
export function removeTodo(d, iso, id, mode = 'one') {
  if (isRepeatId(id)) {
    return mapRepeat(d, id, r => {
      if (mode === 'rest') return iso <= r.start ? null : { ...r, end: toISO(addDays(fromISO(iso), -1)) }
      return { ...r, skip: { ...(r.skip || {}), [iso]: true } }
    })
  }
  return withTodos(d, iso, ((d.todos || {})[iso] || []).filter(x => x.id !== id))
}

// 글 고치기. 반복 할 일은 그 반복 전체의 글이 바뀐다
export function editTodo(d, iso, id, text) {
  const v = String(text || '').trim()
  if (!v) return d
  if (isRepeatId(id)) return mapRepeat(d, id, r => ({ ...r, text: v }))
  return withTodos(d, iso, ((d.todos || {})[iso] || []).map(x => (x.id === id ? { ...x, text: v } : x)))
}

export function addTodo(d, iso, text, color) {
  return withTodos(d, iso, [...((d.todos || {})[iso] || []), { id: Date.now(), text, done: false, ...(color ? { color } : null) }])
}

export function addRepeat(d, iso, text, kind, color) {
  const day = fromISO(iso)
  const r = { id: Date.now().toString(36), text, kind, start: iso, done: {}, skip: {}, ...(color ? { color } : null),
    ...(kind === 'weekly' ? { dow: day.getDay() } : kind === 'monthly' ? { dom: day.getDate() } : null) }
  return { ...d, repeats: [...(d.repeats || []), r] }
}

// 직접 넣은 할 일을 그 날부터 반복으로 바꾼다
export function makeRepeat(d, iso, id, kind) {
  const item = ((d.todos || {})[iso] || []).find(x => x.id === id)
  if (!item) return d
  const next = addRepeat(removeTodo(d, iso, id), iso, item.text, kind, item.color)
  if (!item.done) return next
  const r = next.repeats[next.repeats.length - 1]
  return { ...next, repeats: next.repeats.map(x => (x === r ? { ...r, done: { [iso]: true } } : x)) }
}

// 다른 날로 옮기기(직접 넣은 할 일만)
export function moveTodo(d, from, id, to) {
  if (!from || from === to || isRepeatId(id)) return d
  const item = ((d.todos || {})[from] || []).find(x => x.id === id)
  if (!item) return d
  const a = withTodos(d, from, (d.todos[from] || []).filter(x => x.id !== id))
  return withTodos(a, to, [...((a.todos || {})[to] || []), item])
}

// 달력 칸에 작게 보일 표시 — 초근(인정 시간) · 방과후 · 출장. [{ k, t }]
export function dayMarks(data, iso, today) {
  const out = []
  for (const t of data.trips || []) {
    if (t.date && iso >= t.date && iso <= (t.kind === 'out' && t.endDate && t.endDate > t.date ? t.endDate : t.date)) {
      out.push({ k: 'trip', t: '출장' + (t.place ? ' ' + t.place : '') })
    }
  }
  const ot = data.overtime
  if (ot) {
    const r = dayOvertime(ot, data, iso)
    const planned = iso > today && r.source !== 'log'
    if (r.plans && r.plans.length && planned) out.push({ k: 'plan', t: '방과후' })
    else if (r.minutes > 0) out.push({ k: 'ot', t: '초근 ' + fmtMin(r.minutes) })
    else if (r.plans && r.plans.length) out.push({ k: 'plan', t: '방과후' })
  }
  return out
}

// 아침 알림에 쓸 요약 — 오늘 할 일·넘어온 할 일·D-day(오늘·내일). 알릴 게 없으면 null
export function morningSummary(data, today) {
  const todo = todosOn(data, today).filter(x => !x.done)
  const late = carriedTo(data, today)
  const t = fromISO(today)
  const dd = (data.ddays || []).map(x => ({ ...x, n: Math.round((fromISO(x.date) - t) / 86400000) })).filter(x => x.n === 0 || x.n === 1)
  if (!todo.length && !late.length && !dd.length) return null
  const lines = []
  dd.forEach(x => lines.push((x.n === 0 ? 'D-DAY ' : 'D-1 ') + x.name))
  todo.slice(0, 5).forEach(x => lines.push('• ' + x.text))
  if (todo.length > 5) lines.push('… 외 ' + (todo.length - 5) + '개')
  if (late.length) lines.push('지난 할 일 ' + late.length + '개: ' + late.slice(0, 2).map(x => x.text).join(', ') + (late.length > 2 ? ' …' : ''))
  return { title: '오늘 할 일 ' + todo.length + '개' + (late.length ? ' · 지난 할 일 ' + late.length + '개' : ''), body: lines.join('\n') }
}
