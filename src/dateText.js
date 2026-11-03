// 날짜 칸에 손으로 친 글자를 날짜로 바꾼다.
// 연·월·일 칸을 따로 옮겨 다니지 않고 "10.12", "10/12", "1012", "2026-10-12", "10월 12일"처럼 한 번에 친다.
// 연도를 생략하면 기준일(ref)에서 가장 가까운 해로 잡는다 — 2학기에 "1.8"을 치면 이듬해 1월 8일이 된다.
import { DAYS, fromISO, toISO } from './logic.js'

const pad = n => String(n).padStart(2, '0')

function valid(y, m, d) {
  if (!(y >= 1900 && y <= 2999 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return y + '-' + pad(m) + '-' + pad(d)
}

// 연도 없는 월·일 → 기준일 앞뒤 반년 안의 해
function nearestYear(m, d, ref) {
  const r = fromISO(ref)
  let best = null
  for (const y of [r.getFullYear() - 1, r.getFullYear(), r.getFullYear() + 1]) {
    const iso = valid(y, m, d)
    if (!iso) continue
    const gap = Math.abs(fromISO(iso) - r)
    if (!best || gap < best.gap) best = { iso, gap }
  }
  return best ? best.iso : null
}

export function parseDateText(text, ref) {
  const refISO = ref || toISO(new Date())
  let s = String(text || '').trim()
  if (!s) return null
  if (s === '오늘') return toISO(new Date())
  s = s
    .replace(/\([^)]*\)/g, ' ') // "(월)" 같은 요일 표기
    .replace(/[일월화수목금토]요일/g, ' ')
    .replace(/[화수목금토]/g, ' ')
    .replace(/[년월]/g, '.')
    .replace(/일/g, ' ')
    .replace(/[\s./\-·,]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
  if (!/^[\d.]+$/.test(s)) return null
  const parts = s.split('.').filter(Boolean)
  const year = y => (y.length <= 2 ? 2000 + Number(y) : Number(y))

  if (parts.length === 3) return valid(year(parts[0]), Number(parts[1]), Number(parts[2]))
  if (parts.length === 2) return nearestYear(Number(parts[0]), Number(parts[1]), refISO)
  if (parts.length !== 1) return null

  const t = parts[0]
  if (t.length === 8) return valid(Number(t.slice(0, 4)), Number(t.slice(4, 6)), Number(t.slice(6)))
  if (t.length === 6) return valid(2000 + Number(t.slice(0, 2)), Number(t.slice(2, 4)), Number(t.slice(4)))
  if (t.length === 4) return nearestYear(Number(t.slice(0, 2)), Number(t.slice(2)), refISO)
  if (t.length === 3) return nearestYear(Number(t.slice(0, 1)), Number(t.slice(1)), refISO)
  if (t.length <= 2) {
    // 날짜만 치면 기준일이 있는 달의 그 날
    const r = fromISO(refISO)
    return valid(r.getFullYear(), r.getMonth() + 1, Number(t))
  }
  return null
}

// 칸에 보여 줄 모양: 2026.10.12 (월)
export function formatDateText(iso) {
  if (!iso) return ''
  const d = fromISO(iso)
  return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + ' (' + DAYS[d.getDay()] + ')'
}

// 시작일을 옮길 때 기간 길이를 그대로 두고 종료일도 함께 옮긴다
export function shiftRange(range, newStart) {
  if (!range.start || !range.end || range.end < range.start) return { start: newStart, end: newStart }
  const len = Math.round((fromISO(range.end) - fromISO(range.start)) / 86400000)
  const e = fromISO(newStart)
  e.setDate(e.getDate() + len)
  return { start: newStart, end: toISO(e) }
}
