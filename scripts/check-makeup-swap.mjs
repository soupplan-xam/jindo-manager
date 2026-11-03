import assert from 'node:assert/strict'
import { compute } from '../src/logic.js'
import { defaultData, coerceData } from '../src/storage.js'

const d = defaultData()
// 월1·수1 = A반. 10.5(월)~10.16(금)
Object.assign(d, { semStart: '2026-10-05', semEnd: '2026-10-16', classes: ['A'], pattern: { '1-1': 'A', '3-1': 'A' } })
let c = compute(d)
assert.deepEqual(c.perClass.A.map(x => x.num), [1, 2, 3, 4])

// 보강: 화3에 A반 보강 → 진도 안 셈, 뒤 차시 그대로
d.extras = { '2026-10-06|3': 'A' }
d.extraKind = { '2026-10-06|3': 'makeup' }
c = compute(d)
assert.equal(c.sessions['2026-10-06|3'].makeup, true)
assert.equal(c.sessions['2026-10-06|3'].canceled, true)
assert.equal(c.sessions['2026-10-07|1'].num, 2)
assert.equal(c.perClass.A.length, 4)

// 교환: 수1을 비우고(교환으로 빠짐) 목2로 옮김 → 진도 셈, 차시 수 그대로
d.extras = { '2026-10-07|1': '', '2026-10-08|2': 'A' }
d.extraKind = { '2026-10-07|1': 'swap', '2026-10-08|2': 'swap' }
c = compute(d)
assert.equal(c.sessions['2026-10-07|1'], undefined)
assert.deepEqual(c.sessions['2026-10-08|2'], { cls: 'A', num: 2, extra: true, swap: true })
assert.equal(c.perClass.A.length, 4)

// 예전 데이터(extraKind 없음): 넣은 수업은 그대로 진도에 센다
const legacy = coerceData({ ...d, extraKind: undefined, extras: { '2026-10-06|3': 'A' } })
assert.deepEqual(legacy.extraKind, {})
c = compute(legacy)
assert.equal(c.sessions['2026-10-06|3'].num, 2)
assert.equal(c.perClass.A.length, 5)

// 보강 날이 휴업일이면 휴업으로 빠진다
d.extras = { '2026-10-09|1': 'A' }; d.extraKind = { '2026-10-09|1': 'makeup' }
d.events = [{ id: 1, type: '휴업일', name: '한글날', start: '2026-10-09', end: '2026-10-09' }]
c = compute(d)
assert.equal(c.sessions['2026-10-09|1'].reason, '한글날')
console.log('PASS: makeup not counted, swap counted and marked, legacy extras, holiday over makeup')
