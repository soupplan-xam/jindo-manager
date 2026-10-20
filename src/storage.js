import { compute, subjectOf } from './logic.js'

const KEY = 'jindo.data.v1'

export const defaultData = () => ({
  setupDone: false,
  semStart: '',
  semEnd: '',
  classes: [],
  pattern: {}, // {'dow-period': '2-1'}  dow: 1(월)~5(금), period: 1~7
  colors: {}, // {'2-1': '#D5E7DC'} 반별 색 (없으면 과목 색 → 순번 기본색)
  subjectColors: {}, // {'수학': '#D5E7DC'} 과목 색 — 그 과목 반들이 함께 쓴다
  subjects: ['수학'], // 차시별 내용 과목 탭
  clsSubject: {}, // {'2-1': '수학'} 반→과목 (없으면 첫 과목)
  contents: {}, // {'수학': {'1': '집합의 뜻', ...}} 과목별 차시 내용
  events: [], // {id, start, end, name, type: '휴업일'|'행사'|'고사'|'개인', period?, cls?}
  cancels: {}, // {'iso|p': {reason}}
  extras: {}, // {'iso|p': '2-1'} 그 날 그 교시에 실제로 한 수업 — 빈 칸이면 보강, 있던 칸이면 교체
  memos: {}, // 구버전 칸별 메모 — 로드 시 contents로 이관됨
  cfg: {
    examReset: false,
    examId: null, // 차시 초기화 기준
    targetExamId: null, // 자동: 초기화 이후 다음 고사, semester: 학기 말
    anim: true,
    dash: { today: true, progress: true, exam: true }, // 대시보드에 띄울 항목
    printScale: 'l', // 인쇄 크기: s(A4의 1/4) · m(1/2) · l(1)
    printWeeks: 1, // 인쇄 범위: 1(이번 주) · 2(2주치 — 다음 주까지, 크게는 못 고른다)
    fontScale: 1, // 화면 글씨 크기 배율
    minimal: false, // 미니멀 모드: 제목·설명을 걷어내고 필요한 것만
  },
  ui: {
    dashOpen: true,
    contentsOpen: true,
    splitPct: 62,
    dashW: { today: 26, progress: 60, exam: 14 }, // 대시보드 카드 너비 비율(%)
    schedView: null, // 일정: list | cal (null이면 미니멀은 달력, 일반은 목록)
    contentsView: 'list', // 차시별 내용: list | cal
  },
  introSeen: false,
  schedIntroSeen: false, // 학사일정 검색 안내 모달 — 처음 한 번만 뜬다
})

// 저장본에 없는 필드는 기본값으로 채운다 — 예전 버전 파일도 그대로 열린다.
function normalize(d) {
  const base = defaultData()
  const out = {
    ...base,
    ...d,
    cfg: { ...base.cfg, ...(d.cfg || {}), dash: { ...base.cfg.dash, ...((d.cfg || {}).dash || {}) } },
    ui: { ...base.ui, ...(d.ui || {}), dashW: { ...base.ui.dashW, ...((d.ui || {}).dashW || {}) } },
  }
  if (!Array.isArray(out.subjects) || !out.subjects.length) out.subjects = ['수학']
  return migrateMemos(out)
}

// 구버전 칸별 메모(iso|p)를 (반의 과목, 차시번호)의 차시별 내용으로 이관.
function migrateMemos(d) {
  const keys = Object.keys(d.memos || {})
  if (!keys.length) return d
  if (d.semStart && d.semEnd) {
    const { sessions } = compute(d)
    const contents = JSON.parse(JSON.stringify(d.contents || {}))
    for (const k of keys) {
      const s = sessions[k]
      if (!s || s.canceled || !s.num) continue
      const subj = subjectOf(d, s.cls)
      if (!subj) continue
      contents[subj] = contents[subj] || {}
      if (!contents[subj][s.num]) contents[subj][s.num] = d.memos[k]
    }
    return { ...d, contents, memos: {} }
  }
  return { ...d, memos: {} }
}

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultData()
    return normalize(JSON.parse(raw))
  } catch {
    return defaultData()
  }
}

export function saveData(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

// 전체 데이터를 파일로 내보낸다. API 키는 담지 않는다 — 파일을 주고받아도 키가 새지 않도록.
export function exportJSON(data, today) {
  const payload = { app: 'jindo-manager', version: 1, savedAt: today, data }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
  a.download = '진도계획표-' + today + '.json'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000) // 즉시 해제하면 다운로드가 취소될 수 있다
}

// 내보낸 파일({app,version,data})과 data 객체만 담긴 파일 둘 다 받는다
export function coerceData(parsed) {
  const d = parsed && parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed
  if (!d || typeof d !== 'object' || !Array.isArray(d.classes) || typeof d.pattern !== 'object') {
    throw new Error('진도매니저 데이터 파일이 아닙니다.')
  }
  return normalize(d)
}

export async function importJSON(file) {
  let parsed
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('JSON 파일을 읽을 수 없습니다.')
  }
  return coerceData(parsed)
}

export const getApiKey = () => localStorage.getItem('jindo.apiKey') || ''
export const setApiKey = v => localStorage.setItem('jindo.apiKey', v)
export const getModel = () => localStorage.getItem('jindo.model') || 'google/gemini-2.5-flash'
export const setModel = v => localStorage.setItem('jindo.model', v)
