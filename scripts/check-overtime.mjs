import assert from 'node:assert/strict'
import { zipSync, strToU8 } from 'fflate'
import { dayOvertime, monthOvertime, parsePlanText, defaultOvertime, fmtMin } from '../src/overtime.js'

const data = { events: [{ id: 1, type: '휴업일', name: '재량휴업일', start: '2026-11-20', end: '2026-11-20' }] }
const ot = defaultOvertime()
ot.plans = [{ id: 1, name: '수학 심화', from: '16:50', to: '18:40', start: '2026-11-01', end: '2026-11-30', days: [2, 4], skip: ['2026-11-26'] }]
// 방과후 수업 시간은 초과근무가 아니다: 수업 끝나고 바로 퇴근하면 0
assert.equal(dayOvertime(ot, data, '2026-11-03').minutes, 0)
// 방과후 끝(18:40) 뒤 20:10 퇴근 → 90분 - 공제 60 = 30분
ot.logs['2026-11-05'] = { end: '20:10' }
assert.equal(dayOvertime(ot, data, '2026-11-05').minutes, 30)
// 방과후 없는 날은 퇴근 기준시각(16:40)부터: 20:10 → 210 - 60 = 150
ot.logs['2026-11-04'] = { end: '20:10' }
assert.equal(dayOvertime(ot, data, '2026-11-04').minutes, 150)
// 1일 4시간 상한은 2026.10.1.부터 폐지: 화요일(방과후 18:40 끝) 23:50 퇴근 → 310 - 60 = 250 (4시간 넘어도 인정)
ot.logs['2026-11-10'] = { end: '23:50' }
assert.equal(dayOvertime(ot, data, '2026-11-10').minutes, 250)
// 그 전(9월)에는 4시간까지
ot.logs['2026-09-29'] = { end: '23:50' }
assert.equal(dayOvertime(ot, data, '2026-09-29').minutes, 240)
// 공제보다 짧으면 0
ot.logs['2026-11-11'] = { end: '17:20' }
assert.equal(dayOvertime(ot, data, '2026-11-11').minutes, 0)
// 휴업일·뺀 날에는 방과후가 없다 → 빼 둔 날은 퇴근 기준시각부터 센다
assert.equal(dayOvertime(ot, data, '2026-11-26').plans.length, 0)
assert.equal(dayOvertime(ot, data, '2026-11-20').plans.length, 0)
// 주말 근무: 공제 없이 시작~끝, 최대 4시간
ot.logs['2026-11-07'] = { start: '10:00', end: '12:30' }
assert.equal(dayOvertime(ot, data, '2026-11-07').minutes, 150)
const m = monthOvertime(ot, data, 2026, 10, '2026-12-31')
assert.equal(m.total, 30 + 150 + 250 + 0 + 150)
assert.equal(m.hours, Math.floor(m.total / 60))
assert.equal(fmtMin(150), '2시간 30분')
assert.equal(fmtMin(50), '50분')
assert.equal(fmtMin(120), '2시간')

// 계획서 글자 읽기
const p1 = parsePlanText('강좌명: 수학 심화반\n운영 기간: 2026. 9. 1. ~ 2026. 12. 18.\n운영 요일: 화, 목\n운영 시간: 16:50 ~ 18:30 (8~9교시)', '2026-08-17')
assert.deepEqual(p1, { name: '수학 심화반', from: '16:50', to: '18:30', start: '2026-09-01', end: '2026-12-18', days: [2, 4], dates: [], dayTimes: {}, dateTimes: {} })
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
// 출석부 모양: 요일 없는 날짜 목록 + 날짜마다 다른 시간 + 요일별 시간
const att = '[붙임 1] 2026 학년도 면접대비반 방과후 프로그램 신청서 순번 교사 기간 (고정) 장소 진행 요일 및 시각 프로그램 명 비고 1 홍길동 9/29~11/11 본관 월 , 수 (15:40~17:40) 화 , 목 (16:40~18:40) 면접대비반\n' +
  '( 프로그램 명 : 면접대비반 ) 운영기간 : 2026 년 9 월 29 일 ~ 11 월 11 일 / 담당교사 : 홍길동\n' +
  '출석부 지도시간 15:40~17:40( 월 , 수 ) 16:40~18:40( 화 , 목 ) 연번 학번 성명 9/29 9/30 10/1 10/6 비고 16:40~ 18:40 15:40~ 17:40 16:40~ 18:40 16:40~ 18:40 1 2101 가나다\n' +
  '출석부 연번 학번 성명 11/2 11/3 11/4 비고 15:40~ 17:40 16:40~ 18:40 16:40~ 18:40 1 2101 가나다'
const pa = parsePlanText(att, '2026-08-17')
assert.equal(pa.name, '면접대비반')
assert.deepEqual([pa.start, pa.end, pa.days], ['2026-09-29', '2026-11-11', [1, 2, 3, 4]])
assert.deepEqual(pa.dates, ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-06', '2026-11-02', '2026-11-03', '2026-11-04'])
assert.deepEqual(pa.dateTimes['2026-09-30'], ['15:40', '17:40'])
assert.deepEqual(pa.dateTimes['2026-11-04'], ['16:40', '18:40']) // 수요일이지만 출석부대로
assert.deepEqual(pa.dayTimes[1], ['15:40', '17:40'])
// 날짜별 시간으로 초과근무: 수요일 9.30 방과후 17:40 끝, 19:40 퇴근 → 120 - 60 = 60
const o3 = defaultOvertime(); o3.plans = [{ id: 3, ...pa, skip: [] }]; o3.logs = { '2026-09-30': { end: '19:40' }, '2026-09-29': { end: '19:40' } }
assert.equal(dayOvertime(o3, { events: [] }, '2026-09-30').minutes, 60)
assert.equal(dayOvertime(o3, { events: [] }, '2026-09-29').minutes, 0) // 화 18:40 끝 → 60 - 60
// 수당·다음 인정 단위 — 하루 1시간 미만(17분)인 날은 더하지 않는다(업무지침)
const { allowance, monthOvertime: mo2, defaultOvertime: dot } = await import('../src/overtime.js')
const o2 = dot(); o2.cfg.rate = 12795; o2.cfg.deduct = 0
o2.logs = { '2026-11-02': { end: '19:08' }, '2026-11-03': { end: '16:57' } }
const mm = mo2(o2, { events: [] }, 2026, 10, '2026-11-05')
assert.deepEqual([mm.total, mm.hours, mm.leftover, mm.toNext], [148, 2, 28, 32])
const al = allowance(o2.cfg, mm, 0)
assert.deepEqual([al.perf, al.fixed], [25590, 0])
// 정액분: 15일 미만이면 모자라는 하루마다 1/15 감액 (12일 → 3/15 감액)
assert.equal(allowance(o2.cfg, mm, 12).fixed, Math.floor(127950 * 12 / 15))
assert.equal(allowance(o2.cfg, mm, 20).fixed, 127950)
assert.equal(allowance(o2.cfg, mm, 6).fixed, 51180)
// 방과후 날에 퇴근 기록이 없으면 초과근무 0 — 예정으로 더하는 시간도 없다
const mf = monthOvertime(ot, data, 2026, 10, '2026-11-05')
assert.equal(mf.planned, 0)
assert.equal(mf.total, 30 + 150 + 150 + 250 + 0)
// 호봉별 단가
const { rateByStep, effectiveRate } = await import('../src/overtime.js')
assert.deepEqual([rateByStep(8), rateByStep(19), rateByStep(20), rateByStep(29), rateByStep(30), rateByStep(40), rateByStep(0), rateByStep(25, 'vice')], [12795, 12795, 14213, 14213, 15258, 15258, 0, 16300])
assert.equal(effectiveRate({ step: 8, rate: 0 }), 12795)
assert.equal(effectiveRate({ step: 8, rate: 13000 }), 13000)
assert.equal(allowance({ step: 8, deduct: 0 }, mm, 0).perf, 25590)
// 휴일 근무는 1시간 이상인 날만
ot.logs['2026-11-14'] = { start: '10:00', end: '10:40' }
assert.equal(dayOvertime(ot, data, '2026-11-14').minutes, 0)
// 조기출근: 기준 08:40보다 1시간 이상 일찍(07:20 → 80분) + 퇴근 뒤와 합쳐 1시간 공제
ot.logs['2026-11-18'] = { arrive: '07:20', end: '17:40' }
assert.equal(dayOvertime(ot, data, '2026-11-18').minutes, 80 + 60 - 60)
// 1시간 미만 조기출근(08:00 → 40분)은 빼고 퇴근 뒤만: 17:40 → 60 - 60 = 0
ot.logs['2026-11-25'] = { arrive: '08:00', end: '17:40' }
assert.equal(dayOvertime(ot, data, '2026-11-25').minutes, 0)
// 조기출근만 1시간 30분 → 90 - 60 = 30
ot.logs['2026-11-27'] = { arrive: '07:10' }
assert.equal(dayOvertime(ot, data, '2026-11-27').minutes, 30)
// 정액분 근무일수: 방학(학기 밖)·휴업일·공휴일 빼기
const { workDaysIn } = await import('../src/overtime.js')
assert.equal(workDaysIn({ events: [], semStart: '2026-08-17', semEnd: '2026-12-31' }, 2026, 10), 21)
assert.equal(workDaysIn({ events: [{ id: 9, type: '휴업일', name: '재량휴업일', start: '2026-11-20', end: '2026-11-20' }], semStart: '2026-08-17', semEnd: '2026-11-13' }, 2026, 10), 10)
console.log('PASS: overtime rules (after-school class time excluded, deduct, cap, weekend, holiday, skip, logs), plan text parsing, HWPX text')
