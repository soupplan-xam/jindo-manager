import assert from 'node:assert/strict'
import { decideInitial, syncJSON, isBlank } from '../src/sync.js'
import { defaultData, coerceData } from '../src/storage.js'

const blank = defaultData()
const mine = { ...defaultData(), setupDone: true, classes: ['2-1'], pattern: { '1-1': '2-1' } }
const L = syncJSON(mine), R = syncJSON({ ...mine, classes: ['2-1', '2-2'] })

assert.equal(isBlank(blank), true)
assert.equal(isBlank(mine), false)
assert.equal(decideInitial({ remoteJSON: null, localJSON: L, base: null, localBlank: false }), 'push') // 첫 로그인(온라인 비어 있음)
assert.equal(decideInitial({ remoteJSON: L, localJSON: L, base: null, localBlank: false }), 'same')
assert.equal(decideInitial({ remoteJSON: R, localJSON: syncJSON(blank), base: null, localBlank: true }), 'pull') // 새 휴대폰
assert.equal(decideInitial({ remoteJSON: R, localJSON: L, base: L, localBlank: false }), 'pull') // 이 기기는 그대로, 다른 기기에서 고침
assert.equal(decideInitial({ remoteJSON: L, localJSON: R, base: L, localBlank: false }), 'push') // 오프라인 동안 이 기기에서 고침
assert.equal(decideInitial({ remoteJSON: R, localJSON: L, base: null, localBlank: false }), 'conflict') // 처음 연결인데 양쪽 다 내용 있음
// 화면 배치(ui)는 올리지 않는다
assert.equal(syncJSON({ ...mine, ui: { a: 1 } }), syncJSON({ ...mine, ui: { a: 2 } }))
// 받은 내용을 정리해도 같은 결과(되올림 반복 없음)
const once = coerceData(JSON.parse(L)); const twice = coerceData(JSON.parse(syncJSON(once)))
assert.equal(syncJSON(once), syncJSON(twice))
console.log('PASS: first-connect decisions (push/same/pull/conflict), ui excluded, normalize idempotent')
