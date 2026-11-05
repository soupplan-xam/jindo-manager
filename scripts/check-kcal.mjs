import assert from 'node:assert/strict'
import { solarTerms, solarTermOn, holidayOn } from '../src/kcal.js'
// 절기: 알려진 날짜와 맞는지
const known = { '2025-02-03': '입춘', '2025-04-04': '청명', '2025-06-21': '하지', '2025-07-22': '대서', '2025-12-22': '동지',
  '2026-11-07': '입동', '2026-11-22': '소설' }
for (const [iso, name] of Object.entries(known)) assert.equal(solarTermOn(iso), name, iso)
assert.equal(solarTerms(2026).size, 24)
// 공휴일 표
assert.equal(holidayOn('2026-07-17'), '제헌절')
assert.equal(holidayOn('2026-09-25'), '추석')
assert.equal(holidayOn('2026-10-05'), '대체공휴일')
assert.equal(holidayOn('2026-09-28'), null) // 추석이 토요일과 겹쳐도 대체공휴일 없음
assert.equal(holidayOn('2027-02-08'), '대체공휴일')
assert.equal(holidayOn('2026-11-05'), null)
console.log('PASS: solar terms (known dates), holiday table')
