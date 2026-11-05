import assert from 'node:assert/strict'
import { buildMessage, dateText, defaultHomeroom, docsFor } from '../src/homeroom.js'

const hr = { ...defaultHomeroom(), school: '한빛고등학교', cls: '1학년 3반', teacher: '김선생' }
const m = buildMessage(hr, { start: '2026-11-05', end: '2026-11-05', name: '홍길동', reason: '질병', kind: '조퇴', docs: docsFor('질병') })
assert.equal(m, `안녕하세요~ 한빛고등학교 1학년 3반 담임교사 김선생입니다.
11월 5일자 홍길동 학생 질병 조퇴 관련 안내드립니다.
나이스 학부모 서비스 통해서 지각·조퇴·결석·결과 신고 및 증빙 서류 제출하실 수 있습니다.

질병의 경우 병원처방전 또는 투약봉지로 증빙서류 제출 하시면 됩니다.

5일내 서류 미제출 시 미인정 처리됩니다. 당일 제출할 수 있도록 신경써 주시기 바랍니다.

감사합니다.`)

// 두 안내 모두 켜면 쉼표로 잇는다
const both = buildMessage(hr, { start: '2026-11-05', name: '홍길동', reason: '기타', kind: '결석', docs: { 질병: true, 인정: true } })
assert.ok(both.includes('투약봉지로 증빙서류 제출, 출석인정의 경우 학부모의견서 양식에 내용 작성 및 서명하신 후 서류 제출 하시면 됩니다.'))

// 안내를 모두 끄면 그 문단이 빠지고 빈 줄이 겹치지 않는다
const none = buildMessage(hr, { start: '2026-11-05', name: '홍길동', reason: '기타', kind: '지각', docs: docsFor('기타') })
assert.ok(!none.includes('하시면 됩니다'))
assert.ok(!/\n\n\n/.test(none))
assert.ok(none.includes('홍길동 학생 기타 지각 관련'))

assert.equal(dateText('2026-11-05', '2026-11-07'), '11월 5일~7일')
assert.equal(dateText('2026-11-30', '2026-12-02'), '11월 30일~12월 2일')
console.log('PASS: homeroom message template, document lines, blank paragraph cleanup, date ranges')
