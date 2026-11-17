import assert from 'node:assert/strict'
import { todosOn, carriedTo, toggleTodo, removeTodo, addRepeat, makeRepeat, moveTodo, dayMarks, morningSummary } from '../src/todos.js'
import { coerceData } from '../src/storage.js'

let d = coerceData({ semStart: '2026-09-01', semEnd: '2026-12-31', classes: [], pattern: {},
  todos: { '2026-11-10': [{ id: 1, text: '채점', done: false }, { id: 2, text: '끝낸 일', done: true }], '2026-10-20': [{ id: 3, text: '오래된 일', done: false }] } })
assert.deepEqual(d.repeats, [])

// 매주 금요일(11.13) 반복 — 그 날부터, 금요일마다
d = addRepeat(d, '2026-11-13', '주간 계획 제출', 'weekly')
assert.equal(todosOn(d, '2026-11-13').length, 1)
assert.equal(todosOn(d, '2026-11-13')[0].label, '매주 금요일')
assert.equal(todosOn(d, '2026-11-20').length, 1)
assert.equal(todosOn(d, '2026-11-06').length, 0) // 시작 전
assert.equal(todosOn(d, '2026-11-14').length, 0)
// 한 날 완료는 그 날만
const rid = todosOn(d, '2026-11-13')[0].id
d = toggleTodo(d, '2026-11-13', rid)
assert.equal(todosOn(d, '2026-11-13')[0].done, true)
assert.equal(todosOn(d, '2026-11-20')[0].done, false)
// 그 날만 지우기 / 그 날부터 끝내기
d = removeTodo(d, '2026-11-20', rid, 'one')
assert.equal(todosOn(d, '2026-11-20').length, 0)
assert.equal(todosOn(d, '2026-11-27').length, 1)
d = removeTodo(d, '2026-12-04', rid, 'rest')
assert.equal(todosOn(d, '2026-11-27').length, 1)
assert.equal(todosOn(d, '2026-12-04').length, 0)
assert.equal(todosOn(d, '2026-12-11').length, 0)
// 시작한 날에 끝내면 통째로 사라진다
let e = addRepeat(d, '2026-11-25', '초근 결재', 'monthly')
assert.equal(todosOn(e, '2026-12-25').length, 1)
assert.equal(todosOn(e, '2026-12-24').length, 0)
e = removeTodo(e, '2026-11-25', todosOn(e, '2026-11-25')[0].id, 'rest')
assert.equal(e.repeats.length, d.repeats.length)
// 매달 31일은 31일이 없는 달엔 말일
e = addRepeat(d, '2026-10-31', '월말 정리', 'monthly')
assert.equal(todosOn(e, '2026-11-30').some(x => x.text === '월말 정리'), true)
assert.equal(todosOn(e, '2026-12-31').some(x => x.text === '월말 정리'), true)
// 평일 매일 — 주말 제외
e = addRepeat(d, '2026-11-09', '출석 확인', 'daily')
assert.equal(todosOn(e, '2026-11-14').some(x => x.text === '출석 확인'), false)
assert.equal(todosOn(e, '2026-11-16').some(x => x.text === '출석 확인'), true)
// 직접 넣은 할 일을 반복으로 바꾸기
e = makeRepeat(d, '2026-11-10', 1, 'weekly')
assert.equal((e.todos['2026-11-10'] || []).some(x => x.id === 1), false)
assert.equal(todosOn(e, '2026-11-17').some(x => x.text === '채점' && x.repeat), true)

// 끝내지 못한 할 일은 오늘로 넘어와 보인다(14일 안, 끝낸 것·반복은 빼고) — 데이터는 그대로
const late = carriedTo(d, '2026-11-16')
assert.deepEqual(late.map(x => [x.text, x.from]), [['채점', '2026-11-10']])
assert.equal(d.todos['2026-11-10'].length, 2)
assert.deepEqual(carriedTo({ ...d, cfg: { ...d.cfg, carry: false } }, '2026-11-16'), [])
// 넘어온 일을 끝내면 사라진다 / 오늘로 옮기기
assert.equal(carriedTo(toggleTodo(d, '2026-11-10', 1), '2026-11-16').length, 0)
const mv = moveTodo(d, '2026-11-10', 1, '2026-11-16')
assert.equal(carriedTo(mv, '2026-11-16').length, 0)
assert.equal(mv.todos['2026-11-16'][0].text, '채점')

// 달력 표시: 출장(기간) · 초근(기록) 
const m = { ...d, trips: [{ id: 1, date: '2026-11-18', kind: 'out', endDate: '2026-11-19', place: '수원' }],
  overtime: { ...d.overtime, logs: { '2026-11-12': { end: '19:10' } } } }
assert.deepEqual(dayMarks(m, '2026-11-19', '2026-11-16'), [{ k: 'trip', t: '출장 수원' }])
assert.equal(dayMarks(m, '2026-11-12', '2026-11-16')[0].k, 'ot')
assert.deepEqual(dayMarks(m, '2026-11-17', '2026-11-16'), [])

// 아침 알림 요약
const s = morningSummary({ ...d, todos: { ...d.todos, '2026-11-16': [{ id: 9, text: '성적 입력', done: false }] }, ddays: [{ id: 1, name: '기말', date: '2026-11-17' }] }, '2026-11-16')
assert.equal(s.title, '오늘 할 일 1개 · 지난 할 일 1개')
assert.ok(s.body.includes('D-1 기말') && s.body.includes('• 성적 입력') && s.body.includes('채점'))
assert.equal(morningSummary(coerceData({ classes: [], pattern: {} }), '2026-11-16'), null)
console.log('PASS: repeating todos (weekly/monthly/daily, done per day, skip, end), carry-over, move, calendar marks, morning summary')

// 글 고치기 — 직접 넣은 할 일은 그 날 것만, 반복은 반복 전체. 빈 글이면 그대로 둔다
{
  const { editTodo } = await import('../src/todos.js')
  let x = coerceData({ classes: [], pattern: {}, todos: { '2026-11-17': [{ id: 1, text: '채점', done: true }] } })
  x = editTodo(x, '2026-11-17', 1, '  수행평가 채점 ')
  assert.deepEqual(x.todos['2026-11-17'], [{ id: 1, text: '수행평가 채점', done: true }])
  assert.equal(editTodo(x, '2026-11-17', 1, '   '), x)
  x = addRepeat(x, '2026-11-20', '주간 계획', 'weekly')
  x = editTodo(x, '2026-11-27', todosOn(x, '2026-11-27')[0].id, '주간 계획 제출')
  assert.equal(todosOn(x, '2026-11-20')[0].text, '주간 계획 제출')
  console.log('PASS: edit todo text (own / repeat / blank ignored)')
}

// 예전 날짜별 수행평가 기록 → 평가 이름별(perfs). 같은 이름은 하나로, 반은 그 칸의 반
{
  const x = coerceData({ semStart: '2026-11-02', semEnd: '2026-11-30', classes: ['1-3', '1-8'], pattern: { '1-1': '1-3', '2-2': '1-8' },
    cancels: { '2026-11-09|1': { kind: 'perf' }, '2026-11-10|2': { kind: 'perf' } },
    perf: { '2026-11-09|1': { title: '서술형 1회', absent: [{ no: 15, done: false }, { no: 3, done: true }] }, '2026-11-10|2': { title: '서술형 1회', absent: [{ no: 7, done: false }] } } })
  assert.deepEqual(x.perf, {})
  assert.equal(x.perfs.length, 1)
  assert.equal(x.perfs[0].title, '서술형 1회')
  assert.deepEqual(x.perfs[0].absent, { '1-3': [{ no: 3, done: true }, { no: 15, done: false }], '1-8': [{ no: 7, done: false }] })
  assert.equal(coerceData(x).perfs.length, 1) // 다시 불러와도 그대로
  console.log('PASS: old per-date perf records migrate to per-assessment list')
}
