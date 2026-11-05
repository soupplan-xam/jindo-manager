import assert from 'node:assert/strict'
import { zipSync, strToU8 } from 'fflate'
import { dayOvertime, monthOvertime, parsePlanText, defaultOvertime, fmtMin } from '../src/overtime.js'

const data = { events: [{ id: 1, type: '휴업일', name: '재량휴업일', start: '2026-11-20', end: '2026-11-20' }] }
const ot = defaultOvertime()
ot.plans = [{ id: 1, name: '수학 심화', from: '16:50', to: '18:40', start: '2026-11-01', end: '2026-11-30', days: [2, 4], skip: ['2026-11-26'] }]
// 화 11.3: 18:40 - 16:40 = 120분 - 공제 60 = 60분
assert.equal(dayOvertime(ot, data, '2026-11-03').minutes, 60)
// 직접 기록이 우선: 20:10 퇴근 → 210 - 60 = 150
ot.logs['2026-11-05'] = { end: '20:10' }
assert.equal(dayOvertime(ot, data, '2026-11-05').minutes, 150)
// 하루 최대 4시간
ot.logs['2026-11-10'] = { end: '23:00' }
assert.equal(dayOvertime(ot, data, '2026-11-10').minutes, 240)
// 공제보다 짧으면 0
ot.logs['2026-11-11'] = { end: '17:20' }
assert.equal(dayOvertime(ot, data, '2026-11-11').minutes, 0)
// 휴업일·뺀 날에는 방과후가 없다
assert.equal(dayOvertime(ot, data, '2026-11-26').plans.length, 0)
assert.equal(dayOvertime(ot, data, '2026-11-20').plans.length, 0)
// 주말 근무: 공제 없이 시작~끝, 최대 4시간
ot.logs['2026-11-07'] = { start: '10:00', end: '12:30' }
assert.equal(dayOvertime(ot, data, '2026-11-07').minutes, 150)
const m = monthOvertime(ot, data, 2026, 10)
// 화·목 방과후: 3,5(기록),10(기록),12,17,19,24 (26 뺌) + 11(기록 0) + 7(주말)
assert.equal(m.total, 60 + 150 + 240 + 60 + 60 + 60 + 60 + 0 + 150)
assert.equal(m.hours, Math.floor(m.total / 60))
assert.equal(fmtMin(150), '2시간 30분')
assert.equal(fmtMin(50), '50분')
assert.equal(fmtMin(120), '2시간')

// 계획서 글자 읽기
const p1 = parsePlanText('강좌명: 수학 심화반\n운영 기간: 2026. 9. 1. ~ 2026. 12. 18.\n운영 요일: 화, 목\n운영 시간: 16:50 ~ 18:30 (8~9교시)', '2026-08-17')
assert.deepEqual(p1, { name: '수학 심화반', from: '16:50', to: '18:30', start: '2026-09-01', end: '2026-12-18', days: [2, 4], dates: [] })
const p2 = parsePlanText('차시 | 날짜 | 시간\n1 | 9.2(수) | 17:00~18:40\n2 | 9.9(수) | 17:00~18:40\n3 | 9.16(수) | 17:00~18:40\n4 | 9.23(수) | 17:00~18:40\n점심 12:50~13:40', '2026-08-17')
assert.deepEqual(p2.dates, ['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23'])
assert.deepEqual([p2.from, p2.to, p2.start, p2.end, p2.days], ['17:00', '18:40', '2026-09-02', '2026-09-23', [3]])

// HWPX(압축 XML) 본문 읽기 — fileText 의 변환과 같은 규칙
const xml = '<hs:sec><hp:p><hp:run><hp:t>강좌명: 영어 회화</hp:t></hp:run></hp:p><hp:p><hp:run><hp:t>매주 월·수 17:00~18:30</hp:t></hp:run></hp:p></hs:sec>'
const zip = zipSync({ 'Contents/section0.xml': strToU8(xml), 'mimetype': strToU8('application/hwp+zip') })
globalThis.File = globalThis.File || class { constructor(parts, name) { this.name = name; this.buf = parts[0] } async arrayBuffer() { return this.buf.buffer } async text() { return '' } }
const { fileText } = await import('../src/overtime.js')
const txt = await fileText(new File([zip], '계획서.hwpx'))
const p3 = parsePlanText(txt, '2026-08-17')
assert.equal(p3.name, '영어 회화')
assert.deepEqual([p3.from, p3.to, p3.days], ['17:00', '18:30', [1, 3]])
await assert.rejects(fileText(new File([new Uint8Array(1)], 'a.hwp')), /HWPX나 PDF/)
// 표 칸이 나뉜 HWPX
const p4 = parsePlanText('운영 계획서\n강좌명\n | 수학 심화반\n | 운영 기간\n | 2026. 9. 1. ~ 2026. 12. 18.\n | 운영 요일\n | 화, 목\n | 운영 시간\n | 16:50 ~ 18:30', '2026-08-17')
assert.deepEqual([p4.name, p4.days, p4.from, p4.to, p4.start, p4.end], ['수학 심화반', [2, 4], '16:50', '18:30', '2026-09-01', '2026-12-18'])
console.log('PASS: overtime rules (deduct, cap, weekend, holiday, skip, logs), plan text parsing, HWPX text')
