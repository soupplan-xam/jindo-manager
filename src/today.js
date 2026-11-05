// 오늘 정보 — 현재 교시, 급식(나이스), 날씨·미세먼지(Open-Meteo, 키 없음).
// 급식·날씨는 하루(날씨는 30분) 동안 브라우저에 저장해 두고 다시 묻지 않는다.
import { NEIS_KEY } from './schools.js'

// ---- 교시 시각 ----
export const DEFAULT_BELLS = [
  ['09:00', '09:50'], ['10:00', '10:50'], ['11:00', '11:50'], ['12:00', '12:50'],
  ['13:50', '14:40'], ['14:50', '15:40'], ['15:50', '16:40'],
]
const mins = t => { const [h, m] = String(t || '').split(':').map(Number); return h * 60 + (m || 0) }

// 지금 상태: { kind: 'before' | 'class' | 'break' | 'after', period, next, left(분) }
export function periodNow(bells, date = new Date()) {
  const b = (bells && bells.length ? bells : DEFAULT_BELLS).map(([s, e], i) => ({ p: i + 1, s: mins(s), e: mins(e) })).filter(x => !isNaN(x.s) && !isNaN(x.e))
  const t = date.getHours() * 60 + date.getMinutes()
  if (!b.length || t < b[0].s) return { kind: 'before', period: null, next: b[0] ? b[0].p : null, left: b[0] ? b[0].s - t : null }
  for (let i = 0; i < b.length; i++) {
    if (t >= b[i].s && t < b[i].e) return { kind: 'class', period: b[i].p, next: b[i + 1] ? b[i + 1].p : null, left: b[i].e - t }
    if (b[i + 1] && t >= b[i].e && t < b[i + 1].s) return { kind: 'break', period: null, next: b[i + 1].p, left: b[i + 1].s - t }
  }
  return { kind: 'after', period: null, next: null, left: null }
}

// ---- 저장해 두고 쓰기 ----
function cached(key, maxMs) {
  try {
    const v = JSON.parse(localStorage.getItem('jindo.cache.' + key) || 'null')
    if (v && Date.now() - v.at < maxMs) return v.data
  } catch { /* 저장 공간 막힘 */ }
  return undefined
}
function keep(key, data) {
  try { localStorage.setItem('jindo.cache.' + key, JSON.stringify({ at: Date.now(), data })) } catch { /* 무시 */ }
}

// ---- 급식 ----
export const ALLERGY = ['', '난류', '우유', '메밀', '땅콩', '대두', '밀', '고등어', '게', '새우', '돼지고기', '복숭아', '토마토', '아황산류', '호두', '닭고기', '쇠고기', '오징어', '조개류', '잣']

export function parseDishes(raw) {
  return String(raw || '').split(/<br\s*\/?>/i).map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/\(([\d.\s]+)\)\s*$/)
    const allergy = m ? m[1].split('.').map(x => Number(x.trim())).filter(n => n > 0 && n < ALLERGY.length) : []
    const name = (m ? s.slice(0, m.index) : s).replace(/[*#]+$/g, '').trim()
    return { name, allergy }
  })
}

// [{ meal: '중식', dishes: [{name, allergy}], cal: '812.3 Kcal' }]
export async function fetchMeal(school, iso) {
  if (!school || !school.code || !school.region) return null
  const ymd = iso.replace(/-/g, '')
  const key = 'meal.' + school.code + '.' + ymd
  const hit = cached(key, 12 * 3600000)
  if (hit !== undefined) return hit
  const qs = new URLSearchParams({ KEY: NEIS_KEY, Type: 'json', ATPT_OFCDC_SC_CODE: school.region, SD_SCHUL_CODE: school.code, MLSV_YMD: ymd })
  const res = await fetch('https://open.neis.go.kr/hub/mealServiceDietInfo?' + qs)
  if (!res.ok) throw new Error('급식 정보를 받지 못했습니다 (HTTP ' + res.status + ')')
  const json = await res.json()
  const block = json.mealServiceDietInfo
  const rows = block ? (block.find(b => Array.isArray(b.row)) || {}).row || [] : []
  const out = rows.map(r => ({ meal: r.MMEAL_SC_NM, dishes: parseDishes(r.DDISH_NM), cal: r.CAL_INFO || '' }))
  keep(key, out)
  return out
}

// ---- 날씨 · 미세먼지 ----
// 학교가 있는 시·도청 소재지 좌표(교육청 코드 기준). 설정에서 현재 위치로 바꿀 수 있다.
export const REGION_COORD = {
  B10: ['서울', 37.5665, 126.978], C10: ['부산', 35.1796, 129.0756], D10: ['대구', 35.8714, 128.6014], E10: ['인천', 37.4563, 126.7052],
  F10: ['광주', 35.1595, 126.8526], G10: ['대전', 36.3504, 127.3845], H10: ['울산', 35.5384, 129.3114], I10: ['세종', 36.48, 127.289],
  J10: ['경기(수원)', 37.2636, 127.0286], K10: ['강원(춘천)', 37.8813, 127.7298], M10: ['충북(청주)', 36.6424, 127.489], N10: ['충남(천안)', 36.8151, 127.1139],
  P10: ['전북(전주)', 35.8242, 127.148], Q10: ['전남(무안)', 34.8118, 126.392], R10: ['경북(안동)', 36.5684, 128.7294], S10: ['경남(창원)', 35.2279, 128.6811],
  T10: ['제주', 33.4996, 126.5312],
}
export function weatherPlace(data) {
  if (data.weatherLoc && data.weatherLoc.lat) return data.weatherLoc
  const r = data.school && REGION_COORD[data.school.region]
  return r ? { name: r[0], lat: r[1], lon: r[2] } : null
}

export function weatherText(code) {
  if (code === 0) return '맑음'
  if (code <= 2) return '구름 조금'
  if (code === 3) return '흐림'
  if (code === 45 || code === 48) return '안개'
  if (code >= 51 && code <= 57) return '이슬비'
  if (code >= 61 && code <= 67) return '비'
  if (code >= 71 && code <= 77) return '눈'
  if (code >= 80 && code <= 82) return '소나기'
  if (code === 85 || code === 86) return '눈'
  if (code >= 95) return '뇌우'
  return ''
}
// 한국 환경부 기준 등급
export function dustGrade(kind, v) {
  if (v == null || isNaN(v)) return null
  const cut = kind === 'pm25' ? [15, 35, 75] : [30, 80, 150]
  const i = v <= cut[0] ? 0 : v <= cut[1] ? 1 : v <= cut[2] ? 2 : 3
  return { label: ['좋음', '보통', '나쁨', '매우나쁨'][i], level: i }
}

// { temp, code, text, max, min, rain(강수확률%), pm10, pm25 }
export async function fetchWeather(place) {
  if (!place) return null
  const key = 'wx.' + place.lat.toFixed(2) + ',' + place.lon.toFixed(2)
  const hit = cached(key, 30 * 60000)
  if (hit !== undefined) return hit
  const w = new URLSearchParams({
    latitude: place.lat, longitude: place.lon, timezone: 'Asia/Seoul', forecast_days: 1,
    current: 'temperature_2m,weather_code', daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  })
  const a = new URLSearchParams({ latitude: place.lat, longitude: place.lon, timezone: 'Asia/Seoul', current: 'pm10,pm2_5' })
  const [wr, ar] = await Promise.all([
    fetch('https://api.open-meteo.com/v1/forecast?' + w),
    fetch('https://air-quality-api.open-meteo.com/v1/air-quality?' + a).catch(() => null),
  ])
  if (!wr.ok) throw new Error('날씨를 받지 못했습니다 (HTTP ' + wr.status + ')')
  const wj = await wr.json()
  const aj = ar && ar.ok ? await ar.json() : null
  const out = {
    temp: wj.current ? Math.round(wj.current.temperature_2m) : null,
    code: wj.current ? wj.current.weather_code : null,
    max: wj.daily ? Math.round(wj.daily.temperature_2m_max[0]) : null,
    min: wj.daily ? Math.round(wj.daily.temperature_2m_min[0]) : null,
    rain: wj.daily && wj.daily.precipitation_probability_max ? wj.daily.precipitation_probability_max[0] : null,
    pm10: aj && aj.current ? Math.round(aj.current.pm10) : null,
    pm25: aj && aj.current ? Math.round(aj.current.pm2_5) : null,
  }
  out.text = weatherText(out.code)
  keep(key, out)
  return out
}
