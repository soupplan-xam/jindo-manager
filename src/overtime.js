// 초과근무(초근) — 방과후 계획 + 직접 기록으로 날마다 초과근무 시간을 계산한다.
// 규칙(설정에서 바꿈): 평일은 퇴근 시각 뒤부터 세고 공제(기본 60분)를 뺀 뒤 하루 최대(기본 240분)까지.
// 주말·공휴일·휴업일은 시작~끝을 그대로 세고(공제 없음) 하루 최대까지. 월 합계는 분까지 더한 뒤 시간 미만을 버린다.
import { fromISO, toISO } from './logic.js'
import { holidayOn } from './kcal.js'
import { parseDateText } from './dateText.js'

export const DEFAULT_OT = { offTime: '16:40', deduct: 60, dailyMax: 240 }
export const defaultOvertime = () => ({ cfg: { ...DEFAULT_OT }, plans: [], logs: {} })

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
export function dayOvertime(ot, data, iso) {
  const cfg = { ...DEFAULT_OT, ...(ot.cfg || {}) }
  const log = (ot.logs || {})[iso] || null
  const off = isOffDay(data, iso)
  const ps = plansOn(ot, data, iso)
  if (off) {
    const s = log ? toMin(log.start) : null
    const e = log ? toMin(log.end) : null
    const raw = s != null && e != null && e > s ? e - s : 0
    return { iso, off, plans: ps, start: s, end: e, raw, minutes: Math.min(raw, cfg.dailyMax), source: log ? 'log' : null, note: log && log.note }
  }
  const planEnd = ps.length ? Math.max(...ps.map(x => toMin(x.to) || 0)) : null
  const end = log && toMin(log.end) != null ? toMin(log.end) : planEnd
  const offT = toMin(cfg.offTime)
  const raw = end != null && offT != null ? Math.max(0, end - offT) : 0
  const minutes = Math.min(Math.max(0, raw - cfg.deduct), cfg.dailyMax)
  return { iso, off, plans: ps, start: null, end, raw, minutes, source: log && log.end ? 'log' : ps.length ? 'plan' : null, note: log && log.note }
}

// 한 달 — 기록이나 방과후가 있는 날만
export function monthOvertime(ot, data, y, m) {
  const days = []
  const last = new Date(y, m + 1, 0).getDate()
  for (let d = 1; d <= last; d++) {
    const iso = toISO(new Date(y, m, d))
    const r = dayOvertime(ot, data, iso)
    if (r.source || r.plans.length) days.push(r)
  }
  const total = days.reduce((a, r) => a + r.minutes, 0)
  return { days, total, hours: Math.floor(total / 60) }
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
