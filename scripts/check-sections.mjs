import assert from 'node:assert/strict'
import { compute, sectionsOf, contentOf, withContent, progressFor, pickTargetExam } from '../src/logic.js'
import { defaultData, coerceData } from '../src/storage.js'

// 월1 = A반. 10.5~12.31, 1차 10.19~10.21, 2차 12.7~12.9
const base = () => Object.assign(defaultData(), {
  semStart: '2026-10-05', semEnd: '2026-12-31', classes: ['A'], pattern: { '1-1': 'A' }, subjects: ['국어'],
  events: [
    { id: 1, type: '고사', name: '1차 정기시험', start: '2026-10-19', end: '2026-10-21' },
    { id: 2, type: '고사', name: '2차 정기시험', start: '2026-12-07', end: '2026-12-09' },
  ],
})

// 1차 뒤에만 초기화: 구간 2개
let d = base(); d.cfg.examReset = true; d.cfg.examId = 1
assert.deepEqual(sectionsOf(d).map(s => [s.key, s.label]), [['start', '1차 정기시험 전'], ['after:1', '1차 정기시험 후']])
let c = compute(d)
assert.deepEqual([c.sessions['2026-10-12|1'].num, c.sessions['2026-10-12|1'].sec], [2, 'start'])
assert.deepEqual([c.sessions['2026-10-26|1'].num, c.sessions['2026-10-26|1'].sec], [1, 'after:1'])

// 모든 고사 뒤마다: 2차 뒤에도 1부터, 구간 3개
d.cfg.examId = 'all'
c = compute(d)
assert.deepEqual(sectionsOf(d).map(s => s.key), ['start', 'after:1', 'after:2'])
assert.deepEqual([c.sessions['2026-12-14|1'].num, c.sessions['2026-12-14|1'].sec], [1, 'after:2'])
// 1차 뒤 구간의 진도: 2차 전까지 (10.26~11.30 월요일 6번)
assert.deepEqual(progressFor(d, c, 'A', '2026-11-02'), { current: 2, total: 6, remaining: 4 })
// 목표 자동 = 다가오는 고사
assert.equal(pickTargetExam(d, '2026-11-02').id, 2)
assert.equal(pickTargetExam(d, '2026-12-10'), null)

// 같은 1차시라도 구간마다 내용이 따로
d = withContent(d, 'after:1', '국어', 1, '1차 후 1차시')
d = withContent(d, 'after:2', '국어', 1, '2차 후 1차시')
assert.equal(contentOf(d, 'start', '국어', 1), '')
assert.equal(contentOf(d, 'after:1', '국어', 1), '1차 후 1차시')
assert.equal(contentOf(d, 'after:2', '국어', 1), '2차 후 1차시')
d = withContent(d, 'after:2', '국어', 1, '')
assert.equal(contentOf(d, 'after:2', '국어', 1), '')
assert.equal(contentOf(d, 'after:1', '국어', 1), '1차 후 1차시')

// 예전 내용(구간 없음) → 이미 시작된 구간마다 복사, 앞으로 올 구간은 비움
const old = { ...base(), contents: { 국어: { 1: '예전 1차시', 2: '예전 2차시' } } }
old.cfg = { ...old.cfg, examReset: true, examId: 'all' }
const today = new Date().toISOString().slice(0, 10)
const m = coerceData(old)
assert.deepEqual(m.contents, {})
assert.equal(contentOf(m, 'start', '국어', 2), '예전 2차시')
for (const s of sectionsOf(m)) {
  const want = s.key === 'start' || s.start <= today ? '예전 1차시' : ''
  assert.equal(contentOf(m, s.key, '국어', 1), want, s.key)
}
// 다시 불러와도 그대로(두 번 옮기지 않음)
assert.deepEqual(coerceData(JSON.parse(JSON.stringify(m))).secContents, m.secContents)
console.log('PASS: sections by reset exams (one / all), per-section contents, progress, legacy contents migration')
