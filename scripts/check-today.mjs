import assert from 'node:assert/strict'
import { periodNow, parseDishes, dustGrade, weatherText, DEFAULT_BELLS } from '../src/today.js'
const at = (h, m) => new Date(2026, 10, 5, h, m)
assert.deepEqual(periodNow(DEFAULT_BELLS, at(8, 30)), { kind: 'before', period: null, next: 1, left: 30 })
assert.deepEqual(periodNow(DEFAULT_BELLS, at(9, 10)), { kind: 'class', period: 1, next: 2, left: 40 })
assert.deepEqual(periodNow(DEFAULT_BELLS, at(9, 55)), { kind: 'break', period: null, next: 2, left: 5 })
assert.deepEqual(periodNow(DEFAULT_BELLS, at(12, 55)), { kind: 'break', period: null, next: 5, left: 55 }) // 점심
assert.equal(periodNow(DEFAULT_BELLS, at(17, 0)).kind, 'after')
assert.deepEqual(parseDishes('쌀밥<br/>된장찌개 (5.6.9.)<br/>깍두기 (9.13.)<br/>우유*'), [
  { name: '쌀밥', allergy: [] }, { name: '된장찌개', allergy: [5, 6, 9] }, { name: '깍두기', allergy: [9, 13] }, { name: '우유', allergy: [] }])
assert.deepEqual(dustGrade('pm10', 25), { label: '좋음', level: 0 })
assert.deepEqual(dustGrade('pm25', 40), { label: '나쁨', level: 2 })
assert.equal(weatherText(61), '비')
console.log('PASS: current period, meal parsing, dust grade, weather text')
