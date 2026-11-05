// 담임 — 출결 안내 메시지 만들기.
// 학교·반·담임 이름과 문구 틀은 설정에 저장하고, 학생 이름·날짜·사유·출결 종류는 보낼 때마다 고른다.
// 학생 이름과 사유는 저장하지 않는다(학부모에게 보낼 문장만 만들어 복사한다).
import { fromISO } from './logic.js'

export const REASONS = ['질병', '인정', '기타']
export const KINDS = ['지각', '조퇴', '결석', '결과']

export const DEFAULT_DOCS = {
  질병: '질병의 경우 병원처방전 또는 투약봉지로 증빙서류 제출',
  인정: '출석인정의 경우 학부모의견서 양식에 내용 작성 및 서명하신 후 서류 제출',
}

export const DEFAULT_TEMPLATE = `안녕하세요~ {학교} {반} 담임교사 {담임}입니다.
{날짜}자 {이름} 학생 {사유} {출결} 관련 안내드립니다.
나이스 학부모 서비스 통해서 지각·조퇴·결석·결과 신고 및 증빙 서류 제출하실 수 있습니다.

{서류안내}

5일내 서류 미제출 시 미인정 처리됩니다. 당일 제출할 수 있도록 신경써 주시기 바랍니다.

감사합니다.`

export const defaultHomeroom = () => ({ school: '', cls: '', teacher: '', template: DEFAULT_TEMPLATE, docs: { ...DEFAULT_DOCS } })

// 11월 5일 / 11월 5일~7일 / 11월 30일~12월 2일
export function dateText(start, end) {
  if (!start) return ''
  const a = fromISO(start)
  const left = a.getMonth() + 1 + '월 ' + a.getDate() + '일'
  if (!end || end === start) return left
  const b = fromISO(end)
  return left + '~' + (b.getMonth() === a.getMonth() ? '' : b.getMonth() + 1 + '월 ') + b.getDate() + '일'
}

// 사유에 맞춰 처음 켜 둘 서류 안내
export const docsFor = reason => ({ 질병: reason === '질병', 인정: reason === '인정' })

// form: { start, end, name, reason, kind, docs: { 질병: bool, 인정: bool } }
export function buildMessage(hr, form) {
  const docs = { ...DEFAULT_DOCS, ...(hr.docs || {}) }
  const lines = ['질병', '인정'].filter(k => form.docs && form.docs[k]).map(k => docs[k]).filter(Boolean)
  const docText = lines.length ? lines.join(', ') + ' 하시면 됩니다.' : ''
  const fill = {
    학교: hr.school || '', 반: hr.cls || '', 담임: hr.teacher || '',
    날짜: dateText(form.start, form.end), 이름: form.name || '', 사유: form.reason || '', 출결: form.kind || '',
    서류안내: docText,
  }
  let out = (hr.template || DEFAULT_TEMPLATE).replace(/\{(학교|반|담임|날짜|이름|사유|출결|서류안내)\}/g, (_, k) => fill[k])
  // 비어 버린 줄 정리: 서류 안내가 없으면 그 문단을 없애고, 낱말 사이 겹친 빈칸을 하나로
  out = out.split('\n').map(l => l.replace(/ {2,}/g, ' ').replace(/\s+$/, '')).join('\n')
  out = out.replace(/\n{3,}/g, '\n\n').trim()
  return out
}
