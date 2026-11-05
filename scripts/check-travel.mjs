import assert from 'node:assert/strict'
import { tripCost, tripDays, monthTrips } from '../src/travel.js'

// 근무지 내: 4시간 이상 2만원, 미만 1만원, 공용차량 1만원 감액, 부지급 0
assert.equal(tripCost({ kind: 'in', start: '13:00', end: '17:00' }).amount, 20000)
assert.equal(tripCost({ kind: 'in', start: '13:00', end: '16:59' }).amount, 10000)
assert.equal(tripCost({ kind: 'in', start: '09:00', end: '17:00', car: true }).amount, 10000)
assert.equal(tripCost({ kind: 'in', start: '14:00', end: '16:00', car: true }).amount, 0)
assert.equal(tripCost({ kind: 'in', start: '09:00', end: '17:00', unpaid: true }).amount, 0)
// 근무지 외 당일: 운임 + 일비 + 식비
assert.equal(tripCost({ kind: 'out', date: '2026-11-07', fare: 18600 }).amount, 18600 + 25000 + 25000)
// 1박 2일 서울: 숙박 실비 12만원 → 상한 10만원
const t = { kind: 'out', date: '2026-11-12', endDate: '2026-11-13', fare: 42000, region: 'seoul', lodgingCost: 120000 }
assert.equal(tripDays(t), 2)
assert.equal(tripCost(t).amount, 42000 + 50000 + 50000 + 100000)
// 공용차량이면 일비 절반, 설정값으로 고친 금액
assert.equal(tripCost({ kind: 'out', date: '2026-11-07', car: true }, { daily: 20000, meal: 20000 }).amount, 10000 + 20000)
assert.deepEqual(monthTrips([{ date: '2026-12-01' }, { date: '2026-11-20', start: '13:00' }, { date: '2026-11-03' }], 2026, 10).map(x => x.date), ['2026-11-03', '2026-11-20'])
console.log('PASS: travel expenses (in-area 4h rule, car cut, unpaid, out-of-area daily/meal/fare/lodging cap)')
