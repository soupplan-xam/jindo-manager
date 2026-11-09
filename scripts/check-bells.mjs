import assert from 'node:assert/strict'
import { bellsFor, autoBellSet, parseBellText, periodNow, DEFAULT_BELLS } from '../src/today.js'
import { coerceData } from '../src/storage.js'

// 학교 단축 시간표 문서 글자(HWPX 에서 뽑은 모양)
const t40 = `11월 10일(화),  수업 시간표(40분)
 | 1 ㆍ 2 ㆍ 3학년 | 등교/조회 |    08:40(08:41분~ 지각체크)  | 1교시 | 08:50 ~ 09:30 | 2교시 | 09:40 ~ 10:20 | 3교시 | 10:30 ~ 11:10
 | 4교시 | 11:20 ~ 12:00 | 5교시 | 12:10 ~ 12:50 | 점심 시간
(60분) | 12:50 ~ 13:50 | 6교시 | 13:50 ~ 14:30 | 7교시 | 14:40 ~ 15:20 | 청소 및 종례 | 15:20 ~ `
const t30 = `수업 시간표(30분) | 등교/조회 | 08:40(08:41분~ 지각체크) | 1교시 | 08:50 ~ 09:20 | 2교시 | 09:30 ~ 10:00 | 3교시 | 10:10 ~ 10:40 | 4교시 | 10:50 ~ 11:20 | 5교시 | 11:30 ~ 12:00 | 6교시 | 12:10 ~ 12:40 | 점심 및 종례 | 12:40 ~ `
const a = parseBellText(t40)
assert.equal(a.name, '수업 40분')
assert.deepEqual(a.bells, [['08:50', '09:30'], ['09:40', '10:20'], ['10:30', '11:10'], ['11:20', '12:00'], ['12:10', '12:50'], ['13:50', '14:30'], ['14:40', '15:20']])
const b = parseBellText(t30)
assert.equal(b.name, '수업 30분')
assert.equal(b.bells.length, 6)
assert.deepEqual(b.bells[5], ['12:10', '12:40'])

const d = coerceData({ semStart: '2026-09-01', semEnd: '2026-12-31', classes: [], pattern: {},
  bellSets: [{ id: 's40', name: a.name, bells: a.bells }, { id: 's30', name: b.name, bells: b.bells }],
  todos: { '2026-11-09': [{ id: 1, text: '30분 단축', done: false }], '2026-11-10': [{ id: 2, text: '40분 단축', done: false }] } })
// 할 일에 「30분 단축」 → 수업 30분 시각표가 저절로
assert.equal(bellsFor(d, '2026-11-09').set.id, 's30')
assert.equal(bellsFor(d, '2026-11-09').auto, true)
assert.equal(bellsFor(d, '2026-11-10').set.id, 's40')
// 학사일정 「단축수업(40분)」도
assert.equal(autoBellSet({ ...d, todos: {}, events: [{ id: 1, name: '단축수업(40분)', start: '2026-11-11', end: '2026-11-11' }] }, '2026-11-11').id, 's40')
// 직접 고른 것이 우선, 'normal' 이면 평소
assert.equal(bellsFor({ ...d, bellByDate: { '2026-11-09': 's40' } }, '2026-11-09').set.id, 's40')
assert.equal(bellsFor({ ...d, bellByDate: { '2026-11-09': 'normal' } }, '2026-11-09').set, null)
assert.deepEqual(bellsFor({ ...d, bellByDate: { '2026-11-09': 'normal' } }, '2026-11-09').bells, DEFAULT_BELLS)
// 아무것도 없는 날은 평소
assert.equal(bellsFor(d, '2026-11-12').set, null)
// 단축 시각으로 지금 교시: 30분 수업 날 10:05 는 3교시 전 쉬는 시간
const p = periodNow(bellsFor(d, '2026-11-09').bells, new Date('2026-11-09T10:05:00'))
assert.equal(p.kind, 'break'); assert.equal(p.next, 3)
// 예전 데이터
const old = coerceData({ semStart: '2026-09-01', semEnd: '2026-12-31', classes: [], pattern: {} })
assert.deepEqual(old.bellSets, []); assert.deepEqual(old.bellByDate, {})
console.log('PASS: bell text parsing (HWPX timetable), per-date bell sets, auto from \"30분 단축\", manual override, period with short bells')
