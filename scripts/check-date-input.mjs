import assert from 'node:assert/strict'
import { parseDateText, formatDateText, shiftRange } from '../src/dateText.js'

const ref = '2026-08-17' // 2학기 시작일 기준
const cases = {
  '10.12': '2026-10-12', '10/12': '2026-10-12', '10-12': '2026-10-12', '1012': '2026-10-12',
  '10월 12일': '2026-10-12', '10월12일': '2026-10-12', '2026.10.12': '2026-10-12', '2026-10-12': '2026-10-12',
  '20261012': '2026-10-12', '261012': '2026-10-12', '26.10.12': '2026-10-12', '2026년 10월 12일': '2026-10-12',
  '2026.10.12 (월)': '2026-10-12', '10.12 월': '2026-10-12', '10. 12.': '2026-10-12',
  '1.8': '2027-01-08', '108': '2027-01-08', // 2학기에 친 1월은 이듬해
  '20': '2026-08-20', // 날짜만 → 기준일의 달
  '2.30': null, '13.1': null, 'abc': null, '': null, '2026.2.29': null, '2028.2.29': '2028-02-29',
}
for (const [t, want] of Object.entries(cases)) assert.equal(parseDateText(t, ref), want, t)
assert.equal(parseDateText('3.2', '2027-01-10'), '2027-03-02')
assert.equal(parseDateText('12.28', '2027-01-10'), '2026-12-28')
assert.equal(formatDateText('2026-10-12'), '2026.10.12 (월)')
assert.equal(formatDateText(''), '')
assert.deepEqual(shiftRange({ start: '2026-10-12', end: '2026-10-15' }, '2026-12-14'), { start: '2026-12-14', end: '2026-12-17' })
assert.deepEqual(shiftRange({ start: '2026-12-30', end: '2027-01-02' }, '2027-02-27'), { start: '2027-02-27', end: '2027-03-02' })
assert.deepEqual(shiftRange({ start: '', end: '' }, '2026-10-12'), { start: '2026-10-12', end: '2026-10-12' })
console.log('PASS: typed dates (' + Object.keys(cases).length + ' cases), nearest school year, format, range shift')
