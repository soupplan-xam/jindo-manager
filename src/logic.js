// 날짜 유틸과 차시 계산 로직.
// 원칙: 차시 번호는 저장하지 않는다. 시간표(pattern) + 일정(events) + 결손(cancels)에서 매번 파생 계산한다.

export const DAYS = '일월화수목금토'

// 색 팔레트 (30색). 검은 글씨가 얹힐 자리이므로 명도를 72% 아래로 내리지 않았다.
// 첫 줄은 서로 가장 잘 어울리는 추천 6색, 그 아래는 같은 6계열을 채도 4단계로 나눈 것.
// 6열 격자로 그리면 세로가 색상 계열, 가로가 밝기가 된다.
export const TINTS = [
  '#D5E7DC', '#CFE8E6', '#D3DFF2', '#E0D8EF', '#F0DBE8', '#F2E2C4', // 추천
  '#E0F0E8', '#E0EFF0', '#E0E8F0', '#E6E0F0', '#F0E0E5', '#F1EADF', // 아주 엷게
  '#CBE7D9', '#CBE6E7', '#CAD8E7', '#D5CAE7', '#E7CBD4', '#E9DCC8', // 엷게
  '#B2DCC7', '#B2DBDC', '#B1C5DD', '#C1B1DD', '#DCB2C0', '#E0CCAD', // 보통
  '#A1CEB8', '#A1CDCE', '#A0B6D0', '#B1A0D0', '#CEA1B0', '#D3BD9C', // 진하게
]

// 색을 고르지 않은 반에 순서대로 붙는 기본색 — 예전과 같게 두어 쓰던 색이 바뀌지 않는다.
// 이웃한 반끼리 계열이 겹치지 않도록 돌려 놓았다.
export const DEFAULT_TINTS = [
  '#D5E7DC', '#D3DFF2', '#F2E2C4', '#F0D9CF', '#E0D8EF', '#DFEBCB',
  '#F0DBE8', '#CFE8E6', '#EDE1CB', '#D8E3D8', '#E6DCEF', '#EFE6C9',
]

export const GREEN = '#0F5C4D'
export const INK = '#1A1A1A'
export const SUB = '#575757'
export const FAINT = '#8F8B86'
export const LINE = '#C9C5BE'
export const LINE_SOFT = '#E4E1DA'
export const WARN = '#B4552D'
export const RED = '#C2412D'

// 화면 구획 제목 (요약 · 차시별 내용 · 일정 …)
export const SECTION_TITLE = { fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: INK }

// 화면 컨트롤 버튼 공통 모양 (수정 · 인쇄 · 요약 · 차시별 내용)
export const CHIP_BTN = {
  display: 'flex', alignItems: 'center', gap: 5, border: '1px solid #CBDED7', borderRadius: 6,
  background: '#EAF1EE', color: GREEN, padding: '6px 12px', cursor: 'pointer',
  fontSize: 13, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap', flex: 'none',
}
// 꺼져 있을 때 (요약·차시별 내용 접힌 상태)
export const CHIP_BTN_OFF = { ...CHIP_BTN, border: '1px solid ' + LINE, background: '#FFFFFF', color: SUB }

// 인쇄 크기 — 한 주를 어느 지면에 조판할지. 2주치는 같은 덩어리를 한 번 더 쌓으므로 지면이 배로 든다.
// '크게'는 한 주만으로 A4 한 장을 다 쓰는 크기라 2주치에서는 고를 수 없다 (note에 2가 없다).
const PRINT_SIZES = [
  { k: 's', label: '작게', note: { 1: 'A4의 1/4', 2: 'A4의 1/2' } },
  { k: 'm', label: '중간', note: { 1: 'A4의 1/2', 2: 'A4 한 장' } },
  { k: 'l', label: '크게', note: { 1: 'A4 한 장' } },
]
// 그 범위에서 고를 수 있는 크기들 — 2주치면 '크게'가 빠져 무엇을 골라도 한 장에 담긴다.
export const printSizes = weeks => PRINT_SIZES.filter(x => x.note[weeks > 1 ? 2 : 1])
// 저장된 크기가 그 범위에 없으면(예전에 고른 '크게' + 2주치) 한 장에 담기는 쪽으로 내린다.
export const fitScale = (scale, weeks) => (weeks > 1 && scale === 'l' ? 'm' : scale)

export function toISO(d) {
  const p = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}
export function fromISO(s) {
  const a = s.split('-').map(Number)
  return new Date(a[0], a[1] - 1, a[2])
}
export function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
export function md(iso) {
  const d = fromISO(iso)
  return d.getMonth() + 1 + '.' + d.getDate()
}

// 반 색: 그 반에 따로 지정한 색 → 그 반이 듣는 과목의 색 → 순번 기본색
export function colorOf(data, cls) {
  if (data.colors && data.colors[cls]) return data.colors[cls]
  const sc = data.subjectColors && data.subjectColors[subjectOf(data, cls)]
  if (sc) return sc
  const i = data.classes.indexOf(cls)
  return i < 0 ? '#FFFFFF' : DEFAULT_TINTS[i % DEFAULT_TINTS.length]
}

// 반의 과목: 지정 없으면 첫 과목
export function subjectOf(data, cls) {
  return (data.clsSubject && data.clsSubject[cls]) || (data.subjects && data.subjects[0]) || ''
}

// 기준 고사: 설정에서 고른 고사, 없으면 시작일이 가장 이른 '고사' 일정
export function pickExam(data) {
  const exams = data.events.filter(e => e.type === '고사').slice().sort((a, b) => (a.start < b.start ? -1 : 1))
  if (data.cfg.examId != null) {
    const found = exams.find(e => e.id === data.cfg.examId)
    if (found) return found
  }
  return exams[0] || null
}

export function pickTargetExam(data) {
  const exams = data.events.filter(e => e.type === '고사').slice().sort((a,b) => a.start.localeCompare(b.start))
  if (data.cfg.targetExamId === 'semester') return null
  const selected = exams.find(e => String(e.id) === String(data.cfg.targetExamId))
  if (selected) return selected
  const reset = data.cfg.examReset ? pickExam(data) : null
  return exams.find(e => !reset || e.start > reset.end) || null
}

export function progressFor(data, computed, cls, today) {
  const reset = data.cfg.examReset ? pickExam(data) : null
  const target = computed.exam
  const afterReset = reset && (!target || target.start > reset.end)
  const list = (computed.perClass[cls] || []).filter(x =>
    (!afterReset || x.iso > reset.end) && (!target || x.iso < target.start))
  const current = list.filter(x => x.iso <= today).length
  return { current, total: list.length, remaining: list.length - current }
}

function eventsOn(data, iso) {
  // 개인 일정(출장 등)도 수업이 빠지는 건 같으므로 모든 유형을 결손으로 본다
  return data.events.filter(e => e.start <= iso && iso <= e.end)
}

function cancelEventFor(data, iso, p, cls) {
  return eventsOn(data, iso).find(e => (!e.period || e.period === p) && (!e.cls || e.cls === cls))
}

// 학기 전체를 훑으며 각 (날짜|교시) 칸의 상태를 계산한다.
// sessions[iso|p] = {cls, num, extra?} | {cls, canceled, reason, user?}
// perClass[cls] = [{iso, p, num}...] (결손 제외, 순서대로)
export function compute(data) {
  const resetExam = pickExam(data)
  const exam = pickTargetExam(data)
  const sessions = {}
  const perClass = {}
  const counters = {}
  let d = fromISO(data.semStart)
  const end = fromISO(data.semEnd)
  while (d <= end) {
    const dow = d.getDay()
    if (dow >= 1 && dow <= 5) {
      const iso = toISO(d)
      for (let p = 1; p <= 7; p++) {
        const key = iso + '|' + p
        // 그 날만의 손질이 있으면 시간표보다 그것이 우선한다.
        // 값이 반 이름이면 그 수업을 넣고, 빈 문자열이면 그 날은 이 칸을 비운다.
        const extras = data.extras || {}
        const swap = Object.prototype.hasOwnProperty.call(extras, key) ? extras[key] : null
        const cls = swap === null ? data.pattern[dow + '-' + p] : swap
        if (!cls) continue
        const ev = cancelEventFor(data, iso, p, cls)
        if (ev) {
          sessions[key] = { cls, canceled: true, reason: ev.name, extra: !!swap }
          continue
        }
        const uc = data.cancels[key]
        if (uc) {
          // 수행평가도 차시를 소모하지 않는다 — 다만 결손이 아니라 수행평가로 표시된다
          const perf = uc.kind === 'perf'
          sessions[key] = { cls, canceled: true, user: true, perf, extra: !!swap, reason: uc.reason || (perf ? '수행평가' : '결손') }
          continue
        }
        const sec = data.cfg.examReset && resetExam && iso > resetExam.end ? 1 : 0
        const ck = sec + '|' + cls
        counters[ck] = (counters[ck] || 0) + 1
        const num = counters[ck]
        sessions[key] = { cls, num, extra: !!swap }
        ;(perClass[cls] = perClass[cls] || []).push({ iso, p, num })
      }
    }
    d = addDays(d, 1)
  }
  return { sessions, perClass, exam }
}

// 목표차시는 따로 설정하지 않는다 — 지금 구간(고사 리셋 반영)의 마지막 차시가 곧 목표.
export function sectionTarget(list, today) {
  if (!list || !list.length) return 0
  let i = -1
  for (let j = 0; j < list.length; j++) if (list[j].iso <= today) i = j
  let j = Math.max(i, 0)
  while (j + 1 < list.length && list[j + 1].num > list[j].num) j++
  return list[j].num
}

// 흩어진 날짜들을 연속 구간으로 묶는다 (17,18,19 → 17~19 한 건)
export function mergeDates(isoList) {
  const sorted = [...new Set(isoList)].sort()
  const out = []
  for (const iso of sorted) {
    const last = out[out.length - 1]
    if (last && toISO(addDays(fromISO(last.end), 1)) === iso) last.end = iso
    else out.push({ start: iso, end: iso })
  }
  return out
}

export function exportCSV(sessions) {
  const lines = [['date', 'period', 'class', 'session'].join(',')]
  Object.keys(sessions)
    .sort()
    .forEach(k => {
      const kv = k.split('|')
      const s = sessions[k]
      lines.push([kv[0], kv[1], s.cls, s.canceled ? '결손' : s.num].join(','))
    })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' }))
  a.download = '진도.csv'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}
