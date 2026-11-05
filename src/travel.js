// 출장 여비 — 「공무원 여비 규정」 기준 계산 (참고용, 학교 예산·방침에 따라 부지급·감액될 수 있다).
// - 근무지 내 출장(제18조): 출장 시간 4시간 이상 2만원, 4시간 미만 1만원. 공용차량을 쓰면 1만원 감액.
// - 근무지 외 출장: 운임(실비) + 일비 + 식비 + 숙박비(상한 안 실비). 공용차량을 쓰면 일비 절반.
//   일비·식비·숙박비 상한은 개정될 수 있어 설정에서 고친다.
import { fromISO } from './logic.js'
import { toMin } from './overtime.js'

export const DEFAULT_TRAVEL = {
  inLong: 20000, inShort: 10000, carCut: 10000,
  daily: 25000, meal: 25000,
  lodging: { seoul: 100000, metro: 80000, etc: 70000 },
}
export const REGION_LABEL = { seoul: '서울', metro: '광역시', etc: '그 밖의 지역' }

// trip: { id, date, endDate?, kind: 'in' | 'out', start, end, place, purpose, car(공용차량), unpaid(여비 부지급),
//         fare(운임 원), lodgingCost(숙박 실비 원), region, note }
export function tripDays(t) {
  if (t.kind !== 'out' || !t.endDate || t.endDate < t.date) return 1
  return Math.round((fromISO(t.endDate) - fromISO(t.date)) / 86400000) + 1
}

export function tripCost(t, cfg0) {
  const cfg = { ...DEFAULT_TRAVEL, ...(cfg0 || {}), lodging: { ...DEFAULT_TRAVEL.lodging, ...((cfg0 || {}).lodging || {}) } }
  if (t.kind !== 'out') {
    const s = toMin(t.start), e = toMin(t.end)
    const mins = s != null && e != null && e > s ? e - s : 0
    const base = mins >= 240 ? cfg.inLong : cfg.inShort
    const amount = t.unpaid ? 0 : Math.max(0, base - (t.car ? cfg.carCut : 0))
    return { kind: 'in', minutes: mins, base, amount, lines: t.unpaid ? [['여비 부지급', 0]] : [[mins >= 240 ? '4시간 이상' : '4시간 미만', base], ...(t.car ? [['공용차량 감액', -cfg.carCut]] : [])] }
  }
  const days = tripDays(t)
  const nights = days - 1
  const daily = (t.car ? Math.floor(cfg.daily / 2) : cfg.daily) * days
  const meal = cfg.meal * days
  const fare = Math.max(0, Math.round(Number(t.fare) || 0))
  const cap = (cfg.lodging[t.region || 'etc'] || 0) * nights
  const lodging = Math.min(Math.max(0, Math.round(Number(t.lodgingCost) || 0)), cap)
  const lines = [['운임(실비)', fare], ['일비 ' + days + '일' + (t.car ? '(공용차량 절반)' : ''), daily], ['식비 ' + days + '일', meal]]
  if (nights > 0) lines.push(['숙박 ' + nights + '박(상한 ' + cap.toLocaleString('ko-KR') + '원)', lodging])
  const amount = t.unpaid ? 0 : fare + daily + meal + lodging
  return { kind: 'out', days, nights, amount, lines: t.unpaid ? [['여비 부지급', 0]] : lines }
}

export function monthTrips(trips, y, m) {
  const key = y + '-' + String(m + 1).padStart(2, '0')
  const list = (trips || []).filter(t => (t.date || '').startsWith(key)).sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')))
  return list
}
