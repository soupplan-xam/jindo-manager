import assert from 'node:assert/strict'
import { compute } from '../src/logic.js'
import { defaultData, coerceData } from '../src/storage.js'

const d = defaultData()
// 월1·수1 = A반. 10.5(월)~10.16(금)
Object.assign(d, { semStart: '2026-10-05', semEnd: '2026-10-16', classes: ['A'], pattern: { '1-1': 'A', '3-1': 'A' } })
let c = compute(d)
assert.deepEqual(c.perClass.A.map(x => x.num), [1, 2, 3, 4])

// 보강: 화3에 장소로 넣는다 → 반이 아니고 진도 안 셈
d.makeups = { '2026-10-06|3': { place: '2-9 교실' } }
c = compute(d)
assert.deepEqual(c.sessions['2026-10-06|3'], { cls: '', canceled: true, makeup: true, place: '2-9 교실', reason: '보강' })
assert.equal(c.sessions['2026-10-07|1'].num, 2)
assert.deepEqual(Object.keys(c.perClass), ['A'])

// 교환: 수1을 비우고(교환으로 빠짐) 목2로 옮김 → 진도 셈, 차시 수 그대로
d.makeups = {}
d.extras = { '2026-10-07|1': '', '2026-10-08|2': 'A' }
d.extraKind = { '2026-10-07|1': 'swap', '2026-10-08|2': 'swap' }
c = compute(d)
assert.equal(c.sessions['2026-10-07|1'], undefined)
assert.deepEqual(c.sessions['2026-10-08|2'], { cls: 'A', num: 2, sec: 'start', extra: true, swap: true })
assert.equal(c.perClass.A.length, 4)

// 예전 데이터(extraKind 없음): 넣은 수업은 그대로 진도에 센다
const legacy = coerceData({ ...d, extraKind: undefined, extras: { '2026-10-06|3': 'A' } })
assert.deepEqual(legacy.extraKind, {})
assert.equal(compute(legacy).perClass.A.length, 5)

// 예전 방식 보강(반으로 넣음) → 장소 보강으로 옮기고, 보강 때문에만 생긴 반은 뺀다
const old = coerceData({ ...d, classes: ['A', '2-9'], colors: { '2-9': '#DCE8F8', A: '#FBF0C8' },
  extras: { '2026-10-06|3': '2-9', '2026-10-08|2': 'A' }, extraKind: { '2026-10-06|3': 'makeup', '2026-10-08|2': 'swap' } })
assert.deepEqual(old.makeups, { '2026-10-06|3': { place: '2-9' } })
assert.deepEqual(old.extras, { '2026-10-08|2': 'A' })
assert.deepEqual(old.extraKind, { '2026-10-08|2': 'swap' })
assert.deepEqual(old.classes, ['A'])
assert.deepEqual(old.colors, { A: '#FBF0C8' })
// 정규 시간표에도 있는 반으로 넣었던 보강은 반을 지우지 않는다
const kept = coerceData({ ...d, extras: { '2026-10-06|3': 'A' }, extraKind: { '2026-10-06|3': 'makeup' } })
assert.deepEqual(kept.classes, ['A'])
assert.deepEqual(kept.makeups, { '2026-10-06|3': { place: 'A' } })

// 휴업일에 넣은 보강은 나오지 않는다
const h = { ...d, extras: {}, extraKind: {}, makeups: { '2026-10-09|1': { place: '과학실' } },
  events: [{ id: 1, type: '휴업일', name: '한글날', start: '2026-10-09', end: '2026-10-09' }] }
assert.equal(compute(h).sessions['2026-10-09|1'], undefined)
console.log('PASS: makeup by place (not a class, not counted), swap counted, legacy migration, holiday')
