// 초과근무(초근) — 방과후 계획 + 직접 기록으로 날마다 초과근무 시간을 계산한다.
// 규칙(설정에서 바꿈): 평일은 퇴근 기준시각 뒤부터 세고(1시간 이상 조기출근분 포함) 1시간 이상이면 공제(기본 60분).
// 방과후 수업 시간은 초과근무가 아니다 — 방과후 있는 날은 방과후가 끝나는 시각부터 실제 퇴근까지만 센다.
// 주말·공휴일·휴업일은 1시간 이상 근무한 날 시작~끝을 그대로 센다(공제 없음). 하루 4시간 상한은 2026. 10. 1. 전까지만.
// 월 합계는 분까지 더한 뒤 시간 미만을 버리고 월 57시간까지 인정한다.
import { fromISO, toISO } from './logic.js'
import { holidayOn } from './kcal.js'
import { parseDateText } from './dateText.js'

// step: 호봉, role: 'teacher' | 'vice'(교감), rate: 시간당 단가 직접 입력(0이면 호봉으로 자동)
// monthMax: 월 인정 상한(시간), fixedHours: 정액분 시간
export const DEFAULT_OT = { onTime: '08:40', offTime: '16:40', deduct: 60, dailyMax: 240, step: 0, role: 'teacher', rate: 0, monthMax: 57, fixedHours: 10 }

// 2026년 교원 시간외근무수당 시간당 단가(원) — 호봉 구간별. 공개 자료 기준(참고용), 해마다 고쳐야 한다.
export const RATE_YEAR = 2026
export const RATES = [
  { max: 19, rate: 12795, label: '19호봉 이하' },
  { max: 29, rate: 14213, label: '20~29호봉' },
  { max: 99, rate: 15258, label: '30호봉 이상' },
]
export const VICE_RATE = 16300
export function rateByStep(step, role) {
  if (role === 'vice') return VICE_RATE
  const n = Number(step)
  if (!n) return 0
  return (RATES.find(r => n <= r.max) || RATES[RATES.length - 1]).rate
}
// 실제로 쓰는 단가: 직접 넣은 값이 있으면 그것, 없으면 호봉으로
export const effectiveRate = cfg => Number(cfg.rate) || rateByStep(cfg.step, cfg.role)
export const defaultOvertime = () => ({ cfg: { ...DEFAULT_OT }, plans: [], logs: {}, workDays: {} })

export const toMin = t => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : null }
export const fmtMin = m => {
  if (m == null) return ''
  const h = Math.floor(m / 60), r = m % 60
  return h && r ? h + '시간 ' + r + '분' : h ? h + '시간' : r + '분'
}
export const fmtHM = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')

// 출근하지 않는 날(주말·공휴일·하루 전체 휴업일)
export function isOffDay(data, iso) {
  const dow = fromISO(iso).getDay()
  if (dow === 0 || dow === 6 || holidayOn(iso)) return true
  return (data.events || []).some(e => e.start <= iso && iso <= e.end && !e.period && !e.cls && e.type === '휴업일')
}

// 그 날 열리는 방과후 [{ plan, from, to }]
export function plansOn(ot, data, iso) {
  if (isOffDay(data, iso)) return []
  const dow = fromISO(iso).getDay()
  return (ot.plans || []).filter(p => {
    if ((p.skip || []).includes(iso)) return false
    if (p.dates && p.dates.length) return p.dates.includes(iso)
    return p.start <= iso && iso <= p.end && (p.days || []).includes(dow)
  }).map(p => ({ plan: p, from: p.from, to: p.to }))
}

// 하루 계산: { iso, off, plans, end(퇴근·끝 시각 분), start(주말), raw(공제 전 분), minutes(인정 분), source }
// 1일 상한(4시간)은 2026. 10. 1.부터 폐지(교육부 교원정책과-6655, 2026. 9. 30.) — 그 전 날짜에만 적용한다.
// 월 57시간 상한·평일 1시간 공제·정액분은 그대로.
export const DAILY_CAP_UNTIL = '2026-10-01'
export const dailyCapOn = (cfg, iso) => (iso < DAILY_CAP_UNTIL ? cfg.dailyMax : Infinity)

// 하루 계산 (「공무원보수 등의 업무지침」 시간외근무시간 산정)
// - 평일: 퇴근 기준시각 뒤(방과후 있는 날은 방과후 끝 뒤) + 1시간 이상 조기출근분을 더해, 1시간 이상이면 1시간 공제
// - 휴일·토요일: 공제 없이, 1시간 이상 근무한 날만
// - 하루 1시간 미만이면 0. 월 합계는 분까지 더한 뒤 1시간 미만 버림(monthOvertime)
export function dayOvertime(ot, data, iso) {
  const cfg = { ...DEFAULT_OT, ...(ot.cfg || {}) }
  const log = (ot.logs || {})[iso] || null
  const off = isOffDay(data, iso)
  const ps = plansOn(ot, data, iso)
  const cap = dailyCapOn(cfg, iso)
  if (off) {
    const s = log ? toMin(log.start) : null
    const e = log ? toMin(log.end) : null
    const raw = s != null && e != null && e > s ? e - s : 0
    const minutes = raw >= 60 ? Math.min(raw, cap) : 0
    return { iso, off, plans: ps, start: s, end: e, raw, early: 0, minutes, source: log ? 'log' : null, note: log && log.note }
  }
  const planEnd = ps.length ? Math.max(...ps.map(x => toMin(x.to) || 0)) : null
  const offT = toMin(cfg.offTime)
  const onT = toMin(cfg.onTime)
  // 세기 시작하는 시각: 방과후가 있으면 방과후 끝(그 전·수업 시간은 빼고), 없으면 퇴근 기준시각
  const from = planEnd != null ? Math.max(planEnd, offT ?? 0) : offT
  const end = log && toMin(log.end) != null ? toMin(log.end) : null
  const after = end != null && from != null ? Math.max(0, end - from) : 0
  // 조기출근: 출근 기준시각보다 1시간 이상 일찍 와서 일한 시간만 더한다
  const arrive = log ? toMin(log.arrive) : null
  const earlyRaw = arrive != null && onT != null ? Math.max(0, onT - arrive) : 0
  const early = earlyRaw >= 60 ? earlyRaw : 0
  const raw = after + early
  const minutes = raw >= 60 ? Math.min(Math.max(0, raw - cfg.deduct), cap) : 0
  return { iso, off, plans: ps, start: from, planEnd, end, after, early, earlyRaw, arrive, raw, minutes, source: log && (log.end || log.arrive) ? 'log' : ps.length ? 'plan' : null, note: log && log.note }
}

// 한 달 — 기록이나 방과후가 있는 날만.
// 합계·인정·다음 단위는 오늘까지(today) 기준, 오늘 뒤 방과후는 예정(planned)으로 따로 센다.
export function monthOvertime(ot, data, y, m, today = toISO(new Date())) {
  const days = []
  const last = new Date(y, m + 1, 0).getDate()
  for (let d = 1; d <= last; d++) {
    const iso = toISO(new Date(y, m, d))
    const r = dayOvertime(ot, data, iso)
    r.future = iso > today && r.source !== 'log'
    if (r.source || r.plans.length) days.push(r)
  }
  const total = days.filter(r => !r.future).reduce((a, r) => a + r.minutes, 0)
  const planned = days.filter(r => r.future).reduce((a, r) => a + r.minutes, 0)
  const cfg = { ...DEFAULT_OT, ...(ot.cfg || {}) }
  const whole = Math.floor(total / 60)
  const hours = Math.min(whole, cfg.monthMax)
  const capped = whole >= cfg.monthMax
  // 1시간 단위로 끊고 남은 분 — 아직 수당에 반영되지 않는다
  const leftover = capped ? 0 : total - whole * 60
  const projected = Math.min(Math.floor((total + planned) / 60), cfg.monthMax)
  return { days, total, hours, capped, leftover, toNext: leftover ? 60 - leftover : 0, planned, projected }
}

// 그 달 근무일(평일 중 공휴일·휴업일 아닌 날)
// 정액분 출근 근무일수 추정: 평일 중 공휴일·휴업일·방학(학기 기간 밖) 아닌 날.
// 방학은 근무일수에서 빠진다(근무명령으로 출근한 날은 직접 고쳐 넣는다).
export function workDaysIn(data, y, m) {
  let n = 0
  const last = new Date(y, m + 1, 0).getDate()
  for (let d = 1; d <= last; d++) {
    const iso = toISO(new Date(y, m, d))
    if (isOffDay(data, iso)) continue
    if (data.semStart && data.semEnd && (iso < data.semStart || iso > data.semEnd)) continue
    if ((data.events || []).some(e => e.start <= iso && iso <= e.end && !e.period && !e.cls && /방학/.test(e.name) && !/방학식/.test(e.name))) continue
    n++
  }
  return n
}

// 예상 수당: 실적분 = 인정 시간 × 단가, 정액분 = 정액 시간 × 단가(15일 이상 출근 시 전액, 미만은 출근일/15 비례)
export function allowance(cfg0, month, attend) {
  const cfg = { ...DEFAULT_OT, ...(cfg0 || {}) }
  const rate = effectiveRate(cfg)
  const perf = Math.floor(month.hours * rate)
  const fixed = attend == null ? 0 : Math.floor(rate * cfg.fixedHours * Math.min(1, attend / 15))
  return { rate, perf, fixed, total: perf + fixed, unpaid: Math.floor((month.leftover / 60) * rate) }
}

// ---- 계획서 읽기 ----
const WD = '일월화수목금토'

// 글자에서 방과후 일정 초안을 찾는다. 확실하지 않은 칸은 비워 두고 화면에서 고친다.
export function parsePlanText(text, ref) {
  const t = String(text || '').replace(/ /g, ' ')
  const out = { name: '', from: '', to: '', start: '', end: '', days: [], dates: [] }

  // 표에서는 이름표와 값이 다른 칸(| 로 나뉨)·다른 줄에 온다
  const nm = t.match(/(?:강좌명|프로그램명|과정명|강\s*좌)[\s:：|]*([^\n|]{2,40})/)
  if (nm) out.name = nm[1].trim().replace(/\s{2,}/g, ' ')

  // 시간: 14시 이후 시작하는 구간 중 가장 많이 나온 것
  const times = {}
  for (const m of t.matchAll(/(\d{1,2})\s*[:시]\s*(\d{2})\s*분?\s*[~\-–∼〜]\s*(\d{1,2})\s*[:시]\s*(\d{2})/g)) {
    const a = +m[1] * 60 + +m[2], b = +m[3] * 60 + +m[4]
    if (a >= 14 * 60 && b > a && b <= 23 * 60) {
      const k = fmtHM(a) + '~' + fmtHM(b)
      times[k] = (times[k] || 0) + 1
    }
  }
  const best = Object.entries(times).sort((x, y) => y[1] - x[1])[0]
  if (best) [out.from, out.to] = best[0].split('~')

  // 기간: 2026. 9. 1. ~ 2026. 12. 18.  /  9.1.~12.18.
  const pm = t.match(/((?:\d{4}\s*[.\-년]\s*)?\d{1,2}\s*[.\-월]\s*\d{1,2})\s*[.일]?\s*(?:\([월화수목금토일]\))?\s*[~\-–∼〜]\s*((?:\d{4}\s*[.\-년]\s*)?\d{1,2}\s*[.\-월]\s*\d{1,2})/)
  if (pm) {
    const s = parseDateText(pm[1], ref)
    const e = s && parseDateText(pm[2], s)
    if (s && e && e >= s) { out.start = s; out.end = e }
  }

  // 요일: 매주 월·수 / 운영 요일: 화, 목
  const dm = t.match(/(?:매주|운영\s*요일|요일)[\s:：|]*([월화수목금](?:\s*[,·、/및와과]\s*[월화수목금])*)/)
  if (dm) out.days = [...new Set(dm[1].match(/[월화수목금]/g).map(c => WD.indexOf(c)))].sort()

  // 날짜 목록: 9.2(화) 9/4(목) 9월 9일(화) — 셋 이상이면 날짜 목록으로 쓴다
  const dates = []
  for (const m of t.matchAll(/(\d{1,2})\s*[.\/월]\s*(\d{1,2})\s*[.일]?\s*\(\s*([월화수목금토일])\s*\)/g)) {
    const iso = parseDateText(m[1] + '.' + m[2], out.start || ref)
    if (iso && WD[fromISO(iso).getDay()] === m[3] && !dates.includes(iso)) dates.push(iso)
  }
  if (dates.length >= 3) {
    out.dates = dates.sort()
    if (!out.start) { out.start = out.dates[0]; out.end = out.dates[out.dates.length - 1] }
    if (!out.days.length) out.days = [...new Set(out.dates.map(d => fromISO(d).getDay()))].sort()
  }
  return out
}

// 파일 → 글자. HWPX(압축된 XML) · PDF · 텍스트. 예전 HWP는 읽지 못한다.
export async function fileText(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.hwp')) throw new Error('예전 한글(HWP) 파일은 읽을 수 없습니다. 한글에서 [다른 이름으로 저장] → HWPX나 PDF로 저장해서 올려 주세요.')
  if (name.endsWith('.hwpx')) {
    const { unzipSync, strFromU8 } = await import('fflate')
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()))
    const secs = Object.keys(files).filter(k => /contents\/section\d+\.xml$/i.test(k)).sort()
    if (!secs.length) throw new Error('HWPX 파일 안에서 본문을 찾지 못했습니다.')
    return secs.map(k => strFromU8(files[k])
      .replace(/<\/hp:p>/g, '\n').replace(/<\/hp:tc>/g, ' | ').replace(/<hp:lineBreak\/>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"'))
      .join('\n')
  }
  if (name.endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist')
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    let text = ''
    for (let i = 1; i <= Math.min(doc.numPages, 10); i++) {
      const tc = await (await doc.getPage(i)).getTextContent()
      text += tc.items.map(it => it.str).join(' ') + '\n'
    }
    if (!text.trim()) throw new Error('PDF에서 글자를 찾지 못했습니다(스캔한 PDF는 읽을 수 없습니다).')
    return text
  }
  return await file.text()
}
